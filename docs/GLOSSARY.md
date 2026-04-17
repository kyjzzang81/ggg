# CLIMATE Glossary

> 목적: PRD/DEV-SPEC/DESIGN-SYSTEM에 흩어진 핵심 용어를 하나의 사전으로 모아, 코드·UI·문서의 표기 일치를 보장한다.
> 표기 규칙: **한글 공식명 · 영문 코드 식별자** 양쪽을 명시.

---

## 1. 서비스 용어

### CLIMATE
본 서비스의 코드네임(잠정). 브랜드 확정 전까지 UI 표기는 "CLIMATE"를 유지.

### ggg (goal: good·great·gorgeous)
저장소 코드명. 공개 UI에는 사용하지 않음.

### Phase 1 MVP
웹앱 기준 최소 기능 출시 범위. 정의는 `MVP-SCOPE.md` §2.

---

## 2. 기후·날씨 지표

### Climate Score™ · `climate_score`
목적지 × 기간의 여행 적합도를 0~100으로 표현하는 본 서비스 고유 종합 점수.
- 데이터 출처: `climate_normals` · `monthly_climate` · `best_travel_week` 등
- 등급: `excellent 80+` / `good 60~79` / `fair 40~59` / `poor 0~39` (`DESIGN-SYSTEM.md` §7-1)
- 화면: 홈 요약, `/score`, 장소 추천 배지, D-day 상세
- 관련 컴포넌트: `<ClimateScoreBadge />`, `<ScoreCalendar />`

### Score Grade · `score_grade`
Climate Score를 4등급 라벨로 변환한 값.
- 값: `"excellent" | "good" | "fair" | "poor"`
- UI 라벨(한글): `강력 추천 / 추천 / 보통 / 비추천`

### TCI (Tourism Climate Index)
기상청 KMA 관광기후지수. Climate Score의 **보조 지표**로 통합 가능 (Phase 1.5+).
- 데이터 출처: KMA Open API
- 컬럼(예정): `climate_score_monthly.tci`

### WMO code
세계기상기구 표준 날씨 코드. Open-Meteo 응답에서 사용.
- 매핑: `src/constants/wmo-to-theme.ts` (Phase 1 구현 대상)

### 날씨 테마 · `weather_theme`
8종 시각 테마 (`DESIGN-SYSTEM.md` §3).
- 값: `sunny | shower | cloudy | snow | heat | cold | rain | fog`
- 적용 우선순위: 폭염/한파 → WMO code → 기본 `cloudy`

### 날씨 테마 강도 · `theme_intensity`
테마 색을 얼마나 강하게 적용할지 (`DESIGN-SYSTEM.md` §3-1).
- 값: `full | soft | accent-only`
- 기본값: `soft`

---

## 3. 세부 점수(하위 지표)

### KidSafetyScore · `kid_safety_score`
자외선·미세먼지·열지수·풍속을 조합한 어린이 안전 종합지수 (0~100).
- 사용 화면: 가족 레이어 ON 시 홈/스코어/주변 배지
- 컬럼(예정): `activity_weather_score.kid_safety_score` 또는 함수로 계산
- 낮을수록 주의. 40 미만은 "실내 대안" 자동 추천.

### 골든아워 품질점수 · `golden_hour_score`
일출/일몰 시점의 사진·감성 조건 품질 (0~100).
- 조건: 운량 20~60%, 강수 확률 < 20%, 가시거리 양호
- 사용 화면: 연인 레이어 ON 시 홈/장소 추천/주변 우선순위
- 컬럼(예정): `activity_weather_score.golden_hour_score`

### activity_weather_score
목적별(해수욕/트레킹/사진/미식/…) 가중치를 적용한 맞춤 점수 테이블 또는 RPC.
- 호출 패턴: `get_activity_score(city_id, date_range, purpose)`

---

## 4. 모드·레이어

### 기본 모드
연인/가족 레이어 OFF 상태. 전체 사용자 기본 진입값.

### 연인 레이어 · `mode.couple`
ON 시 골든아워/로맨틱 콘텐츠 가중, D-day 기념일 템플릿 활성화.
- 상태: `modeStore.couple: boolean`

### 가족 레이어 · `mode.family`
ON 시 KidSafetyScore 우선, 자외선/미세먼지 경계 강화, 실내 대안 자동 추천.
- 상태: `modeStore.family: boolean`

### 레이어 중첩
커플 ON + 가족 ON 동시 가능. 상호 배타 아님.

---

## 5. 여행 기획 용어

### best_travel_week
도시별 주간 단위 Climate Score 최상위 구간 테이블. 장소 추천/스코어의 1차 소스.

### 숨은 황금 시즌 · `hidden_season_highlights`
과거 10년 데이터에서 "Climate Score 80+ 이면서 관광객 수 평균 이하"인 구간을 별도 추출한 큐레이션.
- 화면: `/hidden-season`

