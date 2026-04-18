# API Spec (Client-Facing Data Contract)

> 목적: 프론트엔드가 사용하는 데이터 계약을 명확히 해 구현/리뷰/테스트 기준을 통일한다.  
> 형태: Supabase 직접 쿼리 + RPC + Edge Function 호출

---

## 1. 도시 검색

- 소스: `cities`
- 입력: `query`
- 출력: `id`, `name_ko`, `name_en`, `country`, `lat`, `lon`
- 규칙:
  - 1차: `cities` 검색
  - 2차: 미존재 시 Google Autocomplete fallback

---

## 2. 홈 데이터

## 2-1. 현재/단기 예보

- 소스(우선순위): `cities.lat/lon`이 있으면 **Open-Meteo Forecast API**(클라이언트 직접 호출) → 실패·빈 응답 시 **`forecast_weather`**
- 입력: `city_id`, 날짜 범위(또는 좌표 + `forecast_days`)
- 출력: 시간별 날씨 지표(`temperature`, `weather_code`, `precipitation` 등)

## 2-2. 빈도 인사이트

- 소스: `climate_frequency`
- 입력: `city_id`, `day_of_year`
- 출력: `clear_days`, `rain_days`, `snow_days`, ...

## 2-3. 홈 카드

- 소스: `home_cards`
- 입력: 없음
- 출력: 활성 카드 목록(`is_active=true`)

---

## 3. ggg score

## 3-1. 주별 점수

- 소스: `best_travel_week`
- 입력: `city_id`, `week_of_year`
- 출력: `travel_score`, `temp_score`, `rain_score`, `humidity_score`

## 3-2. 월별 점수

- 소스 우선순위:
  1) `climate_score_monthly`
  2) `best_travel_week` 집계

---

## 4. 장소 추천

- 소스:
  - `activity_weather_score`
  - `best_travel_week`
  - `rain_risk_calendar`
- 입력:
  - `city_id`(or 후보군)
  - `activity`
  - 날짜 범위
- 출력:
  - 추천 후보 목록(점수/등급/보조정보)

---

## 5. 주변 추천

- 소스 우선순위:
  1) `nearby_places`
  2) TourAPI 실시간 호출
- 입력:
  - 좌표/도시
  - 카테고리, 거리
- 출력:
  - 장소 리스트

---

## 6. D-day (인증 필요)

- 소스:
  - `user_dday_events`
  - `user_weather_archive`
  - `rain_risk_calendar`
- 동작:
  - CRUD + 날짜 기반 지표 조회

---

## 7. RPC 계약

## 7-1. `find_nearest_city_with_station`

- 입력: `p_lat`, `p_lon`
- 출력: `city_id`, `name_ko`, `name_en`, `station_name`

## 7-2. `get_monthly_visit_count`

- 입력: `p_user_id`, `p_year_month`
- 출력: 방문 횟수 `int`

---

## 8. Edge Function 계약

## 8-1. `track-session`

- 입력:
```json
{ "user_id": "uuid" }
```
- 출력:
```json
{ "ok": true }
```

## 8-2. `adjust-subscription-price`

- 입력: 없음
- 출력:
```json
{ "processed": 1200, "changed": 214 }
```

---

## 9. 에러 포맷(권장)

```json
{
  "error": {
    "code": "CITY_NOT_FOUND",
    "message": "도시 정보를 찾을 수 없습니다.",
    "retryable": false
  }
}
```

---

## 10. 캐싱 정책(권장)

- 실시간성 높음(`forecast_weather`, 대기질): 10~30분
- 통계(`best_travel_week`, `climate_normals`): 24시간
- CMS(`home_cards`, `hidden_season_highlights`): 1~24시간

---

## 11. 버전 정책

- 문서 버전: `v1`
- 파괴적 변경:
  - 마이그레이션 + 문서 동시 갱신
  - 변경 로그 섹션 추가 권장
