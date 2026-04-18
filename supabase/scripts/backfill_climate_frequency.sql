-- climate_frequency 백필 예시 (Supabase SQL Editor 또는 psql)
-- 전제: public.daily_weather 에 (city_id, date)별 집계 데이터 존재
-- 기간은 프로젝트 데이터에 맞게 조정

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
  city_id,
  EXTRACT(DOY FROM date)::smallint AS day_of_year,
  COUNT(DISTINCT EXTRACT(YEAR FROM date))::smallint AS total_years,
  COUNT(*) FILTER (WHERE COALESCE(snowfall_sum, 0) > 0)::smallint AS snow_days,
  COUNT(*) FILTER (WHERE COALESCE(rain_sum, 0) >= 1.0)::smallint AS rain_days,
  COUNT(*) FILTER (WHERE COALESCE(cloud_cover_avg, 100) < 20)::smallint AS clear_days,
  COUNT(*) FILTER (WHERE COALESCE(cloud_cover_avg, 0) >= 80)::smallint AS cloudy_days,
  COUNT(*) FILTER (WHERE temp_max >= 28 AND temp_max < 33)::smallint AS hot_days,
  COUNT(*) FILTER (WHERE temp_max >= 33)::smallint AS heatwave_days,
  COUNT(*) FILTER (WHERE temp_min <= 0)::smallint AS cold_days,
  MIN(date) AS period_start,
  MAX(date) AS period_end
FROM public.daily_weather
WHERE date >= '2016-01-01' AND date <= '2025-12-31'
GROUP BY city_id, EXTRACT(DOY FROM date)
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
