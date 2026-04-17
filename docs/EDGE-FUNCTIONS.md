# Edge Functions Spec

> 목적: Supabase Edge Functions의 책임, 입력/출력, 스케줄을 한 문서로 관리한다.

---

## 1. 함수 목록

| 함수명 | 상태 | 트리거 | 목적 |
|---|---|---|---|
| `refresh-forecast` | 운영중/필수 | cron(일 1회) | 14일 예보 갱신 |
| `build-climate-frequency` | 필요 | 수동 + 정기 | 날짜별 빈도 집계 |
| `build-climate-scores` | 필요 | 수동/월 1회 | 월별 점수 캐시 생성 |
| `adjust-subscription-price` | 필요 | 월 1회 | 방문 기반 가격 조정 |
| `track-session` | 필요 | 앱 진입 시 | 방문 로그 기록 |

---

## 2. 상세 명세

## 2-1. `refresh-forecast`

- 입력: 없음(내부적으로 `cities` 조회)
- 처리:
  - 도시별 Open-Meteo 호출
  - `forecast_weather` upsert
  - 만료 데이터 정리
- 실패 처리:
  - 도시 단위 재시도
  - 실패 도시 로그 저장

## 2-2. `build-climate-frequency`

- 입력: optional `city_id`, `start_date`, `end_date`
- 처리:
  - `daily_weather` 집계
  - `climate_frequency` upsert
- 출력: 처리 도시 수, 처리 행 수

## 2-3. `build-climate-scores`

- 입력: optional `city_id`
- 처리:
  - `best_travel_week` -> `climate_score_monthly`
- 출력: 도시별 처리 요약

## 2-4. `adjust-subscription-price`

- 입력: 없음(배치 기준월 내부 계산)
- 처리:
  - 전월 방문 횟수 조회(`user_sessions`)
  - `user_subscriptions` status/price 업데이트
- 출력: 대상/변경 건수

## 2-5. `track-session`

- 입력: `user_id`
- 처리:
  - `user_sessions` insert
  - `year_month` 자동 계산
- 출력: 성공 여부

---

## 3. 스케줄 정책

- `refresh-forecast`: 매일 02:00 KST
- `adjust-subscription-price`: 매월 1일 00:00 KST
- `build-climate-frequency`: 초기 수동 + 주기 갱신(월/분기)
- `build-climate-scores`: 월 1회 또는 데이터 갱신 후

---

## 4. 환경 변수

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPEN_METEO_BASE_URL` (선택)
- 외부 API 키(필요 함수만)

---

## 5. 공통 에러 처리 규칙

- 타임아웃/429: 지수 백오프 재시도
- 부분 실패: 전체 실패로 중단하지 않고 도시 단위 누적
- 최종 결과: `processed`, `success`, `failed` 반환

---

## 6. 로깅/모니터링

- 요청 ID 생성
- 도시/함수별 처리 시간 기록
- 실패 건 샘플 payload 저장(민감정보 제외)
- 임계치 초과 실패 시 알림(후속: Slack/Sentry)

---

## 7. 배포 체크리스트

- [ ] 함수 코드 배포
- [ ] 환경변수 설정
- [ ] cron 등록/검증
- [ ] 수동 dry-run
- [ ] 로그 확인
