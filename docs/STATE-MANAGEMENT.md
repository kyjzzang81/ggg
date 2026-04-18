# ggg State Management

> 목적: 클라이언트 상태는 Zustand, 서버 상태는 TanStack Query로 분리한다. 본 문서는 **클라이언트 상태(Zustand)의 스토어 shape**과 서버 상태 책임 경계를 고정한다.
> 기준: `FRONTEND-ARCHITECTURE.md` · `NAVIGATION-FLOW.md` · `USER-JOURNEY.md`

---

## 1. 책임 분리

| 종류 | 도구 | 예시 |
|---|---|---|
| 서버 원본 데이터 | TanStack Query | 예보, ggg score, 장소, D-day 목록 |
| 세션/프로필 | TanStack Query + Zustand mirror | 현재 사용자, 구독 상태 |
| UI/설정 | Zustand (persist) | 모드 레이어, 테마 강도, 최근 위치 |
| 일회성 UI | React state | 모달 open, 폼 입력 |
| URL로 표현 가능한 것 | URL 쿼리 | `city`, `from`, `to`, `purpose` |

**원칙**: URL로 표현 가능하면 URL에 둔다. Zustand는 **여러 화면 공통 선호도와 세션 캐시**에만 사용.

---

## 2. 스토어 목록

| Store | Persist | 범위 | 주요 필드 |
|---|---|---|---|
| `modeStore` | ✅ localStorage | 전역 | couple, family, themeIntensity |
| `locationStore` | ✅ localStorage | 전역 | current, recents[] |
| `userStore` | ❌ (세션 쿠키가 소스) | 전역 | profile, loading, isAuthed |
| `uiStore` | ❌ | 전역 | sheetOpen, toasts[] |

---

## 3. modeStore

### 3-1. 목적

연인/가족 레이어와 테마 강도처럼 **화면 전반 콘텐츠 가중을 바꾸는** 선호도를 저장.

### 3-2. Shape

```ts
// src/stores/modeStore.ts
type ThemeIntensity = 'full' | 'soft' | 'accent-only';

export interface ModeState {
  couple: boolean;
  family: boolean;
  themeIntensity: ThemeIntensity;

  setCouple: (v: boolean) => void;
  setFamily: (v: boolean) => void;
  toggleCouple: () => void;
  toggleFamily: () => void;
  setThemeIntensity: (v: ThemeIntensity) => void;
  reset: () => void;
}

export const useModeStore = create<ModeState>()(
  persist(
    (set) => ({
      couple: false,
      family: false,
      themeIntensity: 'soft',
      setCouple: (couple) => set({ couple }),
      setFamily: (family) => set({ family }),
      toggleCouple: () => set((s) => ({ couple: !s.couple })),
      toggleFamily: () => set((s) => ({ family: !s.family })),
      setThemeIntensity: (themeIntensity) => set({ themeIntensity }),
      reset: () => set({ couple: false, family: false, themeIntensity: 'soft' }),
    }),
    { name: 'climate.mode', version: 1 },
  ),
);
```

### 3-3. 셀렉터

```ts
export const selectLayerFlags = (s: ModeState) => ({
  couple: s.couple,
  family: s.family,
});
export const selectHasAnyLayer = (s: ModeState) => s.couple || s.family;
```

### 3-4. URL 공유 규칙

공유 URL에 `?mode=couple,family`가 있으면 **임시 오버라이드**만 하고 스토어는 건드리지 않는다 (선호도 오염 방지).

```ts
const layerFromUrl = useLayerFromQuery();      // URL 기반
const storeLayer = useModeStore(selectLayerFlags);
const effective = layerFromUrl ?? storeLayer;
```

---

## 4. locationStore

### 4-1. 목적

홈/주변/스코어에서 반복 조회되는 **현재 위치 + 최근 선택 위치 기록**을 보관.

### 4-2. Shape

```ts
// src/stores/locationStore.ts
export interface LocationItem {
  cityId?: string;        // 도시 slug가 있으면 우선
  label: string;          // "제주시" 등 표시 이름
  lat: number;
  lng: number;
  source: 'geolocation' | 'search' | 'manual';
  updatedAt: string;      // ISO
}

export interface LocationState {
  current: LocationItem | null;
  recents: LocationItem[];

  setCurrent: (loc: LocationItem) => void;
  pushRecent: (loc: LocationItem) => void;
  clearRecents: () => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      current: null,
      recents: [],
      setCurrent: (loc) => {
        set({ current: loc });
        get().pushRecent(loc);
      },
      pushRecent: (loc) => set((s) => {
        const next = [loc, ...s.recents.filter((r) => r.label !== loc.label)];
        return { recents: next.slice(0, 5) };
      }),
      clearRecents: () => set({ recents: [] }),
    }),
    { name: 'climate.location', version: 1 },
  ),
);
```

