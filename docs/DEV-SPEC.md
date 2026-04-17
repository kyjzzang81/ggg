# CLIMATE 앱 개발 스펙 (바이브코딩 레퍼런스)

> **버전**: v3.0 (PRD v2.1 기준 반영)
> **중요 공지 (2026-04)**: 본 문서의 React+Vite 표기는 일부 레거시 기록이다. 현재 구현 기준 스택은 `FRONTEND-ARCHITECTURE.md`(Next.js App Router)와 `MVP-SCOPE.md`를 우선한다.
> **주요 변경**: 네비게이션 구조 개편 (하단 탭 5개 + 햄버거 사이드 패널), 주변(Nearby) 탭 신규, GPS 동 단위 인식, 모드 레이어 방식 전환, 구독 가격 조정 배치 로직

> **서비스 정의**: "날씨가 아니라 여행을 예측합니다" — 역사 기후 확률 + 실시간 날씨 + 여행 콘텐츠를 통합한 B2C 여행 특화 날씨 앱  
> **기준 목업**: `climate-app-v3.html` (Moonshot AI UI Kit 기반 라이트 테마)  
> **기준 DB**: Supabase PostgreSQL (스키마 파일: `DB-SCHEMA.md`)  
> **역사 데이터 기준**: **최근 30년** (1995-01-01 ~ 2025-12-31)

---

## 1. 개발 스펙 — 플랫폼 및 기술 스택

### 1-1. 출시 로드맵

```
Phase 1  →  웹앱 (React + Vite)               MVP, 즉시 배포 가능 (Vercel)
Phase 2  →  웹앱 + Capacitor                  iOS / Android 스토어 출시
             └ 동일 React 코드베이스 유지
             └ 네이티브 기능만 Capacitor 플러그인으로 추가
```

**Phase 2 전환 비용이 낮은 이유**
- Phase 1 React 코드를 그대로 사용, UI 변경 최소
- Capacitor가 웹뷰를 네이티브 쉘로 감싸는 방식
- 추가 작업: `npx cap add ios`, `npx cap add android` + 네이티브 플러그인 교체만

---

### 1-2. 프론트엔드 (Phase 1 — 웹앱, 레거시 기록)

| 항목 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | **React 18 + Vite 5** | 레거시 기록 (현재 기준: Next.js App Router) |
| 언어 | **TypeScript** | strict 모드 |
| 라우터 | **React Router v6** | 레거시 기록 (현재 기준: Next.js App Router) |
| 상태 관리 | **Zustand** | 전역 상태 (선택 도시, 날씨 테마 등) |
| 서버 상태 | **TanStack Query v5** | API 캐싱 + stale-while-revalidate |
| 스타일링 | **Tailwind CSS v3** | Moonshot UI Kit 토큰 기반 커스텀 테마 |
| 아이콘 (UI) | **Lucide React** | 네비게이션, 버튼, 일반 UI 아이콘 |
| 아이콘 (날씨) | **@meteocons/svg** + **lottie-react** | 날씨 상태 컬러 아이콘 (상세 내용: 섹션 16) |
| 차트 | **Recharts** | Climate Score 월별 차트 |
| 폼 | **React Hook Form + Zod** | 검색 및 입력 |
| 날짜 | **date-fns** | day_of_year 계산 포함 |
| HTTP | **Supabase JS Client v2** | `@supabase/supabase-js` |
| 환경 변수 | `.env.local` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

---

### 1-3. 프론트엔드 (Phase 2 — Capacitor 추가)

Phase 1 코드베이스 위에 Capacitor를 얹는 방식. **React 코드는 변경 없음**.

| 항목 | Phase 1 (웹) | Phase 2 (Capacitor 추가) |
|---|---|---|
| 프레임워크 | React + Vite | 동일 (변경 없음) |
| 플랫폼 | 웹 브라우저 | iOS (WKWebView) + Android (WebView) |
| Capacitor core | — | `@capacitor/core` + `@capacitor/cli` |
| iOS | — | `@capacitor/ios` + Xcode |
| Android | — | `@capacitor/android` + Android Studio |
| 위치 (Geolocation) | `navigator.geolocation` | `@capacitor/geolocation` (더 정확) |
| 알림 | Web Push API | `@capacitor/local-notifications` |
| 스토리지 | localStorage | `@capacitor/preferences` |
| 딥링크 | — | `@capacitor/app` |
| 상태바 | — | `@capacitor/status-bar` |
| 빌드 | `npm run build` → Vercel | `npm run build` → `npx cap sync` → Xcode/Android Studio |

**capacitor.config.ts 기본 설정**
```ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.climate.travel',
  appName: 'Climate',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#5260FE',
    },
    StatusBar: {
      style: 'Light',
      backgroundColor: '#FFFFFF',
    },
  },
};
export default config;
```

**Phase 2 마이그레이션 체크리스트**
```bash
# 1. Capacitor 설치
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
npm install @capacitor/geolocation @capacitor/local-notifications
npm install @capacitor/preferences @capacitor/status-bar @capacitor/app

# 2. 초기화
npx cap init "Climate" "app.climate.travel" --web-dir dist

# 3. 플랫폼 추가
npx cap add ios
npx cap add android

# 4. 빌드 & 동기화
npm run build
npx cap sync

# 5. 실행
npx cap open ios      # Xcode
npx cap open android  # Android Studio
```

**웹 API → Capacitor 플러그인 분기 처리**
```ts
// src/lib/platform.ts
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

// 위치 정보 예시
import { Geolocation } from '@capacitor/geolocation';

export async function getCurrentPosition() {
  if (isNative) {
    return await Geolocation.getCurrentPosition();
  } else {
    return new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject)
    );
  }
}
```

---

### 1-4. 백엔드 & 인프라

| 항목 | 선택 | 비고 |
|---|---|---|
| DB | **Supabase PostgreSQL** | 기존 스키마 그대로 사용 |
| Auth | **Supabase Auth** | 소셜 로그인 (Google, Apple) |
| Storage | **Supabase Storage** | `cities_images` 버킷 (홈 카드 배경) |
| API | **Supabase Edge Functions (Deno)** | 예보 갱신, Climate Score 계산 |
| 배포 | **Vercel** (웹앱) / **Expo EAS** (모바일) | |
| 모니터링 | **Sentry** | 에러 추적 |
| 예보 갱신 CRON | **Supabase pg_cron** 또는 **Edge Function + cron** | 매일 새벽 2시 KST |

---

### 1-5. 폴더 구조 (웹앱 기준)

```
src/
├── app/                    # 라우트 페이지
│   ├── home/
│   ├── score/              # Climate Score™
│   ├── hidden-season/      # 숨은 황금 시즌
│   ├── compare/            # 도시 비교
│   ├── couple/             # 커플 모드
│   ├── family/             # 가족 모드
│   ├── dday/               # D-day 알림
│   └── impact/             # 소셜 임팩트
├── components/
│   ├── ui/                 # 디자인 시스템 컴포넌트
│   ├── weather/            # 날씨 관련 컴포넌트
│   └── layout/             # 사이드바, 토박, 하단 탭
├── hooks/                  # 커스텀 훅 (useWeather, useClimateScore 등)
├── lib/
│   ├── supabase.ts         # Supabase 클라이언트
│   ├── openmeteo.ts        # Open-Meteo API 유틸
│   └── weather-utils.ts    # WMO 코드 매핑, TCI 계산 등
├── stores/                 # Zustand 스토어
├── types/                  # TypeScript 타입 정의
└── constants/
    ├── weather-themes.ts   # 날씨 테마 8종 (색상, 아이콘, 멘트)
    └── wmo-codes.ts        # WMO weather_code → 한/영 매핑
```

---

## 2. 디자인 시스템

### 2-1. 기반: Moonshot AI UI Kit

목업 `climate-app-v3.html` 에서 추출한 토큰을 Tailwind config 에 반영한다.

```ts
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      brand: {
        blue:        '#5260FE',
        'blue-light':'#EEF0FF',
        'blue-mid':  '#C4C8FF',
        'blue-dark': '#3340CC',
        green:       '#BEFBB6',
        'green-dark':'#2C9E1E',
        'green-light':'#EDFCEB',
        orange:      '#FE7C52',
        'orange-light':'#FFF0EB',
        purple:      '#C871FD',
        'purple-light':'#F7EBFF',
      },
      gray: {
        100: '#F2F4F7',
        200: '#E4E7EC',
        300: '#D0D5DD',
        400: '#98A2B3',
        500: '#667085',
        700: '#344054',
        900: '#101828',
      }
    },
    borderRadius: {
      xs:  '6px',
      sm:  '10px',
      md:  '14px',
      lg:  '18px',
      xl:  '24px',
      '2xl':'32px',
    },
    fontFamily: {
      sans: ['Plus Jakarta Sans', 'sans-serif'],
    },
    boxShadow: {
      xs: '0 1px 2px rgba(16,24,40,0.05)',
      sm: '0 1px 3px rgba(16,24,40,0.1), 0 1px 2px rgba(16,24,40,0.06)',
      md: '0 4px 8px -2px rgba(16,24,40,0.1), 0 2px 4px -2px rgba(16,24,40,0.06)',
      lg: '0 12px 16px -4px rgba(16,24,40,0.08), 0 4px 6px -2px rgba(16,24,40,0.03)',
    }
  }
}
```

### 2-2. 폰트

```html
<!-- Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### 2-3. 날씨 테마 시스템 (8종)

WMO `weather_code` → 테마 클래스 자동 매핑. `weather-themes.ts` 에 정의.

```ts
// src/constants/weather-themes.ts
export type WeatherTheme = 'sunny' | 'shower' | 'cloudy' | 'snow' | 'heat' | 'cold' | 'rain' | 'fog';

