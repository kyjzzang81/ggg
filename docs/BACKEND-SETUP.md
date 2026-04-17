# D Day Weather - 백엔드 셋업 완료 현황

Feature Engine 구축 이후 완료된 작업들을 정리한 문서.

---

## 전체 진행 순서 요약

```
DB 스키마 설계
      ↓
데이터 파이프라인 (PIPELINE.md)
  hourly_weather → daily_weather → climate_normals / monthly_climate
      ↓
Feature Engine (FEATURE-ENGINE.md)
  best_travel_week / rain_risk_calendar / weather_stability_index / activity_weather_score
      ↓
[이 문서 범위]
city_requests 테이블 → fetch-forecast Edge Function → Cron 스케줄
```

---

## 1. city_requests 테이블

### 목적
앱에 없는 도시를 사용자가 관리자에게 추가 요청하는 기능.
D Day 화면은 저장된 180+ 도시만 지원하며, 원하는 도시가 없을 경우 요청 가능.

### 파일
```
supabase/city_requests.sql
```

### 테이블 구조
```sql
create table city_requests (
  id          bigserial primary key,
  city_name   text        not null,
  country     text,
  user_email  text,
  status      text        not null default 'pending',  -- pending / approved / rejected
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

### RLS 정책
- 누구나 INSERT 가능 (로그인 불필요)
- SELECT는 본인 요청만 조회 가능
- UPDATE/DELETE는 service_role만 가능

### 핵심 함수
```sql
-- React Native에서 호출하는 upsert 함수
select upsert_city_request('도쿄', 'Japan', 'user@example.com');
```
같은 (city_name, user_email) 조합은 중복 요청 방지됨.

---

## 2. fetch-forecast Edge Function

### 목적
Open-Meteo API에서 전체 194개 도시의 14일 예보를 수집하여 `forecast_weather` 테이블에 저장.

### 파일
```
supabase/functions/fetch-forecast/index.ts
```

### 핵심 구현 사항

**병렬 처리 (10개씩)**
순차 처리 시 3~5분 소요로 Edge Function 제한(150초)을 초과해 EarlyDrop 발생.
10개 도시를 Promise.allSettled로 동시 처리하여 약 48초로 단축.

```
194개 도시 ÷ 10 = 20 배치
각 배치 ~2초 + 배치 사이 딜레이 500ms
총 소요: ~48초
```

**429 Rate Limit 자동 재시도**
Open-Meteo 무료 API의 Rate Limit으로 일부 요청이 429를 반환할 경우
최대 3회까지 지수 백오프(1s → 2s → 3s)로 재시도.

**SMALLINT 컬럼 처리**
`humidity`, `cloud_cover`, `wind_direction`은 DB 컬럼 타입이 SMALLINT이므로
Open-Meteo 응답값에 Math.round() 적용 후 저장.

### 트러블슈팅 히스토리

| 문제 | 원인 | 해결 |
|---|---|---|
| `500 Cannot read properties of undefined (reading 'error')` | EarlyDrop (타임아웃 후 강제 종료) | 병렬 처리로 실행 시간 단축 |
| 일부 도시 429 오류 | Open-Meteo Rate Limit | 429 자동 재시도 로직 추가 |
| 배포 시 파일 못 찾음 | supabase 폴더 내에서 deploy 실행 | 프로젝트 루트에서 실행 |

### 배포 명령어
```bash
# 프로젝트 루트에서 실행
supabase functions deploy fetch-forecast
```

### 응답 구조
```json
{
  "started_at": "ISO timestamp",
  "finished_at": "ISO timestamp",
  "total_cities": 194,
  "success_count": 194,
  "failed_cities": [],
  "delete_status": "완료",
  "error": "",
  "log": ["[1] 환경변수 확인 ...", "[2] ...", "..."]
}
```

---

## 3. Cron 스케줄

### 목적
매일 한국시간 오전 7시(UTC 22:00)에 fetch-forecast를 자동 실행.

### 사전 요구사항
Supabase 대시보드 → Database → Extensions에서 아래 두 확장이 활성화되어 있어야 함.
- `pg_cron` (스케줄 실행)
- `pg_net` (HTTP 호출)

### 등록 SQL
```sql
-- pg_net 확장 활성화 (최초 1회)
create extension if not exists pg_net schema extensions;

-- Cron 스케줄 등록
select cron.schedule(
  'fetch-forecast-daily',
  '0 22 * * *',   -- UTC 22:00 = 한국시간 오전 7시
  $$
  select net.http_post(
    url     := 'https://nisxyhqxihbharxnmmdw.supabase.co/functions/v1/fetch-forecast',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

> `<SERVICE_ROLE_KEY>`: Supabase 대시보드 → Project Settings → API → service_role 키

### 확인 쿼리
```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'fetch-forecast-daily';
```

### 스케줄 관리
```sql
-- 스케줄 변경
select cron.alter_job(
  job_id   := (select jobid from cron.job where jobname = 'fetch-forecast-daily'),
  schedule := '0 1 * * *'
);

-- 스케줄 삭제
select cron.unschedule('fetch-forecast-daily');

-- 실행 이력 조회
select * from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'fetch-forecast-daily')
order by start_time desc
limit 10;
```

---

## 4. 현재 백엔드 완료 상태

| 항목 | 상태 | 비고 |
|---|---|---|
| DB 스키마 전체 테이블 | ✅ 완료 | DB-SCHEMA.md |
| hourly_weather 데이터 | ✅ 완료 | 180+ 도시, 10년치 |
| daily_weather 집계 | ✅ 완료 | build_daily_weather.py |
| climate_normals 집계 | ✅ 완료 | build_climate.py |
| monthly_climate 집계 | ✅ 완료 | build_climate.py |
| Feature 4개 테이블 | ✅ 완료 | build_features.py |
| city_requests 테이블 | ✅ 완료 | city_requests.sql |
| fetch-forecast Edge Function | ✅ 완료 | 194개 도시, 48초, 100% |
| Cron 스케줄 | ✅ 완료 | 매일 KST 07:00 |

---

## 5. 다음 단계

- [ ] React Native API 엔드포인트 설계 (화면별 Supabase 쿼리)
- [ ] Today 화면 연동 (실시간 Open-Meteo 직접 호출)
- [ ] D Day 화면 연동 (forecast_weather / climate_normals 분기)
- [ ] 도시 검색 / city_requests 연동