### 4-3. 사용 규칙

- `/nearby`는 `current`가 없으면 위치 권한 요청 → 거부 시 수동 선택.
- URL에 `?city=` 또는 `?lat&lng`가 있으면 그 값이 우선.

---

## 5. userStore

### 5-1. 목적

Supabase 세션을 UI에서 즉시 참조하기 위한 **얇은 미러**. 소스 오브 트루스는 Supabase 세션 쿠키.

### 5-2. Shape

```ts
// src/stores/userStore.ts
export interface UserProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'user' | 'plus' | 'admin';
}

export interface UserState {
  status: 'idle' | 'loading' | 'authed' | 'guest';
  profile: UserProfile | null;
  setStatus: (s: UserState['status']) => void;
  setProfile: (p: UserProfile | null) => void;
  reset: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  status: 'idle',
  profile: null,
  setStatus: (status) => set({ status }),
  setProfile: (profile) => set({ profile }),
  reset: () => set({ status: 'guest', profile: null }),
}));
```

### 5-3. 동기화

- `SupabaseProvider`가 마운트 시 `auth.getSession()` → `userStore.setProfile`.
- `auth.onAuthStateChange` 이벤트로 계속 갱신.
- 로그아웃 시 `reset()` + `queryClient.clear()`.

---

## 6. uiStore

### 6-1. 목적

전역 토스트, 글로벌 시트(모달) 오픈 상태 등 **여러 화면에서 트리거되는 UI 보조 상태**.

### 6-2. Shape

```ts
// src/stores/uiStore.ts
export interface ToastItem {
  id: string;
  type: 'info' | 'success' | 'warn' | 'error';
  title: string;
  description?: string;
  ttl?: number;
}

export interface UIState {
  toasts: ToastItem[];
  activeSheet: 'mode' | 'citysearch' | null;

  pushToast: (t: Omit<ToastItem, 'id'>) => string;
  dismissToast: (id: string) => void;
  setSheet: (name: UIState['activeSheet']) => void;
}
```

- 시트 오픈/클로즈는 **URL 쿼리가 소스**이고, `activeSheet`는 미러 (라우터 변경 감지로 동기화).

---

## 7. 서버 상태(TanStack Query) 책임 경계

클라이언트 스토어에 **서버 데이터를 복사하지 않는다.** 다음은 모두 Query로 관리:

- `useGggScore`, `useForecast`, `usePlaces`, `useNearby`
- `useDdayList`, `useDdayDetail`
- `useMe` (세션 + profile)

변이는 mutation 성공 후 `invalidateQueries`:

```ts
const qc = useQueryClient();
const createDday = useMutation({
  mutationFn: createDdayEvent,
  onSuccess: () => qc.invalidateQueries({ queryKey: qk.dday.list() }),
});
```

---

## 8. 초기화 순서 (앱 부팅)

```
1) RootProviders 마운트
2) SupabaseProvider.getSession → userStore
3) locationStore rehydrate (persist)
4) modeStore rehydrate (persist)
5) 첫 페이지 RSC 렌더 → Client Boundary에서 Query 기동
```

- persist rehydrate 전에 UI가 깜빡이지 않도록 **skeleton**을 1~2프레임 보여준다.

---

## 9. DevTools / 디버깅

- Zustand: `@redux-devtools/extension` 연결 (dev만).
- Query: `@tanstack/react-query-devtools`를 하단 토글로 탑재(dev만).

---

## 10. 테스트

- 스토어는 순수 함수. 단위 테스트에서 `create` 직접 호출 후 액션 검증.
- 훅은 `@testing-library/react-hooks` + `QueryClientProvider` wrapper.
- 상세: `TESTING-STRATEGY.md`.

---

## 11. 연계 문서

- 아키텍처: `FRONTEND-ARCHITECTURE.md`
- 화면별 상태 사용 예: `SCREEN-SPEC.md`
- 인증 흐름: `AUTH-SPEC.md`