### D-day · `user_dday_events`
사용자가 저장한 여행/기념일. D-30/D-7/D-1 알림 연동.
- 관련: `reminder_set`, `push_sent`, `push_tap` 이벤트

### 에코트립 · `eco_trip`
비수기·지역 분산 여행을 장려하는 콘셉트. 소셜 임팩트 화면에 반영.

---

## 6. 데이터·캐시

### climate_normals
도시별 30년 평균 기후 (월/주/일 단위). Climate Score 계산의 기준값.

### monthly_climate
도시별 월평균 기온/강수량/맑음일수 등 요약. 차트 렌더링에 사용.

### climate_frequency
"X월 Y일 이 도시에서 맑음 빈도" 같은 날짜-조건 빈도 집계. 홈 인사이트에 사용.
- 배치: `build-climate-frequency` Edge Function

### forecast_weather
Open-Meteo/KMA 기반 예보 캐시 테이블. 갱신 주기: 1시간~3시간.
- 배치: `refresh-forecast` Edge Function

### rain_risk_calendar
날짜별 강수 확률을 캘린더 형태로 제공하는 뷰/함수. D-day·장소 추천 캘린더에 사용.

### nearby_places
주변 추천 결과 캐시. TourAPI/카테고리 데이터 기반.

---

## 7. 사용자·인증

### user_sessions
로그인 세션 + 사용량 집계. 구독 가격 조정 배치의 입력값.

### user_subscriptions
구독 상태 머신. 상세: `PAYMENT-SPEC.md` (Phase 1 유보).

### user_weather_archive
과거 날씨 + 사진/메모를 함께 저장하는 사용자 아카이브.

### user_bookmarks
장소/도시 즐겨찾기.

### CLIMATE Plus
프리미엄 구독 플랜 명칭. `PRD.md` §3 참조.

---

## 8. 외부 API (Phase 1 기준)

| 이름 | 용도 | 키 발급처 |
|---|---|---|
| Open-Meteo | 과거 기후 · 예보 | 무료, 키 없음 |
| AirKorea | 국내 PM2.5/PM10 | 공공데이터포털 |
| TourAPI v2 | 관광지 메타 | 공공데이터포털 |
| Kakao Local | 국내 역지오코딩 | Kakao Developers |
| Google Maps | Places/Geocoding (해외) | Google Cloud |
| IQAir | 해외 AQI (Phase 1.5+) | IQAir |
| KMA Open API | TCI 보강 (Phase 1.5+) | 기상청 |

상세 발급/쿼터: `EXTERNAL-API-GUIDE.md` (작성 예정) · `ENV-SETUP.md`.

---

## 9. 배치·인프라

### refresh-forecast
예보 데이터 갱신 Edge Function. 스케줄: 3시간마다.

### build-climate-frequency
날짜별 기후 조건 빈도 집계 배치. 스케줄: 일 1회.

### build-climate-scores
Climate Score 월별/주별 사전계산 배치.

### adjust-subscription-price
사용량 기반 구독가 조정 배치 (Phase 1 유보).

### track-session
사용자 세션 로그 수집 Edge Function.

---

## 10. 소셜 임팩트 용어

### 비수기 지역 예약 비율
대도시 성수기 외 지역(비수기/중소도시) 방문/예약 비중. KPI 목표: ≥ 20%.

### SDG 11
UN Sustainable Development Goal 11 — "지속가능한 도시와 공동체". 서비스 소셜 미션의 주거점.

### 지역 분산 점수
성수기 집중을 완화하는 방향의 기여 정도. `/impact` 대시보드 지표.

---

## 11. UI·컴포넌트 공용 타입

```ts
type ScoreGrade = "excellent" | "good" | "fair" | "poor";
type WeatherTheme = "sunny" | "shower" | "cloudy" | "snow" | "heat" | "cold" | "rain" | "fog";
type ThemeIntensity = "full" | "soft" | "accent-only";
type AsyncState = "default" | "loading" | "empty" | "error";
type TravelPurpose = "family" | "beach" | "trekking" | "photo" | "food" | "romantic";
```

상세 컴포넌트 props: `COMPONENT-SPEC.md`.

---

## 12. 표기 일관성 규칙

- 서비스 공식명(UI): **CLIMATE**
- Climate Score는 `™` 심볼을 첫 노출에만 사용 가능
- 점수는 항상 숫자 + 등급 라벨 병기 (색상 단독 금지)
- 날짜: UI `YYYY.MM.DD`, 코드/DB `ISO 8601 (YYYY-MM-DD)`
- 시간: UI 24시간 `HH:mm`, 타임존은 Asia/Seoul 기본

---

## 13. 관련 문서

- 제품 정의: `PRD.md`
- 범위 고정: `MVP-SCOPE.md`
- 디자인 토큰: `DESIGN-SYSTEM.md`
- 컴포넌트 API: `COMPONENT-SPEC.md`
- DB 스키마: `DB-SCHEMA.md` · `DB-GAP-ANALYSIS.md`
