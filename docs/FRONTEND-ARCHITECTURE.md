# ggg Frontend Architecture

> 목적: Next.js 15 App Router + Supabase + TanStack Query 기반의 프론트엔드 구조를 고정한다.
> 기준: `MVP-SCOPE.md` §3 기술 스택 · `DEV-SPEC.md` · `NAVIGATION-FLOW.md`

---

## 1. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js 15 (App Router, React 19) | RSC 기본 |
| 언어 | TypeScript (strict) | `tsconfig` strict |
| 스타일 | Tailwind CSS 4 + CSS 변수(디자인 토큰) | Design System |
| UI 프리미티브 | Radix UI Primitives | Dialog/Popover/Tabs |
| 상태 관리 | Zustand (클라이언트), TanStack Query v5 (서버) | |
| 폼 | React Hook Form + Zod | |
| 데이터 소스 | Supabase (Postgres, Auth, Edge Functions) | |
| 지도 | Kakao Map (국내), Google Maps (해외) | Phase 1 국내 우선 |
| 차트 | Recharts | 경량 대시보드용 |
| 아이콘 | Lucide + Material Symbols Rounded | |
| 폰트 | Pretendard Variable | CDN or self-host |
| 배포 | Vercel | |

---

## 2. 디렉토리 구조 (Phase 1)

```
src/
├── app/                       # Next.js App Router (NAVIGATION-FLOW.md)
│   ├── (tabs)/
│   ├── (panels)/
│   ├── auth/callback/route.ts
│   ├── layout.tsx             # RootLayout + Providers
│   └── not-found.tsx
│
├── components/
│   ├── layout/                # AppBar, Sidebar, BottomTabs, PageHeader
│   ├── score/                 # GggScoreBadge, ScoreCalendar, ScoreBar
│   ├── place/                 # PlaceCard, PlaceList, PlaceDetailSheet
│   ├── dday/                  # DdayCard, DdayTimeline, DdayForm
│   ├── forecast/              # ForecastTile, WeatherThemeProvider
│   ├── common/                # Button, Card, Input, EmptyState, ErrorState
│   └── icons/                 # 공용 아이콘 래퍼
│
├── features/                  # feature slice (use-case 단위)
│   ├── climate-score/
│   │   ├── api.ts             # query/mutation fn (Supabase 호출)
│   │   ├── queries.ts         # useQuery 래퍼
│   │   ├── utils.ts           # 점수 → 등급 변환 등
│   │   └── index.ts
│   ├── place-recommend/
│   ├── nearby/
│   ├── dday/
│   ├── mode/                  # 연인/가족 레이어 토글
│   └── auth/
│
├── lib/
│   ├── supabase/              # 클라이언트/서버 분리 인스턴스
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── types.ts           # generated DB types
│   ├── query/                 # QueryClient 설정, 공용 keys
│   ├── analytics.ts
│   └── utils.ts
│
├── hooks/                     # 공용 훅
│   ├── useBreakpoint.ts
│   ├── useRequireAuth.ts
│   ├── useWeatherTheme.ts
│   └── useLocation.ts
│
├── stores/                    # Zustand stores (STATE-MANAGEMENT.md)
│   ├── modeStore.ts
│   ├── locationStore.ts
│   ├── userStore.ts
│   └── index.ts
│
├── constants/
│   ├── routes.ts
│   ├── design-tokens.ts       # 타입화된 토큰 (DESIGN-SYSTEM.md)
│   ├── wmo-to-theme.ts
│   └── score-grade.ts
│
├── styles/
│   ├── globals.css            # 토큰 @layer base
│   └── tailwind.css
│
└── types/
    ├── models.ts              # 도메인 모델 (City, Forecast, GggScore, Place, Dday …)
    └── events.ts              # analytics 이벤트 타입
```

### 원칙

- `components/*`는 **프레젠테이션**만, 상태는 props로 받는다.
- `features/*`는 **도메인 유스케이스**. Supabase 호출·쿼리 키·변환 함수를 모은다.
- 화면(`app/.../page.tsx`)은 `features/*`의 훅을 조합해 레이아웃에 배치한다.

---

## 3. 레이아웃 계층

```
RootLayout (app/layout.tsx)
├── <Providers>
│   ├── QueryProvider (TanStack Query)
│   ├── SupabaseProvider (세션 훅)
│   ├── WeatherThemeProvider (현재 테마 주입)
│   └── AnalyticsProvider
│
├── TabLayout  (app/(tabs)/layout.tsx)
│   ├── <TopAppBar />
│   ├── <DesktopSidebar />      (tablet/desktop)
│   ├── <main>{children}</main>
│   └── <BottomTabs />          (mobile)
│
└── SidePanelLayout (app/(panels)/layout.tsx)
    ├── <TopAppBar title />
    ├── <BackButton />
    └── <main>{children}</main>
```

- 반응형 규칙: `RESPONSIVE-GUIDE.md` 참조.
- 테마 주입: `WeatherThemeProvider`가 `data-theme="sunny|rain|…"`를 `<html>`에 설정 → CSS 변수 스위칭.

---

## 4. 데이터 패칭 전략

### 4-1. RSC vs Client Query

