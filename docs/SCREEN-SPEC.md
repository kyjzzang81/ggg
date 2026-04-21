# ggg Screen Specification

> 목적: 화면 단위로 데이터 소스, 상태 처리, 접근 제어, 레이어 규칙을 고정한다.  
> 범위: 하단 탭 5개 + 사이드 패널 5개 (총 10개 화면)
> 마지막 업데이트: 2026-04-21

---

## 1. 공통 화면 상태

- `loading`: 스켈레톤 우선
- `empty`: 이유 + 다음 행동 CTA
- `error`: 짧은 원인 + 재시도
- `offline`: 마지막 캐시 + 오프라인 안내

공통 우선순위:
1) 치명 에러  
2) 로딩  
3) 빈 데이터  
4) 정상 데이터

---

## 2. 하단 탭 화면

## 2-1. 홈 (`/`)

- 목적: 현재 날씨 + 개인화 레이어 콘텐츠
- 주요 데이터
  - **시간별 예보(히어로·5일)**: `cities.lat/lon`이 있으면 **브라우저에서 Open-Meteo Forecast API 우선**(실패·빈 응답 시 `forecast_weather` DB)
  - **자외선/대기질(5일 표)**: Open-Meteo Air Quality API(`forecast_days=5`) 시간값을 일자 단위로 집계해 사용  
    (UV: 일최대, PM2.5: 일평균, PM10: PM2.5 환산값)
  - `climate_frequency` (홈 인사이트)
  - `home_cards`
- 핵심 상호작용
  - 위치 권한 요청/거부 fallback
  - 레이어 ON/OFF에 따른 카드 추가 노출 (토글 제어는 사이드바의 모드 설정에서 수행)
  - 5일 예보는 좌측 라벨(단위 caption 포함) + 일자 컬럼 테이블 구조
  - 기온 그래프는 **최고기온 영역 배경 오버레이(면+라인)**로 제공, 최저기온은 수치 행으로 표시
- 오류 처리
  - 위치 권한 거부: 수동 지역 검색 입력 표시
  - 예보 조회 실패: 마지막 캐시 + 재시도

## 2-2. 스코어 (`/score`)

- 목적: 도시 + 날짜(기간) 기준으로 여행 적합 시기를 탐색하고 D-day로 저장
- 주요 데이터
  - `cities` (도시 선택)
  - `climate_score_monthly` (월별 추천도 우선 소스)
  - `best_travel_week` (주차 추천)
  - `climate_normals`, `monthly_climate` (설명/근거 보조)
  - `activity_weather_score` (여행형태별 Top 5 추천 근거)
- 화면 IA (위에서 아래)
  1) 도시 선택 블록 (초기 진입 중앙 강조)
  2) 기간 선택 캘린더 블록 (월/주/일 추천도)
  3) 컨텍스트(데이터 해석) 블록
  4) 여행형태 탭 3개 + 탭별 Top 5 추천 블록
  5) 하단 고정 CTA: `D-day로 저장`
- 핵심 상호작용
  - 최초 진입 시 도시 선택 전까지 하위 블록 비활성/가이드 표시
  - 도시 선택 후 캘린더 노출
  - 캘린더에서 날짜/기간 선택 시 해석 영역과 추천 목록 재계산
  - 여행형태 탭 선택 시 Top 5 추천/추천 이유 갱신
  - 하단 CTA 클릭 시 D-day 설정 BottomSheet 열기 → 저장
- 상태 전이 (로딩/빈값/에러/모드)
  - `초기`: 도시 선택만 표시, 나머지는 플레이스홀더
  - `loading.city_selected`: 캘린더/해석/추천 영역 스켈레톤
  - `empty.calendar`: 선택 기간 데이터 없음 + 다른 날짜 유도 CTA
  - `empty.recommendation`: 추천 결과 0건 + 인접 주차/월 제안
  - `error.fetch`: 섹션 단위 재시도 버튼 + 전역 오류 배너
  - `mode.changed`: 연인/가족 모드 변경 시 해석 문구/추천 가중치 즉시 갱신
