# CLIMATE DB RLS Policies

> 목적: Supabase Postgres의 Row Level Security 정책을 테이블 단위로 통합 정의한다.
> 기준: `DB-SCHEMA.md` · `DB-ERD.md` · `DB-GAP-ANALYSIS.md` §4

---

## 0. 원칙

- **기본 정책**: RLS ON + 모든 정책 deny, 명시적 allow만 허용.
- **Role**:
  - `anon` — 비로그인 (익명 키)
  - `authenticated` — 로그인된 사용자
  - `service_role` — Edge Function / 서버 배치 (RLS bypass)
- `service_role`은 RLS를 우회하므로 **쓰기 권한이 필요한 배치만** 이 키를 사용.
- 모든 테이블은 `alter table <t> enable row level security` 먼저 적용.

---

## 1. 테이블 × 역할 매트릭스

| 테이블 | anon read | anon write | authenticated read | authenticated write | service_role |
|---|---|---|---|---|---|
| `cities` | ✅ | ❌ | ✅ | ❌ | ALL |
| `hourly_weather` | ❌ | ❌ | ❌ | ❌ | ALL |
| `daily_weather` | ❌ | ❌ | ❌ | ❌ | ALL |
| `climate_normals` | ✅ | ❌ | ✅ | ❌ | ALL |
| `monthly_climate` | ✅ | ❌ | ✅ | ❌ | ALL |
| `forecast_weather` | ✅ | ❌ | ✅ | ❌ | ALL |
| `best_travel_week` | ✅ | ❌ | ✅ | ❌ | ALL |
| `rain_risk_calendar` | ✅ | ❌ | ✅ | ❌ | ALL |
| `weather_stability_index` | ✅ | ❌ | ✅ | ❌ | ALL |
| `activity_weather_score` | ✅ | ❌ | ✅ | ❌ | ALL |
| `climate_frequency` | ✅ | ❌ | ✅ | ❌ | ALL |
| `climate_score_monthly` | ✅ | ❌ | ✅ | ❌ | ALL |
| `nearby_places` | ✅ | ❌ | ✅ | ❌ | ALL |
| `hidden_season_highlights` | ✅ (status=published) | ❌ | ✅ (status=published) | ❌ | ALL |
| `home_cards` | ✅ (active=true) | ❌ | ✅ (active=true) | ❌ | ALL |
| `weather_character_map` | ✅ | ❌ | ✅ | ❌ | ALL |
| `city_requests` | ❌ | ❌ | insert(self) | — | ALL |
| `user_dday_events` | ❌ | ❌ | self ALL | self ALL | ALL |
| `user_sessions` | ❌ | ❌ | self select | self insert | ALL |
| `user_subscriptions` | ❌ | ❌ | self select | ❌ | ALL |
| `user_weather_archive` | ❌ | ❌ | self ALL | self ALL | ALL |
| `user_bookmarks` | ❌ | ❌ | self ALL | self ALL | ALL |

> "self" = `user_id = auth.uid()`

---

## 2. 공개 read 정책 패턴

기후/예보/피처 테이블 (`cities`, `climate_*`, `forecast_weather`, `best_travel_week`, `rain_risk_calendar`, `activity_weather_score`, `climate_frequency`, `monthly_climate`, `weather_stability_index`, `nearby_places`, `climate_score_monthly`, `weather_character_map`)는 익명/로그인 모두 read 허용.

```sql
alter table cities enable row level security;

create policy "public read cities"
  on cities for select
  using (true);
```

동일 패턴으로 다른 공개 테이블에도 적용. 쓰기 정책은 정의하지 않아 기본 deny (service_role은 RLS bypass).

---

## 3. 상태 기반 공개 정책

### 3-1. `home_cards`

```sql
alter table home_cards enable row level security;

create policy "public read active home cards"
  on home_cards for select
  using (active = true);
```

### 3-2. `hidden_season_highlights`

```sql
alter table hidden_season_highlights enable row level security;

create policy "public read published highlights"
  on hidden_season_highlights for select
  using (status = 'published');
```

---

## 4. USER 테이블 정책

### 4-1. `user_dday_events`

```sql
alter table user_dday_events enable row level security;

create policy "dday owner select"
  on user_dday_events for select
  using (user_id = auth.uid());

create policy "dday owner insert"
  on user_dday_events for insert
  with check (user_id = auth.uid());

create policy "dday owner update"
  on user_dday_events for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "dday owner delete"
  on user_dday_events for delete
  using (user_id = auth.uid());
```

