-- Phase 1: cities.station_name, climate_frequency, nearby_places, user_dday_events + RLS
-- 기준: docs/DB-SCHEMA.md, docs/DEV-SPEC.md, docs/DB-RLS-POLICIES.md

-- ---------------------------------------------------------------------------
-- 1) cities — 에어코리아 측정소 매핑
-- ---------------------------------------------------------------------------
ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS station_name text;

COMMENT ON COLUMN public.cities.station_name IS '에어코리아 측정소명 (예: 중구)';

-- ---------------------------------------------------------------------------
-- 2) climate_frequency — 홈 인사이트용 일자별 빈도 (백필은 배치/수동 SQL)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.climate_frequency (
  id bigserial PRIMARY KEY,
  city_id text NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  day_of_year smallint NOT NULL CHECK (day_of_year >= 1 AND day_of_year <= 366),
  total_years smallint NOT NULL DEFAULT 10,
  snow_days smallint NOT NULL DEFAULT 0,
  rain_days smallint NOT NULL DEFAULT 0,
  clear_days smallint NOT NULL DEFAULT 0,
  cloudy_days smallint NOT NULL DEFAULT 0,
  hot_days smallint NOT NULL DEFAULT 0,
  heatwave_days smallint NOT NULL DEFAULT 0,
  cold_days smallint NOT NULL DEFAULT 0,
  period_start date NOT NULL,
  period_end date NOT NULL,
  CONSTRAINT climate_frequency_city_doy_unique UNIQUE (city_id, day_of_year)
);

CREATE INDEX IF NOT EXISTS idx_climate_frequency_city
  ON public.climate_frequency (city_id);

COMMENT ON TABLE public.climate_frequency IS 'daily_weather 집계 백필 대상; 빌드 쿼리는 DB-SCHEMA.md 참고';

-- ---------------------------------------------------------------------------
-- 3) nearby_places — 네이버 등 외부 POI 캐시 (API 연동 전에도 스키마 사용 가능)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nearby_places (
  id bigserial PRIMARY KEY,
  city_id text REFERENCES public.cities(id) ON DELETE CASCADE,
  place_id text NOT NULL,
  content_type_id smallint,
  title text NOT NULL,
  summary text,
  addr text,
  lat double precision,
  lon double precision,
  image_url text,
  tel text,
  weather_tags text[],
  mode_tags text[],
  cached_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nearby_places_city_place_unique UNIQUE (city_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_nearby_places_city_cached
  ON public.nearby_places (city_id, cached_at DESC);

-- ---------------------------------------------------------------------------
-- 4) user_dday_events — D-day (로그인 사용자만)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_dday_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city_id text REFERENCES public.cities(id),
  event_name text NOT NULL,
  event_date date NOT NULL,
  event_type text NOT NULL DEFAULT 'travel',
  note text,
  notify_d30 boolean NOT NULL DEFAULT true,
  notify_d7 boolean NOT NULL DEFAULT true,
  notify_d1 boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_dday_events_event_type_check CHECK (
    event_type = ANY (ARRAY['travel'::text, 'anniversary'::text, 'birthday'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_user_dday_events_user_date
  ON public.user_dday_events (user_id, event_date);

-- ---------------------------------------------------------------------------
-- 5) RLS — 신규 테이블만 (기존 cities RLS는 변경하지 않음)
-- ---------------------------------------------------------------------------
ALTER TABLE public.climate_frequency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nearby_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_dday_events ENABLE ROW LEVEL SECURITY;

-- 공개 읽기: climate_frequency, nearby_places
DROP POLICY IF EXISTS "public read climate_frequency" ON public.climate_frequency;
CREATE POLICY "public read climate_frequency"
  ON public.climate_frequency FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "public read nearby_places" ON public.nearby_places;
CREATE POLICY "public read nearby_places"
  ON public.nearby_places FOR SELECT
  TO anon, authenticated
  USING (true);

-- D-day: 본인만 CRUD (authenticated)
DROP POLICY IF EXISTS "dday owner select" ON public.user_dday_events;
DROP POLICY IF EXISTS "dday owner insert" ON public.user_dday_events;
DROP POLICY IF EXISTS "dday owner update" ON public.user_dday_events;
DROP POLICY IF EXISTS "dday owner delete" ON public.user_dday_events;

CREATE POLICY "dday owner select"
  ON public.user_dday_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "dday owner insert"
  ON public.user_dday_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "dday owner update"
  ON public.user_dday_events FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "dday owner delete"
  ON public.user_dday_events FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- service_role 배치가 climate_frequency / nearby_places 에 쓰기할 수 있도록
-- (Supabase는 service_role이 RLS 우회 — 별도 정책 불필요)
