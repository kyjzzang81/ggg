# CLIMATE Screen Specification

> 목적: 화면 단위로 데이터 소스, 상태 처리, 접근 제어, 레이어 규칙을 고정한다.  
> 범위: 하단 탭 5개 + 사이드 패널 5개 (총 10개 화면)

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
  - `forecast_weather`
  - `climate_frequency`
  - `home_cards`
- 핵심 상호작용
  - 위치 권한 요청/거부 fallback
  - 레이어 ON/OFF에 따른 카드 추가 노출
- 오류 처리
  - 위치 권한 거부: 수동 지역 검색 입력 표시
  - 예보 조회 실패: 마지막 캐시 + 재시도

## 2-2. 스코어 (`/score`)

- 목적: 날짜/시기별 Climate Score 탐색
- 주요 데이터
  - `best_travel_week`
  - `climate_normals`
  - `monthly_climate`
  - `climate_score_monthly` (있으면 우선)
- 핵심 상호작용
  - `ScoreCalendar` 날짜 범위 선택
  - 월 전환, 평균 점수/등급 반영
- 레이어 규칙
  - 연인 ON: 골든아워 보조 지표 표시
  - 가족 ON: 안전 지수 보조 배지 표시

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
  - TourAPI 결과(캐시 미스 시)
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
- 상호작용: 모드 토글, 구독 상태, 알림 설정

## 3-5. 모드 설정 (인라인)

- 별도 라우트 없음, 패널 내 토글 블록
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
