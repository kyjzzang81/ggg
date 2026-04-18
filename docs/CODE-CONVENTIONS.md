# ggg Code Conventions

> 목적: Phase 1 MVP 구현 시 코드 스타일, 파일 구조, 네이밍, 품질 게이트를 통일한다.
> 기준: `FRONTEND-ARCHITECTURE.md`, `STATE-MANAGEMENT.md`, `MVP-SCOPE.md`

---

## 1. 기본 원칙

- TypeScript `strict`를 기본값으로 유지한다.
- 코드보다 문서가 늦게 바뀌지 않게, 구조 변경 시 관련 docs를 함께 수정한다.
- 한 파일은 하나의 책임만 갖는다(컴포넌트, 훅, API 함수 분리).
- 복잡한 로직은 UI에서 분리해 `features/*/utils.ts`로 이동한다.

---

## 2. 네이밍 규칙

| 대상 | 규칙 | 예시 |
|---|---|---|
| 컴포넌트 파일 | PascalCase | `GggScoreCard.tsx` |
| 훅 파일 | `use-*.ts` 또는 `use*.ts` 통일 | `useRequireAuth.ts` |
| 스토어 파일 | `*Store.ts` | `modeStore.ts` |
| 유틸 파일 | kebab-case | `score-grade.ts` |
| 라우트 세그먼트 | kebab-case | `hidden-season` |
| 상수 | UPPER_SNAKE_CASE | `MAX_RECENT_CITIES` |
| 타입/인터페이스 | PascalCase | `PlaceQueryParams` |

---

## 3. 폴더/Import 규칙

- 경로 별칭 `@/*` 사용을 기본으로 한다.
- 상대경로 `../../..` 2단계 이상은 금지, 별칭으로 교체한다.
- import 순서:
  1) React/Next
  2) 외부 패키지
  3) `@/` 내부 모듈
  4) 상대경로

```ts
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query/keys';
import { fetchGggScore } from '@/features/ggg-score/api';

import './styles.css';
```

---

## 4. React/Next 작성 규칙

- Client Component는 `'use client'`가 필요한 파일에서만 선언한다.
- 페이지(`app/**/page.tsx`)에는 비즈니스 로직을 최소화하고, `features/*` 훅을 조합한다.
- RSC에서 브라우저 API(`window`, `localStorage`) 사용 금지.
- 리스트 렌더링 key는 index 금지(안정 ID 사용).

---

## 5. 상태 관리 규칙

- 서버 원본 데이터는 TanStack Query로만 관리한다.
- Zustand는 UI 선호도/경량 세션 상태만 관리한다.
- Query 결과를 Store로 복사하지 않는다.
- URL로 표현 가능한 상태(`city`, `from`, `to`)는 URL에 둔다.

---

## 6. 타입 규칙

- `any` 금지. 불가피할 경우 `unknown` 후 좁히기.
- API 응답은 Zod 또는 타입 가드로 검증한다.
- DB 타입은 `src/lib/supabase/types.ts`를 기준 소스로 사용한다.

---

## 7. 스타일 규칙

- 토큰 우선: 하드코딩 색상/spacing 직접 사용 금지.
- Tailwind 유틸과 컴포넌트 CSS 혼용 시, 토큰 변수(`--color-*`)를 우선한다.
- 반응형 분기는 `mobile-first`.

---

## 8. 테스트/품질 게이트

- 커밋 전 최소 실행:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test --run`
- PR 기준:
  - 신규 로직 파일은 최소 1개 이상의 단위 테스트 포함.
  - 실패 케이스(에러/빈값) 테스트 포함.

---

## 9. 금지 사항

- `console.log`를 프로덕션 코드에 남기지 않는다.
- 민감정보(API 키, 토큰)를 코드/문서에 하드코딩하지 않는다.
- 거대 컴포넌트(300+ LOC)로 기능을 몰아넣지 않는다.

---

## 10. 커밋 메시지 권장 형식

```text
feat: add dday notification settings
fix: handle forecast fallback on api failure
docs: add external api quota guide
refactor: split score calculation utilities
test: add leap-year day_of_year cases
```

---

## 11. 연계 문서

- `FRONTEND-ARCHITECTURE.md`
- `STATE-MANAGEMENT.md`
- `RESPONSIVE-GUIDE.md`
- `TESTING-STRATEGY.md`
