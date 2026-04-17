# CLIMATE User Journey

> 목적: PRD 페르소나 3종의 대표 시나리오를 "진입 → 탐색 → 결정 → 재방문" 단계로 서술해 UI/데이터 요구를 고정한다.
> 기준: `PRD.md` §2 페르소나 · `MVP-SCOPE.md` §2-2 핵심 화면 기능

---

## 0. 공통 원칙

- 비로그인에서도 **탐색 플로우(홈→스코어→장소→주변)**는 완주 가능해야 한다.
- 저장/알림/개인화 레이어는 **로그인 시점에 점진적으로 요구**한다.
- 각 여정은 5분 내 핵심 의사결정에 도달한다 (`MVP-SCOPE.md` §8).

단계 라벨:
- **E(Entry)** 진입
- **D(Discover)** 탐색
- **C(Commit)** 결정/저장
- **R(Return)** 재방문

---

## 1. Persona A · 계획파 여행자 (25~35세)

**배경**: 연차를 아껴 연 2~3회 여행. 여행 전 평균 3주간 준비. 날씨 변수에 가장 민감.
**니즈**: "내가 고른 이 시기가 그 지역에서 진짜 좋은 시기인가?"
**레이어**: 기본 모드 (연인/가족 레이어 OFF)

### Journey A1 — "제주 5월 여행 기획"

| 단계 | 사용자 행동 | 화면 | 시스템 이벤트 | 필요 데이터 |
|---|---|---|---|---|
| E | 검색으로 진입 "제주 5월 날씨" | `/` (홈) | 위치 권한 요청 | `forecast_weather` |
| D | 도시 검색 → "제주" 선택 | `/score?city=jeju` | `city_search` | `cities`, `best_travel_week` |
| D | 5월 캘린더 확인 · 일자별 점수 비교 | `/score` | `calendar_open`, `calendar_range_select` | `climate_score_monthly` |
| D | 인근 도시 함께 확인 | `/compare` | `compare_add` | `climate_normals`, `monthly_climate` |
| C | 최고 점수 구간(5/10~14) 선택 → D-day 저장 시도 | 로그인 모달 | `login_required` | Supabase Auth |
| C | Google 로그인 → D-day 저장 | `/dday` | `dday_create`, `reminder_set:d30,d7,d1` | `user_dday_events` |
| R | D-30 알림 수신 → 예보 재확인 | 알림 → `/dday/:id` | `push_tap` | `forecast_weather` |
| R | D-7 알림 · 예보 변동 체크 | `/dday/:id` | `forecast_refresh` | `forecast_weather` |

**핵심 성공 신호**: Climate Score 확인 → 5분 내 D-day 저장. 재방문율(D-30/D-7 알림 tap rate) ≥ 40%.

---

## 2. Persona B · 기념일 커플 (22~30세)

**배경**: 1주년/100일 등 고정 일정. 날씨보다 **분위기/사진**이 우선.
**니즈**: "그 날짜에 노을이 예쁜 포토스팟은 어디?"
**레이어**: 기본 + 연인 ON

### Journey B1 — "1주년 당일치기 서울 근교"

| 단계 | 사용자 행동 | 화면 | 시스템 이벤트 | 필요 데이터 |
|---|---|---|---|---|
| E | 앱 재진입 | `/` | `session_start` | — |
| D | 모드 설정에서 "연인 레이어 ON" | `/` (레이어 반영) | `mode_toggle:couple` | `modeStore` |
| D | 홈에서 "저녁 추천" 카드 열람 → 장소 추천 이동 | `/place?purpose=romantic` | `home_card_tap` | `activity_weather_score` |
| D | 6월 21일 고정 · 근교 도시 스코어 비교 | `/place` · `/compare` | `filter_date`, `compare_add` | `rain_risk_calendar` |
| D | 추천 리스트에서 "남산 전망대" 확인 | `/place/:id` | `place_detail_open` | `nearby_places` |
| C | D-day로 기념일 저장 (템플릿: 1주년) | `/dday` | `dday_create:template=anniversary` | `user_dday_events` |
| R | D-1 알림 · 당일 체감기온/강수 확률 재확인 | `/dday/:id` | `push_tap` | `forecast_weather` |
| R | 사진 업로드 · 날씨 아카이브 | `/mypage` | `archive_create` | `user_weather_archive` |

