/** 브라우저에서 Open-Meteo 예보를 직접 가져올 때 사용 (홈 시계열 우선, 실패 시 `forecast_weather` DB 폴백). */

export type HourlyForecastPoint = {
  timestamp: string
  temperature: number | null
  weather_code: number | null
  precipitation: number | null
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}

function smallInt(v: unknown): number | null {
  const x = num(v)
  if (x === null) return null
  return Math.round(Math.min(32767, Math.max(-32768, x)))
}

/**
 * @param forecastDays Open-Meteo `forecast_days` (기본 7)
 * @param timezone IANA 타임존 (기본 Asia/Seoul — 홈 5일 스트립이 현지일 기준으로 묶이도록)
 */
export async function fetchOpenMeteoHourlyForecast(
  lat: number,
  lon: number,
  opts?: { forecastDays?: number; timezone?: string },
): Promise<HourlyForecastPoint[]> {
  const forecastDays = opts?.forecastDays ?? 7
  const timezone = opts?.timezone ?? 'Asia/Seoul'

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: ['temperature_2m', 'precipitation', 'weather_code'].join(','),
    forecast_days: String(forecastDays),
    timezone,
  })

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!res.ok) {
    throw new Error(`Open-Meteo forecast HTTP ${res.status}`)
  }

  const body = (await res.json()) as {
    hourly?: Record<string, (number | string | null)[] | undefined>
  }
  const h = body.hourly
  const times = h?.time as string[] | undefined
  if (!times?.length || !h) return []

  const t = h.temperature_2m ?? []
  const pr = h.precipitation ?? []
  const wc = h.weather_code ?? []

  const out: HourlyForecastPoint[] = []
  for (let i = 0; i < times.length; i++) {
    out.push({
      timestamp: times[i],
      temperature: num(t[i]),
      precipitation: num(pr[i]),
      weather_code: smallInt(wc[i]),
    })
  }
  return out
}
