-- MVP: 조회 인덱스 + climate_frequency 서버측 재빌드 RPC (Edge / cron에서 호출)

-- ---------------------------------------------------------------------------
-- 1) 인덱스 (docs/DB-INDEXES.md — 실제 컬럼명에 맞춤)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_forecast_weather_city_timestamp
  ON public.forecast_weather (city_id, "timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_best_travel_week_city_week
  ON public.best_travel_week (city_id, week_of_year);

CREATE INDEX IF NOT EXISTS idx_activity_weather_score_city_activity_day
  ON public.activity_weather_score (city_id, activity, day_of_year);

CREATE INDEX IF NOT EXISTS idx_rain_risk_calendar_city_day
  ON public.rain_risk_calendar (city_id, day_of_year);

-- ---------------------------------------------------------------------------
-- 2) climate_frequency 재빌드 (daily_weather 집계)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rebuild_climate_frequency(p_city_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  INSERT INTO public.climate_frequency (
    city_id,
    day_of_year,
    total_years,
    snow_days,
    rain_days,
    clear_days,
    cloudy_days,
    hot_days,
    heatwave_days,
    cold_days,
    period_start,
    period_end
  )
  SELECT
    dw.city_id,
    EXTRACT(DOY FROM dw.date)::smallint AS day_of_year,
    COUNT(DISTINCT EXTRACT(YEAR FROM dw.date))::smallint AS total_years,
    COUNT(*) FILTER (WHERE COALESCE(dw.snowfall_sum, 0) > 0)::smallint AS snow_days,
    COUNT(*) FILTER (WHERE COALESCE(dw.rain_sum, 0) >= 1.0)::smallint AS rain_days,
    COUNT(*) FILTER (WHERE COALESCE(dw.cloud_cover_avg, 100) < 20)::smallint AS clear_days,
    COUNT(*) FILTER (WHERE COALESCE(dw.cloud_cover_avg, 0) >= 80)::smallint AS cloudy_days,
    COUNT(*) FILTER (WHERE dw.temp_max >= 28 AND dw.temp_max < 33)::smallint AS hot_days,
    COUNT(*) FILTER (WHERE dw.temp_max >= 33)::smallint AS heatwave_days,
    COUNT(*) FILTER (WHERE dw.temp_min <= 0)::smallint AS cold_days,
    MIN(dw.date) AS period_start,
    MAX(dw.date) AS period_end
  FROM public.daily_weather dw
  WHERE dw.date >= '2016-01-01'
    AND dw.date <= '2025-12-31'
    AND (p_city_id IS NULL OR dw.city_id = p_city_id)
  GROUP BY dw.city_id, EXTRACT(DOY FROM dw.date)
  ON CONFLICT (city_id, day_of_year) DO UPDATE SET
    total_years = EXCLUDED.total_years,
    snow_days = EXCLUDED.snow_days,
    rain_days = EXCLUDED.rain_days,
    clear_days = EXCLUDED.clear_days,
    cloudy_days = EXCLUDED.cloudy_days,
    hot_days = EXCLUDED.hot_days,
    heatwave_days = EXCLUDED.heatwave_days,
    cold_days = EXCLUDED.cold_days,
    period_start = EXCLUDED.period_start,
    period_end = EXCLUDED.period_end;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object(
    'upserted_groups', v_rows,
    'city_filter', to_jsonb(p_city_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_climate_frequency(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rebuild_climate_frequency(text) TO service_role;

COMMENT ON FUNCTION public.rebuild_climate_frequency(text) IS
  'daily_weather(2016–2025)로 climate_frequency 갱신. Edge build-climate-frequency에서 service_role로 호출.';