**핵심 성공 신호**: 연인 레이어 ON 사용자의 `/place` 이탈률 < 30%. D-day 생성당 알림 tap rate ≥ 60%.

---

## 3. Persona C · 안전 우선 가족 (30~45세)

**배경**: 유아~초등 자녀 동반. 변수는 **PM2.5, 자외선, 폭염, 실내 대안**.
**니즈**: "오늘 아이 데리고 밖에 나가도 안전한가? 아니라면 근처 대안은?"
**레이어**: 기본 + 가족 ON

### Journey C1 — "주말 당일 외출 결정"

| 단계 | 사용자 행동 | 화면 | 시스템 이벤트 | 필요 데이터 |
|---|---|---|---|---|
| E | 토요일 오전 8시, 홈 진입 | `/` | `session_start` | `forecast_weather` |
| D | 홈 상단 안전 배너 확인 (UV 7 · PM2.5 35) | `/` | `safety_badge_view` | `forecast_weather` (UV/PM) |
| D | 가족 ON 상태 · KidSafetyScore 46 확인 | `/` | `kid_score_view` | 계산 결과 |
| D | "실내 대안" 카드 tap → 주변 실내 추천 | `/nearby?indoor=1` | `home_card_tap` | `nearby_places` (카테고리: 실내) |
| D | 지하철 3정거장 이내 "디뮤지엄" 선택 | `/nearby/:id` | `place_detail_open` | — |
| C | 북마크 저장 (로그인 필요 시 여기서 요구) | `/nearby/:id` | `bookmark_add` | `user_bookmarks` |
| R | 다음 주 토요일 자동 리마인드 (옵션 설정 시) | 알림 | `push_tap` | `user_sessions` |

**핵심 성공 신호**: 가족 ON 사용자의 "실내 대안" 카드 CTR ≥ 25%. 주간 재방문율 ≥ 55%.

---

## 4. 비인증(게스트) 여정

비로그인 사용자도 아래 흐름까지는 **기능 제약 없이** 완주한다.

```
홈 → 도시 검색 → Climate Score → 캘린더 범위 선택 → 장소 추천 → 주변 열람
```

제약 시점 (로그인 모달 표시):
- `user_dday_events` 쓰기 (D-day 저장)
- `user_bookmarks` 쓰기
- 알림 구독
- 마이페이지 진입

로그인 모달은 **현재 작업 컨텍스트를 유지**해야 한다 (로그인 후 원래 있던 화면/선택 상태 복원).

---

## 5. 오류/권한 fallback 여정

### 5-1. 위치 권한 거부 (홈/주변)

```
권한 거부 감지
→ 상단 배너 "위치를 직접 선택하세요"
→ 도시 검색창 강조
→ 수동 선택 후 기본 흐름 진입
```

### 5-2. 예보 API 실패 (홈)

```
예보 조회 실패
→ 마지막 캐시 데이터 + "오프라인/캐시" 라벨 노출
→ "다시 시도" 버튼
→ 재시도 성공 시 라벨 제거
```

### 5-3. 로그인 필요 화면 접근 (/dday, /mypage)

```
미인증 상태로 진입
→ 모달: "저장 기능은 로그인 후 가능해요"
→ Google/Apple 선택 → 리다이렉트 → 원래 화면 복귀
```

---

## 6. 여정별 KPI 매핑 (요약)

| 여정 | KPI | 측정 이벤트 |
|---|---|---|
| A1 (계획파) | 스코어 확인 → D-day 저장 전환율 | `calendar_range_select` → `dday_create` |
| B1 (커플) | 연인 레이어 ON 유지율 | `mode_toggle:couple` 이후 세션 길이 |
| C1 (가족) | 실내 대안 CTR | `home_card_tap[indoor=1]` / view |
| 공통 | D-n 알림 tap rate | `push_sent` → `push_tap` |
| 공통 | 비수기 지역 예약 비율 | `place_detail_open` 지역 분포 |

---

## 7. 연계 문서

- 화면 데이터/상태: `SCREEN-SPEC.md`
- URL 구조/딥링크: `NAVIGATION-FLOW.md`
- 레이어 토글 상태: `STATE-MANAGEMENT.md`
- 이벤트 정의 (공식): `METRICS-KPI.md` (작성 예정)
