# need-docs (Lean Backlog)

> 목적: 문서 목록이 아니라 **남은 의사결정/미완료 항목**만 관리한다.  
> 기준 인덱스: `DOCS-INDEX.md`

---

## 1. 현재 상태 요약

- 핵심 문서(1~31): 작성 완료
- 운영 방식: 통합 문서 중심
  - `ENGINEERING-RUNBOOK.md`
  - `PLATFORM-OPS.md`
  - `DOCS-INDEX.md`
- 남은 작업은 “신규 문서 생성”보다 “정책 확정” 위주

---

## 2. 즉시 의사결정 필요 (협업)

| 항목 | 현재 상태 | 결정 필요 |
|---|---|---|
| 결제 전략 | 구조만 준비 | Phase 1 결제 오픈 여부 |
| Web Push 기본값 | 미확정 | 기본 ON/OFF |
| API 비용 한도 | 미정 | 월 예산 상한 |
| 환경 분리 | 부분 분리 | dev/staging/prod 완전 분리 시점 |
| 분석 도구 | 미확정 | GA4 vs Amplitude |

---

## 3. 남은 문서 백로그 (최소)

### 필수에 가까움

| 문서 | 상태 | 비고 |
|---|---|---|
| `ENVIRONMENTS.md` | 미착수 | 환경 분리 정책 확정용 |
| `MONITORING.md` | 미착수 | 운영 알림/Sentry 기준 |

### 선택

| 문서 | 상태 | 비고 |
|---|---|---|
| `E2E-SCENARIOS.md` | 미착수 | Runbook 하위로도 대체 가능 |
| `PERFORMANCE-BUDGET.md` | 미착수 | 목표치만 Runbook에 흡수 가능 |

---

## 4. 통합/삭제 정책

- `active`: 기준 문서. 항상 최신 유지
- `reference`: 상세 참고. 필요 시만 동기화
- `legacy`: 기록 보존. 신규 기준으로 사용 금지

현재 상태 분류는 `DOCS-INDEX.md`를 단일 기준으로 사용한다.

---

## 5. 다음 액션

1. `ENVIRONMENTS.md`와 `MONITORING.md`를 작성해 운영 공백을 메운다.
2. 이후 신규 문서는 원칙적으로 만들지 않고 통합 문서 섹션으로 흡수한다.
3. 분기마다 `legacy` 문서 유지 필요성만 점검한다.

# 추가 필요 문서 목록 (need-docs)

> 현재 `docs/` 10개 문서 분석 기반. Phase 1 (웹앱 MVP) 착수 전 필요한 문서를 단계별로 정리.

## 범례

**중요도**
- `필수` — Phase 1 착수 전 반드시 있어야 하는 문서
- `선택` — 있으면 좋지만 V1.5 또는 Phase 2에서 작성해도 무방

**작성 주체**
- `[자동]` — 기존 `docs/` 내용 + 일반 지식으로 Claude가 초안까지 완성 가능. 사용자는 확인·승인만.
- `[협업]` — Claude가 초안을 만들고, 사용자가 의사결정(PG사 선정, OAuth 키 등)이나 도메인 지식(브랜드 톤, 사업 결정)을 추가해야 완성.
- `[수동]` — 사용자만 작성 가능. 법무·디자인 파일·외부 계정·실제 키·베타 테스터 섭외 등.

**진행 상태**
- `완료` — 초안 작성 완료
- `진행중` — 일부 작성/보강 필요
- `미착수` — 아직 시작 전

---

## 문서 간소화 정책 (2026-04 갱신)

문서 수가 많아져 유지비가 커진 상태라, 앞으로는 아래 원칙으로 운영한다.

- 통합 우선 문서:
  - `ENGINEERING-RUNBOOK.md` (코드/테스트/QA/릴리즈 실행 기준)
  - `PLATFORM-OPS.md` (인증/알림/API/배포/시크릿 운영 기준)
  - `DOCS-INDEX.md` (읽는 순서 + 문서 맵)
- 신규 작성은 개별 문서를 먼저 만들지 않고, 통합 문서 하위 섹션에 추가한다.
- 기존 개별 문서는 히스토리/상세 참고용으로 유지하되, 우선 수정 대상은 통합 문서로 한다.

