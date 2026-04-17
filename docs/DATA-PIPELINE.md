# D Day Weather - 데이터 파이프라인

## 전체 구조

```
hourly_weather (RAW)
      ↓ STEP 1
daily_weather (집계)
      ↓ STEP 2
climate_normals (기후 통계)
      ↓
monthly_climate (월별 통계)
      ↓ STEP 3
best_travel_week
rain_risk_calendar          ← Feature Engine (별도 문서 예정)
weather_stability_index
activity_weather_score

forecast_weather            ← Open-Meteo 매일 갱신 (별도 문서 예정)
```

---

## STEP 1. hourly_weather → daily_weather

- **목적**: 시간별 원본 데이터를 일별로 집계
- **실행**: 초기 1회 배치, 이후 불변
- **규모**: 도시당 ~3,650 rows (10년 × 365일)
- **SQL 파일**: `supabase/pipeline-batch.sql`

### 집계 방식

| 컬럼 | 집계 방식 |
| ---- | --------- |
| `temp_avg` | AVG(temperature) |
| `temp_min` | MIN(temperature) |
| `temp_max` | MAX(temperature) |
| `apparent_temp_avg` | AVG(apparent_temp) |
| `humidity_avg` | AVG(humidity) |
| `precipitation_sum` | SUM(precipitation) |
| `rain_sum` | SUM(rain) |
| `snowfall_sum` | SUM(snowfall) |
| `wind_avg` | AVG(wind_speed) |
| `wind_max` | MAX(wind_speed) |
| `cloud_cover_avg` | AVG(cloud_cover) |

### 주의사항
- `timestamp`는 UTC 기준으로 날짜 집계
- `ON CONFLICT DO NOTHING` → 중복 실행 안전

---

## STEP 2. daily_weather → climate_normals / monthly_climate

### climate_normals

- **목적**: 10년 데이터 기반 day_of_year 단위 기후 통계
- **규모**: 도시당 365 rows
- **핵심 역할**: 여행 추천 알고리즘(Feature Engine)의 기반 데이터

#### 윤년 처리
2월 29일(DOY=60) 이후 윤년 날짜는 -1 보정하여 365 기준으로 통일

```
윤년 DOY > 59  →  DOY - 1
그 외           →  DOY 그대로
```

#### 집계 방식

| 컬럼 | 집계 방식 |
| ---- | --------- |
| `temp_avg` | AVG(temp_avg) |
| `temp_min_avg` | AVG(temp_min) |
| `temp_max_avg` | AVG(temp_max) |
| `temp_stddev` | STDDEV(temp_avg) |
| `humidity_avg` | AVG(humidity_avg) |
| `rain_probability` | AVG(rain_sum > 0.1 ? 1 : 0) |
| `precipitation_avg` | AVG(precipitation_sum) |
| `precipitation_stddev` | STDDEV(precipitation_sum) |
| `wind_avg` | AVG(wind_avg) |
| `wind_stddev` | STDDEV(wind_avg) |
| `snowfall_avg` | AVG(snowfall_sum) |
| `cloud_cover_avg` | AVG(cloud_cover_avg) |
| `rain_hours` | COUNT(rain > 0.1) — 비 온 시간 수 |

### monthly_climate

- **목적**: 월 단위 기후 통계
- **규모**: 도시당 12 rows

#### 집계 방식
연도별 월 데이터를 먼저 집계한 뒤 다시 평균내는 2단계 방식

```
1단계: 연도 × 월 단위로 집계
  예) 서울 2020년 3월 강수일 수 계산
      서울 2021년 3월 강수일 수 계산
      ...

2단계: 연도별 값을 평균
  예) 서울 3월 평균 강수일 수 = 10년치 평균
```

| 컬럼 | 집계 방식 |
| ---- | --------- |
| `temp_avg` | 연도별 월평균 기온의 평균 |
| `rain_days` | 연도별 강수일 수의 평균 |
| `rain_probability` | rain_days / total_days |
| `wind_avg` | 연도별 월평균 풍속의 평균 |
| `humidity_avg` | 연도별 월평균 습도의 평균 |
| `snowfall_days` | 연도별 눈 오는 날 수의 평균 |

---

## 실행 가이드

### 순서
```
1. STEP 1 실행 (hourly → daily)
2. STEP 2 실행 (daily → climate_normals)
3. STEP 2 실행 (daily → monthly_climate)
```

### 테스트 권장 방법
전체 실행 전 도시 1개로 먼저 검증

```sql
-- 특정 도시만 테스트
WHERE city_id = 'seoul'
```

### SQL 파일 위치
`supabase/pipeline-batch.sql`

### 충돌 처리 정책