| 데이터 | 위치 | 이유 |
|---|---|---|
| 정적/준정적(도시 리스트, 월별 정규기후) | RSC 서버 fetch + ISR | SEO + 초기 페인트 |
| 개인화(D-day, 북마크) | Client `useQuery` | 인증 세션 필요 |
| 예보(빈번 갱신) | Client `useQuery` (staleTime 5~15분) | 실시간성 |
| 변이(생성/수정/삭제) | Client `useMutation` + `invalidateQueries` | 낙관적 업데이트 |

### 4-2. QueryClient 기본 설정

```ts
// src/lib/query/client.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});
```

### 4-3. Query Keys 규약

```ts
// src/lib/query/keys.ts
export const qk = {
  climateScore: (cityId: string, from: string, to: string) =>
    ['climate-score', cityId, from, to] as const,
  forecast: (lat: number, lng: number) =>
    ['forecast', lat.toFixed(3), lng.toFixed(3)] as const,
  places: (params: PlaceQueryParams) =>
    ['places', params] as const,
  nearby: (lat: number, lng: number, category?: string) =>
    ['nearby', lat.toFixed(3), lng.toFixed(3), category ?? 'all'] as const,
  dday: {
    list: () => ['dday', 'list'] as const,
    detail: (id: string) => ['dday', 'detail', id] as const,
  },
  me: () => ['me'] as const,
} as const;
```

### 4-4. 공용 훅 패턴

```ts
// src/features/climate-score/queries.ts
export function useGggScore(cityId: string, from: string, to: string) {
  return useQuery({
    queryKey: qk.climateScore(cityId, from, to),
    queryFn: () => fetchGggScore({ cityId, from, to }),
    enabled: !!cityId && !!from && !!to,
    staleTime: 10 * 60_000,
  });
}
```

### 4-5. 에러/로딩 UI 규약

각 섹션은 4가지 상태 컴포넌트를 모두 구현한다 (`COMPONENT-SPEC.md`).

- `<LoadingSkeleton />`
- `<EmptyState />`
- `<ErrorState onRetry>` — retry 노출
- `<OfflineBanner />` — 캐시 데이터 사용 중 표시

---

## 5. Supabase 클라이언트 분리

```
src/lib/supabase/
├── client.ts   # createBrowserClient (쿠키 기반 세션)
├── server.ts   # createServerClient (RSC/Route Handler)
└── types.ts    # supabase gen types typescript 결과물
```

### 서버/클라이언트 혼용 금지

- RSC에서는 `server.ts`만 import.
- Client Component에서는 `client.ts`만 import.
- Edge Runtime에서는 `@supabase/ssr` 가이드 따름.

---

## 6. 인증/세션

- Middleware (`middleware.ts`)에서 `supabase.auth.getSession()`으로 쿠키 갱신.
- 보호 라우트 (`/dday/*`, `/mypage`)는 세션 없으면 `/?login=1&redirect=...`로 리라이트.
- 세션 변경은 `onAuthStateChange`로 `userStore` 업데이트.
- 상세: `AUTH-SPEC.md`.

---

## 7. 폼/검증

- 폼은 React Hook Form + Zod 스키마.
- 스키마는 `features/<domain>/schema.ts`에 정의 후 `mutation`과 공유.
- 에러 메시지는 `src/constants/form-messages.ts` 중앙 관리 (i18n 고려).

---

## 8. 분석 이벤트

- 이벤트 enum: `src/types/events.ts`
- 공통 래퍼: `src/lib/analytics.ts`의 `track(event, props)`
- 네비/모달/모드 토글 이벤트는 자동 수집 (훅 레벨).
- 상세 이벤트 목록: `METRICS-KPI.md` (작성 예정).

---

## 9. 성능 원칙

- RSC 우선, Client 컴포넌트는 상호작용이 있는 리프에서만.
- 이미지: `next/image` 필수 + 원격 허용 도메인은 `next.config.mjs` 화이트리스트.
- 폰트: `next/font`로 Pretendard 로드(가능한 경우), CDN fallback.
- 번들 예산: 초기 JS ≤ 180KB gzipped (`MVP-SCOPE.md` 성능 가이드).
- Lighthouse 목표: 성능 ≥ 90, 접근성 ≥ 95.

---

## 10. 코드 컨벤션 요약

- 파일명: 컴포넌트 `PascalCase.tsx`, 유틸 `kebab-case.ts`.
- 훅은 `useXxx` 접두 + `hooks/` 또는 `features/*/use-*.ts`.
- import 순서: React → 외부 → `@/` 내부 → 상대.
- 공용 타입은 `types/` 또는 feature 내부에서 export, 순환 import 금지.
- 상세: `CODE-CONVENTIONS.md` (작성 예정).

---

## 11. 테스트 배치

- `*.test.ts[x]`는 파일 옆에 co-location.
- 통합/E2E는 `tests/` 루트에 Playwright 시나리오.
- 세부: `TESTING-STRATEGY.md`.

---

## 12. 빌드/배포

- `pnpm build` → Vercel Preview Deploy.
- 환경 변수 분리: `.env.local`(개발) / Vercel Project env(프로덕션). `ENV-SETUP.md`.
- DB 마이그레이션 적용 후 빌드: `DB-MIGRATIONS.md` 체크리스트.

---

## 13. 연계 문서

- 상태 관리: `STATE-MANAGEMENT.md`
- URL/딥링크: `NAVIGATION-FLOW.md`
- 반응형: `RESPONSIVE-GUIDE.md`
- 컴포넌트 API: `COMPONENT-SPEC.md`
- 인증: `AUTH-SPEC.md`
