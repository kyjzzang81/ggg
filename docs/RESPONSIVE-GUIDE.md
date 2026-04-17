# CLIMATE Responsive Guide

> 목적: Mobile / Tablet / Desktop 3개 브레이크포인트의 그리드·여백·내비게이션 규칙을 고정한다.
> 기준: `DESIGN-SYSTEM.md` · `example/shared/components.css` · `MVP-SCOPE.md`

---

## 1. 브레이크포인트

| 이름 | 범위 | 기준 기기 | 설계 원칙 |
|---|---|---|---|
| `mobile` | ≤ 767px | 스마트폰 | 싱글 컬럼, 하단 탭 노출 |
| `tablet` | 768 ~ 1023px | 태블릿/소형 랩톱 | 72px 아이콘 사이드바 + 싱글~듀얼 컬럼 |
| `desktop` | ≥ 1024px | 데스크톱 | 240px 풀 사이드바 + 멀티 컬럼 |

Tailwind 매핑:

```
mobile   : 기본 (md: 이전)
tablet   : md:  (768px+)
desktop  : lg:  (1024px+)
```

---

## 2. 컨테이너 규격

| 뷰포트 | 앱 max-width | 좌우 패딩 | 주요 gutter |
|---|---|---|---|
| Mobile | 430px (세이프존) | 16px | 16px |
| Tablet | 760px | 24px | 24px |
| Desktop | 1100px (+사이드바 240px 제외) | 32px | 24~32px |

- 앱 콘텐츠는 가운데 정렬. 데스크톱에서 사이드바는 화면 왼쪽 고정, 콘텐츠 가운데.
- 최대 폭을 넘지 않도록 `max-w-[1100px] mx-auto` 사용.

---

## 3. 내비게이션 규칙

| 뷰포트 | 하단탭 | 사이드바 | 상단 앱바 |
|---|---|---|---|
| Mobile | 노출 (5 items) | 햄버거 → 드로어 | 타이틀 + 햄버거 |
| Tablet | 숨김 | 72px 아이콘 고정 | 타이틀 + 검색 아이콘 |
| Desktop | 숨김 | 240px 풀 라벨 고정 | 타이틀 + 유틸 영역 |

### 3-1. 사이드바 구성 (상단→하단)

```
[로고]
─ Main ──────────────
 / 홈
 /score 스코어
 /place 장소 추천
 /nearby 주변
 /dday D-day
─ More ──────────────
 /hidden-season 숨은 시즌
 /compare 도시 비교
 /impact 소셜 임팩트
 /mypage 마이페이지
─ 모드 ─────────────
 [ 연인 ON/OFF ]
 [ 가족 ON/OFF ]
```

태블릿(72px)에서는 아이콘만, 활성 항목은 툴팁으로 라벨 노출.

---

## 4. 그리드 시스템

### 4-1. 기본 규칙

CSS Grid 기반, `grid-template-columns`를 뷰포트별로 변화.

| 영역 | Mobile | Tablet | Desktop |
|---|---|---|---|
| 요약 stat 그리드 | 2열 | 2~3열 | 4열 |
| 장소 카드 리스트 | 1열 (full-width) | 2열 | 3열 |
| 홈 대시보드 | 섹션별 수직 스택 | 섹션별 수직 스택 | 2-컬럼 (hero / rail) |
| D-day 타임라인 | 수직 리스트 | 수직 리스트 | 2-컬럼 (요약/상세) |

### 4-2. 공용 클래스 예시

```css
.stat-grid  { display: grid; gap: 12px; grid-template-columns: repeat(2, 1fr); }
@media (min-width: 768px) { .stat-grid { grid-template-columns: repeat(3, 1fr); gap: 16px; } }
@media (min-width: 1024px) { .stat-grid { grid-template-columns: repeat(4, 1fr); gap: 20px; } }

.place-grid { display: grid; gap: 16px; grid-template-columns: 1fr; }
@media (min-width: 768px) { .place-grid { grid-template-columns: repeat(2, 1fr); gap: 20px; } }
@media (min-width: 1024px) { .place-grid { grid-template-columns: repeat(3, 1fr); gap: 24px; } }
```

---

## 5. 타이포그래피 스케일

텍스트는 `clamp()`로 선형 확장하지 않고 **브레이크포인트별 고정 크기**로 끊어 위계를 유지한다.

| 토큰 | Mobile | Tablet | Desktop |
|---|---|---|---|
| display | 28 / 36 | 32 / 40 | 40 / 48 |
| h1 | 24 / 32 | 28 / 36 | 32 / 40 |
| h2 | 20 / 28 | 22 / 30 | 24 / 32 |
| body | 15 / 22 | 15 / 22 | 16 / 24 |
| caption | 12 / 16 | 12 / 16 | 13 / 18 |