---

## 1. 기획 이해

| 문서 | 중요도 | 주체 | 설명 |
|---|---|---|---|
| `USER-JOURNEY.md` | 필수 | [자동] | 페르소나 3종(계획파/커플/가족)의 대표 시나리오를 화면 이동 단계로 서술. PRD에서 파생 가능. |
| `INFORMATION-ARCHITECTURE.md` | 필수 | [자동] | 하단탭 5개 × 사이드 패널 × 모드 레이어의 화면 이동 flow 다이어그램 (mermaid). |
| `MVP-SCOPE.md` | 필수 | [협업] | PRD의 기능 표를 "Phase 1 포함 / 제외 / 유보"로 확정 정리. 초안 생성 후 사업 결정 필요. 현재 `PRD.md`와 `DEV-SPEC.md` §13이 일부 상충. |
| `GLOSSARY.md` | 필수 | [자동] | Climate Score™, TCI, 골든아워 품질점수, KidSafetyScore, 연인/가족 레이어, 에코트립 등 용어 정의. |
| `METRICS-KPI.md` | 필수 | [협업] | PRD KPI(예: 비수기 지역 예약 비율 ≥20%)의 측정 이벤트와 산식 정의. 이벤트 네이밍은 사용자 확정 필요. |
| `COMPETITOR-ANALYSIS.md` | 선택 | [협업] | 카카오맵/웨더뉴스/AccuWeather/마이리얼트립 대비 포지셔닝. 조사 초안 + 내부 인사이트 병합. |

---

## 2. 디자인 시스템 구축

현재 이 영역이 가장 비어 있음. `DEV-SPEC.md` §2에 토큰·컴포넌트 이름만 있고 시각 규칙 부재.

| 문서 | 중요도 | 주체 | 설명 |
|---|---|---|---|
| `DESIGN-SYSTEM.md` | 필수 | [자동] | color/typography/spacing/radius/elevation/motion 토큰 Single Source of Truth. |
| `COMPONENT-SPEC.md` | 필수 | [협업] | `DEV-SPEC.md` §2-5의 13개 컴포넌트에 Props/Variant/State(default·hover·active·disabled·loading·empty·error) 명세. 디자이너 검토 필요. |
| `ACCESSIBILITY.md` | 필수 | [자동] | WCAG AA 색대비, 키보드 네비, 스크린리더 레이블. 날씨 테마 8종 텍스트 대비 검증 포함. |
| `RESPONSIVE-GUIDE.md` | 필수 | [자동] | PC/Tablet/Mobile 그리드·치수·터치 타겟·사이드바 전환 규칙. |
| `WEATHER-THEME-GUIDE.md` | 선택 | [자동] | 8종 테마별 히어로/배지/알림/CTA 조합 예시. hex는 있으나 조합 가이드 부재. |
| `ICONOGRAPHY.md` | 선택 | [자동] | Meteocons(날씨) / Lucide(UI) / Phosphor(여행) 역할 분리와 사이즈 체계. |
| `MOTION.md` | 선택 | [협업] | Lottie 반복 정책, 테마 전환 애니메이션, 사이드 패널 슬라이드 타이밍. UX 결정 필요. |
| `COPY-TONE.md` | 선택 | [수동] | 날씨 인사이트, D-day/구독 알림 문구 톤앤매너. 서비스명 미정이라 브랜드 확정 후 작성. |
| Figma 파일 / 목업 인덱스 | 선택 | [수동] | 디자인 원본 자산. `climate-app-v3.html` 매핑 인덱스도 포함. |

---

## 3. 개발환경 구축

Repo 루트에 `README.md` 조차 없음.

