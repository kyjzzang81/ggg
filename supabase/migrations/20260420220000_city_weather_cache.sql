create table if not exists public.city_weather_cache (
  city_id text primary key references public.cities(id) on delete cascade,
  lat double precision not null,
  lon double precision not null,
  forecast_rows jsonb not null default '[]'::jsonb,
  pm25_by_day jsonb not null default '{}'::jsonb,
  uv_by_day jsonb not null default '{}'::jsonb,
  cached_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.city_weather_cache is '도시 단위 Open-Meteo 공유 캐시 (TTL 1시간)';
comment on column public.city_weather_cache.forecast_rows is '시간별 예보 rows JSON 배열';
comment on column public.city_weather_cache.pm25_by_day is '일자별 PM2.5 평균 맵 (YYYY-MM-DD -> number|null)';
comment on column public.city_weather_cache.uv_by_day is '일자별 UV 최대 맵 (YYYY-MM-DD -> number|null)';

alter table public.city_weather_cache enable row level security;

drop policy if exists city_weather_cache_read_all on public.city_weather_cache;
create policy city_weather_cache_read_all
on public.city_weather_cache
for select
to anon, authenticated
using (true);
