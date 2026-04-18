/**
 * 로그인 사용자 기준: 좌표에 가까운 기존 도시가 없으면 격자 도시 생성 +
 * Open-Meteo Archive → daily_weather(1980~2025) + 예보 + climate_frequency RPC.
 * 개척 작업 행(pioneer_jobs) 갱신, 완료 시 user_badges.pioneer 부여.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsJson, corsOptions } from '../_shared/cors.ts'
import { refreshForecastForCity } from '../_shared/refreshForecastCity.ts'

const OPEN_ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive'
/** 이 거리(km) 안에 어떤 도시든 있으면 그 city_id만 반환(신규 격자 안 만듦) */
const ATTACH_MAX_KM = 25
/** 격자 중심 좌표(소수 4자리) — 동일 셀 재요청 시 공유 */
const ROUND = 4

const ARCHIVE_RANGES: [string, string][] = [
  ['1980-01-01', '1989-12-31'],
  ['1990-01-01', '1999-12-31'],
  ['2000-01-01', '2009-12-31'],
  ['2010-01-01', '2019-12-31'],
  ['2020-01-01', '2025-12-31'],
]

const DAILY_VARS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'temperature_2m_mean',
  'apparent_temperature_mean',
  'precipitation_sum',
  'rain_sum',
  'snowfall_sum',
  'weather_code',
  'cloud_cover_mean',
  'wind_speed_10m_max',
  'wind_speed_10m_mean',
  'precipitation_hours',
].join(',')

type CityRow = { id: string; name_ko: string; lat: number; lon: number }

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

function gridCenter(lat: number, lon: number): { qlat: number; qlon: number; cityId: string } {
  const f = 10 ** ROUND
  const qlat = Math.round(lat * f) / f
  const qlon = Math.round(lon * f) / f
  const a = Math.round(qlat * f)
  const b = Math.round(qlon * f)
  const cityId = `pioneer_${a}_${b}`
  return { qlat, qlon, cityId }
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}

function rainHoursFromPrecipHours(v: unknown): number | null {
  const x = num(v)
  if (x === null) return null
  return Math.round(Math.min(24, Math.max(0, x)))
}

function nearestOf(
  lat: number,
  lon: number,
  rows: { id: string; lat: number | null; lon: number | null }[],
): { id: string; km: number } | null {
  let best: { id: string; km: number } | null = null
  for (const c of rows) {
    if (c.lat == null || c.lon == null) continue
    const km = haversineKm(lat, lon, c.lat, c.lon)
    if (!best || km < best.km) best = { id: c.id, km }
  }
  return best
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function daysBetweenInclusive(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00Z`).getTime()
  const b = new Date(`${end}T00:00:00Z`).getTime()
  return Math.floor((b - a) / 86400000) + 1
}

async function fetchArchiveChunk(
  lat: number,
  lon: number,
  start: string,
  end: string,
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: start,
    end_date: end,
    timezone: 'UTC',
    daily: DAILY_VARS,
  })
  let res: Response | null = null
  for (let a = 1; a <= 6; a++) {
    res = await fetch(`${OPEN_ARCHIVE}?${params}`)
    if (res.status !== 429 && res.status < 500) break
    const retryAfter = Number(res.headers.get('retry-after') ?? '0')
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : a * 2000
    await sleep(waitMs)
  }
  if (!res) throw new Error('Open-Meteo archive: no response')
  if (!res.ok) throw new Error(`Open-Meteo archive ${res.status}`)
  const body = (await res.json()) as { daily?: Record<string, unknown> }
  const d = body.daily
  if (!d?.time || !Array.isArray(d.time)) throw new Error('archive: no daily.time')
  const times = d.time as string[]
  const tmax = (d.temperature_2m_max ?? []) as unknown[]
  const tmin = (d.temperature_2m_min ?? []) as unknown[]
  const tmean = (d.temperature_2m_mean ?? []) as unknown[]
  const apm = (d.apparent_temperature_mean ?? []) as unknown[]
  const pr = (d.precipitation_sum ?? []) as unknown[]
  const rn = (d.rain_sum ?? []) as unknown[]
  const sn = (d.snowfall_sum ?? []) as unknown[]
  const cc = (d.cloud_cover_mean ?? []) as unknown[]
  const wmax = (d.wind_speed_10m_max ?? []) as unknown[]
  const wmean = (d.wind_speed_10m_mean ?? []) as unknown[]
  const ph = (d.precipitation_hours ?? []) as unknown[]

  const out: Record<string, unknown>[] = []
  for (let i = 0; i < times.length; i++) {
    out.push({
      date: times[i],
      temp_avg: num(tmean[i]),
      temp_min: num(tmin[i]),
      temp_max: num(tmax[i]),
      apparent_temp_avg: num(apm[i]),
      humidity_avg: null,
      precipitation_sum: num(pr[i]),
      rain_sum: num(rn[i]),
      snowfall_sum: num(sn[i]),
      wind_avg: num(wmean[i]),
      wind_max: num(wmax[i]),
      cloud_cover_avg: num(cc[i]),
      rain_hours: rainHoursFromPrecipHours(ph[i]),
    })
  }
  return out
}

async function reverseLabel(lat: number, lon: number): Promise<string> {
  try {
    const u = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`
    const res = await fetch(u, {
      headers: { 'User-Agent': 'CLIMATE-ggg-pioneer/1.0 (edge; contact: dev)' },
    })
    if (!res.ok) return `좌표 ${lat.toFixed(2)}, ${lon.toFixed(2)}`
    const j = (await res.json()) as {
      address?: Record<string, string>
      display_name?: string
    }
    const a = j.address ?? {}
    const parts = [
      a.city,
      a.town,
      a.village,
      a.county,
      a.state,
      a.country,
    ].filter(Boolean)
    if (parts.length) return parts.slice(0, 3).join(' · ')
    return j.display_name?.slice(0, 80) ?? `좌표 ${lat.toFixed(2)}, ${lon.toFixed(2)}`
  } catch {
    return `좌표 ${lat.toFixed(2)}, ${lon.toFixed(2)}`
  }
}