| 문서 | 중요도 | 주체 | 설명 |
|---|---|---|---|
| `README.md` / `GETTING-STARTED.md` | 필수 | [자동] | Node 버전, 패키지 매니저, clone → install → dev 절차. |
| `ENV-SETUP.md` + `.env.example` | 필수 | [협업] | API 키 15종 발급 절차 (공공데이터포털 승인 1~3일 등). 실제 키는 사용자. |
| `CODE-CONVENTIONS.md` | 필수 | [자동] | ESLint + Prettier + TS strict 규칙, 네이밍 (hooks `use*`, store `*Store`). |
| `GIT-WORKFLOW.md` | 선택 | [자동] | 브랜치 전략, Conventional Commits, PR 템플릿. |
| `FOLDER-IMPORT-RULES.md` | 선택 | [자동] | `src/app`, `src/components`, `src/lib` import 허용/금지 규칙. |
| `SUPABASE-LOCAL.md` | 선택 | [자동] | `supabase start` 로컬 개발, 마이그레이션 관리, seed 적용. |
| `CI-CD.md` | 선택 | [협업] | GitHub Actions (lint/typecheck/build/preview). 저장소 권한·Secrets는 사용자. |
| `TROUBLESHOOTING.md` | 선택 | [자동] | 자주 겪는 에러(WMO 매핑 누락, Kakao key 누락 등). 개발하며 누적. |

---

## 4. DB 부족한 부분 파악

`DB-SCHEMA.md`와 `DEV-SPEC.md` §4-2에 흩어진 정보를 종합할 문서가 필요.

| 문서 | 중요도 | 주체 | 설명 |
|---|---|---|---|
| `DB-GAP-ANALYSIS.md` | 필수 | [자동] | 현재 vs 필요 테이블(`user_dday_events`, `user_sessions`, `user_subscriptions`, `climate_score_monthly`, `hidden_season_highlights`, `nearby_places` 등)을 "필수 신규 / 선택 / 확장 필드 / RLS 미정의"로 구분. `climate_frequency` 미구현도 포함. |
| `DB-ERD.md` | 필수 | [자동] | mermaid erDiagram으로 FK 관계 시각화. |
| `DB-MIGRATIONS.md` | 필수 | [자동] | 마이그레이션 파일 네이밍, 롤백 전략, Supabase CLI 기반 워크플로우. |
| `DB-RLS-POLICIES.md` | 필수 | [자동] | 모든 테이블 RLS 정책 통합 (현재 `user_*` 일부만 정의). |
| `DB-INDEXES.md` | 선택 | [자동] | 조회 패턴별 인덱스 (`forecast_weather (city_id, timestamp)`, `user_sessions (user_id, year_month)` 등). |
| `DB-SEED.md` | 선택 | [자동] | 개발/테스트용 seed (cities 일부, home_cards 샘플, dummy user). |

**PRD 미결사항에서 파생되는 DB 작업**

| 작업 | 중요도 | 주체 | 설명 |
|---|---|---|---|
| `cities.station_name` 매핑 | 필수 | [협업] | PRD 미결 "에어코리아 측정소 매핑 테이블 구축". 자동 1차 매핑 후 사용자 검증. |
| 구독 가격 조정 배치 SQL | 필수 | [자동] | `adjust-subscription-price` Edge Function이 쓸 RPC/함수 상세. |

---

## 5. Backend 구축

`BACKEND-FORECAST.md`, `BACKEND-SETUP.md`, `DEV-SPEC.md` §7에 분산된 내용을 통합.

| 문서 | 중요도 | 주체 | 설명 |
|---|---|---|---|
| `API-SPEC.md` | 필수 | [자동] | 클라이언트의 Supabase 쿼리/RPC를 엔드포인트처럼 명세 (request/response schema, 에러 케이스). |
| `EDGE-FUNCTIONS.md` | 필수 | [자동] | `refresh-forecast`, `build-climate-scores`, `build-climate-frequency`, `adjust-subscription-price`, `track-session`, `find_nearest_city_with_station` 통합 목록 + 상태 + 스케줄. |
| `AUTH-SPEC.md` | 필수 | [협업] | Supabase Auth, Google/Apple OAuth Redirect URL, 토큰 갱신. OAuth 앱 등록·키는 사용자. |
| `PAYMENT-SPEC.md` | 필수 | [협업] | 토스페이먼츠 vs 아임포트(Portone) 비교 → 빌링키 플로우 → `user_subscriptions` 상태머신. PG 선정은 사용자 (PRD 미결사항). |
| `NOTIFICATION-SPEC.md` | 필수 | [협업] | Web Push(FCM/APN) + Capacitor Local Notifications + D-30/D-7/D-1 + 구독 가격조정 알림. FCM 프로젝트 생성은 사용자. |
| `EXTERNAL-API-GUIDE.md` | 필수 | [협업] | 에어코리아·TourAPI·KMA·IQAir·Kakao·Google Maps의 발급 절차·쿼터·fallback. 실제 키는 사용자. |
| `RATE-LIMIT-AND-CACHE.md` | 선택 | [자동] | TanStack Query staleTime + 외부 API 일일 한도 + Supabase 캐시 테이블 전략. |
| `MONITORING.md` | 선택 | [협업] | Sentry 설정, Edge Function 로그, 배치 실패 알림(Slack). Sentry DSN·Slack webhook은 사용자. |
| `DATA-BACKFILL.md` | 선택 | [자동] | Open-Meteo 30년 데이터 재수집 절차, 도시 실패 시 재시도. |

