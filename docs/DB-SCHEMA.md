### 데이터 (Supabase)

| 항목        | 내용                                                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 저장소      | Supabase PostgreSQL                                                                                                                                                |
| 테이블      | `cities`, `hourly_weather`, `daily_weather`, `climate_normals`, `monthly_climate`, `forecast_weather`, `best_travel_week`, `rain_risk_calendar`, `weather_stability_index`, `activity_weather_score`, `climate_frequency`, `weather_character_map`, `home_cards` |
| Storage     | `cities_images` 버킷 (홈 카드 배경 이미지)                                                                                                                        |
| 데이터 소스 | Open-Meteo Historical Weather API (과거) / Open-Meteo Forecast API (예보)                                                                                         |
| 기간        | 2016-01-01 ~ 2025-12-31 (과거) / 오늘 ~ +14일 (예보)                                                                                                             |
| 단위        | 시간별 (최대 24행/일/도시)                                                                                                                                         |

---

## 🗄️ 전체 아키텍처

```
RAW WEATHER LAYER
  hourly_weather
        ↓
AGGREGATION LAYER
  daily_weather
        ↓
CORE (CLIMATE) ANALYTICS LAYER
  climate_normals / monthly_climate
        ↓
FEATURE ENGINE LAYER
  best_travel_week / rain_risk_calendar
  weather_stability_index / activity_weather_score
        ↓
FORECAST LAYER (병렬)
  forecast_weather (Open-Meteo, 매일 갱신)
        ↓
API → React Native
```

---

## 🗄️ Supabase 스키마

---

### [RAW] `cities`

| 컬럼         | 타입             | 설명                             |
| ------------ | ---------------- | -------------------------------- |
| `id`         | TEXT (PK)        | 도시 ID (예: `seoul`, `da-nang`) |
| `name_en`    | TEXT             | 영문명                           |
| `name_ko`    | TEXT             | 한글명                           |
| `country`    | TEXT             | 국가 코드                        |
| `lat`        | DOUBLE PRECISION | 위도                             |
| `lon`        | DOUBLE PRECISION | 경도                             |
| `alt`        | INTEGER          | 고도 (m)                         |
| `region`     | TEXT             | 지역 분류 (동아시아, 동남아 등)  |
| `is_popular` | BOOLEAN          | 인기 도시 여부 (검색 상단 노출)  |

---

### [RAW] `hourly_weather`

| 컬럼              | 타입           | 설명            |
| ----------------- | -------------- | --------------- |
| `id`              | BIGSERIAL (PK) | —               |
| `city_id`         | TEXT (FK)      | cities 참조     |
| `timestamp`       | TIMESTAMPTZ    | UTC 기준 시각   |
| `temperature`     | REAL           | 기온 °C         |
| `apparent_temp`   | REAL           | 체감온도 °C     |
| `humidity`        | SMALLINT       | 습도 %          |
| `precipitation`   | REAL           | 강수량 mm       |
| `rain`            | REAL           | 비 mm           |
| `snowfall`        | REAL           | 눈 cm           |
| `weather_code`    | SMALLINT       | WMO 코드 (0-99) |
| `cloud_cover`     | SMALLINT       | 구름 %          |
| `wind_speed`      | REAL           | 풍속 km/h       |
| `wind_direction`  | SMALLINT       | 풍향 °          |
| `wind_gusts`      | REAL           | 돌풍 km/h       |

- **UNIQUE**: `(city_id, timestamp)`
- **INDEX**: `(city_id, timestamp)`, `(timestamp)`
- **규모**: 도시당 최대 ~700,800 rows (80년 × 365일 × 24시간)

---

### [AGGREGATION] `daily_weather`

hourly_weather를 일별로 집계한 테이블. 초기 1회 배치 생성 후 불변.

| 컬럼                | 타입      | 설명           |
| ------------------- | --------- | -------------- |
| `id`                | BIGSERIAL (PK) | —         |
| `city_id`           | TEXT (FK) | cities 참조    |
| `date`              | DATE      | 날짜           |
| `temp_avg`          | REAL      | 평균 기온 °C   |
| `temp_min`          | REAL      | 최저 기온 °C   |
| `temp_max`          | REAL      | 최고 기온 °C   |
| `apparent_temp_avg` | REAL      | 평균 체감온도  |
| `humidity_avg`      | REAL      | 평균 습도 %    |
| `precipitation_sum` | REAL      | 하루 강수량 mm |
| `rain_sum`          | REAL      | 하루 비 mm     |
| `snowfall_sum`      | REAL      | 하루 눈 cm     |
| `wind_avg`          | REAL      | 평균 풍속 km/h |
| `wind_max`          | REAL      | 최대 풍속 km/h |
| `cloud_cover_avg`   | REAL      | 평균 구름 %    |
| `rain_hours`        | SMALLINT  | 하루 중 비 온 시간 수 (0~24) |

