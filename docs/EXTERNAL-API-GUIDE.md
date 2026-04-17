# CLIMATE External API Guide

> 목적: Phase 1에서 사용하는 외부 API의 발급 절차, 쿼터, fallback 정책을 정리한다.
> 기준: `ENV-SETUP.md`, `MVP-SCOPE.md`, `API-SPEC.md`

---

## 1. 사용 API 요약

| API | 목적 | Phase |
|---|---|---|
| Open-Meteo | 예보/역사 기후 | 1 |
| AirKorea | 국내 미세먼지 | 1 |
| TourAPI v2 | 국내 관광 POI | 1 |
| Kakao Local | 국내 지오코딩/역지오코딩 | 1 |
| Google Maps | 해외 지오코딩/Places | 1 |
| KMA Open API | TCI 보강 | 1.5 |
| IQAir | 해외 AQI 보강 | 1.5 |

---

## 2. 환경 변수 매핑

```bash
VITE_AIRKOREA_API_KEY=
VITE_TOURAPI_KEY=
VITE_KAKAO_REST_KEY=
VITE_GOOGLE_MAPS_API_KEY=
VITE_KMA_API_KEY=        # Phase 1.5
VITE_IQAIR_API_KEY=      # Phase 1.5
```

키 자체는 절대 저장소에 커밋하지 않는다.

---

## 3. API별 상세

### 3-1. Open-Meteo

- 인증: 키 없음
- 핵심 endpoint:
  - Forecast: `/v1/forecast`
  - Archive: `/v1/archive`
- fallback:
  - 실패 시 최근 캐시(`forecast_weather`) 반환

### 3-2. AirKorea

- 발급처: 공공데이터포털(data.go.kr)
- 승인: 보통 1~3일
- 주의:
  - 측정소 매핑(`cities.station_name`) 정확도 필요
- fallback:
  - 측정소 조회 실패 시 도시 단위 평균값 사용 + 배지 경고 표시

### 3-3. TourAPI v2

- 발급처: 공공데이터포털
- 용도: 장소 추천/주변 추천 데이터
- fallback:
  - API 실패 시 `nearby_places` 캐시 우선 노출

### 3-4. Kakao Local

- 발급처: Kakao Developers
- 용도: 국내 주소/좌표 변환
- 제한:
  - REST API 일일/분당 한도 확인 필요
- fallback:
  - 실패 시 Google Geocoding(국내도 보조) 또는 수동 도시 선택

### 3-5. Google Maps

- 발급처: Google Cloud Console
- 활성 API:
  - Geocoding API
  - Places API
- 보안:
  - HTTP referrer 제한 필수
- fallback:
  - 실패 시 도시 검색(텍스트 기반) + 내부 도시 목록

### 3-6. KMA Open API (Phase 1.5)

- 용도: TCI 보강 점수
- fallback:
  - 미사용 시 Open-Meteo + 내부 가중치로 대체

### 3-7. IQAir (Phase 1.5)

- 용도: 해외 AQI
- fallback:
  - 미사용 시 Open-Meteo 기반 간이 지표로 degrade

---

## 4. 공통 fallback 정책

1. 실시간 API 실패 시 캐시 데이터 제공  
2. 캐시도 없으면 마지막 성공 스냅샷 제공  
3. 그래도 없으면 사용자에게 재시도 CTA + 명확한 상태 라벨 표시

UI 라벨 예:
- `실시간 데이터 연결 지연`
- `최근 업데이트: 2026-04-17 09:00`

---

## 5. Rate Limit 전략

- 서버 배치(Edge Function)에서 외부 API 호출을 집약해 클라이언트 직접 호출 최소화
- 동일 요청은 10~30분 캐싱
- 요청 실패는 지수 백오프 + jitter
- 429 발생 시:
  - 즉시 재시도 금지
  - 캐시 fallback
  - 운영 로그 알림

---

## 6. 장애 대응 우선순위

1. Open-Meteo 장애
2. AirKorea 측정소 매핑 문제
3. TourAPI 응답 지연/빈값
4. 지오코딩 API(Kakao/Google) 제한 초과

---

## 7. 검증 체크리스트

- [ ] 각 키가 dev/staging/prod에 분리되어 있는가
- [ ] 잘못된 키 입력 시 에러 메시지가 사용자 친화적인가
- [ ] API 장애 시 캐시 fallback이 실제 동작하는가
- [ ] 도시 검색과 주변 추천이 API 장애에서도 최소 동작하는가

---

## 8. 사용자 의사결정 필요(협업)

- [ ] Google Maps 결제 계정 활성화 여부
- [ ] KMA/IQAir를 Phase 1에 부분 선반영할지
- [ ] API 비용 상한(월 예산) 설정

---

## 9. 연계 문서

- `ENV-SETUP.md`
- `API-SPEC.md`
- `EDGE-FUNCTIONS.md`
- `RATE-LIMIT-AND-CACHE.md` (작성 예정)