---

## 6. Frontend 구축

`DEV-SPEC.md`에 폴더 구조와 컴포넌트 이름만 있고, 실행 가능한 설계 문서 부재.

| 문서 | 중요도 | 주체 | 설명 |
|---|---|---|---|
| `FRONTEND-ARCHITECTURE.md` | 필수 | [자동] | React Router v6 라우팅 트리, 레이아웃 계층(Root > TabLayout > Screen), TanStack Query + Supabase 데이터 패칭 패턴. |
| `STATE-MANAGEMENT.md` | 필수 | [자동] | Zustand 스토어 목록(`modeStore`, `locationStore`, `userStore`)과 state shape, persist 여부. |
| `SCREEN-SPEC.md` | 필수 | [자동] | 10개 화면(탭5 + 사이드5) 각각의 data source / loading / empty / error / auth-required / 레이어 ON-OFF 조건. |
| `CALENDAR-SCORE-UX.md` | 필수 | [협업] | Climate Score/장소추천 날짜 선택 캘린더에 날짜별 점수/추천도(강력 추천~비추천) 표현 규칙. 스카이스캐너형 UI 패턴, 색상 구간, 모바일/PC 상호작용 정의. |
| `NAVIGATION-FLOW.md` | 필수 | [자동] | URL 구조(`/`, `/score`, `/place`, `/nearby`, `/dday`, `/hidden-season`, `/compare`, `/impact`, `/mypage`), 딥링크, 뒤로가기 정책. |
| `FORM-VALIDATION.md` | 선택 | [자동] | Zod 스키마 모음 (도시 검색, D-day 저장, 장소 추천 입력). |
| `PWA-SPEC.md` | 선택 | [자동] | Service Worker 캐싱, manifest, 설치 배너. |
| `PERFORMANCE-BUDGET.md` | 선택 | [자동] | Lighthouse 목표, 초기 번들 사이즈 한도, Lottie 지연 로딩. |
| `I18N.md` | 선택 | [협업] | 한/영 분리, 날짜·숫자 로케일. 해외 확장 시점은 사용자 결정. |
| `ANALYTICS-SPEC.md` | 선택 | [협업] | GA4 vs Amplitude 선정 + 이벤트 분류. 도구 선정은 사용자. |

---

## 7. 테스트

현재 문서 전무.

| 문서 | 중요도 | 주체 | 설명 |
|---|---|---|---|
| `TESTING-STRATEGY.md` | 필수 | [자동] | Unit(Vitest) / Component(Testing Library) / E2E(Playwright) 피라미드, 커버리지 목표. |
| `UNIT-TEST-TARGETS.md` | 필수 | [자동] | 핵심 로직 우선순위 (Climate Score 계산, KidSafetyScore, GoldenHourScore, WMO→테마 매핑, day_of_year 변환, 윤년 처리). |
| `QA-CHECKLIST.md` | 필수 | [자동] | 날씨 테마 8종 × 3 브레이크포인트 × 2 레이어 수동 검증 매트릭스. |
| `E2E-SCENARIOS.md` | 선택 | [자동] | Playwright 필수 시나리오 (회원가입 → D-day 저장 → 알림 / 구독 결제 / 레이어 토글 / 권한 거부 fallback). |
| `ACCESSIBILITY-TEST.md` | 선택 | [자동] | axe-core 자동화 + 스크린리더 수동 시나리오. |
| `PERFORMANCE-TEST.md` | 선택 | [자동] | Lighthouse CI, Web Vitals 기준. |
| `TEST-DATA.md` | 선택 | [협업] | 테스트용 Supabase seed, 고정 날씨 mock. 별도 Supabase 프로젝트 생성은 사용자. |
| `UAT-PLAN.md` | 선택 | [수동] | 베타 테스터 섭외, 일정, 피드백 수집 폼. 운영 영역. |

