import { supabase } from "./supabaseClient";

export type CachedForecastRow = {
  timestamp: string;
  temperature: number | null;
  weather_code: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  humidity: number | null;
};

export type DailyValueMap = Record<string, number | null>;

export type WeatherCachePayload = {
  city_id: string;
  cache_hit: boolean;
  stale?: boolean;
  stale_reason?: string;
  cached_at: string;
  forecast_rows: CachedForecastRow[];
  pm25_by_day: DailyValueMap;
  uv_by_day: DailyValueMap;
};

export async function fetchWeatherCache(input: {
  cityId: string;
  lat: number;
  lon: number;
  forceRefresh?: boolean;
}): Promise<{ data: WeatherCachePayload | null; error: string | null }> {
  if (!supabase) return { data: null, error: "supabase unavailable" };
  const { data, error } = await supabase.functions.invoke("weather-cache", {
    body: {
      city_id: input.cityId,
      lat: input.lat,
      lon: input.lon,
      force_refresh: input.forceRefresh === true,
    },
  });
  if (error) return { data: null, error: error.message };
  return { data: (data as WeatherCachePayload | null) ?? null, error: null };
}