- **UNIQUE**: `(city_id, date)`
- **INDEX**: `(city_id, date)`
- **규모**: 도시당 ~29,200 rows (80년 × 365일)

---

### [ggg 코어] `climate_normals`

80년 데이터 기반 day_of_year 단위 기후 통계. 여행 추천 알고리즘의 핵심 데이터.

| 컬럼                 | 타입      | 설명                    |
| -------------------- | --------- | ----------------------- |
| `id`                 | BIGSERIAL (PK) | —                  |
| `city_id`            | TEXT (FK) | cities 참조             |
| `day_of_year`        | SMALLINT  | 1~365                   |
| `temp_avg`           | REAL      | 80년 평균 기온 °C       |
| `temp_min_avg`       | REAL      | 80년 평균 최저 기온     |
| `temp_max_avg`       | REAL      | 80년 평균 최고 기온     |
| `temp_stddev`        | REAL      | 기온 표준편차 (안정성용)|
| `humidity_avg`       | REAL      | 평균 습도 %             |
| `rain_probability`   | REAL      | 비 올 확률 0~1          |
| `precipitation_avg`  | REAL      | 평균 강수량 mm          |
| `precipitation_stddev` | REAL    | 강수 표준편차           |
| `wind_avg`           | REAL      | 평균 풍속 km/h          |
| `wind_stddev`        | REAL      | 풍속 표준편차           |
| `snowfall_avg`       | REAL      | 평균 적설량 cm          |
| `cloud_cover_avg`    | REAL      | 평균 구름 %             |

- **UNIQUE**: `(city_id, day_of_year)`
- **규모**: 도시당 365 rows

---

### [ggg 코어] `monthly_climate`

월 단위 기후 통계.

| 컬럼                | 타입      | 설명              |
| ------------------- | --------- | ----------------- |
| `id`                | BIGSERIAL (PK) | —            |
| `city_id`           | TEXT (FK) | cities 참조       |
| `month`             | SMALLINT  | 1~12              |
| `temp_avg`          | REAL      | 월 평균 기온 °C   |
| `temp_min_avg`      | REAL      | 월 평균 최저 기온 |
| `temp_max_avg`      | REAL      | 월 평균 최고 기온 |
| `rain_days`         | REAL      | 월 평균 강수일 수 |
| `rain_probability`  | REAL      | 강수 확률 0~1     |
| `wind_avg`          | REAL      | 평균 풍속 km/h    |
| `humidity_avg`      | REAL      | 평균 습도 %       |
| `snowfall_days`     | REAL      | 월 평균 눈 오는 일 수 |

- **UNIQUE**: `(city_id, month)`
- **규모**: 도시당 12 rows

---

### [FORECAST] `forecast_weather`

Open-Meteo Forecast API에서 매일 갱신되는 14일 예보 데이터.

| 컬럼              | 타입           | 설명              |
| ----------------- | -------------- | ----------------- |
| `id`              | BIGSERIAL (PK) | —                 |
| `city_id`         | TEXT (FK)      | cities 참조       |
| `timestamp`       | TIMESTAMPTZ    | UTC 기준 시각     |
| `temperature`     | REAL           | 기온 °C           |
| `apparent_temp`   | REAL           | 체감온도 °C       |
| `humidity`        | SMALLINT       | 습도 %            |
| `precipitation`   | REAL           | 강수량 mm         |
| `rain`            | REAL           | 비 mm             |
| `snowfall`        | REAL           | 눈 cm             |
| `weather_code`    | SMALLINT       | WMO 코드 (0-99)   |
| `cloud_cover`     | SMALLINT       | 구름 %            |
| `wind_speed`      | REAL           | 풍속 km/h         |
| `wind_direction`  | SMALLINT       | 풍향 °            |
| `wind_gusts`      | REAL           | 돌풍 km/h         |
| `fetched_at`      | TIMESTAMPTZ    | 데이터 수집 시각  |

- **UNIQUE**: `(city_id, timestamp)`
- **INDEX**: `(city_id, timestamp)`
- **Refresh**: 매일 새벽 Edge Function으로 upsert
- **보관**: 14일 초과 데이터는 자동 삭제 (또는 hourly_weather로 이관)

---

### [FEATURE] `best_travel_week`

Good Day 화면 - 주별 여행 적합도 스코어.

```
TravelScore = 0.4 × TempScore + 0.4 × RainScore + 0.2 × HumidityScore
```

