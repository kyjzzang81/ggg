# ggg Component Specification

> 목적: 화면 구현 전에 컴포넌트 계약(Props, 상태, 접근성, 반응형, 이벤트)을 고정해 프론트엔드 구현/리뷰 기준을 일치시킨다.
> 마지막 업데이트: 2026-04-21

> 범위: Phase 1 MVP 핵심 컴포넌트 13개  
> 기준 문서: `PRD.md`, `DEV-SPEC.md`, `DESIGN-SYSTEM.md`, `MVP-SCOPE.md`

---

## 1. 공통 규칙

## 1-1. 네이밍

- 컴포넌트: PascalCase (`HeroCard`)
- Props 타입: `<ComponentName>Props`
- 이벤트 핸들러: `on*` (`onSelectDate`, `onToggle`)
- Boolean props: `is*`, `has*`, `show*`

## 1-2. 공통 상태

모든 데이터성 컴포넌트는 아래 상태를 지원한다.

- `default`
- `loading`
- `empty`
- `error`
- `disabled` (입력/조작 컴포넌트만)

## 1-3. 접근성(공통)

- 키보드 포커스 가능 요소는 `focus-visible` 스타일 필수
- 아이콘 전용 버튼은 `aria-label` 필수
- 색상 단독 의미 전달 금지 (텍스트/아이콘 병행)
- 동적 텍스트/알림은 필요한 경우 `aria-live` 사용
- 최소 터치 영역 40x40px 이상

## 1-4. 반응형(공통)

- Mobile: `<=767px`
- Tablet: `768~1023px`
- Desktop: `>=1024px`

## 1-5. 타입 공용 정의(권장)

```ts
type ScoreGrade = "excellent" | "good" | "fair" | "poor";
type WeatherTheme = "sunny" | "shower" | "cloudy" | "snow" | "heat" | "cold" | "rain" | "fog";

type AsyncState = "default" | "loading" | "empty" | "error";
```

---

## 2. 컴포넌트 명세

## 2-1. `HeroCard`

서비스 상단 핵심 메시지 + 현재 컨텍스트 요약.

```ts
interface HeroCardProps {
  title: string;
  subtitle?: string;
  locationLabel?: string;
  weatherTheme: WeatherTheme;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  badges?: string[];
  state?: AsyncState;
}
```

- 상태
  - `loading`: 스켈레톤
  - `empty`: 기본 문구 + 재시도 CTA
  - `error`: 에러 안내 + 재시도 버튼
- 접근성
  - CTA 버튼 `aria-label`

## 2-2. `GggScoreBadge`

등급 + 보조 라벨 표시(홈에서는 숫자 점수 비노출 기본).

```ts
interface GggScoreBadgeProps {
  score?: number; // 내부 계산/보조화면에서만 사용 (홈 기본 비노출)
  grade: ScoreGrade;
  label?: string; // 예: "강력 추천"
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  showNumericScore?: boolean; // default false
}
```

- 규칙
  - 숫자 노출이 필요한 화면에서만 점수 반올림 표기
  - 등급 텍스트 동시 표시 (색상만 사용 금지)

## 2-3. `StatCard`

단일 지표 카드(기온/PM2.5/강수 등).

```ts
interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  state?: AsyncState;
}
```

- 접근성
  - 값 갱신 빈도 높으면 `font-variant-numeric: tabular-nums` 적용

## 2-4. `ForecastStrip`

일별 예보 가로 스트립.

```ts
interface ForecastItem {
  date: string; // ISO
  dayLabel: string; // "월", "화"
  weatherCode: number;
  tempMin: number;
  tempMax: number;
  uvIndex?: number | null;   // 일최대
  pm25?: number | null;      // 일평균
  pm10?: number | null;      // PM2.5 기반 환산
  isHighlighted?: boolean; // D-day 등
}

interface ForecastStripProps {
  items: ForecastItem[];
  onSelectDate?: (date: string) => void;
  selectedDate?: string;
  state?: AsyncState;
  showOverlayGraph?: boolean; // 최고기온 배경 면+라인 오버레이
  showLabelUnits?: boolean;   // 좌측 라벨 하단 단위 caption
}
```

