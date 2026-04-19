# ggg Design System

> 목적: `PRD.md`와 `DEV-SPEC.md`의 UI 규칙을 하나의 기준 문서로 통합해, 화면 구현 시 일관된 시각/상호작용 품질을 보장한다.

---

## 1. 디자인 원칙

- **Data-first UI**: 감성보다 의사결정 지원이 우선이다. (점수/확률/리스크가 먼저 보이게)
- **Theme-aware**: 날씨 테마가 바뀌어도 정보 구조와 조작 방식은 동일해야 한다.
- **Mobile-first**: 모바일에서 핵심 플로우(탐색→비교→저장)가 5분 내 완료되어야 한다.
- **Layered personalization**: 연인/가족은 독립 화면이 아니라 기본 화면 위 레이어로 작동한다.
- **Readable at a glance**: 색상만으로 의미 전달하지 않고 라벨/아이콘/텍스트를 함께 제공한다.

---

## 2. Design Tokens

## 2-1. Color

### Brand (Figma 기준 확정값)

| 토큰 | HEX | 용도 |
| ---- | --- | ---- |
| `brand.blue` | `#5260FE` | Primary, insight 카드 배경, 예보 summary |
| `brand.blue-tint` | `#EBEDFF` | 체감기온·바람 카드 배경, 기온 섹션 배경 |
| `brand.green` | `#13EA00` | ggg 로고 첫 번째 도트, insight 배지 배경 |
| `brand.purple` | `#C871FD` | ggg 로고 두 번째 도트, gs-great 등급 색 |
| `brand.orange` | `#FF8F2D` | insight 배지 텍스트, 최저기온 그래프 |
| `brand.red` | `#FF5B5B` | 일요일 텍스트, 강수확률 경고값 |
| `brand.yellow-tint` | `#F8F5E0` | 강수확률·습도·강수량 카드 배경 |
| `brand.purple-tint` | `#F6E7FF` | 자외선 카드 배경, gs-great 카드 배경 |
| `brand.green-tint` | `#DEF3DC` | 미세먼지 카드 배경, gs-good 카드 배경 |

### Gray

- `gray.100`: `#F2F4F7`
- `gray.200`: `#E4E7EC`
- `gray.300`: `#D0D5DD`
- `gray.400`: `#98A2B3`
- `gray.500`: `#667085`
- `gray.700`: `#344054`
- `gray.900`: `#101828`

### Semantic (ggg Grade)

| 등급 | 키 | 색 | 설명 |
| ---- | -- | -- | ---- |
| 강력 추천 | `gorgeous` | `#5260FE` (blue) | 3-dot logo (green+purple+blue) |
| 추천 | `great` | `#C871FD` (purple) | 2-dot logo (green+purple) |
| 보통 | `good` | `#13EA00` (green) | 1-dot logo (green) |
| 비추천 | `meh` | `#888` (gray) | — |

> 홈/핵심 진입 영역에서는 숫자 점수 대신 **ggg grade 배지**를 우선 사용한다. 텍스트 라벨을 항상 같이 제공한다.

### 날씨 지표 카드 배경색

| 지표 | 배경 토큰 | HEX |
| ---- | --------- | --- |
| 체감기온, 바람 | `brand.blue-tint` | `#EBEDFF` |
| 강수확률, 습도, 강수량 | `brand.yellow-tint` | `#F8F5E0` |
| 자외선 | `brand.purple-tint` | `#F6E7FF` |
| 미세먼지, 초미세먼지 | `brand.green-tint` | `#DEF3DC` |

## 2-2. Typography

- Font family: `Plus Jakarta Sans`, `sans-serif`
- Runtime root scale: `html { font-size: 17px }` (웹앱 현재 기준, `1rem = 17px`)
- 기본 규칙
  - Heading: 700
  - Section title: 600
  - Body: 400/500
  - Metric number: 700

추천 타입 스케일:
- Display: 32/40
- H1: 28/36
- H2: 24/32
- H3: 20/28
- Body-L: 16/24
- Body-M: 14/22
- Caption: 12/18

실구현 토큰(웹 코드):
- `--fs-2xs`, `--fs-xs`, `--fs-sm`, `--fs-md`, `--fs-lg`, `--fs-xl`
- 공통 컴포넌트/레이아웃은 위 토큰 우선 사용, 페이지 개별 px 하드코딩은 최소화

## 2-3. Radius

