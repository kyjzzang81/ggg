# CLIMATE Docs Index (Lean)

> 목적: 문서 과다/중복 상태에서 기준 문서를 명확히 고정한다.

---

## 1) 상태 배지 규칙

- `active` : 현재 구현/운영의 기준 문서 (수정 우선)
- `reference` : 상세 참고용 문서 (필요 시만 수정)
- `legacy` : 과거 흐름 기록용 (신규 작업 기준으로 사용 금지)

---

## 2) 먼저 볼 7개 (`active`)

1. `MVP-SCOPE.md` — 범위 확정
2. `SCREEN-SPEC.md` — 화면별 상태/데이터
3. `COMPONENT-SPEC.md` — 컴포넌트 API
4. `FRONTEND-ARCHITECTURE.md` — 구조/패턴
5. `DB-MIGRATIONS.md` — DB 변경 절차
6. `ENGINEERING-RUNBOOK.md` — 코딩/테스트/릴리즈 실행 기준
7. `PLATFORM-OPS.md` — 인증/알림/API/배포 운영 기준

---

## 3) 문서 상태 맵

### Product/Planning

- `PRD.md` (`reference`)
- `MVP-SCOPE.md` (`active`)
- `USER-JOURNEY.md` (`active`)
- `INFORMATION-ARCHITECTURE.md` (`active`)
- `METRICS-KPI.md` (`active`)

### Design/UI

- `DESIGN-SYSTEM.md` (`active`)
- `COMPONENT-SPEC.md` (`active`)
- `CALENDAR-SCORE-UX.md` (`active`)
- `RESPONSIVE-GUIDE.md` (`active`)

### Engineering

- `FRONTEND-ARCHITECTURE.md` (`active`)
- `STATE-MANAGEMENT.md` (`active`)
- `NAVIGATION-FLOW.md` (`active`)
- `DB-ERD.md` (`active`)
- `DB-RLS-POLICIES.md` (`active`)
- `DB-MIGRATIONS.md` (`active`)
- `DB-INDEXES.md` (`active`)
- `DB-SEED.md` (`reference`)

### Ops/Platform

- `ENGINEERING-RUNBOOK.md` (`active`)
- `PLATFORM-OPS.md` (`active`)
- `API-SPEC.md` (`active`)
- `EDGE-FUNCTIONS.md` (`active`)
- `AUTH-SPEC.md` (`reference`)
- `NOTIFICATION-SPEC.md` (`reference`)
- `EXTERNAL-API-GUIDE.md` (`reference`)
- `ENV-SETUP.md` (`reference`)
- `DEPLOYMENT.md` (`reference`)
- `SECRETS.md` (`reference`)

### Legacy (기록 보존)

- `BACKEND-SETUP.md` (`legacy`)
- `BACKEND-FORECAST.md` (`legacy`)
- `DB-FEATURES.md` (`legacy`)
- `DATA-PIPELINE.md` (`legacy`)
- `DATA-COLLECTION.md` (`legacy`)

---

## 4) 운영 원칙

- 신규 수정은 `active` 문서 우선
- `reference` 문서는 충돌 검토가 필요할 때만 보강
- `legacy` 문서는 삭제하지 않고 기록 보존만 수행
- 새 문서 추가 전 이 인덱스에 상태를 먼저 등록

