# CLIMATE Component Specification

> 목적: 화면 구현 전에 컴포넌트 계약(Props, 상태, 접근성, 반응형, 이벤트)을 고정해 프론트엔드 구현/리뷰 기준을 일치시킨다.

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

## 2-2. `ClimateScoreBadge`

점수 + 등급 + 보조 라벨 표시.

```ts
interface ClimateScoreBadgeProps {
  score: number; // 0~100
  grade: ScoreGrade;
  label?: string; // 예: "강력 추천"
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}
```

- 규칙
  - 점수 반올림 표기
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
  isHighlighted?: boolean; // D-day 등
}

interface ForecastStripProps {
  items: ForecastItem[];
  onSelectDate?: (date: string) => void;
  selectedDate?: string;
  state?: AsyncState;
}
```

## 2-5. `MonthlyBarChart`

월별 Climate Score 차트.

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
- 접근성
  - `role="grid"` / `role="gridcell"` 권장
  - 셀 `aria-label`: `"3일, 69점, 추천"`

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
- 스코어: `ScoreCalendar`, `ClimateScoreBadge`, `MonthlyBarChart`, `PercentileChart`
- 장소추천: `ScoreCalendar`, `ListItem`, `Tag`, `ClimateScoreBadge`
- 주변: `ListItem`, `Tag`, `AlertBanner`
- D-day: `ClimateScoreBadge`, `ForecastStrip`, `AlertBanner`
- 공통: `Sidebar`, `MobileBottomNav`, `WeatherSwitcher`(운영 설정에 따라)

---

## 4. 구현 우선순위

1. `MobileBottomNav`, `Sidebar` (레이아웃 고정)
2. `ClimateScoreBadge`, `Tag`, `StatCard` (기초 UI)
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
