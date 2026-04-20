import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsJson, corsOptions } from '../_shared/cors.ts'

type ForecastRow = {
  timestamp: string
  temperature: number | null
  weather_code: number | null
  precipitation: number | null
  wind_speed: number | null
  humidity: number | null
}

type DailyValueMap = Record<string, number | null>

type CacheRow = {
  city_id: string
  lat: number
  lon: number
  forecast_rows: ForecastRow[]
  pm25_by_day: DailyValueMap
  uv_by_day: DailyValueMap
  cached_at: string
}

const CACHE_TTL_MS = 60 * 60 * 1000

function asNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}

function asInt(v: unknown): number | null {
  const x = asNumber(v)
  return x == null ? null : Math.round(x)
}

function parseDailyValueMap(input: unknown): DailyValueMap {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out: DailyValueMap = {}
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    out[k] = asNumber(v)
  }
  return out
}

function parseForecastRows(input: unknown): ForecastRow[] {
  if (!Array.isArray(input)) return []
  const out: ForecastRow[] = []
  for (const row of input) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const ts = typeof r.timestamp === 'string' ? r.timestamp : null
    if (!ts) continue
    out.push({
      timestamp: ts,
      temperature: asNumber(r.temperature),
      weather_code: asInt(r.weather_code),
      precipitation: asNumber(r.precipitation),
      wind_speed: asNumber(r.wind_speed),
      humidity: asNumber(r.humidity),
    })
  }
  return out
}

async function fetchOpenMeteoForecast(lat: number, lon: number): Promise<ForecastRow[]> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'temperature_2m,precipitation,weather_code,wind_speed_10m,relative_humidity_2m',
    forecast_days: '7',
    timezone: 'Asia/Seoul',
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`)
  if (!res.ok) {
    throw new Error(`Open-Meteo forecast HTTP ${res.status}`)
  }
  const body = (await res.json()) as {
    hourly?: {
      time?: string[]
      temperature_2m?: Array<number | null>
      precipitation?: Array<number | null>
      weather_code?: Array<number | null>
      wind_speed_10m?: Array<number | null>
      relative_humidity_2m?: Array<number | null>
    }
  }
  const time = body.hourly?.time ?? []
  const t = body.hourly?.temperature_2m ?? []
  const p = body.hourly?.precipitation ?? []
  const c = body.hourly?.weather_code ?? []
  const w = body.hourly?.wind_speed_10m ?? []
  const h = body.hourly?.relative_humidity_2m ?? []

  const rows: ForecastRow[] = []
  for (let i = 0; i < time.length; i++) {
    rows.push({
      timestamp: time[i],
      temperature: asNumber(t[i]),
      weather_code: asInt(c[i]),
      precipitation: asNumber(p[i]),
      wind_speed: asNumber(w[i]),
      humidity: asNumber(h[i]),
    })
  }
  return rows
}

async function fetchOpenMeteoAir(lat: number, lon: number): Promise<{
  pm25ByDay: DailyValueMap
  uvByDay: DailyValueMap
}> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'pm2_5,uv_index',
    forecast_days: '5',
    timezone: 'Asia/Seoul',
  })
  const res = await fetch(
    `https://air-quality-api.open-meteo.com/v1/air-quality?${params.toString()}`,
  )
  if (!res.ok) {
    throw new Error(`Open-Meteo air-quality HTTP ${res.status}`)
  }
  const body = (await res.json()) as {
    hourly?: {
      time?: string[]
      pm2_5?: Array<number | null>
      uv_index?: Array<number | null>
    }
  }
  const times = body.hourly?.time ?? []
  const pm = body.hourly?.pm2_5 ?? []
  const uv = body.hourly?.uv_index ?? []

  const buckets = new Map<string, { pmSum: number; pmCount: number; uvMax: number | null }>()
  for (let i = 0; i < times.length; i++) {
    const key = times[i]?.slice(0, 10)
    if (!key) continue
    const entry = buckets.get(key) ?? { pmSum: 0, pmCount: 0, uvMax: null }
    const p = asNumber(pm[i])
    if (p != null) {
      entry.pmSum += p
      entry.pmCount += 1
    }
    const u = asNumber(uv[i])
    if (u != null) {
      entry.uvMax = entry.uvMax == null ? u : Math.max(entry.uvMax, u)
    }
    buckets.set(key, entry)
  }

  const pm25ByDay: DailyValueMap = {}
  const uvByDay: DailyValueMap = {}
  for (const [key, entry] of buckets.entries()) {
    pm25ByDay[key] =
      entry.pmCount > 0 ? Math.round((entry.pmSum / entry.pmCount) * 10) / 10 : null
    uvByDay[key] = entry.uvMax != null ? Math.round(entry.uvMax * 10) / 10 : null
  }
  return { pm25ByDay, uvByDay }
}

