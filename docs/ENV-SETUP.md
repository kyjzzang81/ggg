# ENV Setup Guide

> 목적: 로컬 실행/배포에 필요한 환경변수와 발급 경로를 정리한다.

---

## 1. 파일 위치

- 로컬 개발: `.env.local`
- 샘플: `.env.example` (루트)

---

## 2. 필수 변수 (Phase 1)

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

VITE_AIRKOREA_API_KEY=
VITE_TOURAPI_KEY=
VITE_NAVER_MAP_CLIENT_ID=
VITE_GOOGLE_MAPS_API_KEY=
VITE_KAKAO_REST_KEY=
```

---

## 3. 선택 변수 (Phase 1.5+)

```bash
VITE_KMA_API_KEY=
VITE_IQAIR_API_KEY=
VITE_TOSS_CLIENT_KEY=   # 구독·결제 도입 시만
VITE_SENTRY_DSN=
```

---

## 4. 발급처

- Supabase: 프로젝트 대시보드
- 에어코리아/TourAPI: 공공데이터포털(data.go.kr)
- 네이버 클라우드: Nearby·국내 지도(콘솔에서 Maps / Search API 활성화)
- Google Maps: Google Cloud Console
- Kakao Local: Kakao Developers
- KMA: 기상자료개방포털
- IQAir: IQAir API Portal
- Toss Payments: 토스페이먼츠 개발자센터
- Sentry: sentry.io

---

## 5. 보안 규칙

- `.env.local`은 절대 커밋 금지
- 키는 환경별(dev/staging/prod) 분리
- 로그/에러 메시지에 키 노출 금지

---

## 6. 점검 체크리스트

- [ ] 로컬에서 변수 누락 없이 로드됨
- [ ] 잘못된 키에 대한 에러 메시지 확인
- [ ] 빌드 환경(Vercel/Supabase)에도 동일 키 세팅
