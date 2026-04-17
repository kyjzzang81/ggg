# CLIMATE Release Checklist

> 목적: Phase 1 배포 시 누락 없이 릴리즈하기 위한 실행 체크리스트.
> 기준: `DB-MIGRATIONS.md`, `EDGE-FUNCTIONS.md`, `ENV-SETUP.md`

---

## 1. 릴리즈 전날 (T-1)

- [ ] 릴리즈 범위/브랜치 고정
- [ ] 미해결 blocker 이슈 triage 완료
- [ ] 문서 변경(`docs/*`) 동기화 완료
- [ ] 롤백 담당자/연락 체계 확인

---

## 2. 코드 품질 게이트

- [ ] `pnpm lint` 통과
- [ ] `pnpm typecheck` 통과
- [ ] `pnpm test --run` 통과
- [ ] 핵심 시나리오 smoke 결과 공유

---

## 3. 데이터베이스

- [ ] 최신 migration pull/검토
- [ ] 프로덕션에 migration 적용
- [ ] 신규 인덱스 생성 확인
- [ ] RLS 정책 적용/검증
- [ ] 실패 시 롤백 SQL 준비

---

## 4. Edge Functions / cron

- [ ] `refresh-forecast` 배포
- [ ] `build-climate-frequency` 배포
- [ ] `send-dday-notifications` 배포(사용 시)
- [ ] cron 등록/활성 상태 확인
- [ ] 스테이징 dry-run 로그 확인

---

## 5. 환경 변수

- [ ] Vercel env (prod) 최신값 반영
- [ ] Supabase secrets 반영
- [ ] 외부 API 키 만료/쿼터 상태 확인
- [ ] 불필요한 old key 제거

---

## 6. 인증/권한

- [ ] Google OAuth redirect URL 프로덕션 도메인 포함
- [ ] 보호 라우트(`/dday`, `/mypage`) 접근 제어 확인
- [ ] 비로그인 fallback 동작 확인
- [ ] admin/service 키 노출 없음 확인

---

## 7. 사용자 시나리오 최종 검증

- [ ] 홈 → 스코어 → 장소 추천 탐색
- [ ] D-day 생성/수정/삭제
- [ ] 위치 권한 거부 fallback
- [ ] API 장애 시 캐시 fallback

---

## 8. 관측/모니터링

- [ ] 배포 직후 에러 대시보드 모니터링 시작
- [ ] 주요 KPI 이벤트 수집 확인
- [ ] 배치 실패 알림 채널 확인

---

## 9. 릴리즈 실행 (T-0)

1. main merge
2. Vercel 프로덕션 배포
3. DB migration 실행
4. Edge Functions 배포
5. smoke test 15분
6. 릴리즈 공지

---

## 10. 릴리즈 후 (T+1h / T+24h)

- [ ] T+1h: 에러율/응답시간/배치 상태 점검
- [ ] T+24h: KPI 초기치 확인(전환율, 알림 tap rate)
- [ ] 문제 발생 시 Hotfix or Rollback 결정 기록

---

## 11. Go/No-Go 판정표

| 항목 | 기준 | 결과 |
|---|---|---|
| 품질 게이트 | 전부 통과 | ☐ |
| 핵심 플로우 | 치명 오류 없음 | ☐ |
| DB/RLS | 정책 누락 없음 | ☐ |
| 외부 API | 최소 fallback 동작 | ☐ |
| 모니터링 | 알림/로그 수신 정상 | ☐ |

`No-Go` 하나라도 있으면 배포 보류.

---

## 12. 연계 문서

- `QA-CHECKLIST.md`
- `DB-MIGRATIONS.md`
- `DB-RLS-POLICIES.md`
- `NOTIFICATION-SPEC.md`
