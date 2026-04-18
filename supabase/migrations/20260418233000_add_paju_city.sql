-- 파주 추가: 위치 기반 최근접 매칭 정확도 보강
INSERT INTO public.cities (
  id,
  name_en,
  name_ko,
  country,
  lat,
  lon,
  alt,
  region,
  is_popular,
  station_name
)
VALUES (
  'paju',
  'Paju',
  '파주',
  'KR',
  37.7599,
  126.7802,
  50,
  'KR-GYEONGGI',
  false,
  '운정'
)
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_ko = EXCLUDED.name_ko,
  country = EXCLUDED.country,
  lat = EXCLUDED.lat,
  lon = EXCLUDED.lon,
  alt = EXCLUDED.alt,
  region = EXCLUDED.region,
  is_popular = EXCLUDED.is_popular,
  station_name = EXCLUDED.station_name;
