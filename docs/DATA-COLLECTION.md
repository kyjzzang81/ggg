# 날씨 데이터 수집 현황

## 개요

| 항목 | 내용 |
|---|---|
| 수집 기간 | 1940-01-01 ~ 2025-12-31 (86년) |
| 수집 변수 | 11개 (시간별) |
| 대상 도시 | 138개 |
| 데이터 소스 | [Open-Meteo Historical Weather API](https://open-meteo.com/) |
| 저장소 | Supabase DB (`hourly_weather` 테이블) |

## 수집 변수

| 변수 | DB 컬럼 | 단위 | 타입 |
|---|---|---|---|
| 기온 | `temperature` | °C | REAL |
| 체감온도 | `apparent_temp` | °C | REAL |
| 습도 | `humidity` | % | SMALLINT |
| 강수량 | `precipitation` | mm | REAL |
| 비 | `rain` | mm | REAL |
| 눈 | `snowfall` | cm | REAL |
| 날씨코드 | `weather_code` | WMO (0-99) | SMALLINT |
| 구름 | `cloud_cover` | % | SMALLINT |
| 풍속 | `wind_speed` | km/h | REAL |
| 풍향 | `wind_direction` | ° (0-360) | SMALLINT |
| 돌풍 | `wind_gusts` | km/h | REAL |

## Open-Meteo API 한도 (무료 플랜)

| 항목 | 한도 |
|---|---|
| 분당 | 600 calls |
| 시간당 | 5,000 calls |
| **일당** | **10,000 calls** |
| 월간 | 300,000 calls |

### API Call 계산 방식

> 변수 10개 초과 + 기간 2주 초과 → 복수 call로 계산
>
> 86년 × 11변수 요청 ≈ **약 286 calls/도시**

| 기준 | 계산 |
|---|---|
| 도시당 소비 | ~286 calls |
| 하루 최대 도시 수 | 10,000 ÷ 286 = **약 34개** |
| 전체 138개 완료 | **4일 소요** |

## 수집 일정

| 일차 | 날짜 | 대상 도시 | 상태 |
|---|---|---|---|
| 1일차 | - | 도시 1 ~ 34번 | ⏳ 대기 |
| 2일차 | - | 도시 35 ~ 68번 | ⏳ 대기 |
| 3일차 | - | 도시 69 ~ 102번 | ⏳ 대기 |
| 4일차 | - | 도시 103 ~ 138번 | ⏳ 대기 |

## 수집 방법

### 1. 사전 준비

```bash
# .env 파일에 Supabase 자격증명 입력
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Supabase 테이블 생성

Supabase 대시보드 → SQL Editor → `supabase/schema.sql` 내용 붙여넣고 실행

### 3. 수집 실행

```bash
# 오늘치 한도만큼 수집 (34개)
.venv/bin/python scripts/collect_hourly_to_supabase.py --limit 34

# 특정 도시만 수집
.venv/bin/python scripts/collect_hourly_to_supabase.py --cities seoul tokyo paris

# 지난번 실패한 도시만 재수집 (collection_log 기준)
.venv/bin/python scripts/collect_hourly_to_supabase.py --failed-only

# 속도 올리기: 배치 크기·대기 조절 (502 나면 --batch-size 100으로)
.venv/bin/python scripts/collect_hourly_to_supabase.py --batch-size 200 --batch-delay 0.1 --delay 3

# 병렬 실행 (터미널 2개): 1~97번 / 98~194번 나눠서
.venv/bin/python scripts/collect_hourly_to_supabase.py --limit 97 --delay 3
.venv/bin/python scripts/collect_hourly_to_supabase.py --skip 97 --delay 3

# 전체 수집 (이미 완료된 도시 자동 건너뜀)
.venv/bin/python scripts/collect_hourly_to_supabase.py
```

### 4. 수집 현황 확인 (Supabase SQL)

```sql
-- 전체 현황
SELECT status, COUNT(*) FROM collection_log
GROUP BY status;

-- 완료된 도시 목록
SELECT c.name_ko, c.name_en, cl.total_hours, cl.collected_at
FROM collection_log cl
JOIN cities c ON c.id = cl.city_id
WHERE cl.status = 'completed'
ORDER BY cl.collected_at;

-- 실패한 도시 목록
SELECT city_id, error_msg, collected_at
FROM collection_log
WHERE status = 'failed'
ORDER BY collected_at DESC;
```

## DB 스키마

```
cities
├─ id (PK)
├─ name_en, name_ko
├─ country, lat, lon, alt
└─ created_at

hourly_weather
├─ id (PK, BIGSERIAL)
├─ city_id (FK → cities)
├─ timestamp (TIMESTAMPTZ)
├─ temperature, apparent_temp
├─ humidity
├─ precipitation, rain, snowfall
├─ weather_code, cloud_cover
├─ wind_speed, wind_direction, wind_gusts
└─ UNIQUE (city_id, timestamp)

collection_log
├─ id (PK)
├─ city_id (FK → cities)
├─ period_start, period_end
├─ total_hours
├─ status (completed / failed / partial)
├─ error_msg
└─ collected_at
```

## 예상 데이터 규모

| 항목 | 규모 |
|---|---|
| 총 row 수 | 138도시 × 753,888시간 = **약 1억 row** |
| DB 용량 | ~15.7GB |
| Supabase 플랜 | **Pro 플랜 필요** ($25/월) |

---

## 웹앱 연동용: 변경된 데이터 구조 요약

### 기존 vs 변경 후

| 구분 | 기존 | 변경 후 |
|------|------|--------|
| **저장소** | 로컬 JSON 파일 (`output/{city_id}.json`) | **Supabase PostgreSQL** |
| **데이터 단위** | 일별(day) 1건/일 | **시간별(hourly)** 최대 24건/일 |
| **도시 메타** | JSON 내 `city` 객체 | **`cities` 테이블** |
| **날씨 값** | JSON 내 `weather` 배열 (일별) | **`hourly_weather` 테이블** (시간별) |
| **수집 현황** | 파일 유무로 판단 | **`collection_log` 테이블** (status, total_hours 등) |

### 테이블 구조 (웹앱에서 읽을 것)

#### 1. `cities` — 도시 메타

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | TEXT (PK) | 도시 ID (`seoul`, `guam`, `tokyo` 등) |
| `name_en` | TEXT | 영문명 |
| `name_ko` | TEXT | 한글명 |
| `country` | TEXT | 국가 코드 (KR, US, JP 등) |
| `lat` | DOUBLE PRECISION | 위도 |
| `lon` | DOUBLE PRECISION | 경도 |
| `alt` | INTEGER | 고도(m), nullable |

- **용도**: 도시 목록, 지도/선택 UI, `hourly_weather` 조인용.

#### 2. `hourly_weather` — 시간별 날씨 (핵심)

| 컬럼 | 타입 | 단위/비고 |
|------|------|-----------|
| `id` | BIGSERIAL | PK |
| `city_id` | TEXT | FK → `cities.id` |
| `timestamp` | TIMESTAMPTZ | **UTC** 저장. 조회 시 도시 타임존으로 변환 필요 |
| `temperature` | REAL | 기온 °C |
| `apparent_temp` | REAL | 체감온도 °C |
| `humidity` | SMALLINT | 상대습도 % |
| `precipitation` | REAL | 총 강수량 mm |
| `rain` | REAL | 비 mm |
| `snowfall` | REAL | 눈 cm |
| `weather_code` | SMALLINT | **WMO 코드** (0–99). [코드표](https://open-meteo.com/en/docs#api_form) 참고 |
| `cloud_cover` | SMALLINT | 구름 % |
| `wind_speed` | REAL | 풍속 km/h |
| `wind_direction` | SMALLINT | 풍향 ° (0–360) |
| `wind_gusts` | REAL | 돌풍 km/h |

- **유니크**: `(city_id, timestamp)` — 도시·시각당 1행.
- **인덱스**: `(city_id, timestamp)`, `(timestamp)` → 도시별 기간 조회에 유리.

#### 3. `collection_log` — 수집 현황 (선택 사용)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `city_id` | TEXT | FK → `cities.id` |
| `period_start` | DATE | 수집 기간 시작 (현재 고정: 1940-01-01) |
| `period_end` | DATE | 수집 기간 끝 (현재 고정: 2025-12-31) |
| `total_hours` | INTEGER | 수집된 시간 수 |
| `status` | TEXT | `completed` / `failed` / `partial` |
| `error_msg` | TEXT | 실패 시 메시지 |
| `collected_at` | TIMESTAMPTZ | 수집 완료 시각 |

- **용도**: “이 도시 데이터 수집 완료 여부” 표시, 재수집/에러 확인.

### 웹앱에서 쓸 때 참고

1. **인증**  
   - 쓰기는 `service_role`만 가능(수집 스크립트 전용).  
   - 웹앱은 **anon key**로 **SELECT만** 하면 됨. (RLS로 읽기 공개)

2. **timestamp**  
   - DB에는 **UTC**로 들어 있음.  
   - 특정 도시 “현지 시간 N시” 기준으로 보려면 `timestamp`를 도시 타임존(또는 `lat/lon` 기반 타임존)으로 변환해서 필터/표시.

3. **weather_code**  
   - Open-Meteo WMO 코드 그대로 사용.  
   - 아이콘/레이블 매핑은 [Open-Meteo 문서](https://open-meteo.com/en/docs#api_form) 또는 기존 매핑 테이블 재사용.

4. **조회 예시 (Supabase Client)**  
   - 도시별 특정 기간 시간별 데이터:
     ```text
     hourly_weather
       .select('*')
       .eq('city_id', 'seoul')
       .gte('timestamp', '2020-01-01T00:00:00Z')
       .lte('timestamp', '2020-01-31T23:59:59Z')
       .order('timestamp')
     ```
   - “이 도시 수집 완료인지” 확인:
     ```text
     collection_log
       .select('status, total_hours')
       .eq('city_id', 'seoul')
       .eq('period_start', '1940-01-01')
       .eq('period_end', '2025-12-31')
       .single()
     ```

5. **데이터 규모**  
   - 도시당 약 75만 시간(86년 × 24).  
   - 웹에서는 보통 “특정 도시 + 기간”으로만 조회해 페이지네이션/기간 제한 두는 것을 권장.

---

## 조회 속도 / 대용량 시 주의사항

- **인덱스**: `hourly_weather`에는 `(city_id, timestamp)`, `(timestamp)` 인덱스가 있어 **한 도시 + 기간** 또는 **특정 시점 여러 도시** 조회는 인덱스로 처리되어 빠릅니다.
- **권장 쿼리 패턴**:  
  - `WHERE city_id = ? AND timestamp BETWEEN ? AND ?`  
  - `WHERE timestamp = ?` (특정 시점 전체 도시)  
  → 위처럼 조건을 주면 행이 많아도 구간만 스캔하므로 부담이 적습니다.
- **피할 것**: 인덱스 없는 컬럼만으로 넓게 스캔하는 쿼리, 기간/도시 제한 없이 전체 스캔.
- **나중에 더 커지면**: 자주 쓰는 집계(예: 일별 요약)는 materialized view나 요약 테이블로 두고, 상세는 필요할 때만 `hourly_weather` 조회.

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-02-19 | 시간별 수집 방식으로 전환, Supabase DB 직접 업로드 방식 채택 |
