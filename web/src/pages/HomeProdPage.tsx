import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CityPicker } from '../components/CityPicker'
import { PageStatus } from '../components/PageStatus'
import { ProdPageChrome, ProdSection } from '../components/ProdPageChrome'
import { useCities } from '../hooks/useCities'
import { fetchOpenMeteoHourlyForecast } from '../lib/openMeteoForecast'
import { supabase } from '../lib/supabaseClient'
import { useModeStore } from '../stores/modeStore'
import { PAGE_STATUS_COPY } from '../ui/pageStatus'
import './pages.css'

const PIONEER_HINT_KM = 25

type ForecastRow = {
  timestamp: string
  temperature: number | null
  weather_code: number | null
  precipitation: number | null
}

type FreqRow = {
  day_of_year: number
  clear_days: number
  rain_days: number
  snow_days: number
  total_years: number
  period_start: string
  period_end: string
}

type PlaceRow = {
  title: string
  addr: string | null
  mode_tags?: string[] | null
}

type HomeCardRow = {
  id: number
  title: string
  subtitle: string | null
  nights_label: string | null
  date_label: string | null
  image_url: string | null
  card_type: string | null
  date_from: string | null
  date_to: string | null
  sort_order: number | null
  mode_tags?: string[] | null
}

type DailySummary = {
  key: string
  label: string
  min: number | null
  max: number | null
  code: number | null
}

function dayOfYear(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const y = new Date(Date.UTC(d.getFullYear(), 0, 0))
  return Math.floor((t.getTime() - y.getTime()) / 86400000)
}

function toShortDay(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00`)
  return d.toLocaleDateString('ko-KR', { weekday: 'short' })
}

function weatherLabel(code: number | null) {
  if (code == null) return '날씨 정보 준비 중'
  if (code === 0) return '맑음'
  if ([1, 2, 3].includes(code)) return '구름 조금'
  if ([45, 48].includes(code)) return '안개'
  if ([51, 53, 55, 56, 57, 61, 63, 65].includes(code)) return '비'
  if ([71, 73, 75, 77].includes(code)) return '눈'
  if ([80, 81, 82].includes(code)) return '소나기'
  if ([95, 96, 99].includes(code)) return '뇌우'
  return '변동성 있음'
}

function weatherEmoji(code: number | null) {
  if (code == null) return '🌤️'
  if (code === 0) return '☀️'
  if ([1, 2, 3].includes(code)) return '⛅'
  if ([45, 48].includes(code)) return '🌫️'
  if ([51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️'
  if ([71, 73, 75, 77].includes(code)) return '❄️'
  if ([95, 96, 99].includes(code)) return '⛈️'
  return '🌤️'
}

function weatherThemeClass(code: number | null) {
  if (code == null) return 'home-hero--sunny'
  if (code === 0) return 'home-hero--sunny'
  if ([1, 2, 3].includes(code)) return 'home-hero--partly'
  if ([45, 48].includes(code)) return 'home-hero--foggy'
  if ([51, 53, 55].includes(code)) return 'home-hero--drizzle'
  if ([56, 57, 61, 63, 65, 80, 81, 82].includes(code)) return 'home-hero--rainy'
  if ([71, 73, 75, 77].includes(code)) return 'home-hero--snowy'
  if ([95, 96, 99].includes(code)) return 'home-hero--stormy'
  return 'home-hero--windy'
}

function summarizeDaily(rows: ForecastRow[]) {
  const map = new Map<string, ForecastRow[]>()
  for (const row of rows) {
    const key = row.timestamp.slice(0, 10)
    const arr = map.get(key) ?? []
    arr.push(row)
    map.set(key, arr)
  }

  const today = new Date().toISOString().slice(0, 10)
  const sorted = [...map.keys()].sort((a, b) => a.localeCompare(b)).slice(0, 6)
  return sorted.map((key) => {
    const items = map.get(key) ?? []
    const temps = items.map((i) => i.temperature).filter((v): v is number => v != null)
    const codes = items.map((i) => i.weather_code).filter((v): v is number => v != null)
    const code = codes.length
      ? codes.sort((a, b) => codes.filter((v) => v === b).length - codes.filter((v) => v === a).length)[0]
      : null
    return {
      key,
      label: key === today ? '오늘' : toShortDay(key),
      min: temps.length ? Math.min(...temps) : null,
      max: temps.length ? Math.max(...temps) : null,
      code,
    } as DailySummary
  })
}

function rainChance(rows: ForecastRow[]) {
  if (!rows.length) return null
  const rainy = rows.filter((r) => (r.precipitation ?? 0) > 0.2).length
  return Math.round((rainy / rows.length) * 100)
}

function avgTemperature(rows: ForecastRow[]) {
  const nums = rows.map((r) => r.temperature).filter((v): v is number => v != null)
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

function nearestCity(
  lat: number,
  lon: number,
  list: { id: string; name_ko: string; lat: number | null; lon: number | null }[],
) {
  if (!list.length) return null
  let bestId = list[0].id
  let bestName = list[0].name_ko
  let best = Infinity
  for (const c of list) {
    const la = c.lat
    const lo = c.lon
    if (la == null || lo == null || Number.isNaN(la) || Number.isNaN(lo)) continue
    const d = haversineKm(lat, lon, la, lo)
    if (d < best) {
      best = d
      bestId = c.id
      bestName = c.name_ko
    }
  }
  return { id: bestId, name: bestName, km: best }
}

async function reverseLabelKo(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`
    const res = await fetch(url, { headers: { 'Accept-Language': 'ko' } })
    if (!res.ok) return null
    const body = (await res.json()) as { address?: Record<string, string | undefined> }
    const a = body.address ?? {}
    const level1 = a.city ?? a.town ?? a.village ?? a.state_district ?? a.county
    const level2 = a.suburb ?? a.city_district ?? a.neighbourhood
    const parts = [level1, level2].filter(Boolean)
    return parts.length ? parts.join(' ') : null
  } catch {
    return null
  }
}

