# D Day Weather - 예보 데이터 연동

## 개요

Open-Meteo Forecast API에서 전체 도시의 14일 예보를 매일 자동으로 받아
`forecast_weather` 테이블에 저장하는 Supabase Edge Function.

Today 화면과 D Day 화면(14일 이내)에서 사용.

---

## 구조

```
매일 22:00 UTC (한국시간 오전 7시) - Supabase Cron
        ↓
Edge Function: fetch-forecast
        ↓
Open-Meteo Forecast API (10개 도시 병렬 호출, 429 자동 재시도)
        ↓
forecast_weather upsert (ON CONFLICT city_id, timestamp)
        ↓
14일 초과 데이터 자동 삭제
```

---

## 파일 위치

```
supabase/functions/fetch-forecast/index.ts
```

---

## 배포 방법

### 1. Supabase CLI 설치
```bash
brew install supabase/tap/supabase
```

### 2. 로그인 및 프로젝트 연결
```bash
supabase login
supabase link --project-ref nisxyhqxihbharxnmmdw
```

### 3. Edge Function 배포 (프로젝트 루트에서 실행)
```bash
supabase functions deploy fetch-forecast
```

### 4. 환경변수
Edge Function은 아래 환경변수를 Supabase가 자동 주입함.
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 동작 방식

1. `cities` 테이블에서 전체 도시 목록 조회
2. 10개 도시씩 병렬(Promise.allSettled)로 Open-Meteo Forecast API 호출 (14일, hourly)
3. 429 Rate Limit 응답 시 최대 3회 재시도 (1s → 2s → 3s 지수 백오프)
4. `forecast_weather` 테이블에 upsert (`ON CONFLICT city_id, timestamp`)
5. 배치 사이 500ms 딜레이로 Rate Limit 방지
6. 14일 초과된 오래된 데이터 자동 삭제
7. 결과 요약 반환 (성공/실패 도시 목록, 단계별 log 배열)

**실측 성능 (194개 도시 기준):** 약 48초 소요, 성공률 100%

---

## Open-Meteo API 파라미터 매핑

| Open-Meteo 파라미터 | forecast_weather 컬럼 | 타입 |
|---|---|---|
| `temperature_2m` | `temperature` | float |
| `apparent_temperature` | `apparent_temp` | float |
| `relativehumidity_2m` | `humidity` | smallint (Math.round) |
| `precipitation` | `precipitation` | float |
| `rain` | `rain` | float |
| `snowfall` | `snowfall` | float |
| `weathercode` | `weather_code` | smallint |
| `cloudcover` | `cloud_cover` | smallint (Math.round) |
| `windspeed_10m` | `wind_speed` | float |
| `winddirection_10m` | `wind_direction` | smallint (Math.round) |
| `windgusts_10m` | `wind_gusts` | float |

---

## D Day 화면 데이터 분기 로직

```
사용자가 날짜 선택
        ↓
오늘 기준 14일 이내?
    ↓ YES                        ↓ NO
forecast_weather              climate_normals
(실제 예보 데이터)              (10년 통계 기반 예측)
    ↓                               ↓
"실제 예보예요"               "과거 데이터 기준이에요"
```

React Native에서 오늘 날짜 기준으로 분기 처리.

---

## 수동 실행 (테스트)

Supabase 대시보드 → Edge Functions → fetch-forecast → Invoke 버튼 클릭

응답 예시:
```json
{
  "started_at": "2026-03-15T15:51:59.564Z",
  "finished_at": "2026-03-15T15:52:47.783Z",
  "total_cities": 194,
  "success_count": 194,
  "failed_cities": [],
  "delete_status": "완료",
  "error": "",
  "log": ["[1] 환경변수 확인 ...", "..."]
}
```
