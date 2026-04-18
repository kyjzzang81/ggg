# ggg Unit Test Targets

> 목적: MVP에서 반드시 보호해야 할 핵심 계산/변환 로직의 테스트 우선순위를 고정한다.
> 기준: `TESTING-STRATEGY.md`, `GLOSSARY.md`, `MVP-SCOPE.md`

---

## 1. 우선순위 분류

- **P0**: 배포 전 필수
- **P1**: MVP 직후 1주 내
- **P2**: 리팩터링/고도화 시

---

## 2. P0 테스트 대상

| 모듈 | 케이스 | 기대 결과 |
|---|---|---|
| ggg score 계산 | 입력 정상 범위 | 0~100 범위 점수 |
| Score Grade 변환 | 경계값(39/40, 59/60, 79/80) | 등급 정확 매핑 |
| KidSafetyScore | UV/PM2.5 극단값 | 안전 등급 하향 |
| GoldenHourScore | 운량/강수/가시거리 조합 | 점수 가중치 반영 |
| day_of_year 변환 | 평년/윤년 날짜 | 오프셋 정확 |
| WMO → 테마 매핑 | 대표 코드 + 미정 코드 | 기본값 fallback |
| 날짜 범위 유효성 | from > to, 과거/미래 범위 | 에러 처리/정상화 |

---

## 3. P1 테스트 대상

| 모듈 | 케이스 |
|---|---|
| Nearby 정렬 | 거리/카테고리 가중 정렬 |
| 모드 레이어 | couple/family 조합별 필터 |
| 추천도 라벨 | 강력 추천~비추천 문구 매핑 |
| 알림 트리거 | D-30/D-7/D-1/day0 계산 |

---

## 4. P2 테스트 대상

| 모듈 | 케이스 |
|---|---|
| 캐시 만료 정책 | staleTime 경계 동작 |
| 국제화 날짜/숫자 | locale별 포맷 차이 |
| 배치 집계 유틸 | 대량 데이터 성능/정확성 |

---

## 5. 표준 테스트 패턴

```ts
describe('toScoreGrade', () => {
  test.each([
    [39, 'poor'],
    [40, 'fair'],
    [60, 'good'],
    [80, 'excellent'],
  ])('score %i => %s', (score, expected) => {
    expect(toScoreGrade(score)).toBe(expected);
  });
});
```

---

## 6. 경계/예외 케이스 체크

- `null`, `undefined`, `NaN` 입력
- 음수/100 초과 값
- 빈 배열 평균 계산
- timezone 변환 경계(자정)
- 윤년 2/29 처리

---

## 7. 커버리지 목표

- 전체 line coverage: 70%+
- P0 모듈: 90%+
- 브랜치 커버리지: 핵심 계산 모듈 85%+

---

## 8. 파일 배치

- co-location 우선:
  - `src/features/climate-score/utils.test.ts`
  - `src/lib/date/day-of-year.test.ts`
- 공용 fixture:
  - `tests/fixtures/weather.ts`

---

## 9. 연계 문서

- `TESTING-STRATEGY.md`
- `QA-CHECKLIST.md`
- `CALENDAR-SCORE-UX.md`
