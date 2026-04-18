# ggg

`ggg`는 **good, great, gorgeous**의 약자이며,  
날씨/기후 데이터를 바탕으로 여행 의사결정을 돕는 서비스 문서 저장소입니다.

기획/스펙은 `docs/`에 두고, 웹앱 스캐폴딩은 `web/`에서 진행합니다.

---

## 앱 (`web/`)

- Vite + React + TypeScript. 로컬: `cd web && npm install && npm run dev`
- 환경 변수: `web/.env.example` → 복사해 `web/.env.local` 생성
- Google 로그인(D-day): Supabase **Authentication → URL configuration**에 Redirect URL로 `http://localhost:5173/auth/callback`(개발) 및 프로덕션 도메인 동일 경로 추가, Google 프로바이더 활성화
- Supabase 마이그레이션: `supabase/migrations/` → `supabase db push`
- Edge: `refresh-forecast`(Open-Meteo→`forecast_weather`), `build-climate-frequency`(RPC `rebuild_climate_frequency`)
  - 배포: `supabase functions deploy refresh-forecast --no-verify-jwt` (빌드 함수도 동일 플래그)
  - 대시보드 **Database → Cron** 또는 외부 스케줄러로 위 URL 주기 호출(서비스 롤 시크릿은 노출 금지)

---

## 문서 빠른 시작

- 제품 기획: `docs/PRD.md`
- 개발 스펙: `docs/DEV-SPEC.md`
- 디자인 시스템: `docs/DESIGN-SYSTEM.md`
- 컴포넌트 계약: `docs/COMPONENT-SPEC.md`
- MVP 범위: `docs/MVP-SCOPE.md`

---

## 현재 우선 문서 세트

- `docs/SCREEN-SPEC.md`
- `docs/CALENDAR-SCORE-UX.md`
- `docs/DB-GAP-ANALYSIS.md`
- `docs/DB-MIGRATIONS.md`
- `docs/EDGE-FUNCTIONS.md`
- `docs/API-SPEC.md`
- `docs/ENV-SETUP.md`

---

## 개발 준비 예정

앱 구현 시작 전 아래를 확정합니다.

- 환경 변수/외부 API 키 발급
- Supabase 마이그레이션 전략
- 화면/컴포넌트 계약
- 테스트 전략
