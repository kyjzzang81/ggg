# ggg Navigation & URL Policy

> 목적: Next.js App Router 기준 URL 체계, 쿼리 파라미터 규칙, 딥링크, 뒤로가기 정책을 고정한다.
> 기준: `INFORMATION-ARCHITECTURE.md` · `SCREEN-SPEC.md` · `MVP-SCOPE.md`

---

## 1. 라우트 맵 (Phase 1)

| Path | 이름 | 인증 | 레이아웃 | 설명 |
|---|---|---|---|---|
| `/` | Home | 선택 | TabLayout | 홈 대시보드 |
| `/score` | ggg score | 선택 | TabLayout | 점수·캘린더 |
| `/place` | Place Recommend | 선택 | TabLayout | 장소 추천 리스트 |
| `/place/[placeId]` | Place Detail | 선택 | TabLayout | 장소 상세 |
| `/nearby` | Nearby | 선택 | TabLayout | 주변 추천 |
| `/nearby/[placeId]` | Nearby Detail | 선택 | TabLayout | 주변 상세 |
| `/dday` | D-day List | 필수 | TabLayout | D-day 목록 |
| `/dday/new` | D-day Create | 필수 | TabLayout (모달) | D-day 생성 |
| `/dday/[eventId]` | D-day Detail | 필수 | TabLayout | D-day 상세·카운트다운 |
| `/dday/[eventId]/edit` | D-day Edit | 필수 | TabLayout (모달) | D-day 수정 |
| `/hidden-season` | Hidden Season | 선택 | SidePanelLayout | 숨은 황금 시즌 |
| `/compare` | Compare | 선택 | SidePanelLayout | 도시 비교 |
| `/impact` | Impact | 선택 | SidePanelLayout | 소셜 임팩트 |
| `/mypage` | MyPage | 필수 | SidePanelLayout | 마이페이지 |
| `/auth/callback` | OAuth Callback | — | Blank | Supabase 콜백 처리 |
| `/404` | Not Found | — | Blank | 404 fallback |

> 모드 설정 화면은 라우트 없이 **인라인 시트**로 제공 (`?sheet=mode`).

---

## 2. Next.js App Router 파일 구조

```
app/
├── (tabs)/
│   ├── layout.tsx           # TabLayout: 사이드바/하단탭
│   ├── page.tsx             # / 홈
│   ├── score/page.tsx
│   ├── place/
│   │   ├── page.tsx
│   │   └── [placeId]/page.tsx
│   ├── nearby/
│   │   ├── page.tsx
│   │   └── [placeId]/page.tsx
│   └── dday/
│       ├── page.tsx
│       ├── new/page.tsx
│       └── [eventId]/
│           ├── page.tsx
│           └── edit/page.tsx
├── (panels)/
│   ├── layout.tsx           # SidePanelLayout
│   ├── hidden-season/page.tsx
│   ├── compare/page.tsx
│   ├── impact/page.tsx
│   └── mypage/page.tsx
├── auth/
│   └── callback/route.ts
├── layout.tsx               # Root: Providers
└── not-found.tsx
```

- `(tabs)`와 `(panels)`는 **Route Group**으로, URL에는 노출되지 않는다.
- 하위 `layout.tsx`에서 각각 하단탭/사이드바 구성을 정의한다.

---

## 3. 쿼리 파라미터 규약

### 3-1. 화면 필터

| 파라미터 | 값 예시 | 사용 화면 |
|---|---|---|
| `city` | `jeju`, `busan` (slug) | `/score`, `/place`, `/compare` |
| `lat`, `lng` | `37.5, 127.0` | `/nearby` (위치 권한 거부 시) |
| `from`, `to` | `2026-05-01`, `2026-05-07` | `/score`, `/place`, `/place/:id` |
| `purpose` | `family`, `romantic`, `photo` | `/place` |
| `indoor` | `1` | `/nearby` (가족 모드 실내 대안) |
| `grade` | `excellent`, `good` | `/place`, `/hidden-season` |

### 3-2. 모드/UI

| 파라미터 | 값 | 의미 |
|---|---|---|
| `mode` | `couple,family` | 레이어 강제 지정 (공유 URL용) |
| `theme` | `sunny`, `heat` … | 날씨 테마 강제 (디버그/데모) |

### 3-3. 오버레이/모달

모달은 **쿼리 파라미터 기반 parallel route** 또는 단순 쿼리 토글을 사용한다.

| 파라미터 | 의미 | 닫기 |
|---|---|---|
| `login=1` | 로그인 모달 | 파라미터 제거 |
| `sheet=mode` | 모드 설정 시트 | 파라미터 제거 |
| `sheet=citysearch` | 도시 검색 드로어 | 파라미터 제거 |

### 3-4. 규칙

- 모든 쿼리는 **kebab 금지, camelCase 금지, snake_case 금지 → 짧은 영문 소문자**로 통일 (`from`, `to`, `purpose`).
- 날짜는 ISO 8601 `YYYY-MM-DD`.
- 배열은 콤마 구분 (`mode=couple,family`).
- 상태 복원이 필요 없는 값(예: 스크롤 위치)은 URL에 넣지 않는다.

