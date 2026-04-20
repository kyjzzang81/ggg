-- nearby_places 식별자 안정화: source/source_link 추가, 기존 URL place_id 보존용 백업

ALTER TABLE public.nearby_places
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_link text;

COMMENT ON COLUMN public.nearby_places.source IS '데이터 소스 식별자 (예: naver_local)';
COMMENT ON COLUMN public.nearby_places.source_link IS '외부 원본 링크(URL)';

-- 기존에 URL/텍스트가 place_id에 저장된 행은 source_link로 백업
UPDATE public.nearby_places
SET source_link = place_id
WHERE source_link IS NULL
  AND place_id ~* '^(https?://|www\.)';

-- source 기본값 보정
UPDATE public.nearby_places
SET source = COALESCE(source, 'legacy')
WHERE source IS NULL OR btrim(source) = '';