function isMissingColumnError(err: { message?: string } | null) {
  const m = err?.message ?? ''
  return m.includes('column') && m.includes('does not exist')
}

function matchesModeTags(tags: string[] | null | undefined, couple: boolean, family: boolean) {
  const active: string[] = []
  if (couple) active.push('couple')
  if (family) active.push('family')
  if (!active.length) return true
  if (!tags || tags.length === 0) return true
  return tags.some((t) => active.includes(t))
}

function pickModeAwareRows<T extends { mode_tags?: string[] | null }>(rows: T[], couple: boolean, family: boolean, limit: number) {
  const active = couple || family
  if (!active) return rows.slice(0, limit)

  const tagged = rows.filter((r) => (r.mode_tags?.length ?? 0) > 0 && matchesModeTags(r.mode_tags, couple, family))
  if (tagged.length) return tagged.slice(0, limit)

  const neutral = rows.filter((r) => !r.mode_tags || r.mode_tags.length === 0)
  return neutral.slice(0, limit)
}

async function fetchNearbyPlaces(cityId: string): Promise<PlaceRow[]> {
  if (!supabase) return []

  const withTags = await supabase
    .from('nearby_places')
    .select('title, addr, mode_tags')
    .eq('city_id', cityId)
    .order('cached_at', { ascending: false })
    .limit(24)

  if (!withTags.error) return (withTags.data ?? []) as PlaceRow[]

  if (isMissingColumnError(withTags.error)) {
    const basic = await supabase
      .from('nearby_places')
      .select('title, addr')
      .eq('city_id', cityId)
      .order('cached_at', { ascending: false })
      .limit(24)
    if (basic.error) {
      console.warn('[home] nearby_places load failed', basic.error)
      return []
    }
    return (basic.data ?? []) as PlaceRow[]
  }

  console.warn('[home] nearby_places load failed', withTags.error)
  return []
}