---

## 4. 딥링크

### 4-1. 지원되는 딥링크

| Pattern | 진입 경로 | 동작 |
|---|---|---|
| `/dday/:eventId` | 푸시 알림 | 로그인 체크 → D-day 상세 |
| `/score?city=jeju&from=2026-05-10&to=2026-05-14` | 공유 링크 | 도시 + 기간 프리셋 |
| `/place/:placeId?from=...&to=...` | 공유 링크 | 장소 상세 + 기간 프리셋 |
| `/hidden-season?city=busan` | 콘텐츠 마케팅 | 숨은 황금 시즌 프리셋 |

### 4-2. 푸시 알림 payload (D-day)

```json
{
  "title": "제주 여행 D-7",
  "body": "5/10~5/14 예보 업데이트: 맑음 80%",
  "data": {
    "deep_link": "/dday/abc-123",
    "event_id": "abc-123",
    "trigger": "d7"
  }
}
```

앱 측 처리:
1. 포그라운드: 인앱 토스트 + tap 시 `router.push(deep_link)`
2. 백그라운드/종료: OS가 URL을 열면 `/dday/:id`로 진입
3. 미인증 상태라면 `/?login=1&redirect=/dday/:id`로 리라이트

### 4-3. 공유용 URL 정책

- D-day 상세(`/dday/:id`)는 **공유 금지** (개인 데이터).
- 장소 상세·스코어·숨은 시즌은 **공유 허용**. 단, 서버 렌더링 시 OG 이미지 생성 (Phase 1.5+).

---

## 5. 뒤로가기 정책

### 5-1. 기본 원칙

- 모든 라우트 변경은 브라우저 history에 push된다 (`router.push`).
- **단, 모달/시트 열기**는 `router.replace` 또는 `history.replaceState`로 처리해 뒤로가기 시 페이지 이동이 아닌 "모달 닫기"가 되도록 한다.

### 5-2. 상황별 동작

| 상황 | 뒤로가기 동작 |
|---|---|
| 하단 탭 A→B 이동 후 뒤로가기 | A 탭 복귀 |
| `/score` → 모달 열기 → 뒤로가기 | 모달 닫힘 (URL에서 파라미터 제거) |
| 딥링크 `/dday/:id`로 진입 후 뒤로가기 | `/` 홈으로 fallback (history 비어있을 때) |
| 로그인 모달 → 로그인 완료 후 | 원래 화면으로 복귀 (`redirect` 쿼리 사용) |
| `/auth/callback` 처리 완료 | `redirect` 파라미터 경로로 replace |

### 5-3. 구현 가이드

```ts
// 모달 열기
router.replace(`${pathname}?login=1&redirect=${encodeURIComponent(pathname + search)}`);

// 딥링크 fallback
if (typeof window !== 'undefined' && window.history.length <= 1) {
  router.replace('/');
}
```

---

## 6. 인증 가드

### 6-1. 보호된 라우트

| Path prefix | 정책 |
|---|---|
| `/dday`, `/mypage` | 미인증 시 `/?login=1&redirect=<원경로>` 리다이렉트 |

### 6-2. 구현 위치

- Middleware에서 Supabase 세션 쿠키 체크
- 클라이언트 측 fallback: `useRequireAuth()` 훅에서 로그인 모달 자동 오픈

상세: `AUTH-SPEC.md`.

---

## 7. 404 / 에러 라우팅

| 상황 | 처리 |
|---|---|
| 존재하지 않는 `/place/:id` | `notFound()` → `app/place/[placeId]/not-found.tsx` |
| 존재하지 않는 `/dday/:id` (본인 것이 아님 포함) | `/dday`로 리다이렉트 + 토스트 "찾을 수 없어요" |
| 네트워크 오류 (전역) | `app/error.tsx` 스켈레톤 + 재시도 버튼 |

---

## 8. 스크롤/히스토리 UX

- 탭 간 이동 시 각 탭의 스크롤 위치 보존 (Next.js 기본 `scrollRestoration`).
- 리스트 → 상세 → 뒤로가기: 리스트의 **스크롤 + 필터**가 복원되어야 함 (쿼리 파라미터에 저장했기 때문에 자동).
- 모달 내부 스크롤은 body 스크롤 잠금(`inert` + `overflow: hidden`).

---

## 9. 애널리틱스 이벤트 (네비 연관)

| 이벤트 | 발생 시점 | 프로퍼티 |
|---|---|---|
| `pageview` | 라우트 변경 | path, referrer |
| `deep_link_open` | 외부 URL 진입 | trigger (push/share/qr) |
| `modal_open` / `modal_close` | 쿼리 파라미터 변경 | name |
| `tab_change` | 하단탭 클릭 | from, to |

상세: `METRICS-KPI.md` (작성 예정).

---

## 10. 연계 문서

- 화면 구조: `INFORMATION-ARCHITECTURE.md`
- 페이지별 데이터/상태: `SCREEN-SPEC.md`
- 라우팅/레이아웃 구현: `FRONTEND-ARCHITECTURE.md`
- 인증 상세: `AUTH-SPEC.md`
