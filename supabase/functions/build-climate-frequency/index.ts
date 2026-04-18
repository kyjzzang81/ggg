/**
 * climate_frequency 재빌드.
 * - ?city_id=kaohsiung — 해당 도시만 (빠름)
 * - 파라미터 없음 — cities 전부 순회(도시당 RPC 1회, 타임아웃 방지)
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsJson, corsOptions } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsOptions()

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return corsJson({ error: 'Missing Supabase env' }, 500)
  }

  const supabase = createClient(url, key)
  const { searchParams } = new URL(req.url)
  const oneCity = searchParams.get('city_id')

  if (oneCity) {
    const { data, error } = await supabase.rpc('rebuild_climate_frequency', {
      p_city_id: oneCity,
    })
    if (error) {
      return corsJson({ error: error.message }, 500)
    }
    return corsJson({ mode: 'single', city_id: oneCity, result: data })
  }

  const { data: cities, error: cErr } = await supabase
    .from('cities')
    .select('id')
    .order('id')

  if (cErr || !cities?.length) {
    return corsJson({ error: cErr?.message ?? 'no cities' }, 500)
  }

  let ok = 0
  let failed = 0
  const errors: { city_id: string; message: string }[] = []

  for (const row of cities) {
    const id = row.id as string
    const { error } = await supabase.rpc('rebuild_climate_frequency', {
      p_city_id: id,
    })
    if (error) {
      failed++
      if (errors.length < 20) errors.push({ city_id: id, message: error.message })
    } else ok++
  }

  return corsJson({
    mode: 'all',
    processed: cities.length,
    success: ok,
    failed,
    errors,
  })
})
