/**
 * Open-Meteo hourly forecast → forecast_weather
 * Cron 또는 수동 호출. verify_jwt = false 권장(대시보드 cron).
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsJson, corsOptions } from '../_shared/cors.ts'
import { refreshForecastForCity } from '../_shared/refreshForecastCity.ts'

const BATCH = 8

type CityRow = { id: string; lat: number; lon: number }

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsOptions()

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return corsJson({ error: 'Missing Supabase env' }, 500)
  }

  const supabase = createClient(url, key)
  const { searchParams } = new URL(req.url)
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Math.min(500, Math.max(1, parseInt(limitParam, 10))) : 200

  const { data: cities, error: cErr } = await supabase
    .from('cities')
    .select('id, lat, lon')
    .order('id')
    .limit(limit)

  if (cErr || !cities?.length) {
    return corsJson({ error: cErr?.message ?? 'no cities', processed: 0 }, 500)
  }

  const results: { city_id: string; ok: boolean; rows?: number; err?: string }[] = []

  for (let i = 0; i < cities.length; i += BATCH) {
    const chunk = cities.slice(i, i + BATCH) as CityRow[]
    const settled = await Promise.allSettled(
      chunk.map((c) => refreshForecastForCity(supabase, c)),
    )
    for (let j = 0; j < settled.length; j++) {
      const city = chunk[j]
      const r = settled[j]
      if (r.status === 'fulfilled') {
        results.push({ city_id: city.id, ok: true, rows: r.value })
      } else {
        results.push({
          city_id: city.id,
          ok: false,
          err: r.reason instanceof Error ? r.reason.message : String(r.reason),
        })
      }
    }
    await sleep(400)
  }

  const ok = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length

  return corsJson({
    processed: cities.length,
    success: ok,
    failed,
    sample: results.slice(0, 5),
  })
})
