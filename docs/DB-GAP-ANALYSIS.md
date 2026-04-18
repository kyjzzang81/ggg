# DB Gap Analysis (Phase 1 MVP)

> 기준: `DB-SCHEMA.md`, `DEV-SPEC.md`  
> 목적: 현재 DB 상태와 MVP 구현 요구 사이의 갭을 우선순위로 정리

---

## 0. 운영 DB 스냅샷 (2026-04 기준 Visualizer 복사)

**이미 존재하는 테이블:**  
`cities`, `city_requests`, `hourly_weather`, `daily_weather`, `climate_normals`, `monthly_climate`, `forecast_weather`, `collection_log`, `best_travel_week`, `rain_risk_calendar`, `weather_stability_index`, `activity_weather_score`, `weather_character_map`, `home_cards`

**본 스냅샷에서 확인되지 않음(추가 필요):**  
`climate_frequency`(테이블·집계), `user_dday_events`, `nearby_places`, `climate_score_monthly`, `hidden_season_highlights`, `user_weather_archive`, `user_bookmarks`

**컬럼 갭:**  
`cities`에 **`station_name` 없음** → AirKorea 측정소 매핑용 컬럼 추가 권장(P0).

**결제 미사용 시:**  
`user_subscriptions`, 월간 `adjust-subscription-price` 연동 **`user_sessions`** 는 P0에서 제외 가능(제품 분석용으로만 나중에 추가).

---

## 1. 현황 요약

- 기반 테이블(기후/예보/추천): **스냅샷 기준 상당 부분 구축됨**
- 사용자 기능 테이블(D-day 등): **미구축**
- 집계 캐시(`climate_frequency` 등): **미구축**
- RLS 정책: USER 영역 테이블 도입 시 확장 필요

---

## 2. 필수 신규 (MVP)

| 테이블/요소 | 상태 | 우선순위 | 용도 |
|---|---|---|---|
| `user_dday_events` | 필요 | P0 | D-day CRUD |
| `user_sessions` | 선택 | P2 | 구독 없으면 방문 로그만 필요 시 |
| `user_subscriptions` | **제외 가능** | — | Phase 1 결제·후원 없음 (`MVP-SCOPE.md` 동기화) |
| `climate_frequency` 빌드 | 미완 | P0 | 홈 인사이트 문구 |
| `cities.station_name` | **컬럼 없음** | P0 | 에어코리아 측정소 매핑 |

---

## 3. 권장 신규 (Phase 1.5+)

| 테이블/요소 | 상태 | 우선순위 | 용도 |
|---|---|---|---|
| `user_weather_archive` | 필요 | P1 | 아카이브/SNS 공유 |
| `user_bookmarks` | 필요 | P1 | 북마크 |
| `climate_score_monthly` | 필요 | P1 | ggg score 월별 캐시 |
| `hidden_season_highlights` | 필요 | P1 | 숨은 황금 시즌 CMS |
| `nearby_places` | 필요 | P1 | 주변 추천 캐시 |

---

## 4. RLS 갭

필수:
- `user_dday_events`: 본인만 CRUD
- (도입 시) `user_sessions`: 본인 insert/select 제한
- ~~`user_subscriptions`~~ — Phase 1 미도입 시 생략

권장:
- `user_weather_archive`, `user_bookmarks`
- `city_requests` 정책 재검토(스팸 방지)

---

## 5. 인덱스 갭

필수:
- `user_sessions (user_id, year_month)`
- `forecast_weather (city_id, timestamp)` 확인
- `best_travel_week (city_id, week_of_year)` 확인

권장:
- `activity_weather_score (city_id, activity, day_of_year)`
- `rain_risk_calendar (city_id, day_of_year)`

---

## 6. 데이터 품질 갭

- `climate_frequency` 집계 기준 기간 확정 필요 (문서 간 10년/30년 혼재)
- `cities.station_name` 매핑 정확도 검증 필요
- Score 산식 소수 처리/반올림 정책 통일 필요

---

## 7. 추천 실행 순서

1. `cities.station_name` 추가 + 측정소 매핑
2. `user_dday_events` 생성 + RLS
3. `climate_frequency` 빌드 함수/배치 구성
4. 핵심 인덱스 추가(기존 테이블 기준 `DB-INDEXES.md` 대조)
5. `nearby_places` + 네이버 연동 캐시 전략
6. P1 테이블(`climate_score_monthly` 등) 순차 도입

---

## 8. 완료 기준

- [ ] P0 테이블 생성 + 마이그레이션 반영
- [ ] P0 인덱스 생성
- [ ] P0 RLS 적용 및 테스트
- [ ] `climate_frequency` 빌드 가능
- [ ] 문서와 실제 스키마 불일치 0건