export const WEATHER_THEMES: Record<WeatherTheme, {
  heroFrom: string;   // gradient start
  heroTo: string;     // gradient end
  accent: string;     // text accent
  accentFill: string; // button/badge fill
  badgeBg: string;
  badgeText: string;
  alertBg: string;
  alertBorder: string;
  alertText: string;
  icon: string;       // emoji
  label: string;      // 한국어
  wmoRange: number[]; // WMO 코드 범위
}> = {
  sunny:  { heroFrom:'#FFB300', heroTo:'#FF8C00', accentFill:'#FF8C00', badgeBg:'#FEF3C7', badgeText:'#92400E', alertBg:'#FFFBEB', alertBorder:'#FDE68A', alertText:'#92400E', accent:'#B45309', icon:'☀️', label:'맑음', wmoRange:[0,1] },
  shower: { heroFrom:'#38BDF8', heroTo:'#0284C7', accentFill:'#0EA5E9', badgeBg:'#E0F2FE', badgeText:'#0C4A6E', alertBg:'#F0F9FF', alertBorder:'#BAE6FD', alertText:'#075985', accent:'#0369A1', icon:'🌦️', label:'소나기', wmoRange:[80,81,82] },
  cloudy: { heroFrom:'#94A3B8', heroTo:'#475569', accentFill:'#64748B', badgeBg:'#F1F5F9', badgeText:'#334155', alertBg:'#F8FAFC', alertBorder:'#CBD5E1', alertText:'#334155', accent:'#475569', icon:'☁️', label:'흐림', wmoRange:[2,3,45,48] },
  snow:   { heroFrom:'#93C5FD', heroTo:'#3B82F6', accentFill:'#60A5FA', badgeBg:'#EFF6FF', badgeText:'#1E3A8A', alertBg:'#EFF6FF', alertBorder:'#BFDBFE', alertText:'#1E40AF', accent:'#1D4ED8', icon:'❄️', label:'눈', wmoRange:[71,72,73,75,76,77,85,86] },
  heat:   { heroFrom:'#F97316', heroTo:'#DC2626', accentFill:'#EF4444', badgeBg:'#FEE2E2', badgeText:'#7F1D1D', alertBg:'#FFF5F5', alertBorder:'#FCA5A5', alertText:'#991B1B', accent:'#B91C1C', icon:'🌡️', label:'폭염', wmoRange:[] }, // temp_max >= 33 조건
  cold:   { heroFrom:'#3B82F6', heroTo:'#1E3A8A', accentFill:'#3B82F6', badgeBg:'#EFF6FF', badgeText:'#1E3A8A', alertBg:'#EFF6FF', alertBorder:'#BFDBFE', alertText:'#1E40AF', accent:'#1E3A8A', icon:'🥶', label:'한파', wmoRange:[] }, // apparent_temp <= -10 조건
  rain:   { heroFrom:'#4F86C6', heroTo:'#1E40AF', accentFill:'#3B82F6', badgeBg:'#DBEAFE', badgeText:'#1E3A8A', alertBg:'#EFF6FF', alertBorder:'#93C5FD', alertText:'#1E40AF', accent:'#1D4ED8', icon:'🌧️', label:'하루종일 비', wmoRange:[61,63,65,66,67] },
  fog:    { heroFrom:'#94A3B8', heroTo:'#64748B', accentFill:'#94A3B8', badgeBg:'#F1F5F9', badgeText:'#334155', alertBg:'#F8FAFC', alertBorder:'#CBD5E1', alertText:'#475569', accent:'#475569', icon:'🌫️', label:'안개', wmoRange:[45,48,51,53,55] },
};

// WMO weather_code → WeatherTheme 변환 함수
export function getWeatherTheme(weatherCode: number, tempMax?: number, apparentTemp?: number): WeatherTheme {
  if (tempMax !== undefined && tempMax >= 33) return 'heat';
  if (apparentTemp !== undefined && apparentTemp <= -10) return 'cold';
  if ([0, 1].includes(weatherCode)) return 'sunny';
  if ([2, 3].includes(weatherCode)) return 'cloudy';
  if ([45, 48].includes(weatherCode)) return 'fog';
  if ([51, 53, 55].includes(weatherCode)) return 'fog';
  if ([61, 63, 65, 66, 67].includes(weatherCode)) return 'rain';
  if ([71, 72, 73, 75, 76, 77, 85, 86].includes(weatherCode)) return 'snow';
  if ([80, 81, 82].includes(weatherCode)) return 'shower';
  return 'cloudy';
}
```

### 2-4. 반응형 브레이크포인트

목업 v3 기준과 동일. Tailwind 기본값 활용.

```
mobile:  max-width 767px  → 사이드바 없음, 하단 탭 네비
tablet:  768px ~ 1023px   → 아이콘 전용 사이드바 (64px)
pc:      1024px 이상       → 풀 사이드바 (240px)
```

### 2-4-B. 네비게이션 구조 (PRD v2.1 확정)

**하단 탭 (모바일, 5개 고정)**

```ts
// src/components/layout/BottomNav.tsx
const NAV_ITEMS = [
  { id: 'home',     icon: '🏠', label: '홈',      screen: 'Home' },
  { id: 'score',    icon: '🌡️', label: '스코어',  screen: 'ClimateScore' },
  { id: 'place',    icon: '📍', label: '장소',     screen: 'PlaceFinder' },
  { id: 'nearby',   icon: '📌', label: '주변',     screen: 'Nearby' },
  { id: 'dday',     icon: '📅', label: 'D-day',   screen: 'Dday' },
] as const;
```

**사이드 패널 (햄버거 ≡ 클릭 → 슬라이드 인)**

```ts
// src/components/layout/SidePanel.tsx
const SIDE_PANEL_ITEMS = [
  { id: 'mode',    icon: '⚙️', label: '모드 설정',     screen: null },  // 인라인 토글
  { id: 'hidden',  icon: '✦',  label: '숨은 황금 시즌', screen: 'HiddenSeason' },
  { id: 'compare', icon: '⚖️', label: '도시 비교',      screen: 'CityCompare' },
  { id: 'impact',  icon: '🌱', label: '소셜 임팩트',    screen: 'Impact' },
  { id: 'mypage',  icon: '👤', label: '마이페이지',     screen: 'MyPage' },
] as const;
```

**모드 레이어 상태 (Zustand)**

```ts
// src/store/modeStore.ts
interface ModeState {
  coupleMode: boolean;   // 연인 레이어 ON/OFF
  familyMode: boolean;   // 가족 레이어 ON/OFF
  toggleCouple: () => void;
  toggleFamily: () => void;
}

// 모드는 독립 화면이 아님 — 각 화면 컴포넌트가 modeStore를 구독하여
// 활성화된 레이어에 따라 추가 콘텐츠를 조건부 렌더링
```

**반응형 레이아웃 분기**

```ts
// PC/태블릿: 사이드바 항상 노출 (모든 항목 표시)
// 모바일: 하단 탭 5개 + 우상단 햄버거(≡) → 사이드 패널
```

---

### 2-5. 핵심 컴포넌트 목록

```
<HeroCard />           - 날씨 테마 그라디언트 히어로 카드
<ClimateScoreBadge />  - 76/100 점수 + 퍼센타일 바
<StatCard />           - 기온/PM2.5/강수/쾌적도 지표 카드
<ForecastStrip />      - 5~14일 예보 가로 스크롤
<MonthlyBarChart />    - Climate Score 월별 막대 차트 (Recharts)
<PercentileChart />    - 역사 기후 분포 바 (최악/일반/최상)
<ScoreCalendar />      - 날짜별 Climate Score/추천도 캘린더 (색상 히트맵 + 등급 배지)
<WeatherSwitcher />    - 날씨 상태 전환 sticky 버튼 (8종)
<BarChart />           - TCI 비교 막대
<ListItem />           - 여행지/활동 리스트 아이템
<Tag />                - 색상 배지 (tag-blue/green/orange/purple/gray)
<AlertBanner />        - 기상 경보 배너 (날씨별 색상)
<ImpactRow />          - 소셜 임팩트 KPI 행
<Sidebar />            - PC/Tablet 사이드 네비게이션
<MobileBottomNav />    - 모바일 하단 탭 네비게이션
```

---

## 3. 필요 API

### 3-1. Open-Meteo (현재 사용 중)

#### Historical Weather API — 과거 데이터 수집용 (데이터 파이프라인)

```
GET https://archive-api.open-meteo.com/v1/archive
  ?latitude={lat}
  &longitude={lon}
  &start_date=2016-01-01
  &end_date=2025-12-31
  &hourly=temperature_2m,apparent_temperature,relative_humidity_2m,
          precipitation,rain,snowfall,weather_code,cloud_cover,
          wind_speed_10m,wind_direction_10m,wind_gusts_10m
  &timezone=UTC
```

- 수집 결과 → `hourly_weather` 테이블 upsert
- Python 스크립트 (`data-pipeline/fetch_historical.py`) 로 일괄 실행

#### Forecast API — 14일 예보 (매일 새벽 갱신)

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude={lat}
  &longitude={lon}
  &hourly=temperature_2m,apparent_temperature,relative_humidity_2m,
          precipitation,rain,snowfall,weather_code,cloud_cover,
          wind_speed_10m,wind_direction_10m,wind_gusts_10m
  &forecast_days=14
  &timezone=UTC
```

- 수집 결과 → `forecast_weather` 테이블 upsert
- Supabase Edge Function `refresh-forecast` 에서 pg_cron으로 매일 새벽 2시 실행
- 전체 도시 순회: `cities` 테이블에서 `city_id`, `lat`, `lon` 조회 후 루프

#### Open-Meteo WMO weather_code 매핑

