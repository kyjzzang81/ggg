# DB Migrations Guide

> 목적: Supabase 마이그레이션 작성/적용/롤백 규칙을 통일한다.

---

## 1. 기본 원칙

- 모든 스키마 변경은 마이그레이션 파일로 관리
- 수동 SQL Editor 직접 변경 금지(긴급 핫픽스 제외)
- `up` 기준으로 항상 재현 가능해야 함

---

## 2. 파일 네이밍

권장 포맷:

`YYYYMMDDHHMM__<scope>__<short-description>.sql`

예:
- `202604171830__user__create_user_dday_events.sql`
- `202604171900__feature__add_climate_frequency_indexes.sql`

---

## 3. 작업 절차

1. 변경 요구 확인 (`DB-GAP-ANALYSIS.md`)
2. 마이그레이션 파일 작성
3. 로컬 적용 테스트
4. 스테이징 적용
5. 앱 회귀 테스트
6. 운영 반영

---

## 4. 작성 규칙

- DDL은 idempotent 작성 권장 (`IF NOT EXISTS`)
- 대량 데이터 변경은 트랜잭션/배치 분리
- 위험한 변경(컬럼 삭제/타입 변경)은 단계적 마이그레이션

예시:
```sql
BEGIN;

CREATE TABLE IF NOT EXISTS user_dday_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;
```

---

## 5. 롤백 전략

- 원칙: forward fix 우선
- 롤백 필요 시 별도 복구 마이그레이션 추가
- 파괴적 변경 전 백업/스냅샷 필수

권장:
- `DROP COLUMN` 대신 deprecate 후 제거
- `ALTER TYPE` 대신 신규 컬럼 추가 후 백필/전환

---

## 6. 검증 체크리스트

- [ ] 마이그레이션 재실행 시 실패하지 않음
- [ ] 인덱스/제약조건 기대대로 생성
- [ ] RLS 정책 의도대로 동작
- [ ] 앱 쿼리 호환성 확인
- [ ] 문서(`DB-SCHEMA.md`) 동기화

---

## 7. Supabase CLI 예시

```bash
# 마이그레이션 생성(팀 규칙에 맞는 명령으로 대체 가능)
supabase migration new create_user_dday_events

# 로컬 적용
supabase db reset

# 원격 반영
supabase db push
```

---

## 8. Phase 1 권장 마이그레이션 순서

1. `user_dday_events`
2. `user_sessions`
3. `user_subscriptions`
4. 인덱스 추가
5. RLS 정책 추가
6. `climate_frequency` 빌드 함수/뷰