---

## 8. 배포

구독 결제·개인정보 취급 서비스라 법무·보안 문서가 특히 중요.

| 문서 | 중요도 | 주체 | 설명 |
|---|---|---|---|
| `DEPLOYMENT.md` | 필수 | [협업] | 빌드 → 테스트 → 배포 단일 플로우. Vercel 계정 연결은 사용자. |
| `ENVIRONMENTS.md` | 필수 | [협업] | dev / staging / production 3환경 분리. Supabase 프로젝트 분리 결정은 사용자. |
| `RELEASE-CHECKLIST.md` | 필수 | [자동] | DB 마이그레이션 / Edge Function 배포 / cron 등록 / 환경변수 확인. |
| `SECRETS.md` | 필수 | [협업] | Vercel Env, GitHub Secrets, Supabase Vault 사용 규칙. 저장소 선정은 사용자. |
| `LEGAL.md` (이용약관·결제약관·환불정책) | 필수 | [수동] | 변호사 검토 필수. 구독 결제 도입 시 법적 요건. |
| `DATA-PRIVACY.md` (개인정보처리방침) | 필수 | [수동] | 위치정보·알림 수집 동의, 개인정보보호법 대응. 변호사/DPO 검토. |
| `ROLLBACK.md` | 선택 | [자동] | DB·Edge Function·Vercel 각각의 롤백 절차. |
| `SEO.md` | 선택 | [협업] | 메타태그, Open Graph, 사이트맵. 도메인·브랜딩 확정 후 작성. |
| `OBSERVABILITY.md` | 선택 | [자동] | 로그 집계, 에러 대시보드, 주요 알람. |
| `INCIDENT-RESPONSE.md` | 선택 | [자동] | 장애 등급, 대응 순서, 포스트모템 템플릿. |
| `COOKIE-POLICY.md` | 선택 | [수동] | 광고·분석 쿠키 동의 배너. |
| `APP-STORE-SUBMISSION.md` (Phase 2) | 선택 | [수동] | iOS/Android 심사 자료. 개발자 계정, 스토어 스크린샷·아이콘은 사용자. |

---

## 우선 착수 Top 10 (Phase 1 바이브코딩 직전에 필요한 최소 세트)

| 우선순위 | 문서 | 주체 | 상태 | 이유 |
|---|---|---|---|---|
| 1 | `MVP-SCOPE.md` | [협업] | 완료 | Phase 1에서 무엇을 안 만들지 확정해야 전체 일정 설계 가능. |
| 2 | `DESIGN-SYSTEM.md` | [자동] | 완료 | 컴포넌트 바이브코딩의 재료. |
| 3 | `COMPONENT-SPEC.md` | [협업] | 완료 | 화면 구현 시 참조할 Props/State. |
| 4 | `SCREEN-SPEC.md` | [자동] | 완료 | 화면별 data source / state 매트릭스. |
| 5 | `CALENDAR-SCORE-UX.md` | [협업] | 완료 | 날짜 선택 UX(점수/추천도 시각화) 확정. |
| 6 | `DB-GAP-ANALYSIS.md` | [자동] | 완료 | 신규 테이블 착수 순서. |
| 7 | `DB-MIGRATIONS.md` | [자동] | 완료 | 마이그레이션 실행 규칙. |
| 8 | `EDGE-FUNCTIONS.md` | [자동] | 완료 | 백엔드 작업 목록. |
| 9 | `API-SPEC.md` | [자동] | 완료 | 프론트/백 계약 고정. |
| 10 | `README.md` + `ENV-SETUP.md` | [협업] | 완료 | 개발자 온보딩 진입점. |