```
0   → 맑음 (Clear sky)
1   → 대체로 맑음
2   → 부분 흐림
3   → 흐림 (Overcast)
45  → 안개
48  → 안개 (서리)
51~55 → 이슬비
61~67 → 비
71~77 → 눈
80~82 → 소나기
85~86 → 눈 소나기
95  → 뇌우
96~99 → 뇌우 + 우박
```

---

### 3-2. Supabase (클라이언트 직접 호출)

앱에서 직접 Supabase JS Client로 호출. 별도 API 서버 불필요.

#### 주요 쿼리 패턴

**현재 날씨 (오늘 forecast)**
```ts
const today = new Date().toISOString().split('T')[0];
const { data } = await supabase
  .from('forecast_weather')
  .select('*')
  .eq('city_id', cityId)
  .gte('timestamp', `${today}T00:00:00Z`)
  .lt('timestamp', `${today}T24:00:00Z`)
  .order('timestamp', { ascending: true });
```

**Climate Score™ 계산용 데이터**
```ts
// 특정 주차의 역사 기후 통계
const { data } = await supabase
  .from('best_travel_week')
  .select('travel_score, temp_score, rain_score, humidity_score')
  .eq('city_id', cityId)
  .eq('week_of_year', weekOfYear)
  .single();
```

**월별 Climate Score (차트용)**
```ts
// 12개월 전체 조회
const { data } = await supabase
  .from('best_travel_week')
  .select('week_of_year, travel_score')
  .eq('city_id', cityId)
  .order('week_of_year');
```

**캘린더 날짜별 Score 매핑 (스카이스캐너형 날짜 탐색 UI)**
```ts
// month 기준으로 day_of_year 구간을 만들어 일자별 점수/등급 렌더링
const { startDoy, endDoy } = getMonthDayRange(year, month); // 윤년 보정 포함

// 1) 날짜별 기본 기후 점수 소스 (climate_normals 기반)
const { data: normals } = await supabase
  .from('climate_normals')
  .select('day_of_year, temp_avg, rain_probability, wind_avg')
  .eq('city_id', cityId)
  .gte('day_of_year', startDoy)
  .lte('day_of_year', endDoy);

// 2) 장소추천 화면일 경우 목적별 점수로 우선 표시
const { data: activity } = await supabase
  .from('activity_weather_score')
  .select('day_of_year, score')
  .eq('city_id', cityId)
  .eq('activity', activityType)
  .gte('day_of_year', startDoy)
  .lte('day_of_year', endDoy);

// 렌더링: 날짜 셀에 score(0~100) + gradeBadge('강력 추천'|'추천'|'보통'|'비추천')
```

**D-day 날씨 히스토리 (rain_risk_calendar)**
```ts
const dayOfYear = getDayOfYear(targetDate); // date-fns
const { data } = await supabase
  .from('rain_risk_calendar')
  .select('rain_probability, risk_level')
  .eq('city_id', cityId)
  .eq('day_of_year', dayOfYear)
  .single();
```

**가족 모드 — 어린이 안전 지수 (climate_normals)**
```ts
const { data } = await supabase
  .from('climate_normals')
  .select('temp_avg, temp_max_avg, humidity_avg, rain_probability, wind_avg')
  .eq('city_id', cityId)
  .eq('day_of_year', dayOfYear)
  .single();
```

**날씨 상태 빈도 (climate_frequency) — "10년 중 X번 맑음"**
```ts
const { data } = await supabase
  .from('climate_frequency')
  .select('clear_days, rain_days, snow_days, hot_days, heatwave_days, cold_days, total_years')
  .eq('city_id', cityId)
  .eq('day_of_year', dayOfYear)
  .single();
```

**활동별 날씨 적합도 점수**
```ts
const { data } = await supabase
  .from('activity_weather_score')
  .select('activity, score')
  .eq('city_id', cityId)
  .eq('day_of_year', dayOfYear);
// activities: beach / hiking / city_sightseeing
```

**도시 검색**
```ts
const { data } = await supabase
  .from('cities')
  .select('id, name_ko, name_en, country, region')
  .or(`name_ko.ilike.%${query}%, name_en.ilike.%${query}%`)
  .limit(10);
```

**홈 카드 목록**
```ts
const { data } = await supabase
  .from('home_cards')
  .select('*')
  .eq('is_active', true)
  .order('sort_order');
```

---

### 3-3. 추가 API — 전체 스펙

---

#### ① 에어코리아 API (한국환경공단) — 국내 미세먼지 실시간

| 항목 | 내용 |
|---|---|
| 발급처 | 공공데이터포털 (data.go.kr) |
| 비용 | **무료** |
| 인증 | API Key (serviceKey) |
| 용도 | 국내 도시 PM2.5 / PM10 실시간 · 예보 |
| 적용 화면 | 홈 (현재 대기질), 가족 모드 (어린이 안전 지수) |

**주요 엔드포인트**
```
# 측정소별 실시간 대기질
GET https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty
  ?stationName={측정소명}
  &dataTerm=DAILY
  &pageNo=1&numOfRows=1
  &returnType=json
  &serviceKey={API_KEY}
  &ver=1.4

# 대기질 예보 (오늘/내일/모레)
GET https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMinuDustFrcstDspth
  ?searchDate={YYYY-MM-DD}
  &returnType=json
  &serviceKey={API_KEY}
  &numOfRows=10
```

**응답 핵심 필드**
```ts
interface AirKoreaRealtimeItem {
  stationName: string;   // 측정소명
  pm10Value: string;     // PM10 농도 (㎍/㎥)
  pm25Value: string;     // PM2.5 농도 (㎍/㎥)
  pm10Grade: string;     // 1(좋음) 2(보통) 3(나쁨) 4(매우나쁨)
  pm25Grade: string;
  dataTime: string;      // 측정 시각
  khaiGrade: string;     // 통합대기환경지수 등급
}
```

**측정소 매핑 전략**
```ts
// cities 테이블의 lat/lon → 가장 가까운 측정소 사전 매핑
// supabase cities 테이블에 station_name 컬럼 추가 권장
// 예: seoul → "중구", busan → "연제구"

// 캐싱 전략: TanStack Query staleTime 30분 (실시간 대기질)
const { data } = useQuery({
  queryKey: ['airkorea', cityId],
  queryFn: () => fetchAirKorea(stationName),
  staleTime: 30 * 60 * 1000,
});
```

**PM2.5 등급 기준 (WHO 기준 적용)**
```ts
export function getPM25Grade(value: number): 'good' | 'moderate' | 'bad' | 'very_bad' {
  if (value <= 15) return 'good';      // 좋음
  if (value <= 35) return 'moderate';  // 보통
  if (value <= 75) return 'bad';       // 나쁨
  return 'very_bad';                   // 매우 나쁨
}
```

---

#### ② 한국관광공사 TourAPI v2 — 여행 콘텐츠 큐레이션

| 항목 | 내용 |
|---|---|
| 발급처 | 공공데이터포털 (data.go.kr) |
| 비용 | **무료** |
| 인증 | API Key (serviceKey) |
| 데이터 규모 | 관광지 / 음식점 / 숙박 / 축제 / 레포츠 등 **26만 건** |
| 적용 화면 | 홈 (날씨 트리거 콘텐츠 추천), 커플·가족 모드 |

**주요 엔드포인트**
```
# 지역 기반 관광정보 목록
GET https://apis.data.go.kr/B551011/KorService1/areaBasedList1
  ?serviceKey={API_KEY}
  &numOfRows=10
  &pageNo=1
  &MobileOS=ETC
  &MobileApp=Climate
  &areaCode={지역코드}    # 1=서울, 6=부산, 39=제주 등
  &sigunguCode={시군구코드}
  &contentTypeId={타입}   # 12=관광지, 14=문화시설, 15=축제, 28=레포츠, 32=숙박, 39=음식점
  &_type=json

# 날씨 조건별 필터링 (contentTypeId 활용)
# 맑음 → contentTypeId=28 (레포츠), 15 (축제)
# 비/안개 → contentTypeId=14 (문화시설), 39 (음식점)
# 폭염/한파 → contentTypeId=32 (숙박), 14 (실내 문화)
```

**날씨 × 콘텐츠 타입 매핑 전략**
```ts
// src/constants/weather-content-map.ts
export const WEATHER_CONTENT_MAP: Record<WeatherTheme, {
  contentTypeIds: number[];
  tags: string[];
  label: string;
}> = {
  sunny:  { contentTypeIds: [28, 15, 12], tags: ['야외', '체험', '액티비티'], label: '야외 활동 추천' },
  shower: { contentTypeIds: [14, 39, 32], tags: ['실내', '맛집', '카페'],     label: '실내 피신 추천' },
  cloudy: { contentTypeIds: [14, 39, 12], tags: ['전시', '갤러리', '맛집'],   label: '감성 코스 추천' },
  snow:   { contentTypeIds: [28, 12, 39], tags: ['설경', '스키', '온천'],     label: '겨울 특화 추천' },
  heat:   { contentTypeIds: [14, 32, 39], tags: ['냉방', '실내', '해수욕'],   label: '더위 탈출 추천' },
  cold:   { contentTypeIds: [39, 32, 14], tags: ['찜질방', '국밥', '온천'],   label: '따뜻한 실내 추천' },
  rain:   { contentTypeIds: [14, 39, 32], tags: ['뮤지컬', '공연', '서점'],   label: '비 오는 날 추천' },
  fog:    { contentTypeIds: [39, 14, 32], tags: ['창가', '감성', '스파'],     label: '안개 감성 추천' },
};
```

**응답 처리**
```ts
interface TourItem {
  contentid: string;
  contenttypeid: string;
  title: string;
  addr1: string;          // 주소
  firstimage: string;     // 대표 이미지 URL
  mapx: string;           // 경도
  mapy: string;           // 위도
  tel: string;
}
// 캐싱: staleTime 24시간 (콘텐츠 변화 적음)
```

