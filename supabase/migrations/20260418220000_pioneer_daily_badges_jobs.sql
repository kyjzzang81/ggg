-- 개척자 플로우: daily_weather(로컬 미존재 시 생성), user_badges, pioneer_jobs

-- ---------------------------------------------------------------------------
-- 1) daily_weather — 문서 스키마 (이미 있으면 스킵)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_weather (
  id bigserial PRIMARY KEY,
  city_id text NOT NULL REFERENCES public.cities (id) ON DELETE CASCADE,
  date date NOT NULL,
  temp_avg real,
  temp_min real,
  temp_max real,
  apparent_temp_avg real,
  humidity_avg real,
  precipitation_sum real,
  rain_sum real,
  snowfall_sum real,
  wind_avg real,
  wind_max real,
  cloud_cover_avg real,
  rain_hours smallint,
  CONSTRAINT daily_weather_city_date_unique UNIQUE (city_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_weather_city_date
  ON public.daily_weather (city_id, date);

ALTER TABLE public.daily_weather ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.daily_weather IS '일별 집계; 개척 Edge에서 Open-Meteo Archive로 백필';

-- ---------------------------------------------------------------------------
-- 2) user_badges — 서비스 롤만 쓰기, 본인 읽기
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  badge text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  earned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_badges_pkey PRIMARY KEY (user_id, badge),
  CONSTRAINT user_badges_badge_check CHECK (badge = ANY (ARRAY['pioneer'::text]))
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges (user_id);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_badges self read" ON public.user_badges;
CREATE POLICY "user_badges self read"
  ON public.user_badges FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.user_badges IS '앱 뱃지; pioneer 등은 Edge에서만 INSERT';

-- ---------------------------------------------------------------------------
-- 3) pioneer_jobs — 개척 진행 상태(미션 피드), 공개 읽기
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pioneer_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES public.cities (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  user_display_name text NOT NULL DEFAULT '',
  region_label text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'running'
    CHECK (status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text])),
  progress smallint NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  step text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pioneer_jobs_status_created
  ON public.pioneer_jobs (status, created_at DESC);

ALTER TABLE public.pioneer_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pioneer_jobs public read" ON public.pioneer_jobs;
CREATE POLICY "pioneer_jobs public read"
  ON public.pioneer_jobs FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON TABLE public.pioneer_jobs IS '개척 백필 진행·미션 안내용; 쓰기는 service_role(Edge)';
