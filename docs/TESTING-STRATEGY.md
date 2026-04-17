# Testing Strategy

> 목적: MVP 품질 기준을 테스트 레벨별로 정의한다.

---

## 1. 테스트 피라미드

- Unit: 60%
- Component: 25%
- E2E/Smoke: 15%

---

## 2. 우선 테스트 대상

## 2-1. Unit

- 점수 계산/등급 매핑
- 날짜/윤년/day_of_year 변환
- 추천 정렬 로직
- 레이어 ON/OFF 조건 분기

## 2-2. Component

- `ScoreCalendar` 범위 선택
- `ClimateScoreBadge` 라벨/색상 동시 표시
- `MobileBottomNav` 활성 탭 전환

## 2-3. E2E (핵심 플로우)

- 도시 선택 -> 스코어 확인
- 시기 선택 -> 장소 추천 확인
- 로그인 -> D-day 저장/조회

---

## 3. 품질 기준

- 치명 플로우 회귀 0건
- 계산 로직 커버리지 우선 확보
- 접근성 기본 점검 포함(키보드 포커스, 라벨)

---

## 4. 실행 시점

- PR 단위: unit/component
- 배포 전: smoke E2E + 수동 QA 체크리스트

---

## 5. 실패 처리

- flaky 테스트는 즉시 격리 후 원인 분석
- 회귀 버그는 재현 테스트 먼저 추가 후 수정