- 그래프 규칙
  - `showOverlayGraph=true`일 때 최고기온 영역에 면+라인 그래프를 배경으로 렌더링
  - 최저기온 및 기타 지표는 숫자 행으로 유지해 정보 과밀을 방지
- 단위 표기 규칙
  - `showLabelUnits=true`일 때 라벨 아래 caption 단위를 항상 노출
  - 단위는 `%`, `mm`, `km/h`, `UV index`, `ug/m3` 등 지표별 고정 맵으로 관리

## 2-5. `MonthlyBarChart`

월별 ggg score 차트.

```ts
interface MonthlyScorePoint {
  month: number; // 1~12
  score: number; // 0~100
}

interface MonthlyBarChartProps {
  data: MonthlyScorePoint[];
  selectedMonth?: number;
  onSelectMonth?: (month: number) => void;
  state?: AsyncState;
}
```

- 접근성
  - 차트 대체 텍스트/테이블 요약 제공 권장

## 2-6. `PercentileChart`

최악/일반/최상 분포 시각화.

```ts
interface PercentileChartProps {
  lowLabel: string;
  midLabel: string;
  highLabel: string;
  lowValue: number;
  midValue: number;
  highValue: number;
  unit?: string;
  state?: AsyncState;
}
```

## 2-7. `ScoreCalendar`

날짜별 점수/추천도 캘린더.

```ts
interface ScoreCalendarDay {
  day: number;
  score: number; // 0~100
  grade: ScoreGrade;
  disabled?: boolean;
}

interface ScoreCalendarProps {
  year: number;
  month: number; // 1~12
  days: ScoreCalendarDay[];
  viewMode?: "monthly" | "weekly" | "daily"; // 추천도 표현 단위
  rangeStartDay?: number | null;
  rangeEndDay?: number | null;
  onSelectDay: (day: number) => void;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  state?: AsyncState;
}
```

- 필수 동작
  - 일자별 `score + grade` 표시
  - 범위(start/end) 선택 표시
  - 월 전환
  - 월/주/일 뷰 전환 시 추천도 표현 동기화
- 접근성
  - `role="grid"` / `role="gridcell"` 권장
  - 셀 `aria-label`: `"3일, 69점, 추천"`

## 2-7-1. `ScoreCityPicker`

스코어 화면 진입 직후 중앙에서 도시를 고르게 하는 선택 컴포넌트.

```ts
interface ScoreCityPickerProps {
  value: string | null; // city_id
  options: Array<{ id: string; name: string }>;
  onChange: (cityId: string) => void;
  state?: AsyncState;
}
```

- 상태
  - `loading`: 검색 입력/목록 스켈레톤
  - `empty`: 매칭 도시 없음 안내
  - `error`: 불러오기 실패 + 재시도

## 2-7-2. `ScoreContextPanel`

선택한 도시/기간의 데이터 해석 영역(홈 insight 유사).

```ts
interface ScoreContextPanelProps {
  cityLabel: string;
  rangeLabel: string;
  summary: string;
  bullets?: string[];
  mode: { couple: boolean; family: boolean };
  state?: AsyncState;
}
```

## 2-7-3. `TravelTypeTabs`

여행형태 3개 탭과 선택 상태.

```ts
type TravelTypeKey = "relax" | "activity" | "citywalk";

interface TravelTypeTabsProps {
  items: Array<{ key: TravelTypeKey; label: string }>;
  selected: TravelTypeKey;
  onChange: (key: TravelTypeKey) => void;
}
```

## 2-7-4. `ScoreRecommendationList`

선택한 여행형태 기준 Top 5 주차 추천 목록.

