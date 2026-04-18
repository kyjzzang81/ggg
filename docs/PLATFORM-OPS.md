# ggg Platform Ops

> 목적: 백엔드 운영/배포/외부연동 관련 기준을 한 문서로 묶어 운영 복잡도를 낮춘다.  
> 통합 대상: `ENV-SETUP.md`, `AUTH-SPEC.md`, `NOTIFICATION-SPEC.md`, `EXTERNAL-API-GUIDE.md`, `RELEASE-CHECKLIST.md`

---

## 1. 환경변수/시크릿 기준

필수(Phase 1):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AIRKOREA_API_KEY`
- `VITE_TOURAPI_KEY`
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_KAKAO_REST_KEY`

원칙:
- `.env.local` 커밋 금지
- dev/staging/prod 분리
- 시크릿 값은 문서에 직접 기록 금지

---

## 2. 인증 운영 기준

- 공개 조회: 비로그인 허용
- 보호 라우트: `/dday`, `/mypage`
- 미인증 접근 시:
  - `/?login=1&redirect=<원경로>` 리다이렉트
- OAuth:
  - Google 우선
  - Apple은 Phase 1.5+

---

## 3. 알림 운영 기준

기본 트리거:
- `D-30`, `D-7`, `D-1`, `day0`

정책:
- 사용자 opt-in 확인 후 발송
- 중복 발송 방지 키 적용
- 실패 시 최대 3회 백오프 재시도

---

## 4. 외부 API 운영 기준

주요 API:
- Open-Meteo, AirKorea, TourAPI, Kakao, Google Maps

공통 fallback:
1) 실시간 호출 실패 -> 캐시  
2) 캐시 실패 -> 마지막 성공 스냅샷  
3) 그래도 실패 -> 재시도 CTA + 상태 라벨

---

## 5. 배포 운영 기준

릴리즈 순서:
1. 코드 품질 게이트
2. DB migration/RLS
3. Edge Functions 배포
4. cron 확인
5. smoke 테스트

배포 후:
- T+1h 모니터링
- T+24h KPI 초동 점검

---

## 6. 의사결정 남은 항목 (협업)

- [ ] Web Push Phase 1 기본 ON 여부
- [ ] API 월 비용 상한
- [ ] prod/staging 환경 완전 분리 시점
- [ ] 시크릿 저장소 운영 정책(Vercel/GitHub/Supabase Vault)

---

## 7. 참조 문서

- `API-SPEC.md`
- `EDGE-FUNCTIONS.md`
- `DB-RLS-POLICIES.md`
- `METRICS-KPI.md`