---

#### ③ 기상청 API (KMA Open API) — TCI 및 한국 특화 예보

| 항목 | 내용 |
|---|---|
| 발급처 | 기상청 기상자료개방포털 (data.kma.go.kr) |
| 비용 | **무료** |
| 인증 | API Key |
| 용도 | 관광기후지수(TCI), 생활기상지수, 단기예보 |
| 적용 화면 | Climate Score™ TCI 보강, 홈 날씨 지수 |

**주요 엔드포인트**
```
# 생활기상지수 (자외선, 체감온도, 불쾌지수 등)
GET https://apis.data.go.kr/1360000/LivingWthrIdxServiceV4/getUVIdx
  ?serviceKey={API_KEY}
  &pageNo=1&numOfRows=10
  &dataType=JSON
  &time={YYYYMMDDHH}
  &areaNo={지역코드}

# 관광기후지수 (TCI)
GET https://apis.data.go.kr/1360000/TouristInfoSvc/getTouristClmtInfo
  ?serviceKey={API_KEY}
  &pageNo=1&numOfRows=10
  &dataType=JSON
  &startDt={YYYYMMDD}
  &endDt={YYYYMMDD}
  &stnIds={기상청 지점코드}
```

**TCI 활용 전략**
```ts
// Climate Score™ = best_travel_week.travel_score (주 기반)
// TCI = 기상청 관광기후지수 (일 기반, 한국 도시 한정)
// → 국내 도시에 한해 TCI로 Climate Score™ 보정 레이어 추가
// → 해외 도시는 Open-Meteo 기반 자체 알고리즘만 사용

export function getEnhancedScore(
  baseScore: number,   // best_travel_week.travel_score
  tci?: number         // 기상청 TCI (국내 도시만)
): number {
  if (!tci) return baseScore * 100;
  return Math.round((baseScore * 0.7 + (tci / 100) * 0.3) * 100);
}
```

**생활기상지수 → 가족 모드 안전 지수 연동**
```ts
// UV 지수: getUVIdx → 가족 모드 자외선 안전 점수
// 체감온도: getLPIdx → 가족 모드 체감온도 안전 점수
// 불쾌지수: getDiscomfortIdx → 쾌적도 점수 보정
```

---

#### ④ Google Maps API — 도시·장소 검색 자동완성

| 항목 | 내용 |
|---|---|
| 발급처 | Google Cloud Console |
| 비용 | 월 $200 무료 크레딧 (초과 시 유료) |
| 인증 | API Key |
| 용도 | 도시 검색 자동완성, 위경도 추출, 장소 검색 |
| 적용 화면 | 도시 검색, 도시 추가 요청 (city_requests) |

**사용 API 3종**
```
1. Places API (Autocomplete)  → 도시명 입력 시 자동완성
2. Geocoding API              → 도시명 → 위경도 변환
3. Place Details API          → 장소 상세 정보 (선택)
```

**Places Autocomplete 구현**
```ts
// src/hooks/useCitySearch.ts
import { useQuery } from '@tanstack/react-query';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export function useCityAutocomplete(input: string) {
  return useQuery({
    queryKey: ['city-autocomplete', input],
    queryFn: async () => {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
        `?input=${encodeURIComponent(input)}` +
        `&types=(cities)` +          // 도시 타입만 필터
        `&language=ko` +             // 한국어 결과 우선
        `&key=${GOOGLE_MAPS_KEY}`
      );
      return res.json();
    },
    enabled: input.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}

// Geocoding: 도시명 → lat/lon
export async function geocodeCity(placeId: string) {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?place_id=${placeId}` +
    `&key=${GOOGLE_MAPS_KEY}`
  );
  const data = await res.json();
  const loc = data.results[0]?.geometry?.location;
  return { lat: loc?.lat, lon: loc?.lng };
}
```

**도시 추가 요청 플로우 (city_requests 연동)**
```
사용자 입력 → Google Autocomplete → place_id 선택
→ Geocoding으로 lat/lon 추출
→ city_requests 테이블 INSERT (city_name, lat, lon, country)
→ 관리자 검토 후 cities 테이블에 추가
```

**비용 절감 전략**
```ts
// 1. Supabase cities 테이블 먼저 검색 (무료)
// 2. 미등록 도시일 때만 Google API 호출
// 3. 검색 결과 Supabase에 캐시 (1주일)
// → 월 $200 무료 크레딧 내에서 운영 가능

async function searchCity(query: string) {
  // 1차: Supabase 내 도시 검색
  const { data: existing } = await supabase
    .from('cities')
    .select('id, name_ko, name_en, lat, lon')
    .or(`name_ko.ilike.%${query}%, name_en.ilike.%${query}%`)
    .limit(5);

  if (existing?.length) return existing;

  // 2차: Google Places Autocomplete
  return fetchGoogleAutocomplete(query);
}
```

---

#### ⑤ IQAir API — 해외 도시 대기질 AQI

| 항목 | 내용 |
|---|---|
| 발급처 | iqair.com/air-pollution-data-api |
| 비용 | 무료 플랜 1만 call/월, 유료 플랜 $99/월~ |
| 인증 | API Key |
| 용도 | 해외 도시 실시간 AQI / PM2.5 (에어코리아 미제공 국가) |
| 적용 화면 | 홈 (대기질 지표), 가족 모드 (해외 여행 시) |

**엔드포인트**
```
# 도시별 실시간 대기질
GET https://api.airvisual.com/v2/city
  ?city={도시명}
  &state={주/도}
  &country={국가명}
  &key={API_KEY}

# 위경도 기반 가장 가까운 측정소
GET https://api.airvisual.com/v2/nearest_city
  ?lat={위도}
  &lon={경도}
  &key={API_KEY}
```

**응답 핵심 필드**
```ts
interface IQAirData {
  city: string;
  state: string;
  country: string;
  current: {
    pollution: {
      aqius: number;   // AQI (US 기준, 0~500)
      mainus: string;  // 주요 오염원 ("p2" = PM2.5)
      aqicn: number;   // AQI (중국 기준)
      p2: { conc: number; aqius: number }; // PM2.5 농도
    };
    weather: {
      tp: number;   // 기온 °C
      hu: number;   // 습도 %
      ws: number;   // 풍속 m/s
      ic: string;   // 날씨 아이콘 코드
    };
  };
}
```

**국내/해외 분기 처리**
```ts
// src/lib/air-quality.ts
export async function getAirQuality(cityId: string, country: string) {
  if (country === 'KR') {
    // 국내: 에어코리아 (무료, 정확도 높음)
    return fetchAirKorea(cityId);
  } else {
    // 해외: IQAir (해외 도시 커버리지)
    return fetchIQAir(cityId);
  }
}

// AQI → PM2.5 등급 통일 변환
export function aqiToPM25Grade(aqi: number): 'good' | 'moderate' | 'bad' | 'very_bad' {
  if (aqi <= 50)  return 'good';
  if (aqi <= 100) return 'moderate';
  if (aqi <= 150) return 'bad';
  return 'very_bad';
}
```

**무료 플랜 한도 운영 전략**
```ts
// 1만 call/월 제한 → 효율적 사용 필요
// 캐싱: TanStack Query staleTime 1시간 (해외 대기질 변화 느림)
// 조건: 해외 도시 화면 진입 시에만 호출 (홈 화면 국내 도시 제외)
// Phase 2에서 MAU 증가 시 유료 플랜($99/월) 전환 검토
```

---

#### API 우선순위 및 단계별 도입

| API | Phase 1 (MVP) | Phase 2 |
|---|---|---|
| 에어코리아 | ✅ 필수 도입 | 유지 |
| TourAPI | ✅ 필수 도입 (콘텐츠 큐레이션 핵심) | 유지 |
| 기상청 KMA | ⚠️ 선택 (TCI 보강용) | 도입 권장 |
| Google Maps | ✅ 도시 검색 필수 | 유지 |
| IQAir | ⚠️ 선택 (해외 도시 대기질) | 도입 권장 |

**Phase 1 MVP 최소 구성**
```bash
# 필수
VITE_AIRKOREA_API_KEY=xxxx          # 공공데이터포털 무료 발급
VITE_TOURAPI_KEY=xxxx               # 공공데이터포털 무료 발급
VITE_GOOGLE_MAPS_API_KEY=xxxx       # Google Cloud Console

