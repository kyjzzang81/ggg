# CLIMATE Metrics & KPI Spec

> 목적: Phase 1 핵심 KPI의 산식, 이벤트, 대시보드 기준을 정의한다.
> 기준: `PRD.md`, `MVP-SCOPE.md`, `USER-JOURNEY.md`

---

## 1. KPI 북극성

- 북극성 지표:
  - **탐색→저장 전환율** = `D-day 생성 사용자 / 스코어 확인 사용자`

---

## 2. Phase 1 KPI

| KPI | 목표 | 산식 |
|---|---|---|
| 스코어→D-day 전환율 | 20%+ | `dday_create users / score_view users` |
| D-day 알림 tap rate | 40%+ | `push_tap / push_sent` |
| 비수기 지역 탐색 비율 | 20%+ | `offseason_city_view / place_view` |
| 7일 재방문율 | 30%+ | `D7 retained users / 신규 users` |
| 탐색 완료율 | 60%+ | `home→score→place 완료 세션 / home 세션` |

---

## 3. 이벤트 택소노미

### 3-1. 공통 속성

모든 이벤트는 아래 공통 필드를 포함:

```json
{
  "user_id": "uuid|anonymous",
  "session_id": "uuid",
  "timestamp": "ISO-8601",
  "path": "/score",
  "city": "jeju",
  "mode_couple": false,
  "mode_family": true
}
```

### 3-2. 핵심 이벤트

| 이벤트 | 시점 | 필수 속성 |
|---|---|---|
| `home_view` | 홈 진입 | weather_theme |
| `score_view` | 스코어 화면 노출 | city, from, to |
| `calendar_range_select` | 기간 선택 완료 | from, to, avg_score |
| `place_view` | 장소 추천 노출 | purpose, grade |
| `place_detail_open` | 장소 상세 열기 | place_id |
| `dday_create` | D-day 생성 성공 | event_id, target_date |
| `dday_update` | D-day 수정 | event_id |
| `dday_delete` | D-day 삭제 | event_id |
| `push_sent` | 알림 발송 | trigger_code |
| `push_tap` | 알림 클릭 | trigger_code, event_id |
| `mode_toggle` | 연인/가족 토글 | couple, family |

---

## 4. 퍼널 정의

### 퍼널 A: 여행 의사결정

1) `home_view`  
2) `score_view`  
3) `calendar_range_select`  
4) `place_view`  
5) `dday_create`

이탈 구간:
- `score_view` 이후 이탈
- `place_view` 이후 저장 미실행

---

## 5. 유지/재방문 지표

- `D1`, `D7`, `D30` 리텐션
- D-day 보유 사용자 재방문율
- 알림 수신자 대비 재오픈율

---

## 6. 대시보드 최소 구성

- 일간 활성 사용자(DAU)
- 퍼널 전환율(위 퍼널 A)
- D-day 생성 추이
- 알림 발송/클릭 추이
- 도시별 조회 TOP 10

---

## 7. 데이터 품질 규칙

- 이벤트 이름 snake_case 통일
- 중복 전송 방지용 `event_idempotency_key` 권장
- 클라이언트 시계 오차 보정(서버 수신시각 병행 저장)

---

## 8. 운영 경보(알람) 기준

- `push_tap_rate` 20% 미만 2일 연속
- `score_view` 급감 30% 이상
- `dday_create` 0건 1일 지속

---

## 9. 협업 의사결정 항목

- [ ] 분석 도구: GA4 vs Amplitude
- [ ] 익명 사용자 추적 정책(쿠키 동의 연계)
- [ ] 이벤트 보관 기간(예: 13개월)

---

## 10. 연계 문서

- `USER-JOURNEY.md`
- `NAVIGATION-FLOW.md`
- `NOTIFICATION-SPEC.md`
- `ANALYTICS-SPEC.md` (작성 예정)
