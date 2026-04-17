# DB Gap Analysis (Phase 1 MVP)

> 기준: `DB-SCHEMA.md`, `DEV-SPEC.md`  
> 목적: 현재 DB 상태와 MVP 구현 요구 사이의 갭을 우선순위로 정리

---

## 1. 현황 요약

- 기반 테이블(기후/예보/추천): 대체로 준비됨
- 사용자 기능 테이블(D-day/세션/구독/북마크): 일부 미구현
- 집계 캐시/운영 CMS: 부분 미구현
- RLS 정책: USER 영역 중심으로 확장 필요

---

## 2. 필수 신규 (MVP)

| 테이블/요소 | 상태 | 우선순위 | 용도 |
|---|---|---|---|
| `user_dday_events` | 필요 | P0 | D-day CRUD |
| `user_sessions` | 필요 | P0 | 방문 횟수 추적 |
| `user_subscriptions` | 필요 | P0 | 구독 상태/가격 구조 |
| `climate_frequency` 빌드 | 미완 | P0 | 홈 인사이트 문구 |
| `cities.station_name` | 일부/미정 | P0 | 에어코리아 측정소 매핑 |

---

## 3. 권장 신규 (Phase 1.5+)

| 테이블/요소 | 상태 | 우선순위 | 용도 |
|---|---|---|---|
| `user_weather_archive` | 필요 | P1 | 아카이브/SNS 공유 |
| `user_bookmarks` | 필요 | P1 | 북마크 |
| `climate_score_monthly` | 필요 | P1 | 월별 점수 캐시 |
| `hidden_season_highlights` | 필요 | P1 | 숨은 황금 시즌 CMS |
| `nearby_places` | 필요 | P1 | 주변 추천 캐시 |

---

## 4. RLS 갭

필수:
- `user_dday_events`: 본인만 CRUD
- `user_sessions`: 본인 insert/select 제한
- `user_subscriptions`: 본인 select, service role update

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

1. `user_dday_events`, `user_sessions`, `user_subscriptions` 생성
2. 핵심 인덱스 추가
3. RLS 정책 적용
4. `climate_frequency` 빌드 함수/배치 구성
5. `cities.station_name` 매핑 작업
6. P1 테이블 순차 도입

---

## 8. 완료 기준

- [ ] P0 테이블 생성 + 마이그레이션 반영
- [ ] P0 인덱스 생성
- [ ] P0 RLS 적용 및 테스트
- [ ] `climate_frequency` 빌드 가능
- [ ] 문서와 실제 스키마 불일치 0건