function isFresh(cachedAt: string): boolean {
  const ts = Date.parse(cachedAt)
  return Number.isFinite(ts) && Date.now() - ts < CACHE_TTL_MS
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsOptions()
  if (req.method !== 'POST') {
    return corsJson({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRole) {
    return corsJson({ error: 'Missing Supabase env' }, 500)
  }
  const supabase = createClient(supabaseUrl, serviceRole)

  let body: {
    city_id?: string
    lat?: number
    lon?: number
    force_refresh?: boolean
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return corsJson({ error: 'Invalid JSON body' }, 400)
  }

  const cityId = body.city_id?.trim()
  if (!cityId) return corsJson({ error: 'city_id is required' }, 400)

  let lat = asNumber(body.lat)
  let lon = asNumber(body.lon)
  if (lat == null || lon == null) {
    const { data: city, error: cityErr } = await supabase
      .from('cities')
      .select('lat, lon')
      .eq('id', cityId)
      .maybeSingle()
    if (cityErr) return corsJson({ error: cityErr.message }, 500)
    lat = asNumber(city?.lat)
    lon = asNumber(city?.lon)
  }
  if (lat == null || lon == null) {
    return corsJson({ error: 'City coordinates are required' }, 400)
  }

  const { data: cached, error: cacheErr } = await supabase
    .from('city_weather_cache')
    .select('city_id, lat, lon, forecast_rows, pm25_by_day, uv_by_day, cached_at')
    .eq('city_id', cityId)
    .maybeSingle()

  if (cacheErr) {
    return corsJson({ error: cacheErr.message }, 500)
  }

  const forceRefresh = body.force_refresh === true
  if (cached && !forceRefresh && isFresh(cached.cached_at)) {
    const row = cached as unknown as CacheRow
    return corsJson({
      city_id: cityId,
      cache_hit: true,
      cached_at: row.cached_at,
      forecast_rows: parseForecastRows(row.forecast_rows),
      pm25_by_day: parseDailyValueMap(row.pm25_by_day),
      uv_by_day: parseDailyValueMap(row.uv_by_day),
    })
  }

  try {
    const [forecastRows, air] = await Promise.all([
      fetchOpenMeteoForecast(lat, lon),
      fetchOpenMeteoAir(lat, lon),
    ])

    const payload = {
      city_id: cityId,
      lat,
      lon,
      forecast_rows: forecastRows,
      pm25_by_day: air.pm25ByDay,
      uv_by_day: air.uvByDay,
      cached_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { error: upsertErr } = await supabase
      .from('city_weather_cache')
      .upsert(payload, { onConflict: 'city_id' })

    if (upsertErr) {
      return corsJson({ error: upsertErr.message }, 500)
    }

    return corsJson({
      city_id: cityId,
      cache_hit: false,
      cached_at: payload.cached_at,
      forecast_rows: forecastRows,
      pm25_by_day: air.pm25ByDay,
      uv_by_day: air.uvByDay,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (cached) {
      const row = cached as unknown as CacheRow
      return corsJson({
        city_id: cityId,
        cache_hit: true,
        stale: true,
        stale_reason: message,
        cached_at: row.cached_at,
        forecast_rows: parseForecastRows(row.forecast_rows),
        pm25_by_day: parseDailyValueMap(row.pm25_by_day),
        uv_by_day: parseDailyValueMap(row.uv_by_day),
      })
    }
    return corsJson({ error: message }, 500)
  }
})
