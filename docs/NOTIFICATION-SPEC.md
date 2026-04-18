# ggg Notification Spec

> 목적: D-day/운영 알림의 트리거, 채널, 페이로드, 실패 대응을 정의한다.
> 기준: `MVP-SCOPE.md`, `AUTH-SPEC.md`, `EDGE-FUNCTIONS.md`

---

## 1. 범위

- Phase 1 필수:
  - D-day 알림 (`D-30`, `D-7`, `D-1`, 당일 오전)
  - 예보 급변 알림(옵션)
- Phase 1.5 유보:
  - 결제/구독 가격 조정 알림
  - 마케팅 캠페인 푸시

---

## 2. 채널 전략

| 채널 | 웹(Phase 1) | 앱(Phase 2) | 용도 |
|---|---|---|---|
| In-app 토스트 | 사용 | 사용 | 즉시 피드백 |
| Web Push | 선택(브라우저 지원 시) | - | D-day 리마인드 |
| Local Notification | - | 사용 | 앱 백그라운드 알림 |
| 이메일 | 미사용 | 미사용 | Phase 2 검토 |

---

## 3. 데이터 모델

기본 테이블:
- `user_dday_events`: 일정과 리마인드 설정 저장
- `user_subscriptions`: 향후 구독 알림 대상 식별
- `user_sessions`: 최근 활동 사용자 필터링

권장 컬럼(없으면 추가):

```sql
-- user_dday_events
reminders jsonb default '["d30","d7","d1","day0"]'::jsonb,
timezone text default 'Asia/Seoul',
notification_opt_in boolean default true
```

---

## 4. 트리거 규칙

### 4-1. D-day 알림

| 코드 | 발송 시점 | 기본 ON |
|---|---|---|
| `d30` | target_date - 30일, 09:00 | ON |
| `d7` | target_date - 7일, 09:00 | ON |
| `d1` | target_date - 1일, 18:00 | ON |
| `day0` | target_date 당일, 08:00 | ON |

중복 발송 방지:
- `(event_id, trigger_code, send_date)` unique 처리

### 4-2. 예보 급변 알림 (옵션)

- 조건:
  - 강수확률 증가폭 ≥ 30%p 또는
  - score grade 하락 2단계 이상
- 발송 제한:
  - 동일 event 24시간 1회 제한

---

## 5. 스케줄/배치

- Edge Function: `send-dday-notifications`
- cron: 매일 08:55 KST 실행
- 처리 순서:
  1) 오늘 발송 대상 조회
  2) 사용자 opt-in 확인
  3) 채널별 발송
  4) 발송 로그 기록

---

## 6. 메시지 템플릿

```json
{
  "d30": {
    "title": "{{city}} 여행 D-30",
    "body": "이번 주 예보 기준 추천도 {{gradeLabel}}입니다."
  },
  "d7": {
    "title": "{{city}} 여행 D-7",
    "body": "비 예보 변동을 확인해 보세요."
  },
  "d1": {
    "title": "{{title}} D-1",
    "body": "내일 날씨와 준비물을 최종 확인하세요."
  },
  "day0": {
    "title": "{{title}} 오늘 출발",
    "body": "좋은 여행 되세요. 실시간 주변 추천도 확인해 보세요."
  }
}
```

---

## 7. 딥링크

- 기본 딥링크: `/dday/:eventId`
- 미인증 사용자:
  - `/?login=1&redirect=/dday/:eventId`로 이동
- 앱(WebView)에서는 동일 경로를 내부 라우터로 전달

---

## 8. 실패/재시도

- 네트워크 실패: 지수 백오프 최대 3회
- 영구 실패: `failed` 상태 기록 + 다음 배치에서 제외
- 미등록 토큰: 즉시 비활성화 처리

---

## 9. 사용자 설정 UX

- D-day 생성/수정 시 알림 토글 노출
- `모두 끄기`와 `개별(d30/d7/d1/day0)` 동시 지원
- 알림 권한 거부 시:
  - 인앱 배너로 권한 재요청 유도

---

## 10. 의사결정 필요(협업)

- [ ] Phase 1 웹에서 Web Push를 기본 활성할지
- [ ] 예보 급변 알림 기본 ON/OFF
- [ ] 야간 발송 금지 시간대(예: 22:00~08:00)

---

## 11. 연계 문서

- `AUTH-SPEC.md`
- `NAVIGATION-FLOW.md`
- `EDGE-FUNCTIONS.md`
- `METRICS-KPI.md`
