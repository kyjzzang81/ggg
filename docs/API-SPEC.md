# API Spec (Client-Facing Data Contract)

> 목적: 프론트엔드가 사용하는 데이터 계약을 명확히 해 구현/리뷰/테스트 기준을 통일한다.  
> 형태: Supabase 직접 쿼리 + RPC + Edge Function 호출
> 마지막 업데이트: 2026-04-21

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

## 2-1-1. 5일 표 보조 지표(자외선/대기질)

- 소스: Open-Meteo Air Quality API (클라이언트 직접 호출)
- 입력: `latitude`, `longitude`, `forecast_days=5`, `hourly=pm2_5,uv_index`
- 집계 규칙(일자별):
  - `uv_index`: 일최대값
  - `pm2_5`: 일평균값
  - `pm10`: `pm2_5 * 1.5` 환산
- 출력: 5일 테이블 행 렌더링용 일자별 수치 맵 (`YYYY-MM-DD` 키)

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

## 3-0. 스코어 진입 플로우 계약

- 순서:
  1) 도시 선택 (`cities`)
  2) 캘린더 추천도 조회 (월/주/일)
  3) 컨텍스트 해석 조회
  4) 여행형태 탭별 Top 5 추천 조회
  5) D-day 저장 바텀시트 호출
- 모드 반영:
  - 입력에 `mode`(`default` | `couple` | `family` | `couple_family`) 포함 가능
  - `mode` 변경 시 2~4 단계 재조회

## 3-1. 주별 점수

- 소스: `best_travel_week`
- 입력: `city_id`, `week_of_year`
- 출력: `travel_score`, `temp_score`, `rain_score`, `humidity_score`

## 3-2. 월별 점수

- 소스 우선순위:
  1) `climate_score_monthly`
  2) `best_travel_week` 집계

## 3-3. 캘린더 추천도 (월/주/일)

- 소스:
  - 월: `climate_score_monthly`
  - 주: `best_travel_week`
  - 일: `climate_normals` + 파생 로직(등급 매핑)
- 입력:
  - `city_id`
  - `year`, `month`
  - `view_mode` (`monthly` | `weekly` | `daily`)
  - `mode` (옵션)
- 출력:
  - `cells`: 날짜/주차 단위 추천도 데이터
  - `summary`: 평균 점수/등급, 선택 범위 정보
  - `state`: `ready` | `empty`

## 3-4. 컨텍스트(해석 영역)

- 소스: `monthly_climate`, `climate_normals`, `best_travel_week` 조합
- 입력:
  - `city_id`
  - `start_date`, `end_date`
  - `mode` (옵션)
- 출력:
  - `summary_text` (한 줄 해석)
  - `bullets` (근거 2~4개)

## 3-5. 여행형태 탭 Top 5 추천

- 소스: `activity_weather_score`, `best_travel_week`
- 입력:
  - `city_id`
  - `travel_type` (예: `relax` | `activity` | `citywalk`)
  - `start_date`, `end_date` (또는 `month`)
  - `mode` (옵션)
- 출력:
  - 추천 5건
  - 각 항목: `week_label`, `grade`, `score`, `reason`, `data_points[]`

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
  2) `nearby-sync` Edge Function 호출로 Naver Local Search 결과 캐시 적재 후 재조회
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

## 6-1. 스코어 화면 저장 (BottomSheet)

- 입력(생성):
  - `title` (옵션, 미입력 시 기본값 자동 생성)
  - `city_id`
  - `date_from`, `date_to`
  - `mode_context` (옵션: 저장 시점 모드)
- 출력:
  - `event_id`
  - `saved_at`
  - 저장된 이벤트 요약

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

## 8-3. `weather-cache`

- 입력:
```json
{ "city_id": "paju", "lat": 37.76, "lon": 126.78 }
```
- 출력:
```json
{
  "city_id": "paju",
  "cache_hit": true,
  "cached_at": "2026-04-21T01:00:00.000Z",
  "forecast_rows": [],
  "pm25_by_day": {},
  "uv_by_day": {}
}
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