# 선택 (V1.5~)
VITE_KMA_API_KEY=xxxx               # 기상자료개방포털 무료 발급
VITE_IQAIR_API_KEY=xxxx             # IQAir 무료 플랜
```

---

## 4. 필요 데이터 (DB 기반)

### 4-1. 현재 Supabase 구축 현황 요약

> **역사 데이터 기준**: `climate_normals`, `monthly_climate`, `best_travel_week`, `rain_risk_calendar`, `activity_weather_score` 등 모든 통계는 **최근 30년 (1995-2025)** 기준으로 계산. `hourly_weather` 원본 데이터는 더 오래됐더라도 Feature 계산 시 30년 윈도우만 사용.

| 레이어 | 테이블 | 상태 | 비고 |
|---|---|---|---|
| RAW | `cities` | ✅ 완료 | 도시 마스터 |
| RAW | `hourly_weather` | ✅ 완료 | 2016-2025 |
| AGGREGATION | `daily_weather` | ✅ 완료 | hourly 집계 |
| CLIMATE | `climate_normals` | ✅ 완료 | 365행/도시 |
| CLIMATE | `monthly_climate` | ✅ 완료 | 12행/도시 |
| FORECAST | `forecast_weather` | ✅ 완료 | 14일, 매일 갱신 |
| FEATURE | `best_travel_week` | ✅ 완료 | 52행/도시 |
| FEATURE | `rain_risk_calendar` | ✅ 완료 | 365행/도시 |
| FEATURE | `weather_stability_index` | ✅ 완료 | 12행/도시 |
| FEATURE | `activity_weather_score` | ✅ 완료 | 활동×365행/도시 |
| FEATURE | `climate_frequency` | ⚠️ 미완성 | 빌드 스크립트 미구현 |
| UI | `weather_character_map` | ✅ 완료 | WMO → 캐릭터 매핑 |
| UI | `home_cards` | ✅ 완료 | 홈 카드 CMS |
| USER | `city_requests` | ✅ 완료 | 도시 추가 요청 |

### 4-2. 신규 추가 필요 테이블

아래 테이블은 목업의 킬러 피처 구현을 위해 신규 추가가 필요하다.

---

#### [USER] `user_dday_events` — D-day 알림 기능

```sql
CREATE TABLE user_dday_events (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  city_id      TEXT REFERENCES cities(id),
  event_name   TEXT NOT NULL,          -- "100일 기념일 제주 여행"
  event_date   DATE NOT NULL,          -- D-day 날짜
  event_type   TEXT DEFAULT 'travel',  -- travel / anniversary / birthday
  note         TEXT,
  notify_d30   BOOLEAN DEFAULT true,   -- D-30 알림
  notify_d7    BOOLEAN DEFAULT true,   -- D-7 알림
  notify_d1    BOOLEAN DEFAULT true,   -- D-1 알림
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: 본인만 CRUD
```

---

#### [USER] `user_weather_archive` — 날씨 아카이브 기능

```sql
CREATE TABLE user_weather_archive (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  city_id        TEXT REFERENCES cities(id),
  event_date     DATE NOT NULL,
  event_name     TEXT,                 -- "크리스마스 명동 데이트"
  weather_code   SMALLINT,
  temp_avg       REAL,
  temp_max       REAL,
  precipitation  REAL,
  memo           TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: 본인만 CRUD
```

---

#### [USER] `user_bookmarks` — 도시/여행 북마크

```sql
CREATE TABLE user_bookmarks (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  city_id    TEXT REFERENCES cities(id),
  label      TEXT,        -- 커스텀 라벨 (예: "신혼여행 후보")
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, city_id)
);
```

---

#### [FEATURE] `nearby_places` — 주변 장소 캐시 (Nearby 탭)

TourAPI v2에서 가져온 주변 장소 데이터를 위치별로 캐시하는 테이블.

```sql
CREATE TABLE nearby_places (
  id              BIGSERIAL PRIMARY KEY,
  city_id         TEXT REFERENCES cities(id),
  place_id        TEXT NOT NULL,           -- TourAPI contentid
  content_type_id SMALLINT,                -- 12=관광지, 14=문화, 28=레포츠, 39=음식점 등
  title           TEXT NOT NULL,
  addr            TEXT,
  lat             FLOAT,
  lon             FLOAT,
  image_url       TEXT,
  tel             TEXT,
  weather_tags    TEXT[],                  -- ['맑음', '비', '폭염'] — 날씨 조건별 추천
  mode_tags       TEXT[],                  -- ['couple', 'family'] — 레이어별 우선 노출
  cached_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(city_id, place_id)
);
-- 갱신: 도시별 주 1회 배치
```

---

#### [USER] `user_sessions` — 방문 횟수 추적 (구독 가격 조정용)

```sql
CREATE TABLE user_sessions (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  visited_at TIMESTAMPTZ DEFAULT NOW(),
  year_month TEXT NOT NULL   -- 'YYYY-MM' 형식 (예: '2025-10')
);
-- 인덱스: user_id + year_month
CREATE INDEX idx_sessions_user_month ON user_sessions(user_id, year_month);

-- 월별 방문 횟수 집계 함수
CREATE OR REPLACE FUNCTION get_monthly_visit_count(p_user_id UUID, p_year_month TEXT)
RETURNS INT AS $$
  SELECT COUNT(*)::INT FROM user_sessions
  WHERE user_id = p_user_id AND year_month = p_year_month;
$$ LANGUAGE SQL STABLE;
```

---

#### [USER] `user_subscriptions` — 구독 상태 및 가격 관리

```sql
CREATE TABLE user_subscriptions (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  status          TEXT DEFAULT 'free',       -- free / active / inactive
  price           INTEGER DEFAULT 0,         -- 현재 결제 금액 (원): 0 / 1900 / 3900
  billing_key     TEXT,                      -- 토스페이먼츠 빌링키
  started_at      TIMESTAMPTZ,
  next_billing_at TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
-- status: free=무료, active=활성(₩1,900), inactive=비활성(₩3,900)
```

---

#### [FEATURE] `climate_score_monthly` — Climate Score™ 월별 캐시

`best_travel_week` (주별)을 월 단위로 집계한 캐시 테이블.  
매번 52행 집계 쿼리 없이 12행으로 빠른 조회 가능.

```sql
CREATE TABLE climate_score_monthly (
  id            BIGSERIAL PRIMARY KEY,
  city_id       TEXT REFERENCES cities(id),
  month         SMALLINT,            -- 1~12
  climate_score REAL,                -- 0~100 (0~1 × 100)
  temp_score    REAL,
  rain_score    REAL,
  humidity_score REAL,
  grade         TEXT,                -- excellent / good / fair / poor
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(city_id, month)
);
-- 빌드: best_travel_week에서 월별 평균 집계
-- 갱신: 월 1회 또는 데이터 업데이트 시
```

---

#### [FEATURE] `hidden_season_highlights` — 숨은 황금 시즌 콘텐츠

운영팀이 데이터 기반으로 관리하는 CMS 성격 테이블.

```sql
CREATE TABLE hidden_season_highlights (
  id            BIGSERIAL PRIMARY KEY,
  city_id       TEXT REFERENCES cities(id),
  peak_month    SMALLINT,      -- 성수기 월 (편견)
  golden_month  SMALLINT,      -- 실제 최적 월 (데이터 기반)
  peak_tci      REAL,          -- 성수기 TCI 점수
  golden_tci    REAL,          -- 황금 시즌 TCI 점수
  headline_ko   TEXT,          -- "강릉, 10월이 8월보다 좋다?"
  desc_ko       TEXT,          -- 상세 설명
  tags          TEXT[],        -- ["비수기", "인파없음", "특가"]
  is_active     BOOLEAN DEFAULT true,
  sort_order    INTEGER DEFAULT 0
);
```

---

### 4-3. Climate Score™ 계산 로직 정의

```
Climate Score™ = (TravelScore × 100) 반올림

TravelScore (0~1) = best_travel_week.travel_score
  = 0.4 × TempScore + 0.4 × RainScore + 0.2 × HumidityScore

등급 분류:
  80~100 → "우수" (excellent)  → 강력 추천
  60~79  → "양호" (good)       → 추천
  40~59  → "보통" (fair)       → 무난
  0~39   → "주의" (poor)       → 재고 권장

퍼센타일 표현 (UI):
  하위 10% 기준 기온 → "최악 10% 경우"
  25~75% 범위       → "일반적인 범위"
  상위 10% 기준 기온 → "최상 10% 경우"
  → climate_normals.temp_avg ± (temp_stddev × 1.28) 로 계산
```

---

### 4-4. 어린이 안전 종합지수 계산 로직 (가족 레이어)

> PRD v2.1: 가족 모드는 독립 화면이 아니라 **가족 레이어**로 전환됨. `modeStore.familyMode === true` 조건 시 홈·장소추천·주변 화면에 조건부 렌더링됨.

```
KidSafetyScore (0~100) = round(
  TempSafe × 0.3 +
  PmSafe   × 0.3 +
  UvSafe   × 0.2 +
  RainSafe × 0.2
)

TempSafe:  apparent_temp_avg 18~26°C → 100, 벗어날수록 감소 (linear)
PmSafe:    pm25 < 15 → 100, 15~35 → 60, 35~75 → 30, >75 → 0
           (PM2.5는 에어코리아 API 또는 IQAir API에서 실시간 조회)
UvSafe:    uv_index < 3 → 100, 3~5 → 70, 6~7 → 40, >8 → 10
           (UV 지수는 Open-Meteo forecast.uv_index_max 사용)
RainSafe:  rain_probability < 10% → 100, 10~40% → 70, >40% → 30

등급: ≥70 "안전" / 50~69 "주의" / <50 "위험"
```

---

## 5. 화면별 데이터 흐름 매핑

> PRD v2.1 기준. 하단 탭 5개 + 사이드 패널 구조 반영.
> 커플/가족 모드는 독립 화면이 아니라 modeStore 레이어로 각 화면에 조건부 렌더링.

**하단 탭 화면**

| 화면 | 사용 테이블 | Open-Meteo API | 비고 |
|---|---|---|---|
| **홈** | `forecast_weather`, `climate_frequency`, `home_cards` | Forecast API | 동 단위 GPS 위치 기반. 연인 레이어 ON → 골든아워 추가. 가족 레이어 ON → 안전지수 추가 |
| **Climate Score™** | `best_travel_week`, `climate_normals`, `monthly_climate`, `climate_score_monthly` | — | 연인 레이어 ON → D-day 저장 CTA 추가. 가족 레이어 ON → 안전 지수 강조 |
| **장소 추천** | `activity_weather_score`, `best_travel_week`, `rain_risk_calendar`, `cities` | — | 목적+시기 입력 → 여행지 추천. 레이어별 추천 콘텐츠 다름 |
| **주변 (Nearby)** | `cities` (위치 기반) | Forecast API (현재 위치) | TourAPI v2 연동. 날씨 테마별 카테고리 우선순위 변동. 레이어별 추천 카테고리 다름 |
| **D-day** | `user_dday_events`, `rain_risk_calendar`, `forecast_weather`, `user_weather_archive` | — | 인증 필요. 연인 레이어 ON → 기념일 유형 추가. 가족 레이어 ON → 소풍 유형 추가 |

**사이드 패널 화면**

| 화면 | 사용 테이블 | Open-Meteo API | 비고 |
|---|---|---|---|
| **숨은 황금 시즌** | `hidden_season_highlights`, `best_travel_week` | — | CMS + 계산. 레이어별 비교 예시 다름 |
| **도시 비교** | `best_travel_week`, `monthly_climate` | — | 최대 4개 도시 |
| **소셜 임팩트** | 임팩트 집계 뷰 (신규) | — | MVP에서 하드코딩 가능 |
| **마이페이지** | `user_dday_events`, `user_weather_archive`, `user_bookmarks` | — | 모드 설정 토글 포함 |

**모드 레이어별 추가 데이터 (조건부)**

| 레이어 | 추가 데이터 | 적용 화면 |
|---|---|---|
| 연인 ON | `forecast_weather.sunrise`, `forecast_weather.sunset` → 골든아워 계산 | 홈, Climate Score™, D-day |
| 가족 ON | `forecast_weather.uv_index_max`, 에어코리아 PM2.5 → 안전 지수 | 홈, 장소 추천, 주변 |

---

## 6. 인증 (Supabase Auth)

```
비로그인 (anon):    도시 검색, 날씨 조회, Climate Score 확인
소셜 로그인 필요:   D-day 저장, 날씨 아카이브, 북마크

지원 소셜: Google OAuth, Apple Sign In (모바일 App Store 필수)
```

### RLS 정책 요약

```sql
-- user_dday_events: 본인만 CRUD
CREATE POLICY "own_dday" ON user_dday_events
  USING (auth.uid() = user_id);

-- user_weather_archive: 본인만 CRUD
CREATE POLICY "own_archive" ON user_weather_archive
  USING (auth.uid() = user_id);

-- home_cards: 비로그인 읽기 허용
CREATE POLICY "anon_read" ON home_cards
  FOR SELECT USING (is_active = true);

-- city_requests: 비로그인 INSERT 허용
CREATE POLICY "anon_insert" ON city_requests
  FOR INSERT WITH CHECK (true);
```

---

## 7. Supabase Edge Functions

### 7-1. `refresh-forecast` (기존)

매일 새벽 2시 KST 실행. 전체 cities 테이블 순회 → Open-Meteo Forecast API 호출 → `forecast_weather` upsert.

```ts
// 스케줄: pg_cron
SELECT cron.schedule('refresh-forecast', '0 17 * * *', -- UTC 17시 = KST 02시
  $$SELECT net.http_post(url:='https://{project}.supabase.co/functions/v1/refresh-forecast',
    headers:='{"Authorization": "Bearer {SERVICE_KEY}"}'::jsonb)$$
);
```

### 7-2. `build-climate-scores` (신규 필요)

`best_travel_week` → `climate_score_monthly` 월별 집계 캐시 생성.  
월 1회 또는 수동 트리거.

### 7-3. `build-climate-frequency` (신규 필요)

`daily_weather` (2016-2025) → `climate_frequency` 테이블 생성.  
최초 1회 실행 후 연 1회 갱신.

```sql
-- 핵심 쿼리 (DB-SCHEMA.md에 명시됨)
INSERT INTO climate_frequency (city_id, day_of_year, ...)
SELECT city_id, EXTRACT(DOY FROM date)::SMALLINT, ...
FROM daily_weather
WHERE date BETWEEN '2016-01-01' AND '2025-12-31'
GROUP BY city_id, day_of_year
ON CONFLICT (city_id, day_of_year) DO UPDATE SET ...;
```

---

### 7-4. `adjust-subscription-price` (신규 — 구독 가격 조정 배치)

매월 1일 실행. 전월 방문 횟수 기준으로 구독 가격을 ₩1,900 또는 ₩3,900으로 자동 조정.

```ts
// supabase/functions/adjust-subscription-price/index.ts
import { serve } from 'https://deno.land/std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 전월 YYYY-MM 계산
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2,'0')}`;

  // 활성/비활성 구독자 전체 조회
  const { data: subs } = await supabase
    .from('user_subscriptions')
    .select('user_id, price')
    .in('status', ['active', 'inactive']);

  for (const sub of subs ?? []) {
    // 전월 방문 횟수 조회
    const { data: countData } = await supabase.rpc('get_monthly_visit_count', {
      p_user_id: sub.user_id,
      p_year_month: yearMonth,
    });

    const visitCount = countData ?? 0;
    const newPrice = visitCount >= 5 ? 1900 : 3900;
    const newStatus = visitCount >= 5 ? 'active' : 'inactive';

    if (sub.price !== newPrice) {
      // 가격 업데이트
      await supabase
        .from('user_subscriptions')
        .update({ price: newPrice, status: newStatus, updated_at: new Date().toISOString() })
        .eq('user_id', sub.user_id);

      // 알림 발송 (가격 변경된 경우만)
      // → Supabase Realtime 또는 Web Push API 연동
    }
  }

  return new Response(JSON.stringify({ processed: subs?.length ?? 0 }), { status: 200 });
});
```

