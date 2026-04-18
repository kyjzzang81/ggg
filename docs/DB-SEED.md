# ggg DB Seed Guide

> 목적: 로컬/스테이징 검증용 최소 seed 데이터를 표준화한다.

---

## 1. Seed 원칙

- 개인정보/실키 사용 금지
- 재실행 가능(idempotent)하게 작성
- 도시/날짜/점수는 회귀테스트가 가능한 고정값 사용

---

## 2. 최소 Seed 범위 (Phase 1)

- `cities` 10개 (국내 6, 해외 4)
- `monthly_climate` 최근 12개월 샘플
- `best_travel_week` 도시별 4주 샘플
- `home_cards` 기본 카드 5개
- `user_dday_events` 테스트 계정 2개 일정

---

## 3. 예시 SQL

```sql
insert into cities (id, slug, name_ko, lat, lng)
values
  ('11111111-1111-1111-1111-111111111111', 'jeju', '제주', 33.4996, 126.5312),
  ('22222222-2222-2222-2222-222222222222', 'busan', '부산', 35.1796, 129.0756)
on conflict (id) do nothing;
```

---

## 4. 실행 순서

1. migration 적용
2. seed SQL 실행
3. smoke 시나리오 실행(`홈 -> 스코어 -> D-day`)

---

## 5. 연계 문서

- `DB-MIGRATIONS.md`
- `QA-CHECKLIST.md`
- `UNIT-TEST-TARGETS.md`