- `xs`: 6px
- `sm`: 10px
- `md`: 14px
- `lg`: 18px
- `xl`: 24px
- `2xl`: 32px

## 2-4. Shadow

- `xs`: `0 1px 2px rgba(16,24,40,0.05)`
- `sm`: `0 1px 3px rgba(16,24,40,0.1), 0 1px 2px rgba(16,24,40,0.06)`
- `md`: `0 4px 8px -2px rgba(16,24,40,0.1), 0 2px 4px -2px rgba(16,24,40,0.06)`
- `lg`: `0 12px 16px -4px rgba(16,24,40,0.08), 0 4px 6px -2px rgba(16,24,40,0.03)`

## 2-5. Spacing

8pt 기반을 기본으로 사용한다.

- `4`, `8`, `12`, `16`, `24`, `32`, `40`, `48`
- 카드 내부 기본 패딩: `16`
- 섹션 간 기본 간격: `24`
- 페이지 섹션 간격: `32`

---

## 3. Weather Theme System (8종)

테마는 시각 스타일 레이어이며, 정보 구조는 고정한다.

- `sunny`
- `shower`
- `cloudy`
- `snow`
- `heat`
- `cold`
- `rain`
- `fog`

적용 우선순위:
1. 폭염/한파(온도 조건)
2. WMO code 매핑
3. 기본 `cloudy` fallback

테마 적용 영역:
- Hero gradient
- Badge/Alert 색상
- 일부 추천 콘텐츠 톤

테마 비적용 영역:
- 핵심 텍스트 계층 구조
- 네비게이션 구조
- 폼 입력/검증 규칙

## 3-1. Theme Intensity Level Rules

테마는 화면 전체를 항상 강하게 덮지 않는다. 화면 목적에 따라 적용 강도를 구분한다.

- **Full**
  - Hero/상단 비주얼 영역을 테마 그라데이션으로 적극 적용
  - 사용 조건: 홈 상단, 날씨 상황 몰입이 중요한 뷰
  - 제한: 본문 카드/폼/표에는 직접 적용 금지 (가독성 우선)
- **Soft**
  - Surface 배경은 중립색 유지, 테마는 배지/보조 패널/분리선에 약하게 적용
  - 사용 조건: 리스트, 탐색형 화면(장소 추천/주변/비교)
  - 권장 기본값: 대부분의 프로덕션 화면
- **Accent-only**
  - 주요 CTA, 점 상태 점, 아이콘 포인트에만 테마 색 사용
  - 사용 조건: 데이터/입력 밀도가 높은 화면(폼, 설정, 결제, 마이페이지)
  - 목적: 브랜드 일관성과 정보 가독성을 최대화

### 적용 우선순위 규칙

1. 정보 가독성 > 테마 몰입감
2. 상태/위험 신호 색(에러/경고/성공)과 의미 충돌 금지
3. 브랜드 기본색(`brand.blue`) 계열을 기준축으로 유지
4. 고채도 테마(`heat`, 일부 `sunny`)는 Full 사용을 제한하고 Soft/Accent로 다운그레이드 가능

### 상태 신호 분리 규칙

- 테마 색은 "분위기" 역할
- 위험/오류 색은 "의미" 역할
- 동일 화면에서 `heat`(적색 계열)와 에러/비추천(적색 계열)이 공존할 때:
  - 에러는 아이콘 + 텍스트 + 보더로 별도 강조
  - 테마는 채도/명도를 낮춰 배경 레이어로만 사용

---

## 4. Layout & Breakpoints

- Mobile: `<= 767px`
  - 하단 탭 5개 + 햄버거 패널
- Tablet: `768px ~ 1023px`
  - 64px 아이콘 사이드바
- PC: `>= 1024px`
  - 240px 풀 사이드바

그리드 원칙:
- Mobile: 1~2열
- Tablet: 2열
- PC: 2~4열 (콘텐츠 성격에 따라 선택)

---

## 5. Navigation System

- 고정 하단 탭: `홈`, `스코어`, `장소`, `주변`, `D-day`
- 사이드 패널: `모드 설정`, `숨은 황금 시즌`, `도시 비교`, `소셜 임팩트`, `마이페이지`
- 연인/가족은 화면 분기가 아니라 콘텐츠 레이어 토글이다.
- 연인/가족 토글 UI는 홈 본문에 두지 않고, **사이드 패널 `모드 설정` 섹션**에서만 제어한다.

---