```ts
interface ScoreRecommendationItem {
  weekLabel: string; // 예: "10월 2주차"
  grade: ScoreGrade;
  score?: number;
  reason: string; // 추천 이유
  dataPoints?: string[]; // 핵심 지표 요약
}

interface ScoreRecommendationListProps {
  items: ScoreRecommendationItem[];
  state?: AsyncState;
}
```

## 2-7-5. `DdaySaveSheet`

스코어 화면 하단 CTA에서 호출되는 D-day 저장 바텀시트.

```ts
interface DdaySaveSheetProps {
  open: boolean;
  cityId: string;
  cityLabel: string;
  startDate: string | null;
  endDate?: string | null;
  onClose: () => void;
  onSaved?: (eventId: string) => void;
}
```

## 2-8. `WeatherSwitcher`

테마 전환 스위처(데모/운영 공용).

```ts
interface WeatherSwitcherProps {
  value: WeatherTheme;
  onChange: (theme: WeatherTheme) => void;
  options?: WeatherTheme[]; // default 8종
  floating?: boolean;
}
```

- 운영 모드에서는 비활성/숨김 가능

## 2-9. `ListItem`

추천 결과 리스트 아이템.

```ts
interface ListItemProps {
  title: string;
  description?: string;
  tags?: string[];
  score?: number;
  grade?: ScoreGrade;
  rightSlot?: React.ReactNode; // 가격, 거리 등
  onClick?: () => void;
}
```

## 2-10. `Tag`

칩/배지 컴포넌트.

```ts
interface TagProps {
  label: string;
  tone?: "blue" | "green" | "orange" | "purple" | "gray";
  size?: "sm" | "md";
  outlined?: boolean;
}
```

## 2-11. `AlertBanner`

안내/주의/에러 배너.

```ts
interface AlertBannerProps {
  variant: "info" | "success" | "warning" | "error";
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  dismissible?: boolean;
  onDismiss?: () => void;
}
```

## 2-12. `Sidebar`

PC/태블릿 네비게이션.

```ts
interface NavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  href?: string;
  badge?: string | number;
}

interface SidebarProps {
  items: NavItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  compact?: boolean; // tablet icon mode
}
```

## 2-13. `MobileBottomNav`

모바일 하단 탭 5개.

```ts
interface MobileBottomNavProps {
  items: NavItem[]; // 홈/스코어/장소/주변/D-day
  activeId: string;
  onSelect: (id: string) => void;
}
```

- 규칙
  - 탭 수 최대 5
  - 아이콘 + 라벨 동시 표기

---

## 3. 화면별 컴포넌트 조합

- 홈: `HeroCard`, `StatCard`, `ForecastStrip`, `Tag`, `AlertBanner`
- 스코어: `ScoreCalendar`, `GggScoreBadge`, `MonthlyBarChart`, `PercentileChart`
- 장소추천: `ScoreCalendar`, `ListItem`, `Tag`, `GggScoreBadge`
- 주변: `ListItem`, `Tag`, `AlertBanner`
- D-day: `GggScoreBadge`, `ForecastStrip`, `AlertBanner`
- 공통: `Sidebar`, `MobileBottomNav`, `WeatherSwitcher`(운영 설정에 따라)

---

## 4. 구현 우선순위

1. `MobileBottomNav`, `Sidebar` (레이아웃 고정)
2. `GggScoreBadge`, `Tag`, `StatCard` (기초 UI)
3. `ScoreCalendar` (핵심 차별 컴포넌트)
4. `ListItem`, `ForecastStrip` (목록/예보)
5. `MonthlyBarChart`, `PercentileChart` (차트)
6. `HeroCard`, `AlertBanner`, `WeatherSwitcher` (경험 고도화)

---

## 5. 리뷰 체크리스트

- [ ] 모든 컴포넌트에 `loading/empty/error` 처리 존재
- [ ] 점수 표현은 숫자+라벨 동시 제공
- [ ] 색상 의미 충돌 없음(테마 vs 위험 신호)
- [ ] 키보드 포커스/스크린리더 라벨 확인
- [ ] 모바일 터치 영역 40x40px 이상