**스케줄**: 매월 1일 00:00 KST (Supabase pg_cron 또는 외부 cron 서비스)

```sql
-- pg_cron 설정 예시
SELECT cron.schedule('adjust-subscription-price', '0 15 1 * *', -- UTC 15:00 = KST 00:00
  $$ SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/adjust-subscription-price',
    headers := '{"Authorization": "Bearer <anon_key>"}'
  ) $$
);
```

---

### 7-5. `track-session` (신규 — 방문 횟수 기록)

앱 진입 시 호출. user_sessions 테이블에 방문 기록 저장.

```ts
// src/lib/session.ts
export async function trackSession(userId: string) {
  const yearMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  await supabase.from('user_sessions').insert({
    user_id: userId,
    year_month: yearMonth,
  });
}

// App.tsx — 로그인 상태일 때 진입 시 호출
useEffect(() => {
  if (user) trackSession(user.id);
}, []);
```

---

## 8. Open-Meteo 추가 파라미터 (현재 미수집)

목업 기능 구현을 위해 Forecast API에 아래 파라미터 추가 수집이 필요하다.

```
daily 파라미터 (일별, forecast 에 추가):
  uv_index_max          → 가족 모드 UV 안전 지수
  sunrise               → 커플 모드 골든아워 계산
  sunset                → 커플 모드 골든아워 계산
  sunshine_duration     → 일조 시간 (분)
  precipitation_hours   → 비 온 시간 수
  wind_speed_10m_max    → 최대 풍속

hourly 파라미터 (시간별, 기존에 추가):
  uv_index              → 시간별 UV 지수
  direct_radiation      → 직달일사량 (골든아워 품질 지수용)
  diffuse_radiation     → 산란일사량
```

`forecast_weather` 테이블에 컬럼 추가:
```sql
ALTER TABLE forecast_weather ADD COLUMN uv_index REAL;
ALTER TABLE forecast_weather ADD COLUMN uv_index_max REAL; -- daily 집계
ALTER TABLE forecast_weather ADD COLUMN sunrise TIMESTAMPTZ;
ALTER TABLE forecast_weather ADD COLUMN sunset TIMESTAMPTZ;
ALTER TABLE forecast_weather ADD COLUMN sunshine_duration INTEGER; -- 분
```

---

## 9. 골든아워 품질 지수 계산 (연인 레이어)

> PRD v2.1: 커플 모드는 독립 화면이 아니라 **연인 레이어**로 전환됨. 아래 계산 로직은 `modeStore.coupleMode === true` 조건 시 홈·장소추천·주변·D-day 화면에 조건부 렌더링됨.

```
GoldenHourScore (0~100) = round(
  CloudScore  × 0.4 +
  RadiationScore × 0.3 +
  HumidityScore × 0.2 +
  WindScore × 0.1
)

CloudScore:      cloud_cover < 20% → 100, 20~50% → 70, >50% → 40
RadiationScore:  direct_radiation (일몰 전 1시간 평균) 정규화 0~100
HumidityScore:   humidity < 60% → 100, 60~80% → 70, >80% → 30
WindScore:       wind_speed < 10km/h → 100, 10~20 → 70, >20 → 30

골든아워 시간:
  morning_golden = sunrise + 30분 ~ sunrise + 60분
  evening_golden = sunset - 60분 ~ sunset - 15분
```

---

## 10. 위치 인식 — 동(洞) 단위 GPS

PRD 요구사항: 실시간 날씨는 **동 단위**로 GPS 인식. 단순 cities 테이블 최근접 도시가 아니라 행정동 수준 역지오코딩이 필요.

### 10-1. 위치 인식 전략

```
1단계: GPS 좌표 획득 (navigator.geolocation)
  ↓
2단계: 역지오코딩 → 행정동명 추출
  - 국내: 카카오 로컬 API (좌표 → 행정동) 또는 Vworld 행정구역
  - 해외: Google Maps Geocoding API (cities 테이블 최근접 도시)
  ↓
3단계: 에어코리아 측정소 매핑
  - cities.station_name 컬럼으로 가장 가까운 측정소 연결
  ↓
4단계: 위치 표시 (예: "📍 서울 중구 명동2가 · 26°")
```

### 10-2. 구현 코드