| 컬럼           | 타입      | 설명                   |
| -------------- | --------- | ---------------------- |
| `id`           | BIGSERIAL (PK) | —                 |
| `city_id`      | TEXT (FK) | cities 참조            |
| `week_of_year` | SMALLINT  | 1~52                   |
| `travel_score` | REAL      | 0~1 (높을수록 좋음)    |
| `temp_score`   | REAL      | 기온 서브스코어        |
| `rain_score`   | REAL      | 강수 서브스코어        |
| `humidity_score` | REAL    | 습도 서브스코어        |

- **UNIQUE**: `(city_id, week_of_year)`

---

### [FEATURE] `rain_risk_calendar`

D Day / Calendar 화면 - 날짜별 강수 위험도.

```
RainProbability = rain_hours / total_hours  (80년 기준)
```

| 컬럼              | 타입      | 설명              |
| ----------------- | --------- | ----------------- |
| `id`              | BIGSERIAL (PK) | —            |
| `city_id`         | TEXT (FK) | cities 참조       |
| `day_of_year`     | SMALLINT  | **평년 기준 1~365** (2/29 행 없음) |
| `rain_probability`| REAL      | 강수 확률 0~1 (`NULL` 가능 — 앱에서는 0%로 처리) |
| `risk_level`      | TEXT      | 앱 매핑: `low`, `moderate`, `mid`, `high`, `very_high` 등 (`gradeMapper` 참고) |

- **UNIQUE**: `(city_id, day_of_year)`
- **앱 조회:** 월별로 `day_of_year` 범위(`gte`/`lte`)를 쓴다. 윤년 2/29는 DB에 없으므로 클라이언트에서 **2/28과 동일 통계를 복제**해 표시한다 (`useCalendarData`).

---

### [FEATURE] `weather_stability_index`

Good Day 화면 - 월별 날씨 안정성 지수.

```
StabilityIndex = 1 − normalize(σ_temp + σ_rain + σ_wind)
```

| 컬럼              | 타입      | 설명                    |
| ----------------- | --------- | ----------------------- |
| `id`              | BIGSERIAL (PK) | —                  |
| `city_id`         | TEXT (FK) | cities 참조             |
| `month`           | SMALLINT  | 1~12                    |
| `stability_score` | REAL      | 0~1 (높을수록 안정적)   |

- **UNIQUE**: `(city_id, month)`

---

### [FEATURE] `activity_weather_score`

Good Day 화면 - 활동 × 날짜별 날씨 적합도.

활동 목록 (MVP): `beach`, `hiking`, `city_sightseeing`
확장 예정: `skiing`, `cycling`, `surfing`

```
-- 예: beach
Score = gaussian(temp, 28°C) × exp(−rain) × exp(−wind)
```

| 컬럼          | 타입      | 설명                |
| ------------- | --------- | ------------------- |
| `id`          | BIGSERIAL (PK) | —              |
| `city_id`     | TEXT (FK) | cities 참조         |
| `activity`    | TEXT      | beach / hiking / city_sightseeing 등 |
| `day_of_year` | SMALLINT  | 1~365               |
| `score`       | REAL      | 0~1 (높을수록 적합) |

- **UNIQUE**: `(city_id, activity, day_of_year)`

---

### [FEATURE] `climate_frequency`

Today 화면 피피 멘트 보강용 — 최근 10년(2016-2025) 기준, 날짜별 날씨 상태 빈도 카운트.
`{눈빈도}`, `{비빈도}`, `{맑음빈도}` 등 "10년 중 X번" 형태의 멘트 변수에 사용.

| 컬럼             | 타입           | 설명                                          |
| ---------------- | -------------- | --------------------------------------------- |
| `id`             | BIGSERIAL (PK) | —                                             |
| `city_id`        | TEXT (FK)      | cities 참조                                   |
| `day_of_year`    | SMALLINT       | 1~366                                         |
| `total_years`    | SMALLINT       | 기준 연도 수 (기본 10 = 2016–2025)            |
| `snow_days`      | SMALLINT       | snowfall > 0인 날 수                          |
| `rain_days`      | SMALLINT       | precipitation ≥ 1.0mm인 날 수                |
| `clear_days`     | SMALLINT       | weather_code = 0 (맑음)인 날 수              |
| `cloudy_days`    | SMALLINT       | cloud_cover ≥ 80%인 날 수                    |
| `hot_days`       | SMALLINT       | temp_max 28~32°C인 날 수 (HOT 기준)         |
| `heatwave_days`  | SMALLINT       | temp_max ≥ 33°C인 날 수 (HEATWAVE 기준)     |
| `cold_days`      | SMALLINT       | temp_min ≤ 0°C인 날 수 (영하 기준)          |
| `period_start`   | DATE           | 집계 기간 시작 (2016-01-01)                  |
| `period_end`     | DATE           | 집계 기간 끝 (2025-12-31)                    |

