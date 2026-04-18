import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'
const FORECAST_DAYS = 16

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}

function small(v: unknown): number | null {
  const x = num(v)
  if (x === null) return null
  return Math.round(Math.min(32767, Math.max(-32768, x)))
}

export async function refreshForecastForCity(
  supabase: SupabaseClient,
  city: { id: string; lat: number; lon: number },
): Promise<number> {
  const params = new URLSearchParams({
    latitude: String(city.lat),
    longitude: String(city.lon),
    hourly: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'precipitation',
      'rain',
      'snowfall',
      'weather_code',
      'cloud_cover',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
    ].join(','),
    forecast_days: String(FORECAST_DAYS),
    timezone: 'UTC',
  })

  const res = await fetch(`${OPEN_METEO}?${params}`)
  if (!res.ok) {
    throw new Error(`Open-Meteo forecast ${res.status}`)
  }
  const body = (await res.json()) as {
    hourly?: Record<string, (number | string | null)[]>
  }
  const h = body.hourly
  if (!h?.time?.length) throw new Error('no hourly.time')

  const times = h.time as string[]
  const n = times.length
  const t = h.temperature_2m ?? []
  const ap = h.apparent_temperature ?? []
  const rh = h.relative_humidity_2m ?? []
  const pr = h.precipitation ?? []
  const rn = h.rain ?? []
  const sn = h.snowfall ?? []
  const wc = h.weather_code ?? []
  const cc = h.cloud_cover ?? []
  const ws = h.wind_speed_10m ?? []
  const wd = h.wind_direction_10m ?? []
  const wg = h.wind_gusts_10m ?? []

  const fromTs = times[0]
  const toTs = times[times.length - 1]

  const { error: delErr } = await supabase
    .from('forecast_weather')
    .delete()
    .eq('city_id', city.id)
    .gte('timestamp', fromTs)
    .lte('timestamp', toTs)

  if (delErr) throw new Error(delErr.message)

  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < n; i++) {
    rows.push({
      city_id: city.id,
      timestamp: times[i],
      temperature: num(t[i]),
      apparent_temp: num(ap[i]),
      humidity: small(rh[i]),
      precipitation: num(pr[i]),
      rain: num(rn[i]),
      snowfall: num(sn[i]),
      weather_code: small(wc[i]),
      cloud_cover: small(cc[i]),
      wind_speed: num(ws[i]),
      wind_direction: small(wd[i]),
      wind_gusts: num(wg[i]),
    })
  }

  const chunkSize = 200
  for (let i = 0; i < rows.length; i += chunkSize) {
    const part = rows.slice(i, i + chunkSize)
    const { error: insErr } = await supabase.from('forecast_weather').insert(part)
    if (insErr) throw new Error(insErr.message)
  }

  return rows.length
}