```ts
// src/lib/location.ts

export interface LocationResult {
  coords: { lat: number; lon: number };
  dong: string;         // 행정동명 (예: "명동2가")
  district: string;     // 구/군명 (예: "중구")
  city: string;         // 시/도명 (예: "서울특별시")
  displayName: string;  // UI 표시용 (예: "서울 중구 명동2가")
  nearestCityId: string; // cities 테이블 city_id
  stationName: string;  // 에어코리아 측정소명
}

export async function getCurrentLocation(): Promise<LocationResult> {
  const pos = await new Promise<GeolocationPosition>((res, rej) =>
    navigator.geolocation.getCurrentPosition(res, rej, {
      enableHighAccuracy: true,
      timeout: 10000,
    })
  );

  const { latitude: lat, longitude: lon } = pos.coords;

  // 국내 여부 판단 (위도 33~39, 경도 124~132)
  const isKorea = lat >= 33 && lat <= 39 && lon >= 124 && lon <= 132;

  if (isKorea) {
    // 카카오 로컬 API — 좌표 → 행정동
    const kakaoRes = await fetch(
      `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lon}&y=${lat}`,
      { headers: { Authorization: `KakaoAK ${import.meta.env.VITE_KAKAO_REST_KEY}` } }
    );
    const kakaoData = await kakaoRes.json();
    const region = kakaoData.documents?.find((d: any) => d.region_type === 'H'); // 행정동

    const dong = region?.region_3depth_name ?? '';
    const district = region?.region_2depth_name ?? '';
    const city = region?.region_1depth_name ?? '';

    // cities 테이블에서 가장 가까운 측정 도시 + 에어코리아 측정소
    const { data } = await supabase.rpc('find_nearest_city_with_station', { p_lat: lat, p_lon: lon });

    return {
      coords: { lat, lon },
      dong, district, city,
      displayName: `${city.replace('특별시','').replace('광역시','')} ${district} ${dong}`.trim(),
      nearestCityId: data?.city_id ?? '',
      stationName: data?.station_name ?? '',
    };
  } else {
    // 해외: Google Geocoding + cities 최근접
    const { data } = await supabase.rpc('find_nearest_city_with_station', { p_lat: lat, p_lon: lon });
    return {
      coords: { lat, lon },
      dong: '', district: '', city: data?.name_en ?? '',
      displayName: data?.name_ko ?? data?.name_en ?? '',
      nearestCityId: data?.city_id ?? '',
      stationName: '',
    };
  }
}

// 권한 거부 시 수동 검색 fallback
export function useLocation() {
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentLocation()
      .then(setLocation)
      .catch(() => setError('위치 권한이 없어요. 지역을 직접 검색해주세요.'));
  }, []);

  return { location, error };
}
```

### 10-3. Supabase RPC — find_nearest_city_with_station

```sql
-- cities 테이블에 station_name 컬럼 추가 필요
ALTER TABLE cities ADD COLUMN IF NOT EXISTS station_name TEXT;

CREATE OR REPLACE FUNCTION find_nearest_city_with_station(p_lat FLOAT, p_lon FLOAT)
RETURNS TABLE(city_id TEXT, name_ko TEXT, name_en TEXT, station_name TEXT) AS $$
  SELECT id, name_ko, name_en, station_name
  FROM cities
  ORDER BY (lat - p_lat)^2 + (lon - p_lon)^2
  LIMIT 1;
$$ LANGUAGE SQL STABLE;
```

### 10-4. 환경 변수 추가

```bash
VITE_KAKAO_REST_KEY=xxxx   # 카카오 로컬 API (국내 동 단위 역지오코딩)
```

---

## 11. PWA 설정 (Phase 2)

```json
// public/manifest.json
{
  "name": "CLIMATE",
  "short_name": "Climate",
  "description": "날씨가 아니라 여행을 예측합니다",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F9FAFB",
  "theme_color": "#5260FE",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**캐싱 전략 (Service Worker)**:
- `/` 홈, 정적 자산 → Cache First
- Supabase 날씨 데이터 → Stale-While-Revalidate (1시간)
- Open-Meteo 예보 → Network First (최신성 중요)

---

## 12. 성능 최적화

- **TanStack Query staleTime**: 날씨 데이터 30분, 기후 통계 24시간
- **Supabase 캐싱**: `climate_score_monthly`, `monthly_climate` 등 변경이 적은 테이블은 클라이언트 캐시 24h
- **이미지 최적화**: Supabase Storage → Cloudflare CDN 연동 고려, WebP 포맷
- **코드 스플리팅**: 화면별 lazy import (`React.lazy`)
- **DB 쿼리 최적화**:
  - `hourly_weather`: 앱에서 직접 조회하지 않음 (파이프라인 전용)
  - `daily_weather`: 앱에서 직접 조회하지 않음 (집계 전용)
  - 앱은 FEATURE 레이어 이상만 쿼리

---

## 13. 개발 우선순위 (MVP → V1.5)

> PRD v2.1 기준. 하단 탭 5개 구조 + 모드 레이어 방식 기준.

### MVP (Phase 1 — 웹앱)

**인프라 & 기반**
- [ ] 프로젝트 셋업 (Vite + React + TS + Tailwind + Supabase)
- [ ] 디자인 시스템 컴포넌트 구현 (`/components/ui`)
- [ ] `<WeatherIcon />` 컴포넌트 구현 (Meteocons)
- [ ] 반응형 레이아웃 (PC/Tablet/Mobile)
- [ ] 날씨별 sticky 전환 스위처

**네비게이션 구조**
- [ ] 하단 탭 5개 구현 (홈·스코어·장소추천·주변·D-day)
- [ ] 햄버거(≡) → 사이드 패널 구현 (슬라이드 인/아웃)
- [ ] `modeStore` (Zustand) — 연인/가족 레이어 ON/OFF 토글
- [ ] PC/태블릿 사이드바 — 모든 항목 노출

**핵심 화면 (하단 탭)**
- [ ] 홈: 동 단위 GPS + 카카오 로컬 API 역지오코딩
- [ ] 홈: 현재 날씨 (forecast_weather) + 날씨 테마 8종
- [ ] 홈: 모드 레이어 조건부 렌더링 (연인/가족 ON 시 추가 콘텐츠)
- [ ] Climate Score™ 화면 (best_travel_week + climate_normals)
- [ ] Climate Score™: 날짜 선택 캘린더에 일자별 Score + 추천도 배지 시각화
- [ ] 장소 추천: 목적+시기 입력 → activity_weather_score 기반 추천
- [ ] 장소 추천: 시기 선택 캘린더에 날짜별 추천/비추천 히트맵 표시
- [ ] 주변(Nearby): 현재 위치 기반 TourAPI v2 연동 + 날씨 카테고리 필터
- [ ] D-day: 저장/조회 (user_dday_events) + Supabase Auth

**사이드 패널 화면**
- [ ] 숨은 황금 시즌 (best_travel_week 비교)
- [ ] 도시 비교 (최대 4개)

**데이터 & 배치**
- [ ] `build-climate-frequency` Edge Function
- [ ] `track-session` 방문 기록 함수

### V1.5

**모드 레이어 심화**
- [ ] 연인 레이어: 골든아워 지수 고도화 (노을 색상 예측 포함)
- [ ] 가족 레이어: 어린이 안전 지수 + 에어코리아 API 연동
- [ ] 가족 레이어: 다음 날 PM2.5 예보 → 플랜B 자동 노출

**기능 확장**
- [ ] 날씨 아카이브 (user_weather_archive) + SNS 공유 카드
- [ ] D-day 푸시 알림 (Web Push API) — D-30/D-7/D-1
- [ ] 구독 가격 조정 배치 (`adjust-subscription-price` Edge Function)
- [ ] `user_sessions` 방문 추적 + 구독 가격 조건부 표시 UI
- [ ] 토스페이먼츠 정기결제 빌링키 연동
- [ ] `hidden_season_highlights` CMS 구성
- [ ] 소셜 임팩트 KPI 대시보드
- [ ] Apple Sign In 추가 (Capacitor 대비)

### Phase 2 (Capacitor — iOS/Android)

- [ ] Capacitor 설치 및 초기화
- [ ] iOS / Android 플랫폼 추가
- [ ] `@capacitor/geolocation` 적용 (동 단위 정확도 향상)
- [ ] `@capacitor/local-notifications` 적용 (D-day 알림)
- [ ] `@capacitor/preferences` 적용 (로컬 캐시)
- [ ] 홈 화면 위젯 외주 개발 연동
- [ ] App Store / Google Play 등록 준비
- [ ] Lottie 날씨 아이콘 네이티브 성능 확인
- [ ] Google Play Console 앱 등록
- [ ] 앱 심사 제출

---

## 14. 환경 변수 (.env.local)

```bash
# Supabase
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Open-Meteo (무료, 키 없음)
# VITE_OPENMETEO_BASE_URL=https://api.open-meteo.com/v1
# VITE_OPENMETEO_ARCHIVE_URL=https://archive-api.open-meteo.com/v1

# 에어코리아 — 국내 PM2.5/PM10 (공공데이터포털, 무료)
VITE_AIRKOREA_API_KEY=xxxx

# 한국관광공사 TourAPI — 여행 콘텐츠 큐레이션 + 주변(Nearby) (공공데이터포털, 무료)
VITE_TOURAPI_KEY=xxxx

# Google Maps — 도시 검색 자동완성 + Geocoding (월 $200 무료 크레딧)
VITE_GOOGLE_MAPS_API_KEY=xxxx

# 카카오 로컬 API — 국내 동 단위 역지오코딩 (무료 300,000 call/일)
VITE_KAKAO_REST_KEY=xxxx

# 기상청 KMA — TCI, 생활기상지수 (기상자료개방포털, 무료) [V1.5~]
VITE_KMA_API_KEY=xxxx

# IQAir — 해외 도시 대기질 AQI (무료 1만 call/월) [V1.5~]
VITE_IQAIR_API_KEY=xxxx

# 토스페이먼츠 — 정기결제 빌링키 [V1.5~]
VITE_TOSS_CLIENT_KEY=xxxx