async function fetchHomeCards(cityId: string): Promise<HomeCardRow[]> {
  if (!supabase) return []
  const sb = supabase

  /** 스키마·RLS·정렬 컬럼 차이로 첫 요청이 400이어도, 단계적으로 완화해 맞춘다. */
  const attempts = [
    () =>
      sb
        .from('home_cards')
        .select(
          'id, title, subtitle, nights_label, date_label, image_url, card_type, date_from, date_to, sort_order, mode_tags',
        )
        .eq('city_id', cityId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .limit(12),
    () =>
      sb
        .from('home_cards')
        .select(
          'id, title, subtitle, nights_label, date_label, image_url, card_type, date_from, date_to, sort_order, mode_tags',
        )
        .eq('city_id', cityId)
        .eq('is_active', true)
        .order('id', { ascending: true })
        .limit(12),
    () =>
      sb
        .from('home_cards')
        .select(
          'id, title, subtitle, nights_label, date_label, image_url, card_type, date_from, date_to, sort_order, mode_tags',
        )
        .eq('city_id', cityId)
        .eq('is_active', true)
        .limit(12),
    () =>
      sb
        .from('home_cards')
        .select('id, title, subtitle, nights_label, date_label, image_url, card_type, date_from, date_to, sort_order')
        .eq('city_id', cityId)
        .eq('is_active', true)
        .limit(12),
    () =>
      sb
        .from('home_cards')
        .select(
          'id, title, subtitle, nights_label, date_label, image_url, card_type, date_from, date_to, sort_order, mode_tags',
        )
        .eq('city_id', cityId)
        .order('id', { ascending: true })
        .limit(12),
    () =>
      sb
        .from('home_cards')
        .select('id, title, subtitle, nights_label, date_label, image_url, card_type, date_from, date_to')
        .eq('city_id', cityId)
        .limit(12),
    () => sb.from('home_cards').select('id, title, subtitle, image_url, card_type').eq('city_id', cityId).limit(12),
  ] as const

  for (let i = 0; i < attempts.length; i++) {
    const { data, error } = await attempts[i]()
    if (!error) return (data ?? []) as HomeCardRow[]
    console.warn(`[home] home_cards try ${i + 1}/${attempts.length}:`, error.message)
  }

  return []
}

export function HomeProdPage() {
  const mode = useModeStore()
  const { cities, cityId, setCityId, citiesLoading, citiesError } = useCities(500, 'home:last-city-id')
  const [forecast, setForecast] = useState<ForecastRow[]>([])
  const [freq, setFreq] = useState<FreqRow | null>(null)
  const [places, setPlaces] = useState<PlaceRow[]>([])
  const [homeCards, setHomeCards] = useState<HomeCardRow[]>([])
  const [airPm25, setAirPm25] = useState<number | null>(null)
  const [uvIndex, setUvIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [geoHint, setGeoHint] = useState('위치를 확인하고 있어요.')
  const [nearestKm, setNearestKm] = useState<number | null>(null)
  const [citiesPickedByUser, setCitiesPickedByUser] = useState(false)

  const loadTokenRef = useRef(0)
  const cityIdRef = useRef(cityId)

  const doy = useMemo(() => dayOfYear(new Date()), [])

  useEffect(() => {
    cityIdRef.current = cityId
  }, [cityId])

  useEffect(() => {
    if (!cities.length || typeof navigator === 'undefined') return
    if (!navigator.geolocation) {
      setGeoHint('위치 권한이 없으면 도시를 직접 선택해 주세요.')
      return
    }

    setGeoHint('현재 위치를 기준으로 도시를 찾는 중이에요.')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (citiesPickedByUser) return
        const n = nearestCity(pos.coords.latitude, pos.coords.longitude, cities)
        if (!n) return
        setNearestKm(n.km)
        setCityId(n.id)
        const place = await reverseLabelKo(pos.coords.latitude, pos.coords.longitude)
        if (place) setGeoHint(`현재 위치(${place}) 기준: ${n.name}`)
        else setGeoHint(`현재 위치 기준: ${n.name}`)
      },
      () => setGeoHint('위치 권한이 꺼져 있어요. 도시를 직접 선택해 주세요.'),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 120_000 },
    )
  }, [cities, citiesPickedByUser, setCityId])

  const currentCity = useMemo(() => cities.find((c) => c.id === cityId) ?? null, [cities, cityId])

  useEffect(() => {
    if (!currentCity?.lat || !currentCity?.lon) {
      setAirPm25(null)
      setUvIndex(null)
      return
    }

    const loadAtmosphere = async () => {
      try {
        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${currentCity.lat}&longitude=${currentCity.lon}&hourly=pm2_5,uv_index&timezone=Asia%2FSeoul&forecast_days=1`
        const res = await fetch(url)
        if (!res.ok) {
          setAirPm25(null)
          setUvIndex(null)
          return
        }
        const body = (await res.json()) as {
          hourly?: {
            pm2_5?: number[]
            uv_index?: number[]
          }
        }
        setAirPm25(body.hourly?.pm2_5?.[0] ?? null)
        setUvIndex(body.hourly?.uv_index?.[0] ?? null)
      } catch {
        setAirPm25(null)
        setUvIndex(null)
      }
    }

    void loadAtmosphere()
  }, [currentCity?.lat, currentCity?.lon])

  const loadHome = useCallback(async () => {
    if (!supabase || !cityId) return

    const token = ++loadTokenRef.current
    const cid = cityId

    setLoading(true)
    setError(false)

    const nowIso = new Date().toISOString()

    const c0 = cities.find((x) => x.id === cid)
    const la0 = c0?.lat
    const lo0 = c0?.lon
    const hasCoords =
      la0 != null &&
      lo0 != null &&
      !Number.isNaN(Number(la0)) &&
      !Number.isNaN(Number(lo0))

    const liveForecastPromise = hasCoords
      ? fetchOpenMeteoHourlyForecast(la0, lo0, {
          forecastDays: 7,
          timezone: 'Asia/Seoul',
        }).catch((e) => {
          console.warn('[home] open-meteo forecast failed', e)
          return [] as ForecastRow[]
        })
      : Promise.resolve([] as ForecastRow[])

    try {
      const [fr, fq, liveRaw] = await Promise.all([
        supabase
          .from('forecast_weather')
          .select('timestamp, temperature, weather_code, precipitation')
          .eq('city_id', cid)
          .gte('timestamp', nowIso)
          .order('timestamp', { ascending: true })
          .limit(168),
        supabase
          .from('climate_frequency')
          .select('day_of_year, clear_days, rain_days, snow_days, total_years, period_start, period_end')
          .eq('city_id', cid)
          .eq('day_of_year', doy)
          .maybeSingle(),
        liveForecastPromise,
      ])

      if (fr.error || fq.error) {
        console.warn('[home] load error', { fr: fr.error, fq: fq.error })
        setError(true)
        setForecast([])
        setFreq(null)
        setPlaces([])
        setHomeCards([])
        return
      }

      const nowMs = Date.now()
      const filterFromNow = (rows: ForecastRow[]) => {
        const future = rows.filter((row) => {
          const t = Date.parse(row.timestamp)
          return Number.isFinite(t) && t >= nowMs - 45 * 60_000
        })
        return (future.length ? future : rows).slice(0, 168)
      }

      const liveRows = (liveRaw ?? []) as ForecastRow[]
      const forecastRows =
        liveRows.length > 0 ? filterFromNow(liveRows) : filterFromNow((fr.data ?? []) as ForecastRow[])

      if (token !== loadTokenRef.current || cid !== cityIdRef.current) return

      setForecast(forecastRows)
      setFreq((fq.data as FreqRow | null) ?? null)

      const [prRows, hrRows] = await Promise.all([fetchNearbyPlaces(cid), fetchHomeCards(cid)])
      if (token !== loadTokenRef.current || cid !== cityIdRef.current) return
      setPlaces(prRows)
      setHomeCards(hrRows)
    } catch {
      setError(true)
      setForecast([])
      setFreq(null)
      setPlaces([])
      setHomeCards([])
    } finally {
      if (token === loadTokenRef.current) setLoading(false)
    }
  }, [cities, cityId, doy])

  useEffect(() => {
    void loadHome()
  }, [loadHome])

  const first = forecast[0] ?? null
  const daily = summarizeDaily(forecast)
  const rain = rainChance(forecast.slice(0, 24))
  const avgTemp = avgTemperature(forecast.slice(0, 24))

  const heroTitle = first
    ? first.weather_code != null && [0, 1, 2].includes(first.weather_code)
      ? '오늘은 야외 활동하기 좋은 날이에요'
      : '오늘 컨디션에 맞춰 일정을 조정해 보세요'
    : '오늘 날씨 데이터를 준비하고 있어요'

  const insight = freq
    ? `최근 ${freq.total_years}년 기준 오늘은 맑음 ${freq.clear_days}일, 비 ${freq.rain_days}일, 눈 ${freq.snow_days}일이었어요.`
    : '평년 인사이트 데이터를 준비하고 있어요.'

  const filteredPlaces = useMemo(
    () => pickModeAwareRows(places, mode.couple, mode.family, 3),
    [mode.couple, mode.family, places],
  )

  const filteredHomeCards = useMemo(
    () => pickModeAwareRows(homeCards, mode.couple, mode.family, 2),
    [homeCards, mode.couple, mode.family],
  )

  const layerHint = useMemo(() => {
    if (mode.couple && first?.weather_code != null && [0, 1, 2].includes(first.weather_code)) {
      return '연인 레이어: 해 질 무렵 야외 일정이 특히 좋아 보여요.'
    }
    if (mode.family && airPm25 != null && airPm25 >= 35) {
      return '가족 레이어: 미세먼지가 다소 높아 실내 활동 비중을 늘리는 편이 좋아요.'
    }
    if (mode.family && uvIndex != null && uvIndex >= 6) {
      return '가족 레이어: 자외선이 강해 야외 활동 시간을 짧게 나누는 걸 추천해요.'
    }
    return null
  }, [airPm25, first, mode.couple, mode.family, uvIndex])

  if (!supabase) {
    return (
      <ProdPageChrome title="홈" lead="오늘의 날씨와 추천 정보를 확인합니다.">
        <PageStatus variant="error" message={PAGE_STATUS_COPY.supabaseMissing} />
      </ProdPageChrome>
    )
  }

  return (
    <ProdPageChrome title="홈" lead="현재 날씨, 5일 예보, 인사이트, 추천 장소를 한 번에 확인해요.">
      {citiesLoading ? <PageStatus variant="loading" /> : null}
      {citiesError ? <PageStatus variant="error" /> : null}

      {!citiesLoading && !citiesError ? (
        <div className="home-topbar">
          <CityPicker
            cities={cities}
            cityId={cityId}
            setCityId={setCityId}
            onUserPick={() => {
              setCitiesPickedByUser(true)
            }}
          />
          <div className="home-mode">
            <span className="home-mode__label">모드</span>
            <label className="home-mode__toggle">
              <input type="checkbox" checked={mode.couple} onChange={(e) => mode.setCouple(e.target.checked)} />
              연인
            </label>
            <label className="home-mode__toggle">
              <input type="checkbox" checked={mode.family} onChange={(e) => mode.setFamily(e.target.checked)} />
              가족
            </label>
          </div>
          <div className="home-topbar__meta">{geoHint}</div>
        </div>
      ) : null}

      {nearestKm != null && nearestKm > PIONEER_HINT_KM ? (
        <div className="prod-callout">등록 도시와 거리가 멀어요. 미션 탭에서 새 지역 데이터 확장을 요청할 수 있어요.</div>
      ) : null}

      {error ? <PageStatus variant="error" /> : null}
      {loading ? <PageStatus variant="loading" /> : null}

      {!loading && !error ? (
        <>
          <section className={`home-hero ${weatherThemeClass(first?.weather_code ?? null)}`} aria-label="현재 날씨 요약">
            <span className="home-hero__eyebrow">
              {weatherEmoji(first?.weather_code ?? null)} {weatherLabel(first?.weather_code ?? null)}
            </span>
            <h2 className="home-hero__title">{heroTitle}</h2>
            <p className="home-hero__subtitle">
              {cityId} · {first?.timestamp.slice(11, 16) ?? '업데이트 중'}
              {layerHint ? <span className="home-hero__layerHint"> · {layerHint}</span> : null}
            </p>
            <div className="home-hero__meta">
              <strong className="home-hero__temp">
                {first?.temperature != null ? `${Math.round(first.temperature)}°C` : '—'}
              </strong>
              <span className="home-score-chip">ggg score 준비 중</span>
            </div>
          </section>

          <div className="home-stat-grid">
            <article className="home-stat">
              <span className="home-stat__label">강수 확률</span>
              <strong className="home-stat__value">{rain != null ? `${rain}%` : '—'}</strong>
              <span className="home-stat__sub">앞으로 24시간 기준</span>
            </article>
            <article className="home-stat">
              <span className="home-stat__label">평균 기온</span>
              <strong className="home-stat__value">{avgTemp != null ? `${Math.round(avgTemp)}°C` : '—'}</strong>
              <span className="home-stat__sub">체감 대체 지표</span>
            </article>
            <article className="home-stat">
              <span className="home-stat__label">대기질</span>
              <strong className="home-stat__value">{airPm25 != null ? `${Math.round(airPm25)} ㎍/㎥` : '준비 중'}</strong>
              <span className="home-stat__sub">{airPm25 != null ? 'PM2.5' : '외부 연동 예정'}</span>
            </article>
            <article className="home-stat">
              <span className="home-stat__label">자외선</span>
              <strong className="home-stat__value">{uvIndex != null ? `${uvIndex.toFixed(1)}` : '준비 중'}</strong>
              <span className="home-stat__sub">{uvIndex != null ? 'UV Index' : '외부 연동 예정'}</span>
            </article>
          </div>

          <ProdSection title="5일 예보">
            {daily.length === 0 ? <PageStatus variant="empty" /> : null}
            {daily.length > 0 ? (
              <div className="home-forecast-strip" role="list">
                {daily.map((d, idx) => (
                  <button
                    key={d.key}
                    type="button"
                    className={`home-forecast-item${idx === 0 ? ' home-forecast-item--active' : ''}`}
                    role="listitem"
                  >
                    <span className="home-forecast-item__day">{d.label}</span>
                    <span className="home-forecast-item__icon">{weatherEmoji(d.code)}</span>
                    <span className="home-forecast-item__temp">{d.max != null ? `${Math.round(d.max)}°` : '—'}</span>
                    <span className="home-forecast-item__tempMin">{d.min != null ? `${Math.round(d.min)}°` : '—'}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </ProdSection>

          <div className="home-insight" role="region" aria-label="오늘의 인사이트">
            <strong className="home-insight__title">오늘의 인사이트</strong>
            <p className="home-insight__text">{insight}</p>
          </div>

          {filteredHomeCards.length > 0 ? (
            <div className="home-cards">
              {filteredHomeCards.map((card) => (
                <div key={String(card.id)} className="home-card home-card--info">
                  <strong className="home-card__title">{card.title}</strong>
                  {card.subtitle ? <p className="home-card__subtitle">{card.subtitle}</p> : null}
                  <p className="home-card__message">
                    {[card.nights_label, card.date_label].filter(Boolean).join(' · ') || '추천 일정을 확인해 보세요.'}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          <ProdSection title="지금 가기 좋은 곳">
            {filteredPlaces.length === 0 ? <PageStatus variant="empty" message="주변 추천 데이터를 준비 중입니다." /> : null}
            {filteredPlaces.length > 0 ? (
              <div className="home-place-list">
                {filteredPlaces.map((place, idx) => (
                  <article key={`${place.title}-${idx}`} className="home-place-item">
                    <div className="home-place-item__thumb">📍</div>
                    <div className="home-place-item__body">
                      <h3 className="home-place-item__title">{place.title}</h3>
                      <p className="home-place-item__desc">{place.addr ?? '주소 정보 없음'}</p>
                    </div>
                    <div className="home-place-item__score">{92 - idx * 7}</div>
                  </article>
                ))}
              </div>
            ) : null}
          </ProdSection>
        </>
      ) : null}
    </ProdPageChrome>
  )
}
