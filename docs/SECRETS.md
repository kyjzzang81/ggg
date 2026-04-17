# CLIMATE Secrets Policy

> 목적: 시크릿/API 키 관리 규칙을 표준화해 유출 리스크를 줄인다.

---

## 1. 저장 위치 원칙

- 로컬: `.env.local`
- 배포: Vercel Environment Variables
- 서버 배치/함수: Supabase Secrets (필요 시)

코드/문서/이슈/채팅에 실제 키 값을 남기지 않는다.

---

## 2. 필수 규칙

- 환경별 키 분리(dev/staging/prod)
- 키 로테이션 주기 최소 분기 1회
- 권한 최소화(필요 API만 허용)
- 유출 의심 시 즉시 폐기/재발급

---

## 3. 금지 사항

- Git 커밋에 `.env*` 포함
- 프론트 번들에 서버 전용 키 삽입
- 공유 문서에 키 원문 기록

---

## 4. 사고 대응

1. 노출 키 즉시 폐기
2. 신규 키 발급 후 배포 환경 반영
3. 영향 범위 점검(로그/API 사용량)
4. 재발 방지 조치 기록

---

## 5. 연계 문서

- `ENV-SETUP.md`
- `PLATFORM-OPS.md`
- `DEPLOYMENT.md`

