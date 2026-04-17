# CLIMATE Deployment

> 목적: 웹앱 MVP 배포 절차를 단일 플로우로 고정한다.

---

## 1. 대상 환경

- `dev` (로컬)
- `staging` (프리뷰/검증)
- `prod` (실사용)

---

## 2. 배포 순서 (표준)

1. 코드 품질 게이트 통과 (`lint`, `typecheck`, `test`)
2. DB migration 적용
3. Edge Functions 배포
4. Vercel 프로덕션 배포
5. smoke 테스트
6. 릴리즈 공지

---

## 3. 실패 대응

- 코드 이슈: 즉시 hotfix 배포
- DB 이슈: 롤백 SQL 또는 긴급 migration
- 외부 API 장애: 캐시 fallback 강제

---

## 4. 운영 체크

- T+1h 에러율/응답시간 점검
- T+24h KPI 초동 점검

---

## 5. 참고

상세 체크리스트는 `RELEASE-CHECKLIST.md`, 운영 기준은 `PLATFORM-OPS.md`를 기준으로 한다.

