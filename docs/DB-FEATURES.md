# D Day Weather - Feature Engine

## 개요

`climate_normals` 데이터를 기반으로 여행 추천에 필요한 스코어를 계산해 Feature 테이블 4개에 저장.
Good Day 화면의 모든 추천 기능이 이 테이블들을 사용함.

---

## 전체 구조

```
climate_normals
      ↓
best_travel_week        주별 여행 적합도
rain_risk_calendar      날짜별 강수 위험도
weather_stability_index 월별 날씨 안정성
activity_weather_score  활동별 날씨 적합도
```

---

## 실행 방법

### 사전 준비
Supabase SQL Editor에서 함수 4개 생성 (아래 각 항목의 SQL 참고)

### Python 스크립트 실행
```bash
cd supabase
source venv/bin/activate
python build_features.py
```

- 4개 테이블을 순서대로 자동 처리
- 완료된 도시는 자동 스킵 → 중단 후 재시작 가능
- 실패한 도시는 최대 2회 재시도 후 실패 목록 출력

---

## Feature 1. best_travel_week

### 목적
주별(week_of_year 1~52) 여행 적합도 스코어 계산. Good Day 화면 추천 기능.

### 알고리즘
```
TravelScore = 0.4 × TempScore + 0.4 × RainScore + 0.2 × HumidityScore

TempScore     = Gaussian(temp_avg, 평균=22°C, σ=8)
RainScore     = 1 - rain_probability
HumidityScore = Gaussian(humidity_avg, 평균=50%, σ=20)
```

- 기온 22°C를 여행 최적 기준으로 설정
- 강수 확률이 낮을수록 높은 점수
- 습도 50%를 최적 기준으로 설정

### Supabase 함수명
`build_best_travel_week_for_city(p_city_id TEXT)`

### 출력
| 컬럼 | 설명 |
|---|---|
| `travel_score` | 종합 여행 스코어 0~1 |
| `temp_score` | 기온 서브스코어 |
| `rain_score` | 강수 서브스코어 |
| `humidity_score` | 습도 서브스코어 |

---

## Feature 2. rain_risk_calendar

### 목적
날짜별(day_of_year 1~365) 강수 위험도 계산. D Day / Good Day 화면.

### 알고리즘
```
rain_probability = climate_normals.rain_probability (10년 평균)

risk_level:
  low  → rain_probability < 0.2
  mid  → rain_probability 0.2 ~ 0.4
  high → rain_probability > 0.4
```

### Supabase 함수명
`build_rain_risk_for_city(p_city_id TEXT)`

### 출력
| 컬럼 | 설명 |
|---|---|
| `rain_probability` | 강수 확률 0~1 |
| `risk_level` | low / mid / high |

---

## Feature 3. weather_stability_index

### 목적
월별(month 1~12) 날씨 안정성 지수 계산. Good Day 화면.
변동성이 낮을수록 (예측 가능한 날씨일수록) 높은 점수.

### 알고리즘
```
total_vol = σ_temp + σ_rain + σ_wind

StabilityScore = 1 - normalize(total_vol)
```

- σ는 climate_normals의 표준편차 컬럼 사용
- **도시 내 월별 상대 비교**로 정규화 (min-max, PARTITION BY city_id)
- 절대값이 아닌 상대값이므로 어느 도시든 가장 안정적인 달이 1.0에 가까움

### Supabase 함수명
`build_stability_for_city(p_city_id TEXT)`

### 출력
| 컬럼 | 설명 |
|---|---|
| `stability_score` | 안정성 지수 0~1 (높을수록 안정적) |

---

## Feature 4. activity_weather_score

### 목적
활동 × 날짜(day_of_year)별 날씨 적합도 계산. Good Day 화면 Activity 필터.

### MVP 활동 목록
`beach` / `hiking` / `city_sightseeing`

### 알고리즘

**Beach** (최적 기온 28°C)
```
Score = Gaussian(temp_avg, 28°C, σ=5)
      × (1 - rain_probability)
      × Gaussian(wind_avg, 0, σ=20)
```

**Hiking** (최적 기온 20°C)
```
Score = Gaussian(temp_avg, 20°C, σ=8)
      × (1 - rain_probability)
      × (cloud_cover 보정: 0.5 ~ 1.0)
```

**City Sightseeing** (최적 기온 22°C)
```
Score = Gaussian(temp_avg, 22°C, σ=8)
      × (1 - rain_probability)
      × (humidity 보정: 0.6 ~ 1.0)
```

### Supabase 함수명
`build_activity_score_for_city(p_city_id TEXT)`

### 향후 확장 예정 활동
`skiing` / `cycling` / `surfing`

### 출력
| 컬럼 | 설명 |
|---|---|
| `activity` | beach / hiking / city_sightseeing 등 |
| `score` | 적합도 0~1 (높을수록 좋음) |

---

## 스코어 해석 가이드

| 범위 | 의미 |
|---|---|
| 0.8 ~ 1.0 | 최적 |
| 0.6 ~ 0.8 | 좋음 |
| 0.4 ~ 0.6 | 보통 |
| 0.2 ~ 0.4 | 나쁨 |
| 0.0 ~ 0.2 | 매우 나쁨 |

---

## 관련 파일

| 파일 | 설명 |
|---|---|
| `supabase/build_features.py` | 일괄 처리 Python 스크립트 |
| `DB-SCHEMA.md` | Feature 테이블 스키마 상세 |
| `PIPELINE.md` | 전체 데이터 파이프라인 구조 |