숫자는 `font-size / line-height`. 자세한 토큰은 `DESIGN-SYSTEM.md` §2.

---

## 6. 간격(spacing) 스케일

기본 4px 단위. 섹션 블록 여백만 뷰포트별로 늘린다.

| 사용처 | Mobile | Tablet | Desktop |
|---|---|---|---|
| 섹션 상하 여백 | 24px | 32px | 40px |
| 카드 padding | 16px | 20px | 24px |
| 리스트 item 간격 | 8px | 12px | 12px |

---

## 7. 이미지·미디어

- 반응형 이미지는 `next/image` + `sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"` 기본.
- Hero/배너: Mobile 16:9, Desktop 21:9 전환 허용.
- 카드 썸네일은 모든 뷰포트에서 4:3 고정.

---

## 8. 상호작용 타겟

- 최소 터치 타겟 44×44px (Mobile/Tablet).
- Desktop은 32×32px 허용하되, 주요 CTA는 40×40px 이상 유지.
- 호버 효과는 Desktop에서만 강조(`@media (hover: hover)`).

---

## 9. 데이터 테이블/차트

| 컴포넌트 | Mobile | Tablet | Desktop |
|---|---|---|---|
| Climate Score 캘린더 | 7열 × 주별 스와이프 | 7열 × 전체 월 | 7열 × 월 2개 병렬 |
| 도시 비교 테이블 | 세로 카드 스택 | 2열 분할 | 3~4열 매트릭스 |
| 차트(월평균 등) | 높이 220 | 260 | 300 |

---

## 10. 모달·시트

| 폼팩터 | Mobile | Tablet | Desktop |
|---|---|---|---|
| 로그인 모달 | bottom-sheet 90vh | 중앙 모달 560px | 중앙 모달 480px |
| 도시 검색 | 전체 화면 드로어 | 중앙 시트 600px | 우상단 popover 480px |
| D-day 편집 | 전체 화면 | 중앙 모달 640px | 중앙 모달 720px |

- bottom-sheet는 Mobile에서만 사용.

---

## 11. Safe Area & 노치 대응

- 하단 탭: `env(safe-area-inset-bottom)` 반영.
- 상단 앱바: `env(safe-area-inset-top)` 반영 (iOS).
- 데스크톱에선 safe-area 무시 (0).

---

## 12. 반응형 훅

```ts
// src/hooks/useBreakpoint.ts
export function useBreakpoint(): 'mobile' | 'tablet' | 'desktop' {
  const [bp, setBp] = useState<'mobile'|'tablet'|'desktop'>('mobile');
  useEffect(() => {
    const mq1 = matchMedia('(min-width: 1024px)');
    const mq2 = matchMedia('(min-width: 768px)');
    const update = () => setBp(mq1.matches ? 'desktop' : mq2.matches ? 'tablet' : 'mobile');
    update();
    mq1.addEventListener('change', update);
    mq2.addEventListener('change', update);
    return () => { mq1.removeEventListener('change', update); mq2.removeEventListener('change', update); };
  }, []);
  return bp;
}
```

레이아웃 분기(하단탭 ↔ 사이드바)는 **CSS 미디어쿼리**로 우선 처리하고, 훅은 **자바스크립트 로직 분기**에만 사용.

---

## 13. QA 체크리스트

- [ ] iPhone SE(375×667) 하단탭이 가려지지 않는가
- [ ] iPad Mini(768×1024) 사이드바 아이콘이 중앙 정렬되었는가
- [ ] 1280/1440 데스크톱에서 콘텐츠 좌우 여백이 과도하지 않은가
- [ ] 2560 Wide 화면에서 컨테이너 max-width가 유지되는가
- [ ] 가로모드(Mobile landscape)에서 주요 CTA가 접히지 않는가
- [ ] 다크모드 + Desktop 사이드바 대비 WCAG AA 이상

---

## 14. `example/` 구현과의 관계

프로토타입 디렉토리 `example/shared/components.css`는 본 가이드의 **최소 구현 예시**다.
- 72px/240px 사이드바 토글은 `components.css`의 media query로 제어.
- 하단탭 숨김/노출도 동일 media query에서 처리.
- 실제 앱에서는 이 값을 `design-tokens.ts`와 Tailwind 설정으로 이관한다.

---

## 15. 연계 문서

- 컴포넌트 스펙: `COMPONENT-SPEC.md`
- 화면 구성: `SCREEN-SPEC.md`
- 디자인 토큰: `DESIGN-SYSTEM.md`
- IA: `INFORMATION-ARCHITECTURE.md`