## 6. Core Components (v1)

- `<HeroCard />`
- `<GggScoreBadge />`
- `<StatCard />`
- `<ForecastStrip />`
- `<MonthlyBarChart />`
- `<PercentileChart />`
- `<ScoreCalendar />`
- `<WeatherSwitcher />`
- `<ListItem />`
- `<Tag />`
- `<AlertBanner />`
- `<Sidebar />`
- `<MobileBottomNav />`

컴포넌트 공통 상태:
- default / hover / active / disabled
- loading / empty / error

---

## 7. Score Visualization Rules

## 7-1. Score Grade

- `80~100`: 강력 추천
- `60~79`: 추천
- `40~59`: 보통
- `0~39`: 비추천

## 7-2. 표현 규칙

- 홈에서는 숫자 점수 노출 없이 등급 라벨 중심(`강력 추천/추천/보통/비추천`)으로 표시
- 배지 텍스트 우선, 색상은 보조
- 동일 점수라도 화면 맥락별 라벨은 동일 유지

## 7-4. 홈 5일 예보 그래프(그래스 스타일)

- 항목: 최고기온 / 최저기온 / 체감기온 3개
- 표현: 일자 카드 내부 미니 가로 막대 3줄(빨강/파랑/초록)
- 길이 기준: 동일 화면의 5일 구간에서 상대 길이 비교 가능해야 함
- 최소 길이 보장: 데이터가 낮아도 시각적 인지 가능하도록 10~12% 최소폭 유지

## 7-3. Calendar 표현 원칙

- 날짜 셀에 `점수` 또는 `등급 라벨` 중 최소 1개는 항상 노출
- 선택 범위(start/end)는 고대비 테두리로 구분
- 점수 없음 날짜는 `N/A` 또는 비활성 상태로 명시

---

## 8. Interaction & Motion

- 기본 인터랙션 시간: 150ms~220ms
- 사이드 패널 슬라이드: 220ms
- 탭 전환: 150ms (과도한 애니메이션 금지)
- 점수/배지 색상 전환은 즉시 반영, 레이아웃 점프 방지

---

## 9. Accessibility Baseline

- 텍스트 대비 WCAG AA 이상
- 인터랙티브 요소 키보드 포커스 링 필수
- 포커스 이동 순서는 시각 순서와 동일
- 아이콘 버튼은 `aria-label` 필수
- 색상 외 대체 신호(아이콘/텍스트/패턴) 제공

---

## 10. Icon System

- 날씨: `@meteocons/svg`, `@meteocons/lottie`
- UI: `lucide-react`
- 여행/활동: `@phosphor-icons/react` (선택)

원칙:
- 큰 히어로/상태 강조: Lottie
- 리스트/표/작은 칩: SVG 또는 Lucide

---

## 11. Content Style

- 문장 톤: 짧고 명확하게
- 수치 앞세우기: 라벨보다 점수/확률을 먼저 노출
- 경고 문구는 행동 제안까지 포함
  - 예: "비 확률 70% · 실내 플랜B를 확인하세요"

---

## 12. Implementation Mapping

- Tailwind 토큰: `tailwind.config.ts`에 정의
- 테마 매핑: `src/constants/weather-themes.ts`
- 모드 상태: `src/store/modeStore.ts`
- 점수 계산: `best_travel_week`, `activity_weather_score`, `climate_normals`

현 상태 구현 기준(2026-04):
- 스타일 엔진: 전역 CSS(`src/index.css`) + 화면 CSS(`src/pages/pages.css`) + 레이아웃 CSS
- 우선 원칙: **토큰 우선(token-first CSS)** / rem 기반 / 반복 스타일 변수화
- 점진 이관: 신규 UI는 토큰 기반으로 작성하고, 기존 하드코딩 스타일은 리팩터링 단계에서 순차 치환

---

## 13. Out of Scope (이 문서에서 다루지 않는 것)

- 법무/약관 문구
- 광고 영업 소재 운영 가이드
- 앱스토어 제출 디자인 산출물

---

## 14. 다음 문서 연계

- `COMPONENT-SPEC.md`: 컴포넌트별 Props/Variant 상세
- `CALENDAR-SCORE-UX.md`: 날짜 선택 캘린더 상호작용 상세
- `ACCESSIBILITY.md`: 접근성 체크리스트 상세
- `SCREEN-SPEC.md`: 화면별 데이터/상태/에러 처리 상세
