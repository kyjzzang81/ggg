# CLIMATE DB Indexes

> 목적: Phase 1 조회 패턴 기준 인덱스 최소 세트를 정의한다.

---

## 1. 필수 인덱스 (P0)

```sql
create index if not exists idx_forecast_weather_city_time
  on forecast_weather (city_id, forecast_at desc);

create index if not exists idx_best_travel_week_city_week
  on best_travel_week (city_id, week_of_year);

create index if not exists idx_user_sessions_user_month
  on user_sessions (user_id, year_month);

create index if not exists idx_user_dday_events_user_date
  on user_dday_events (user_id, target_date);
```

---

## 2. 권장 인덱스 (P1)

```sql
create index if not exists idx_activity_weather_score_city_activity_day
  on activity_weather_score (city_id, activity, day_of_year);

create index if not exists idx_rain_risk_calendar_city_day
  on rain_risk_calendar (city_id, day_of_year);

create index if not exists idx_nearby_places_city_category
  on nearby_places (city_id, category);
```

---

## 3. 운영 체크

- 인덱스 추가 후 `explain analyze`로 주요 쿼리 계획 확인
- write-heavy 테이블은 인덱스 과다 생성 금지
- 분기마다 미사용 인덱스 점검

---

## 4. 연계 문서

- `DB-MIGRATIONS.md`
- `DB-GAP-ANALYSIS.md`