### 4-2. `user_sessions`

```sql
alter table user_sessions enable row level security;

create policy "session self select"
  on user_sessions for select
  using (user_id = auth.uid());

create policy "session self insert"
  on user_sessions for insert
  with check (user_id = auth.uid());

-- update/delete 는 금지 (service_role 배치만 가능)
```

### 4-3. `user_subscriptions`

```sql
alter table user_subscriptions enable row level security;

create policy "subscription self select"
  on user_subscriptions for select
  using (user_id = auth.uid());

-- insert/update 금지 (PG/service_role 에서만 처리)
```

### 4-4. `user_weather_archive`

```sql
alter table user_weather_archive enable row level security;

create policy "archive owner select"
  on user_weather_archive for select
  using (user_id = auth.uid());

create policy "archive owner insert"
  on user_weather_archive for insert
  with check (user_id = auth.uid());

create policy "archive owner update"
  on user_weather_archive for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "archive owner delete"
  on user_weather_archive for delete
  using (user_id = auth.uid());
```

### 4-5. `user_bookmarks`

```sql
alter table user_bookmarks enable row level security;

create policy "bookmark owner select"
  on user_bookmarks for select
  using (user_id = auth.uid());

create policy "bookmark owner insert"
  on user_bookmarks for insert
  with check (user_id = auth.uid());

create policy "bookmark owner delete"
  on user_bookmarks for delete
  using (user_id = auth.uid());
```

### 4-6. `city_requests`

```sql
alter table city_requests enable row level security;

create policy "city request self insert"
  on city_requests for insert
  with check (user_id = auth.uid());

-- 목록/상세 조회는 admin UI에서만 service_role로 접근
-- 스팸 방지: 분당 insert 제한은 애플리케이션 레이어에서 처리
```

---

## 5. 서비스 전용 테이블

`hourly_weather`, `daily_weather`는 익명/로그인 모두 직접 read 불가. 집계된 `climate_*`, `forecast_weather`만 노출.

```sql
alter table hourly_weather enable row level security;
-- 어떤 policy도 만들지 않음 → 기본 deny
-- service_role 만 접근
```

---

## 6. JWT 커스텀 클레임 (참고)

Premium 여부를 JWT에 담아 성능을 개선할 수 있다 (Phase 1.5+).

```sql
-- 예시: Climate Plus 전용 자료에 정책 추가 시
using ((auth.jwt() ->> 'plan') = 'plus')
```

Phase 1에서는 JOIN으로 확인:

```sql
using (exists (
  select 1 from user_subscriptions s
  where s.user_id = auth.uid()
    and s.status = 'active'
    and s.plan = 'plus'
))
```

---

## 7. 정책 테스트 체크리스트

- [ ] `anon` 키로 각 공개 테이블 `select` 성공
- [ ] `anon` 키로 `user_*` 전체 테이블 `select` 실패
- [ ] 로그인한 사용자 A가 자신의 `user_dday_events` CRUD 성공
- [ ] 로그인한 사용자 A가 사용자 B의 `user_dday_events` select/update 실패
- [ ] `service_role` 키로 배치 작업이 모든 테이블 write 성공
- [ ] `hidden_season_highlights (status='draft')`는 익명/로그인 모두 조회 불가
- [ ] `home_cards (active=false)`는 익명/로그인 모두 조회 불가

SQL 예시:

```sql
-- Supabase SQL Editor 에서 role 스위칭 테스트
set role authenticated;
set request.jwt.claim.sub to '<user_a_uuid>';
select * from user_dday_events;   -- 자기 것만 나와야 함
reset role;
```

---

## 8. 마이그레이션 반영 순서

1. 테이블 생성 (`DB-MIGRATIONS.md`)
2. `enable row level security`
3. `create policy ...` (본 문서)
4. 통합 테스트 (§7)
5. Edge Function은 `SUPABASE_SERVICE_ROLE_KEY`로 접근

---

## 9. 연계 문서

- ERD: `DB-ERD.md`
- 갭 분석: `DB-GAP-ANALYSIS.md`
- 마이그레이션 절차: `DB-MIGRATIONS.md`
- 인증: `AUTH-SPEC.md`