- 레이어 규칙
  - 연인 ON: 컨텍스트에 감성/골든아워 관점 문구 우선, 탭 추천 가중치 반영
  - 가족 ON: 안전(자외선/대기질/강수) 우선 문구, 탭 추천 후보 필터 강화
  - 연인+가족 동시 ON: 안전 하한 필터 후 연인 가중치 재정렬

## 2-3. 장소 추천 (`/place`)

- 목적: 목적 + 시기 기반 추천 결과 제시
- 주요 데이터
  - `activity_weather_score`
  - `best_travel_week`
  - `rain_risk_calendar`
  - `cities`
- 핵심 상호작용
  - 시기 캘린더에서 추천도 확인 후 범위 선택
  - 정렬(점수순/거리순/리스크순)
- 레이어 규칙
  - 연인 ON: 로맨틱/골든아워 가중
  - 가족 ON: 안전 필터 강화

## 2-4. 주변 (`/nearby`)

- 목적: 위치 기반 주변 추천
- 주요 데이터
  - `cities` + 위치 좌표
  - `nearby_places` (캐시)
  - **네이버** Local Search / Places 계열 API 결과(캐시 미스 시; TourAPI 대신)
- 핵심 상호작용
  - 카테고리/거리 필터
  - 리스트 우선 (지도는 후순위)
- 오류 처리
  - 위치 미허용: 탭 안내 + 권한 재요청

## 2-5. D-day (`/dday`)

- 목적: 일정 저장 + 날씨 기반 리마인드
- 접근 제어: 로그인 필요
- 주요 데이터
  - `user_dday_events`
  - `rain_risk_calendar`
  - `forecast_weather`
  - `user_weather_archive`
- 핵심 상호작용
  - 이벤트 CRUD
  - D-30/7/1 알림 설정

---

## 3. 사이드 패널 화면

## 3-1. 숨은 황금 시즌 (`/hidden-season`)

- 데이터: `hidden_season_highlights`, `best_travel_week`
- 상태: CMS 데이터 없으면 기본 추천 카드로 fallback

## 3-2. 도시 비교 (`/compare`)

- 데이터: `best_travel_week`, `monthly_climate`
- 제약: 최대 4도시
- 상호작용: 도시 추가/제거, 시기 공통 적용

## 3-3. 소셜 임팩트 (`/impact`)

- 데이터: 초기 정적/샘플 허용, 이후 실시간 집계 뷰 연동

## 3-4. 마이페이지 (`/mypage`)

- 접근 제어: 로그인 필요
- 데이터: `user_dday_events`, `user_weather_archive`, `user_bookmarks`
- 상호작용: 구독 상태, 알림 설정

## 3-5. 모드 설정 (사이드바)

- 별도 라우트 없음, 햄버거 사이드바 패널 내 토글 블록
- 상태 저장: `modeStore` (+ 사용자 설정 동기화 선택)

---

## 4. 라우팅 맵

- `/` 홈
- `/score` 스코어
- `/place` 장소 추천
- `/nearby` 주변
- `/dday` D-day
- `/hidden-season` 숨은 황금 시즌
- `/compare` 도시 비교
- `/impact` 소셜 임팩트
- `/mypage` 마이페이지

---

## 5. 인증 정책 요약

- 비로그인 가능: 홈, 스코어, 장소추천, 주변, 숨은황금시즌, 도시비교, 소셜임팩트
- 로그인 필요: D-day, 마이페이지, 저장/북마크/알림 관련 쓰기 동작

---

## 6. 화면별 QA 최소 체크

- [ ] `loading/empty/error` 모두 확인
- [ ] 모바일 탭/패널 전환 확인
- [ ] 레이어 ON/OFF별 콘텐츠 차이 확인
- [ ] 점수 캘린더 범위 선택 정상 동작
- [ ] 권한 거부 fallback 확인