# Sentry (선택)
VITE_SENTRY_DSN=https://xxxx.ingest.sentry.io/xxxx
```

---

## 15. 참고 파일

| 파일 | 설명 |
|---|---|
| `climate-app-v3.html` | 목업 (반응형 + 날씨 테마 8종 + sticky 버튼) |
| `climate-app-v2.html` | 이전 버전 목업 (Moonshot UI Kit 라이트 테마) |
| `DB-SCHEMA.md` | Supabase 전체 스키마 정의 |
| `시장조사.md` | 글로벌 기상 데이터 B2C 시장 조사 |
| `서비스 기획을 위한 사전 조사.md` | 기획 방향 및 데이터 소스 분석 |

---

## 16. 아이콘 라이브러리 추천

이모지를 **컬러 아이콘**으로 대체하기 위한 라이브러리 구성. 역할별로 분리해서 사용.

---

### 16-1. 날씨 아이콘 — Meteocons ⭐ 핵심 추천

**[meteocons.com](https://meteocons.com) | GitHub: basmilius/meteocons**

| 항목 | 내용 |
|---|---|
| 아이콘 수 | **500개 이상** (날씨 상태, 기온계, 기압계, 바람, 달 위상, UV 지수, 경보 등) |
| 스타일 | Fill / Flat / Line / Monochrome — **4가지** |
| 포맷 | **애니메이션 SVG** + **Lottie JSON** — 웹/네이티브 모두 지원 |
| 라이선스 | MIT (무료 상업 사용 가능) |
| 유지보수 | 활발 (2025년 최신 업데이트) |
| 플랫폼 | React, Vue, Svelte, Angular, iOS, Android 모두 지원 |

```bash
# SVG (정적 + 애니메이션)
npm install @meteocons/svg

# Lottie JSON (Phase 2 네이티브 앱 권장)
npm install @meteocons/lottie

# Lottie 렌더러 (웹)
npm install lottie-react

# Lottie 렌더러 (웹 경량 버전)
npm install @lottiefiles/dotlottie-react
```

**React 컴포넌트 예시**

```tsx
// src/components/weather/WeatherIcon.tsx
import { useMemo } from 'react';
import Lottie from 'lottie-react';

// Lottie JSON import (트리 쉐이킹 가능)
import clearDay    from '@meteocons/lottie/fill/clear-day.json';
import partlyCloudy from '@meteocons/lottie/fill/partly-cloudy-day.json';
import overcast    from '@meteocons/lottie/fill/overcast.json';
import rain        from '@meteocons/lottie/fill/rain.json';
import drizzle     from '@meteocons/lottie/fill/drizzle.json';
import snow        from '@meteocons/lottie/fill/snow.json';
import thunderstorm from '@meteocons/lottie/fill/thunderstorms-rain.json';
import fog         from '@meteocons/lottie/fill/fog.json';
import thermometerWarmerIcon from '@meteocons/lottie/fill/thermometer-warmer.json';
import thermometerColderIcon from '@meteocons/lottie/fill/thermometer-colder.json';

// WMO weather_code → Meteocons 매핑
const WMO_TO_METEOCON: Record<number, unknown> = {
  0:  clearDay,
  1:  clearDay,
  2:  partlyCloudy,
  3:  overcast,
  45: fog, 48: fog,
  51: drizzle, 53: drizzle, 55: drizzle,
  61: rain, 63: rain, 65: rain,
  66: rain, 67: rain,
  71: snow, 73: snow, 75: snow,
  77: snow,
  80: rain, 81: rain, 82: rain,
  85: snow, 86: snow,
  95: thunderstorm,
  96: thunderstorm, 99: thunderstorm,
};

// 폭염/한파는 온도 기반 오버라이드
function getAnimationData(weatherCode: number, tempMax?: number, apparentTemp?: number) {
  if (tempMax !== undefined && tempMax >= 33) return thermometerWarmerIcon;
  if (apparentTemp !== undefined && apparentTemp <= -10) return thermometerColderIcon;
  return WMO_TO_METEOCON[weatherCode] ?? overcast;
}

interface WeatherIconProps {
  weatherCode: number;
  tempMax?: number;
  apparentTemp?: number;
  size?: number;
  loop?: boolean;
  className?: string;
}

export function WeatherIcon({
  weatherCode,
  tempMax,
  apparentTemp,
  size = 64,
  loop = true,
  className,
}: WeatherIconProps) {
  const animationData = useMemo(
    () => getAnimationData(weatherCode, tempMax, apparentTemp),
    [weatherCode, tempMax, apparentTemp]
  );

  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      style={{ width: size, height: size }}
      className={className}
    />
  );
}
```

**사용 예시**
```tsx
// WMO 코드 직접
<WeatherIcon weatherCode={0} size={80} />        // ☀️ 맑음
<WeatherIcon weatherCode={61} size={64} />       // 🌧️ 비
<WeatherIcon weatherCode={71} size={48} />       // ❄️ 눈

// 폭염 / 한파 (온도 기반)
<WeatherIcon weatherCode={1} tempMax={38} />     // 🌡️ 폭염
<WeatherIcon weatherCode={2} apparentTemp={-15} /> // 🥶 한파

// 비애니메이션 SVG (번들 크기 중요할 때)
<img src="https://cdn.meteocons.com/v2/svg/fill/clear-day.svg" width={64} />
```

**Meteocons 아이콘 카탈로그 (날씨 테마 8종 매핑)**

| 앱 테마 | Meteocons 아이콘 키 | WMO 코드 |
|---|---|---|
| 맑음 (sunny) | `clear-day` | 0, 1 |
| 소나기 (shower) | `rain` / `partly-cloudy-day-rain` | 80, 81, 82 |
| 흐림 (cloudy) | `overcast` / `cloudy` | 2, 3 |
| 눈 (snow) | `snow` / `snowflake` | 71~77, 85, 86 |
| 폭염 (heat) | `thermometer-warmer` | temp_max ≥ 33 |
| 한파 (cold) | `thermometer-colder` | apparent_temp ≤ -10 |
| 하루종일 비 (rain) | `extreme-rain` / `rain` | 61, 63, 65 |
| 안개 (fog) | `fog` / `haze` | 45, 48 |

---

### 16-2. UI 아이콘 — Lucide React (기존 유지)

네비게이션, 버튼, 카드, 폼 등 일반 UI 아이콘은 기존 `lucide-react` 유지.

```bash
npm install lucide-react
```

```tsx
import { Search, Bell, Map, Bookmark, ChevronRight } from 'lucide-react';

// 사용 예시
<Search size={16} className="text-gray-400" />
<Bell size={18} className="text-blue-600" />
```

**Lucide 사용 범위**: 검색, 알림, 설정, 북마크, 화살표, 체크, 탭 네비게이션, 데이터 수치 옆 소형 아이콘

---

### 16-3. 여행/활동 아이콘 — Phosphor Icons (선택 추천)

해변, 등산, 관광, 커플, 가족 등 여행 컨텍스트 아이콘.  
Lucide에 없는 여행 특화 아이콘 보완용.

```bash
npm install @phosphor-icons/react
```

```tsx
import { Umbrella, Mountains, Camera, Heart, Baby, Sun } from '@phosphor-icons/react';

// 활동 카드 아이콘 예시
<Mountains size={24} weight="fill" color="#5260FE" />  // 등산
<Umbrella   size={24} weight="fill" color="#0EA5E9" />  // 비
<Camera     size={24} weight="fill" color="#FF8C00" />  // 사진/커플
<Baby       size={24} weight="fill" color="#2C9E1E" />  // 가족
```

**Phosphor 특징**
- 스타일: thin / light / regular / bold / fill / duotone (6종)
- 6,000+ 아이콘 — 여행, 자연, 날씨 카테고리 풍부
- 색상 직접 지정 가능 (`color` prop)
- `weight="fill"` + 브랜드 컬러 조합으로 Meteocons와 톤 맞추기 쉬움

---

### 16-4. 최종 아이콘 구성 요약

| 역할 | 라이브러리 | 이모지 대체 예시 |
|---|---|---|
| 날씨 상태 아이콘 | **@meteocons/lottie** (Lottie 애니메이션) | ☀️🌧️❄️🌫️ → 컬러 애니메이션 |
| 날씨 수치 아이콘 | **@meteocons/svg** (정적 SVG) | 🌡️💧💨 → 컬러 SVG |
| UI / 네비게이션 | **lucide-react** | 🔍🔔⚙️→ 모노톤 라인 |
| 여행 / 활동 | **@phosphor-icons/react** | 🏖️🏔️📸 → 컬러 fill 아이콘 |

**설치 명령 한번에**
```bash
npm install @meteocons/svg @meteocons/lottie lottie-react lucide-react @phosphor-icons/react
```

---

### 16-5. 아이콘 성능 고려사항

**번들 사이즈 최적화**
```ts
// ❌ 전체 import (무거움)
import * as Meteocons from '@meteocons/lottie';

// ✅ 필요한 아이콘만 import (트리 쉐이킹)
import clearDay from '@meteocons/lottie/fill/clear-day.json';
import rain from '@meteocons/lottie/fill/rain.json';
```

**CDN 활용 (번들 크기 0)**
```tsx
// 자주 쓰는 날씨 아이콘은 CDN으로 img 태그 사용
const METEOCON_CDN = 'https://cdn.meteocons.com/v2/svg/fill';

<img
  src={`${METEOCON_CDN}/${iconKey}.svg`}
  width={size}
  height={size}
  alt={label}
/>
```

**Lottie vs SVG 선택 기준**
| 상황 | 권장 |
|---|---|
| 히어로 카드 (크게 표시, 애니메이션 필요) | Lottie JSON |
| 예보 스트립 (작게, 여러 개) | 정적 SVG (`@meteocons/svg`) |
| 목록 아이콘 (작게, 텍스트 옆) | 정적 SVG or Phosphor |
| Phase 2 Capacitor 네이티브 | Lottie JSON (네이티브 렌더러 효율적) |
