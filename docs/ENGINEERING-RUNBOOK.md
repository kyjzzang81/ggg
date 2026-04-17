# CLIMATE Engineering Runbook

> 목적: 개발팀이 실제로 매일 쓰는 실행 기준을 한 문서에 통합한다.  
> 통합 대상: `CODE-CONVENTIONS.md`, `TESTING-STRATEGY.md`, `UNIT-TEST-TARGETS.md`, `QA-CHECKLIST.md`, `RELEASE-CHECKLIST.md`

---

## 1. 코드 작성 규칙

- TypeScript strict 유지, `any` 금지
- 서버 데이터는 TanStack Query, UI 선호도는 Zustand
- URL로 표현 가능한 상태는 URL에 저장
- import 순서: React/Next -> 외부 -> 내부(`@/`) -> 상대
- 공용 네이밍:
  - 컴포넌트 `PascalCase`
  - 훅 `useXxx`
  - 스토어 `*Store`

---

## 2. 테스트 전략 (실행형)

### 비율
- Unit 60%
- Component 25%
- E2E/Smoke 15%

### P0 단위테스트 필수
- Climate Score 계산/등급 경계값
- KidSafetyScore, GoldenHourScore
- 윤년/day_of_year 변환
- WMO -> 테마 매핑 fallback

### PR 기준
- `lint`, `typecheck`, `test` 통과
- 신규 로직은 최소 1개 단위테스트 포함

---

## 3. QA 체크 (배포 전)

- 핵심 플로우:
  - 홈 -> 스코어 -> 장소 추천
  - 로그인 -> D-day 생성/수정/삭제
- 반응형:
  - Mobile 하단탭
  - Tablet 72px 사이드바
  - Desktop 240px 사이드바
- 오류 복구:
  - 위치 권한 거부 fallback
  - 외부 API 실패 시 캐시 fallback

---

## 4. 릴리즈 체크

1. 코드 품질 게이트 통과
2. DB migration + RLS 반영
3. Edge Functions/cron 상태 확인
4. 환경변수/시크릿 점검
5. Smoke 테스트 후 배포 공지

---

## 5. 운영 원칙

- 회귀 버그는 “재현 테스트 먼저” 추가 후 수정
- flaky 테스트는 즉시 격리하고 원인 기록
- 문서 업데이트는 통합 문서 우선 반영

---

## 6. 참조 문서

- `FRONTEND-ARCHITECTURE.md`
- `STATE-MANAGEMENT.md`
- `NAVIGATION-FLOW.md`
- `PLATFORM-OPS.md`

