-- nearby_places: summary(기존 분류/요약 혼합) -> category + summary(설명 전용)

ALTER TABLE public.nearby_places
  ADD COLUMN IF NOT EXISTS category text;

COMMENT ON COLUMN public.nearby_places.category IS '장소 분류 (예: 음식점, 카페, 관광명소)';
COMMENT ON COLUMN public.nearby_places.summary IS '장소 요약 설명';

-- 기존 데이터 이관:
-- 요청사항에 따라 summary의 기존 값을 category로 옮기고 summary는 비운다.
UPDATE public.nearby_places
SET
  category = COALESCE(NULLIF(category, ''), NULLIF(summary, '')),
  summary = NULL
WHERE COALESCE(NULLIF(summary, ''), '') <> '';