- **UNIQUE**: `(city_id, day_of_year)`
- **규모**: 도시당 366 rows
- **데이터 소스**: `daily_weather` (2016-2025 범위 집계)
- **빌드 방법**: `data-pipeline/build_climate_frequency.py` (미구현, 추가 예정)

```
-- 빌드 쿼리 예시 (서울, 3월 18일 = day_of_year 77)
SELECT
  city_id,
  EXTRACT(DOY FROM date)::SMALLINT AS day_of_year,
  COUNT(*) FILTER (WHERE snowfall_sum > 0)      AS snow_days,
  COUNT(*) FILTER (WHERE rain_sum >= 1.0)        AS rain_days,
  COUNT(*) FILTER (WHERE cloud_cover_avg < 20)   AS clear_days,
  COUNT(*) FILTER (WHERE cloud_cover_avg >= 80)              AS cloudy_days,
  COUNT(*) FILTER (WHERE temp_max >= 28 AND temp_max < 33)   AS hot_days,
  COUNT(*) FILTER (WHERE temp_max >= 33)                     AS heatwave_days,
  COUNT(*) FILTER (WHERE temp_min <= 0)                      AS cold_days,
  COUNT(*) AS total_years
FROM daily_weather
WHERE date BETWEEN '2016-01-01' AND '2025-12-31'
GROUP BY city_id, day_of_year;
```

---

### [UI] `weather_character_map`

캐릭터 디자인 컨셉 - WMO weather_code를 캐릭터 상태에 매핑.

| 컬럼              | 타입      | 설명                                   |
| ----------------- | --------- | -------------------------------------- |
| `weather_code`    | SMALLINT (PK) | WMO 코드 (0-99)                    |
| `label_ko`        | TEXT      | 날씨 설명 (한국어)                     |
| `label_en`        | TEXT      | 날씨 설명 (영어)                       |
| `character_state` | TEXT      | 캐릭터 상태 키 (sunny / rainy / snowy 등) |
| `icon_key`        | TEXT      | 앱 내 아이콘 키                        |

---

### [UI] `home_cards`

| 컬럼           | 타입           | 설명                                      |
| -------------- | -------------- | ----------------------------------------- |
| `id`           | BIGSERIAL (PK) | —                                         |
| `title`        | TEXT           | 카드 제목                                 |
| `subtitle`     | TEXT           | 서브타이틀                                |
| `nights_label` | TEXT           | 기간 텍스트 (예: "3박 4일")               |
| `date_label`   | TEXT           | 날짜 표시 텍스트                          |
| `image_url`    | TEXT           | `cities_images` 버킷 파일명 또는 전체 URL |
| `city_id`      | TEXT (FK)      | 클릭 시 로드할 도시                       |
| `card_type`    | TEXT           | `date` / `range`                          |
| `date_from`    | TEXT           | MM-DD 형식                                |
| `date_to`      | TEXT           | MM-DD 형식 (range만)                      |
| `sort_order`   | INTEGER        | 표시 순서                                 |
| `is_active`    | BOOLEAN        | 노출 여부                                 |

- RLS: anon → SELECT (is_active=true만), authenticated → 전체 CRUD
- 생성 SQL: `supabase/home_cards.sql`

---

### [USER] `city_requests`

사용자가 DB에 없는 도시를 관리자에게 추가 요청하는 테이블.
동일 도시 중복 요청은 `request_count`로 누적하여 우선순위 판단에 활용.

| 컬럼            | 타입           | 설명                                      |
| --------------- | -------------- | ----------------------------------------- |
| `id`            | BIGSERIAL (PK) | —                                         |
| `city_name`     | TEXT           | 사용자가 입력한 도시명                    |
| `country`       | TEXT           | 국가명 (선택)                             |
| `requested_by`  | TEXT           | 사용자 ID 또는 이메일                     |
| `status`        | TEXT           | pending / approved / rejected             |
| `request_count` | INTEGER        | 동일 도시 요청 누적 수 (우선순위 판단용)  |
| `admin_note`    | TEXT           | 관리자 메모 (거절 사유 등)                |
| `created_at`    | TIMESTAMPTZ    | 최초 요청 시각                            |
| `reviewed_at`   | TIMESTAMPTZ    | 관리자 검토 시각                          |

- `status` 기본값: `pending`
- `request_count` 기본값: `1` (동일 도시 재요청 시 +1)
- RLS: anon → INSERT, authenticated → SELECT (본인 요청만), service_role → 전체 CRUD
- 생성 SQL: `supabase/city_requests.sql`