### 우선순위 진행 요약

- 완료: 10/10
- 미착수: 0/10
- 비고: `TESTING-STRATEGY.md`, `.env.example`도 추가 완료됨

---

## 우선 착수 Next 10 (Phase 1 개발 착수 직전 2차 배치)

| 우선순위 | 문서 | 주체 | 상태 | 이유 |
|---|---|---|---|---|
| 11 | `USER-JOURNEY.md` | [자동] | 완료 | 페르소나 3종 여정을 화면/이벤트로 고정. |
| 12 | `INFORMATION-ARCHITECTURE.md` | [자동] | 완료 | 하단탭 5 × 사이드패널 5 × 모드 레이어 flow. |
| 13 | `GLOSSARY.md` | [자동] | 완료 | Climate Score™ 등 용어 Single Source. |
| 14 | `NAVIGATION-FLOW.md` | [자동] | 완료 | URL·쿼리·딥링크·뒤로가기 정책. |
| 15 | `FRONTEND-ARCHITECTURE.md` | [자동] | 완료 | 라우팅 트리·레이아웃·데이터 패칭 패턴. |
| 16 | `STATE-MANAGEMENT.md` | [자동] | 완료 | Zustand 스토어 shape + Query 경계. |
| 17 | `RESPONSIVE-GUIDE.md` | [자동] | 완료 | Mobile/Tablet/Desktop 그리드·사이드바 규칙. |
| 18 | `DB-ERD.md` | [자동] | 완료 | mermaid erDiagram으로 전체 관계 시각화. |
| 19 | `DB-RLS-POLICIES.md` | [자동] | 완료 | 전체 테이블 RLS 정책 통합 정의. |
| 20 | `AUTH-SPEC.md` | [협업] | 완료 | Supabase Auth 흐름 초안 (OAuth 키는 사용자). |

### 2차 배치 진행 요약

- 완료: 10/10
- 누적 완료: 20/20 (Top 10 + Next 10)
- 다음 후보: `CODE-CONVENTIONS.md`, `NOTIFICATION-SPEC.md`, `EXTERNAL-API-GUIDE.md`, `UNIT-TEST-TARGETS.md`, `QA-CHECKLIST.md`, `RELEASE-CHECKLIST.md`, `METRICS-KPI.md` 등

---

## 우선 착수 Next 7 (Phase 1 실행 안정화 3차 배치)

| 우선순위 | 문서 | 주체 | 상태 | 이유 |
|---|---|---|---|---|
| 21 | `CODE-CONVENTIONS.md` | [자동] | 완료 | 구현 품질 게이트와 네이밍/구조 통일. |
| 22 | `NOTIFICATION-SPEC.md` | [협업] | 완료 | D-day 알림 트리거/채널/딥링크 정책 확정. |
| 23 | `EXTERNAL-API-GUIDE.md` | [협업] | 완료 | API 키 발급·쿼터·fallback 운영 기준. |
| 24 | `UNIT-TEST-TARGETS.md` | [자동] | 완료 | 핵심 계산 로직 P0 테스트 대상 고정. |
| 25 | `QA-CHECKLIST.md` | [자동] | 완료 | 출시 직전 수동 QA 매트릭스 확보. |
| 26 | `RELEASE-CHECKLIST.md` | [자동] | 완료 | DB/배치/환경변수 포함 릴리즈 점검표. |
| 27 | `METRICS-KPI.md` | [협업] | 완료 | KPI 산식과 이벤트 택소노미 고정. |

### 3차 배치 진행 요약

- 완료: 7/7
- 누적 완료: 27개 핵심 문서
- 다음 후보: `ENVIRONMENTS.md`, `E2E-SCENARIOS.md`, `PERFORMANCE-BUDGET.md`, `MONITORING.md`

---

## 간소화 통합 문서 (운영 기준)