| 테이블 | 정책 |
| ------ | ---- |
| `daily_weather` | ON CONFLICT DO NOTHING (불변) |
| `climate_normals` | ON CONFLICT DO UPDATE (재계산 시 갱신) |
| `monthly_climate` | ON CONFLICT DO UPDATE (재계산 시 갱신) |

---

## 향후 추가 예정

- **STEP 3**: Feature Engine SQL (best_travel_week, rain_risk_calendar 등)
- **STEP 4**: Open-Meteo 예보 데이터 Edge Function (매일 자동 갱신)

---

## ⚠️ 집계 시 발생할 수 있는 경우의 수

### 1. 스콜 vs 지속성 비 (동남아 핵심 이슈)
- **문제**: 1시간 스콜과 하루종일 비가 `rain_sum`에서 동일하게 표현될 수 있음
- **해결**: `rain_hours` 컬럼으로 구분
  - 스콜: `rain_sum` 높음, `rain_hours` = 1~2
  - 지속성 비: `rain_sum` 높음, `rain_hours` = 10+
- **활용**: `climate_normals`에서 `rain_probability` 두 가지로 분리
  - `rain_day_probability` = 비 온 날 확률 (스콜도 1일 카운트)
  - `rain_hour_ratio` = AVG(rain_hours / 24.0) → 하루 중 비 오는 시간 비율

---

### 2. 타임존 날짜 경계 문제
- **문제**: `timestamp`를 UTC로 집계하면 현지 날짜와 다를 수 있음
  - 예) 다낭(UTC+7) 새벽 1시 비 → UTC 기준 전날로 집계됨
- **현재 방침**: UTC 기준 집계 유지 (모든 도시 동일 기준)
- **영향도**: 기후 통계 목적에서는 1~7시간 차이가 큰 영향 없음
- **개선 옵션**: `cities` 테이블에 `timezone` 컬럼 추가 후 현지 기준 집계
  ```sql
  DATE(timestamp AT TIME ZONE cities.timezone)
  ```

---

### 3. 시간 데이터 누락
- **문제**: 특정 날 24시간 미만 데이터만 존재할 경우 집계 왜곡
  - 예) 데이터 수집 오류로 12시간만 있는 날 → `rain_hours` 최대값이 12
- **감지 방법**:
  ```sql
  -- 24시간 미만 날짜 확인
  SELECT city_id, DATE(timestamp), COUNT(*) AS hour_count
  FROM hourly_weather
  GROUP BY city_id, DATE(timestamp)
  HAVING COUNT(*) < 24;
  ```
- **처리 방침**: 누락 시간 비율이 25% 이상(6시간 이상)이면 해당 날짜 집계 제외 권장

---

### 4. 강수 임계값 기준
- **문제**: 이슬비/안개비도 rain > 0 으로 기록됨 → 실제 여행에 영향 없는 강수도 카운트
- **확정 기준**: `rain >= 1.0mm` 을 "비 온 시간"으로 판정
- **이유**: 지중해·유럽 도시 이슬비 과대 집계 방지, 여행객 체감 기준에 부합
- **참고 기준**:
  - `>= 0.1mm`: 이슬비 포함 (기상청 공식 강수 기준)
  - `>= 1.0mm`: 체감 가능한 비 **(채택)**
  - `>= 5.0mm`: 우산 필요한 수준

---

### 5. 풍향 평균의 함정
- **문제**: 풍향(wind_direction)은 각도값이라 단순 평균 불가
  - 예) 350°와 10°의 평균 → 수학적으로는 180° (잘못됨), 실제로는 0°(북풍)
- **현재 방침**: `daily_weather`에 `wind_direction` 미집계 (wind_avg, wind_max만 사용)
- **필요 시 처리**: 벡터 평균 사용
  ```sql
  DEGREES(ATAN2(AVG(SIN(RADIANS(wind_direction))),
               AVG(COS(RADIANS(wind_direction))))) AS wind_dir_avg
  ```

---

### 6. 이상값 (센서 오류)
- **문제**: 오류 데이터가 포함될 경우 AVG/MIN/MAX 왜곡
  - 예) temperature = 99°C, precipitation = 9999mm
- **권장 필터** (파이프라인 실행 전 정제):
  ```sql
  WHERE temperature BETWEEN -60 AND 60
    AND precipitation BETWEEN 0 AND 300
    AND wind_speed BETWEEN 0 AND 250
  ```

---

### 7. 눈과 비의 중복 기록
- **문제**: Open-Meteo에서 `precipitation`은 비+눈 합산, `rain`과 `snowfall`은 각각 별도 기록
  - `precipitation_sum` ≠ `rain_sum + snowfall_sum` 인 경우 존재 (단위 차이: 눈은 cm)
- **현재 방침**: 각 컬럼 독립적으로 집계, 혼합 계산 없음
- **활용**: 스키 활동 추천 시 `snowfall_sum` 독립 사용