async function reverseLocality(lat: number, lon: number): Promise<string | null> {
  try {
    const u = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`
    const res = await fetch(u, {
      headers: { 'User-Agent': 'CLIMATE-ggg-pioneer/1.0 (edge; contact: dev)' },
    })
    if (!res.ok) return null
    const j = (await res.json()) as { address?: Record<string, string> }
    const a = j.address ?? {}
    const locality = a.city ?? a.town ?? a.village ?? a.county ?? a.state_district
    return locality?.trim() ?? null
  } catch {
    return null
  }
}

function normalizeKo(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/시|군|구|읍|면|동/g, '')
}

function displayNameFromUser(
  user: { user_metadata?: Record<string, unknown>; email?: string | null },
  bodyName?: string,
): string {
  const b = bodyName?.trim()
  if (b) return b.slice(0, 40)
  const meta = user.user_metadata ?? {}
  const full = meta.full_name ?? meta.name ?? meta.preferred_username
  if (typeof full === 'string' && full.trim()) return full.trim().slice(0, 40)
  const em = user.email?.split('@')[0]
  return (em ?? '여행자').slice(0, 40)
}

async function patchJob(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  patch: Record<string, unknown>,
) {
  await supabase
    .from('pioneer_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', jobId)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsOptions()
  if (req.method !== 'POST') return corsJson({ error: 'POST only' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !serviceKey || !anonKey) {
    return corsJson({ error: 'Missing Supabase env' }, 500)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return corsJson({ error: 'Authorization Bearer 필요' }, 401)

  const authClient = createClient(url, anonKey)
  const { data: authData, error: authErr } = await authClient.auth.getUser(token)
  if (authErr || !authData.user) {
    return corsJson({ error: '로그인이 필요합니다.' }, 401)
  }
  const user = authData.user

  let body: { lat?: number; lon?: number; displayName?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return corsJson({ error: 'Invalid JSON' }, 400)
  }
  const lat = Number(body.lat)
  const lon = Number(body.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return corsJson({ error: 'lat, lon 필요' }, 400)
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return corsJson({ error: '좌표 범위 오류' }, 400)
  }

  const supabase = createClient(url, serviceKey)
  const disp = displayNameFromUser(user, body.displayName)

  const { data: running } = await supabase
    .from('pioneer_jobs')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'running')
    .limit(1)
    .maybeSingle()

  if (running?.id) {
    return corsJson({
      ok: true,
      mode: 'already_running',
      job_id: running.id,
      message: '이미 진행 중인 개척 작업이 있습니다.',
    })
  }

  const { data: allCities, error: cErr } = await supabase
    .from('cities')
    .select('id, name_ko, lat, lon')
    .limit(2500)

  if (cErr || !allCities?.length) {
    return corsJson({ error: cErr?.message ?? '도시 목록 없음' }, 500)
  }

  const nearest = nearestOf(lat, lon, allCities as CityRow[])
  const locality = await reverseLocality(lat, lon)
  const nearestCityRow = (allCities as CityRow[]).find((c) => c.id === nearest?.id)
  const localityNorm = locality ? normalizeKo(locality) : ''
  const nearestNorm = nearestCityRow?.name_ko ? normalizeKo(nearestCityRow.name_ko) : ''
  const nearMatchByName =
    Boolean(localityNorm) &&
    Boolean(nearestNorm) &&
    (localityNorm.includes(nearestNorm) || nearestNorm.includes(localityNorm))

  let targetCityId = ''
  let targetLat = lat
  let targetLon = lon
  let regionLabel = ''

  if (nearest && nearest.km <= ATTACH_MAX_KM && nearMatchByName && nearestCityRow) {
    const { count: nearestDaily } = await supabase
      .from('daily_weather')
      .select('*', { count: 'exact', head: true })
      .eq('city_id', nearest.id)

    if (nearestDaily !== null && nearestDaily > 200) {
      return corsJson({
        ok: true,
        mode: 'existing_catalog',
        city_id: nearest.id,
        distance_km: Math.round(nearest.km * 10) / 10,
        locality,
      })
    }

    targetCityId = nearest.id
    targetLat = nearestCityRow.lat
    targetLon = nearestCityRow.lon
    regionLabel = nearestCityRow.name_ko || (await reverseLabel(targetLat, targetLon))
  } else {
    const { qlat, qlon, cityId } = gridCenter(lat, lon)
    const { count: existingDaily } = await supabase
      .from('daily_weather')
      .select('*', { count: 'exact', head: true })
      .eq('city_id', cityId)

    if (existingDaily !== null && existingDaily > 200) {
      return corsJson({
        ok: true,
        mode: 'existing_grid',
        city_id: cityId,
        daily_rows: existingDaily,
      })
    }

    targetCityId = cityId
    targetLat = qlat
    targetLon = qlon
    regionLabel = await reverseLabel(qlat, qlon)

    const cityRow = {
      id: cityId,
      name_en: regionLabel,
      name_ko: regionLabel,
      country: 'ZZ',
      lat: qlat,
      lon: qlon,
      alt: null as number | null,
      region: 'pioneer',
      is_popular: false,
    }

    const { error: upCityErr } = await supabase.from('cities').upsert(cityRow, { onConflict: 'id' })
    if (upCityErr) return corsJson({ error: `cities 저장 실패: ${upCityErr.message}` }, 500)
  }

  const { data: jobRow, error: jobInsErr } = await supabase
    .from('pioneer_jobs')
    .insert({
      city_id: targetCityId,
      user_id: user.id,
      user_display_name: disp,
      region_label: regionLabel,
      status: 'running',
      progress: 5,
      step: '과거 일별 기온·강수 수집 중…',
    })
    .select('id')
    .single()

  if (jobInsErr || !jobRow?.id) {
    return corsJson({ error: jobInsErr?.message ?? '작업 행 생성 실패' }, 500)
  }
  const jobId = jobRow.id as string

  let didDaily = false
  try {
    let chunkIdx = 0
    for (const [start, end] of ARCHIVE_RANGES) {
      const expected = daysBetweenInclusive(start, end)
      const { count: existingRangeCount } = await supabase
        .from('daily_weather')
        .select('*', { count: 'exact', head: true })
        .eq('city_id', targetCityId)
        .gte('date', start)
        .lte('date', end)

      if (existingRangeCount !== null && existingRangeCount >= expected - 2) {
        chunkIdx++
        const progress = 10 + Math.round((chunkIdx / ARCHIVE_RANGES.length) * 55)
        await patchJob(supabase, jobId, {
          progress,
          step: `과거 데이터 재사용 (${start} ~ ${end})`,
        })
        continue
      }

      const rows = await fetchArchiveChunk(targetLat, targetLon, start, end)
      const withCity = rows.map((r) => ({ ...r, city_id: targetCityId }))
      const batch = 400
      for (let i = 0; i < withCity.length; i += batch) {
        const part = withCity.slice(i, i + batch)
        const { error: insErr } = await supabase.from('daily_weather').upsert(part, {
          onConflict: 'city_id,date',
        })
        if (insErr) throw new Error(insErr.message)
      }
      didDaily = true
      chunkIdx++
      const progress = 10 + Math.round((chunkIdx / ARCHIVE_RANGES.length) * 55)
      await patchJob(supabase, jobId, {
        progress,
        step: `과거 데이터 적재 중 (${start} ~ ${end})`,
      })
      await sleep(1200)
    }

    await patchJob(supabase, jobId, { progress: 70, step: '단기 예보 갱신 중…' })
    await refreshForecastForCity(supabase, {
      id: targetCityId,
      lat: targetLat,
      lon: targetLon,
    })

    await patchJob(supabase, jobId, { progress: 85, step: '기후 빈도 집계 중…' })
    const { error: rpcErr } = await supabase.rpc('rebuild_climate_frequency', {
      p_city_id: targetCityId,
    })
    if (rpcErr) throw new Error(rpcErr.message)

    await supabase.from('user_badges').upsert(
      {
        user_id: user.id,
        badge: 'pioneer',
        meta: { city_id: targetCityId, region_label: regionLabel },
        earned_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,badge' },
    )

    await patchJob(supabase, jobId, {
      status: 'completed',
      progress: 100,
      step: '완료',
    })

    return corsJson({
      ok: true,
      mode: 'pioneer_completed',
      city_id: targetCityId,
      region_label: regionLabel,
      job_id: jobId,
      badge: 'pioneer',
      did_backfill: didDaily,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await patchJob(supabase, jobId, {
      status: 'failed',
      error: msg,
      step: '실패',
    })
    return corsJson({ ok: false, error: msg, job_id: jobId }, 500)
  }
})