| 문서 | 상태 | 통합 범위 |
|---|---|---|
| `DOCS-INDEX.md` | 완료 | 문서 맵/읽는 순서/운영 원칙 |
| `ENGINEERING-RUNBOOK.md` | 완료 | `CODE-CONVENTIONS`, `TESTING-STRATEGY`, `UNIT-TEST-TARGETS`, `QA-CHECKLIST`, `RELEASE-CHECKLIST` |
| `PLATFORM-OPS.md` | 완료 | `ENV-SETUP`, `AUTH-SPEC`, `NOTIFICATION-SPEC`, `EXTERNAL-API-GUIDE`, 배포 운영 기준 |

---

## 우선 착수 Next 4 (Phase 1 운영 필수 보강 4차 배치)

| 우선순위 | 문서 | 주체 | 상태 | 이유 |
|---|---|---|---|---|
| 28 | `DB-INDEXES.md` | [자동] | 완료 | 조회 성능/쿼리 안정성 기준 |
| 29 | `DB-SEED.md` | [자동] | 완료 | 로컬/스테이징 재현 가능한 테스트 데이터 |
| 30 | `DEPLOYMENT.md` | [협업] | 완료 | 배포 단계 표준화 |
| 31 | `SECRETS.md` | [협업] | 완료 | 키/시크릿 유출 방지 운영 규칙 |

### 4차 배치 진행 요약

- 완료: 4/4
- 누적 완료: 31개 핵심 문서

---

## 작성 주체별 요약

**[자동] 총 29개** — Claude가 기존 `docs/`만으로 초안 완성 가능
- 기획: USER-JOURNEY, INFORMATION-ARCHITECTURE, GLOSSARY
- 디자인: DESIGN-SYSTEM, ACCESSIBILITY, RESPONSIVE-GUIDE, WEATHER-THEME-GUIDE, ICONOGRAPHY
- 개발환경: README, CODE-CONVENTIONS, GIT-WORKFLOW, FOLDER-IMPORT-RULES, SUPABASE-LOCAL, TROUBLESHOOTING
- DB: DB-GAP-ANALYSIS, DB-ERD, DB-MIGRATIONS, DB-RLS-POLICIES, DB-INDEXES, DB-SEED, 구독 배치 SQL
- Backend: API-SPEC, EDGE-FUNCTIONS, RATE-LIMIT-AND-CACHE, DATA-BACKFILL
- Frontend: FRONTEND-ARCHITECTURE, STATE-MANAGEMENT, SCREEN-SPEC, NAVIGATION-FLOW, FORM-VALIDATION, PWA-SPEC, PERFORMANCE-BUDGET
- Test: TESTING-STRATEGY, UNIT-TEST-TARGETS, QA-CHECKLIST, E2E-SCENARIOS, ACCESSIBILITY-TEST, PERFORMANCE-TEST
- 배포: RELEASE-CHECKLIST, ROLLBACK, OBSERVABILITY, INCIDENT-RESPONSE

**[협업] 총 18개** — Claude 초안 + 사용자 의사결정 필요
- MVP-SCOPE, METRICS-KPI, COMPETITOR-ANALYSIS (기획)
- COMPONENT-SPEC, MOTION (디자인)
- ENV-SETUP, CI-CD (개발환경)
- cities.station_name 매핑 (DB)
- AUTH-SPEC, PAYMENT-SPEC, NOTIFICATION-SPEC, EXTERNAL-API-GUIDE, MONITORING (Backend)
- CALENDAR-SCORE-UX, I18N, ANALYTICS-SPEC (Frontend)
- TEST-DATA (Test)
- DEPLOYMENT, ENVIRONMENTS, SECRETS, SEO (배포)

**[수동] 총 7개** — 사용자만 작성 가능
- COPY-TONE, Figma 자산 (디자인, 브랜딩 확정 후)
- UAT-PLAN (운영)
- LEGAL, DATA-PRIVACY, COOKIE-POLICY (법무)
- APP-STORE-SUBMISSION (Phase 2, 개발자 계정·스토어 자산)

---

## 다음 단계 제안

1. 사용자가 이 문서 검토 후 우선순위 Top 10 중 착수 문서 선택
2. `[자동]` 문서는 Claude가 연속으로 초안 작성
3. `[협업]` 문서는 Claude 초안 → 의사결정 질문 → 최종 확정
4. `[수동]` 문서는 사용자 자체 작성 일정 수립
