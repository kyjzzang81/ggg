import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CityPicker } from '../components/CityPicker'
import { PageStatus } from '../components/PageStatus'
import { useCities } from '../hooks/useCities'
import { useSidebar } from '../layouts/SidebarContext'
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
  wind_speed?: number | null
  humidity?: number | null
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
  feels: number | null
  code: number | null
  rainChance: number | null
  windAvg: number | null
  humidityAvg: number | null
  precipSum: number | null
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

function weatherIcon(code: number | null): string {
  if (code == null) return '/assets/weather/Cloud.png'
  if (code === 0) return '/assets/weather/Sun.png'
  if ([1, 2].includes(code)) return '/assets/weather/Cloudy-day.png'
  if (code === 3) return '/assets/weather/Cloud.png'
  if ([45, 48].includes(code)) return '/assets/weather/Cloud.png'
  if ([51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82].includes(code)) return '/assets/weather/Raining.png'
  if ([71, 73, 75, 77].includes(code)) return '/assets/weather/Snow.png'
  if ([95, 96, 99].includes(code)) return '/assets/weather/Thunder.png'
  return '/assets/weather/Wind.png'
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

function summarizeDaily(rows: ForecastRow[]): DailySummary[] {
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
    const rainy = items.filter((r) => (r.precipitation ?? 0) > 0.2).length
    const rainChance = items.length ? Math.round((rainy / items.length) * 100) : null
    const winds = items.map((i) => i.wind_speed).filter((v): v is number => v != null)
    const windAvg = winds.length ? winds.reduce((a, b) => a + b, 0) / winds.length : null
    const hums = items.map((i) => i.humidity).filter((v): v is number => v != null)
    const humidityAvg = hums.length ? hums.reduce((a, b) => a + b, 0) / hums.length : null
    const precipSum = items.reduce((s, r) => s + (r.precipitation ?? 0), 0)
    return {
      key,
      label: key === today ? '오늘' : toShortDay(key),
      min: temps.length ? Math.min(...temps) : null,
      max: temps.length ? Math.max(...temps) : null,
      feels: temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null,
      code,
      rainChance,
      windAvg: windAvg != null ? Math.round(windAvg * 10) / 10 : null,
      humidityAvg: humidityAvg != null ? Math.round(humidityAvg) : null,
      precipSum: precipSum > 0 ? Math.round(precipSum * 10) / 10 : 0,
    }
  })
}

function gradeFromInputs(code: number | null, rain: number | null, pm25: number | null, uv: number | null) {
  let score = 72
  if (code != null) {
    if ([0, 1, 2].includes(code)) score += 12
    else if ([61, 63, 65, 80, 81, 82].includes(code)) score -= 10
    else if ([95, 96, 99].includes(code)) score -= 16
  }
  if (rain != null) score -= Math.min(15, rain / 7)
  if (pm25 != null) score -= Math.min(12, pm25 / 5)
  if (uv != null && uv >= 7) score -= Math.min(8, (uv - 6) * 1.5)
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  if (clamped >= 80) return { key: 'gorgeous', label: '강력 추천' as const }
  if (clamped >= 60) return { key: 'great', label: '추천' as const }
  if (clamped >= 40) return { key: 'good', label: '보통' as const }
  return { key: 'meh', label: '비추천' as const }
}

function clothingSuggestions(temp: number | null, code: number | null, pm25: number | null): string[] {
  if (temp == null) return []
  const items: string[] = []
  if (temp < -5) items.push('🧥 두꺼운 롱패딩', '🧣 목도리', '🧤 장갑')
  else if (temp < 0) items.push('🧥 두꺼운 롱패딩', '🧣 목도리')
  else if (temp < 5) items.push('🧥 패딩', '🧶 니트')
  else if (temp < 10) items.push('🧥 코트', '🧶 니트')
  else if (temp < 15) items.push('🧥 가벼운 재킷', '👕 긴팔')
  else if (temp < 20) items.push('👕 긴팔', '🧥 얇은 겉옷')
  else if (temp < 25) items.push('👕 반팔')
  else items.push('👕 반팔', '🕶️ 선글라스')
  if (code != null && [51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) items.push('☂️ 우산')
  if (pm25 != null && pm25 >= 35) items.push('😷 마스크')
  return items
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

function nearestCity(lat: number, lon: number, list: { id: string; name_ko: string; lat: number | null; lon: number | null }[]) {
  if (!list.length) return null
  let bestId = list[0].id, bestName = list[0].name_ko, best = Infinity
  for (const c of list) {
    const la = c.lat, lo = c.lon
    if (la == null || lo == null || Number.isNaN(la) || Number.isNaN(lo)) continue
    const d = haversineKm(lat, lon, la, lo)
    if (d < best) { best = d; bestId = c.id; bestName = c.name_ko }
  }
  return { id: bestId, name: bestName, km: best }
}

async function reverseLabelKo(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`, { headers: { 'Accept-Language': 'ko' } })
    if (!res.ok) return null
    const body = (await res.json()) as { address?: Record<string, string | undefined> }
    const a = body.address ?? {}
    const level1 = a.city ?? a.town ?? a.village ?? a.state_district ?? a.county
    const level2 = a.suburb ?? a.city_district ?? a.neighbourhood
    const parts = [level1, level2].filter(Boolean)
    return parts.length ? parts.join(' ') : null
  } catch { return null }
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
  return rows.filter((r) => !r.mode_tags || r.mode_tags.length === 0).slice(0, limit)
}

async function fetchNearbyPlaces(cityId: string): Promise<PlaceRow[]> {
  if (!supabase) return []
  const withTags = await supabase.from('nearby_places').select('title, addr, mode_tags').eq('city_id', cityId).order('cached_at', { ascending: false }).limit(24)
  if (!withTags.error) return (withTags.data ?? []) as PlaceRow[]
  if (isMissingColumnError(withTags.error)) {
    const basic = await supabase.from('nearby_places').select('title, addr').eq('city_id', cityId).order('cached_at', { ascending: false }).limit(24)
    if (basic.error) return []
    return (basic.data ?? []) as PlaceRow[]
  }
  return []
}

async function fetchHomeCards(cityId: string): Promise<HomeCardRow[]> {
  if (!supabase) return []
  const sb = supabase
  const attempts = [
    () => sb.from('home_cards').select('id, title, subtitle, nights_label, date_label, image_url, card_type, date_from, date_to, sort_order, mode_tags').eq('city_id', cityId).eq('is_active', true).order('sort_order', { ascending: true, nullsFirst: false }).limit(12),
    () => sb.from('home_cards').select('id, title, subtitle, nights_label, date_label, image_url, card_type, date_from, date_to, sort_order, mode_tags').eq('city_id', cityId).eq('is_active', true).order('id', { ascending: true }).limit(12),
    () => sb.from('home_cards').select('id, title, subtitle, nights_label, date_label, image_url, card_type, date_from, date_to, sort_order, mode_tags').eq('city_id', cityId).eq('is_active', true).limit(12),
    () => sb.from('home_cards').select('id, title, subtitle, image_url, card_type').eq('city_id', cityId).limit(12),
  ] as const
  for (let i = 0; i < attempts.length; i++) {
    const { data, error } = await attempts[i]()
    if (!error) return (data ?? []) as HomeCardRow[]
    console.warn(`[home] home_cards try ${i + 1}/${attempts.length}:`, error.message)
  }
  return []
}

/* ── ggg 로고 도트 (가로) ── */
function GggDots({ size = 16 }: { size?: number }) {
  const overlap = Math.round(size * 0.35)
  return (
    <span
      className="home-ggg-dots"
      style={{ '--dot': `${size}px`, '--ov': `-${overlap}px` } as React.CSSProperties}
    >
      <span className="home-ggg-dot home-ggg-dot--green" />
      <span className="home-ggg-dot home-ggg-dot--purple" />
      <span className="home-ggg-dot home-ggg-dot--blue" />
    </span>
  )
}

/* ── gs 추천 배지 (세로 dots + 텍스트 아래) ── */
type GsGrade = 'gorgeous' | 'great' | 'good' | 'meh'
const GS_COLORS: Record<GsGrade, string> = {
  gorgeous: '#5260FE',
  great: '#C871FD',
  good: '#13EA00',
  meh: '#888',
}
const GS_LABELS: Record<GsGrade, string> = {
  gorgeous: '강력\n추천',
  great: '추천',
  good: '보통',
  meh: '비추',
}

function GsScore({ grade }: { grade: GsGrade }) {
  const dotCount = grade === 'gorgeous' ? 3 : grade === 'great' ? 2 : grade === 'good' ? 1 : 0
  const dotColors = ['#5260FE', '#C871FD', '#13EA00'] // blue, purple, green (top to bottom)
  return (
    <div className="home-gs-score">
      <div className="home-gs-score__dots">
        {Array.from({ length: dotCount }).map((_, i) => (
          <span
            key={i}
            className="home-gs-score__dot"
            style={{ background: dotColors[i] ?? '#13EA00' }}
          />
        ))}
      </div>
      <span className="home-gs-score__label" style={{ color: GS_COLORS[grade] }}>
        {GS_LABELS[grade]}
      </span>
    </div>
  )
}

/* ── 5일 기온 그래프 (SVG) ── */
function TempGraph({ days }: { days: DailySummary[] }) {
  const vals = days.flatMap((d) => [d.max, d.min, d.feels]).filter((v): v is number => v != null)
  if (vals.length < 2) return null
  const globalMin = Math.min(...vals), globalMax = Math.max(...vals)
  const range = globalMax - globalMin || 1
  const W = 220, H = 48, PAD_X = 12, PAD_Y = 6
  const innerW = W - PAD_X * 2, innerH = H - PAD_Y * 2
  const xOf = (i: number) => PAD_X + (i / (days.length - 1 || 1)) * innerW
  const yOf = (v: number) => PAD_Y + (1 - (v - globalMin) / range) * innerH
  const path = (key: 'max' | 'min' | 'feels', color: string) => {
    const pts = days.map((d, i) => { const v = d[key]; return v != null ? [xOf(i), yOf(v)] : null })
    const valid = pts.filter((p): p is [number, number] => p != null)
    if (valid.length < 2) return null
    const d = valid.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
    return <path key={color} d={d} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  }
  return (
    <div className="home-forecast-graph">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} aria-hidden>
        {path('max', '#5260FE')}
        {path('min', '#FF8F2D')}
        {path('feels', '#C871FD')}
      </svg>
      <div className="home-forecast-graph__legend">
        <span style={{ color: '#5260FE' }}>● 최고</span>
        <span style={{ color: '#FF8F2D' }}>● 최저</span>
        <span style={{ color: '#C871FD' }}>● 체감</span>
      </div>
    </div>
  )
}

/* ── 메트릭 상세 인라인 패널 ── */
const METRIC_DETAIL: Record<string, { title: string; text: string }> = {
  feels: { title: '체감기온 안내', text: '실제 온도보다 덥거나 춥게 느껴지는 정도에요. 습도·바람 영향을 반영한 값으로, 옷차림 선택의 기준이 됩니다.' },
  rain: { title: '강수확률 안내', text: '앞으로 24시간 동안 비가 내릴 가능성이에요. 60% 이상이면 우산을 챙기거나 실내 대안을 준비해 두세요.' },
  humidity: { title: '습도 안내', text: '공기 중 수분 비율이에요. 60% 이상이면 끈적한 느낌, 40% 이하면 건조해서 피부·목에 신경 써야 해요.' },
  precip: { title: '강수량 안내', text: '하루 동안 내린 비·눈의 양(mm)이에요. 10mm 이상이면 신발이 젖을 수 있으니 방수 신발을 추천해요.' },
  wind: { title: '바람 안내', text: '풍속(km/h)이에요. 20km/h 이상이면 우산이 뒤집힐 수 있고, 30km/h 이상이면 야외 활동이 불편할 수 있어요.' },
  uv: { title: '자외선 지수 안내', text: 'UV 지수 6 이상이면 자외선 차단제와 모자가 필요해요. 가족 모드에서는 안전 알림이 강화됩니다.' },
  pm10: { title: '미세먼지 안내', text: 'PM10이 80㎍/㎥ 이상이면 장시간 야외활동을 줄이고 마스크를 착용하세요.' },
  pm25: { title: '초미세먼지 안내', text: 'PM2.5가 35㎍/㎥ 이상이면 민감군(어린이·노인·임산부)은 야외 활동을 자제해야 해요.' },
}

/* ── home-cards 기본 템플릿 ── */
type HomeCardData = { title: string; subtitle: string; cta: string; to: string; color: 'blue' | 'green' | 'purple'; emoji: string }
function defaultHomeCards(couple: boolean, family: boolean): HomeCardData[] {
  if (family) return [
    { title: 'D-day 날씨 예보', subtitle: '가족 여행·약속 날짜의 날씨를 미리 확인해 두세요', cta: 'D-day 저장하기', to: '/dday', color: 'blue', emoji: '📅' },
    { title: '안전 지수 확인', subtitle: 'PM2.5·UV 기반 오늘의 가족 외출 안전도', cta: 'ggg score 보기', to: '/score', color: 'green', emoji: '🛡️' },
    { title: '가족 코스 추천', subtitle: '아이와 무리 없는 실내·야외 1일 루트', cta: '장소 탐색하기', to: '/place', color: 'purple', emoji: '🗺️' },
  ]
  if (couple) return [
    { title: 'D-day 날씨 예보', subtitle: '기념일·여행 날짜 날씨를 미리 확인해요', cta: 'D-day 저장하기', to: '/dday', color: 'blue', emoji: '💌' },
    { title: '오늘의 감성 코스', subtitle: '골든아워·야경·카페 중심 데이트 동선', cta: '장소 보기', to: '/place', color: 'purple', emoji: '🌅' },
    { title: '주변 탐색', subtitle: '지금 날씨에 딱 맞는 주변 스팟 큐레이션', cta: '지도로 보기', to: '/nearby', color: 'green', emoji: '📍' },
  ]
  return [
    { title: 'D-day 날씨 예보', subtitle: '여행·약속 날짜의 날씨를 미리 확인해요', cta: 'D-day 저장하기', to: '/dday', color: 'blue', emoji: '📅' },
    { title: '주변 탐색', subtitle: '지금 컨디션에 맞는 주변 활동 큐레이션', cta: '지도로 보기', to: '/nearby', color: 'green', emoji: '📍' },
    { title: '숨은 황금 시즌', subtitle: '같은 도시의 다른 매력 시기를 비교해요', cta: '시즌 비교', to: '/hidden-season', color: 'purple', emoji: '✨' },
  ]
}

export function HomeProdPage() {
  const { openSidebar } = useSidebar()
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
  const [geoLabel, setGeoLabel] = useState<string | null>(null)
  const [nearestKm, setNearestKm] = useState<number | null>(null)
  const [citiesPickedByUser, setCitiesPickedByUser] = useState(false)
  const [insightExpanded, setInsightExpanded] = useState(true)
  const [heroCompact, setHeroCompact] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null)
  const [assistOpen, setAssistOpen] = useState(false)
  const [cityPickerOpen, setCityPickerOpen] = useState(false)

  const loadTokenRef = useRef(0)
  const cityIdRef = useRef(cityId)
  const doy = useMemo(() => dayOfYear(new Date()), [])

  useEffect(() => { cityIdRef.current = cityId }, [cityId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onScroll = () => {
      const compact = window.scrollY > 200
      setHeroCompact(compact)
      if (compact) setInsightExpanded(false)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!cities.length || typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (citiesPickedByUser) return
        const n = nearestCity(pos.coords.latitude, pos.coords.longitude, cities)
        if (!n) return
        setNearestKm(n.km)
        setCityId(n.id)
        const place = await reverseLabelKo(pos.coords.latitude, pos.coords.longitude)
        if (place) setGeoLabel(place)
      },
      () => {},
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 120_000 },
    )
  }, [cities, citiesPickedByUser, setCityId])

  const currentCity = useMemo(() => cities.find((c) => c.id === cityId) ?? null, [cities, cityId])

  useEffect(() => {
    if (!currentCity?.lat || !currentCity?.lon) { setAirPm25(null); setUvIndex(null); return }
    const load = async () => {
      try {
        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${currentCity.lat}&longitude=${currentCity.lon}&hourly=pm2_5,uv_index&timezone=Asia%2FSeoul&forecast_days=1`
        const res = await fetch(url)
        if (!res.ok) return
        const body = (await res.json()) as { hourly?: { pm2_5?: number[]; uv_index?: number[] } }
        setAirPm25(body.hourly?.pm2_5?.[0] ?? null)
        setUvIndex(body.hourly?.uv_index?.[0] ?? null)
      } catch { /* ignore */ }
    }
    void load()
  }, [currentCity?.lat, currentCity?.lon])

  const loadHome = useCallback(async () => {
    if (!supabase || !cityId) return
    const token = ++loadTokenRef.current
    const cid = cityId
    setLoading(true); setError(false)
    const nowIso = new Date().toISOString()
    const c0 = cities.find((x) => x.id === cid)
    const la0 = c0?.lat, lo0 = c0?.lon
    const hasCoords = la0 != null && lo0 != null && !Number.isNaN(Number(la0)) && !Number.isNaN(Number(lo0))
    const liveForecastPromise = hasCoords
      ? fetchOpenMeteoHourlyForecast(la0, lo0, { forecastDays: 7, timezone: 'Asia/Seoul' }).catch(() => [] as ForecastRow[])
      : Promise.resolve([] as ForecastRow[])
    try {
      const [fr, fq, liveRaw] = await Promise.all([
        supabase.from('forecast_weather').select('timestamp, temperature, weather_code, precipitation').eq('city_id', cid).gte('timestamp', nowIso).order('timestamp', { ascending: true }).limit(168),
        supabase.from('climate_frequency').select('day_of_year, clear_days, rain_days, snow_days, total_years, period_start, period_end').eq('city_id', cid).eq('day_of_year', doy).maybeSingle(),
        liveForecastPromise,
      ])
      if (fr.error || fq.error) { setError(true); setForecast([]); setFreq(null); setPlaces([]); setHomeCards([]); return }
      const nowMs = Date.now()
      const filterFromNow = (rows: ForecastRow[]) => {
        const future = rows.filter((row) => { const t = Date.parse(row.timestamp); return Number.isFinite(t) && t >= nowMs - 45 * 60_000 })
        return (future.length ? future : rows).slice(0, 168)
      }
      const liveRows = (liveRaw ?? []) as ForecastRow[]
      const forecastRows = liveRows.length > 0 ? filterFromNow(liveRows) : filterFromNow((fr.data ?? []) as ForecastRow[])
      if (token !== loadTokenRef.current || cid !== cityIdRef.current) return
      setForecast(forecastRows); setFreq((fq.data as FreqRow | null) ?? null)
      const [prRows, hrRows] = await Promise.all([fetchNearbyPlaces(cid), fetchHomeCards(cid)])
      if (token !== loadTokenRef.current || cid !== cityIdRef.current) return
      setPlaces(prRows); setHomeCards(hrRows)
    } catch {
      setError(true); setForecast([]); setFreq(null); setPlaces([]); setHomeCards([])
    } finally {
      if (token === loadTokenRef.current) setLoading(false)
    }
  }, [cities, cityId, doy])

  useEffect(() => { void loadHome() }, [loadHome])

  const first = forecast[0] ?? null
  const daily = useMemo(() => summarizeDaily(forecast), [forecast])
  const todayRain = rainChance(forecast.slice(0, 24))
  const avgTemp = avgTemperature(forecast.slice(0, 24))
  const today = daily[0]
  const cityName = currentCity?.name_ko ?? null

  const heroTitle = first
    ? first.weather_code != null && [0, 1, 2].includes(first.weather_code)
      ? '오늘은 야외 활동 최적의 하루!'
      : '오늘 컨디션에 맞춰 일정을 조정해 보세요'
    : '오늘 날씨 데이터를 준비하고 있어요'

  const insightText = useMemo(() => {
    if (freq) {
      const rainPart = todayRain != null && todayRain > 40 ? ' 오후 강수 가능성이 있으니 우산을 준비해 두세요.' : ''
      return `최근 ${freq.total_years}년 기준, 오늘과 같은 날은 맑음 ${freq.clear_days}일 · 비 ${freq.rain_days}일 · 눈 ${freq.snow_days}일이었어요.${rainPart}`
    }
    return '오늘의 날씨 인사이트를 분석 중이에요. 잠시만 기다려 주세요.'
  }, [freq, todayRain])

  const clothingTags = useMemo(
    () => clothingSuggestions(first?.temperature ?? null, first?.weather_code ?? null, airPm25),
    [first, airPm25],
  )

  const grade = useMemo(
    () => gradeFromInputs(first?.weather_code ?? null, todayRain, airPm25, uvIndex),
    [airPm25, first?.weather_code, todayRain, uvIndex],
  )

  const filteredPlaces = useMemo(
    () => pickModeAwareRows(places, mode.couple, mode.family, 3),
    [mode.couple, mode.family, places],
  )

  const filteredHomeCards = useMemo(
    () => pickModeAwareRows(homeCards, mode.couple, mode.family, 3),
    [homeCards, mode.couple, mode.family],
  )

  const cardRows = useMemo((): HomeCardData[] => {
    if (filteredHomeCards.length) {
      return filteredHomeCards.map((card) => ({
        title: card.title,
        subtitle: card.subtitle ?? ([card.nights_label, card.date_label].filter(Boolean).join(' · ') || '추천 일정을 확인해 보세요.'),
        cta: '자세히 보기',
        to: '/',
        color: 'blue' as const,
        emoji: '📌',
      }))
    }
    return defaultHomeCards(mode.couple, mode.family)
  }, [filteredHomeCards, mode.couple, mode.family])

  const metricCards = useMemo(() => [
    { key: 'feels',    label: '체감기온',    value: avgTemp != null ? `${Math.round(avgTemp)}` : '—', unit: '°C',    color: 'blue'   },
    { key: 'rain',     label: '강수확률',    value: todayRain != null ? `${todayRain}` : '—',          unit: '%',     color: 'yellow' },
    { key: 'humidity', label: '습도',        value: today?.humidityAvg != null ? `${today.humidityAvg}` : '—', unit: '%', color: 'yellow' },
    { key: 'precip',   label: '강수량',      value: today?.precipSum != null ? `${today.precipSum}` : '—', unit: 'mm',  color: 'yellow' },
    { key: 'wind',     label: '바람',        value: today?.windAvg != null ? `${today.windAvg}` : '—', unit: 'km/h', color: 'blue'   },
    { key: 'uv',       label: '자외선',      value: uvIndex != null ? `${uvIndex.toFixed(1)}` : '—',   unit: 'uv',   color: 'purple' },
    { key: 'pm10',     label: '미세먼지',    value: '—',                                                unit: '㎍/㎥', color: 'green'  },
    { key: 'pm25',     label: '초미세먼지',  value: airPm25 != null ? `${Math.round(airPm25)}` : '—',  unit: '㎍/㎥', color: 'green'  },
  ], [avgTemp, todayRain, today, uvIndex, airPm25])

  const weekSummary = useMemo(() => {
    if (!daily.length) return '이번 주 날씨 흐름을 분석 중이에요.'
    const rainyDays = daily.slice(0, 5).filter((d) => (d.rainChance ?? 0) >= 40).length
    const maxT = Math.max(...daily.slice(0, 5).map((d) => d.max ?? -99))
    const minT = Math.min(...daily.slice(0, 5).map((d) => d.min ?? 99))
    if (rainyDays >= 3) return `이번 주 강수 일수가 많아요. 우산을 챙기고 실내 일정 비중을 높여보세요.`
    if (maxT - minT > 15) return `일교차가 크게 벌어지는 한 주예요. 겉옷을 꼭 챙겨 두세요.`
    return `최고 ${Math.round(maxT)}° · 최저 ${Math.round(minT)}°, 무난한 한 주가 될 것 같아요.`
  }, [daily])

  if (!supabase) {
    return <div className="home-page"><PageStatus variant="error" message={PAGE_STATUS_COPY.supabaseMissing} /></div>
  }

  return (
    <div className="home-page">
      {nearestKm != null && nearestKm > PIONEER_HINT_KM
        ? <div className="prod-callout">등록 도시와 거리가 멀어요. 미션 탭에서 새 지역 데이터 확장을 요청할 수 있어요.</div>
        : null}
      {citiesLoading ? <PageStatus variant="loading" /> : null}
      {citiesError ? <PageStatus variant="error" /> : null}

      {/* ══════════════ HERO ══════════════ */}
      <div className={`home-hero${heroCompact ? ' home-hero--compact' : ''}`}>
        {/* 타이틀 행 — 항상 표시 */}
        <div className="home-hero__toprow">
          <div className="home-hero__brand">
            <GggDots size={heroCompact ? 12 : 18} />
            <span className="home-hero__msg">{heroTitle}</span>
          </div>
          <button type="button" className="home-hero__menu-btn" aria-label="메뉴 열기" onClick={openSidebar}>
            <span /><span /><span />
          </button>
        </div>

        {/* 날씨 + 온도 — compact 시 완전 숨김 */}
        {!heroCompact && (
          <div className="home-hero__weather">
            <div className="home-hero__weather-left">
              <img
                className="home-hero__weather-icon"
                src={weatherIcon(first?.weather_code ?? null)}
                alt={weatherLabel(first?.weather_code ?? null)}
              />
              <p className="home-hero__location">{geoLabel ?? cityName ?? '위치 확인 중'}</p>
            </div>
            <div className="home-hero__weather-right">
              <div className="home-hero__temp-row">
                <span className="home-hero__temp">
                  {first?.temperature != null ? Math.round(first.temperature) : '—'}
                </span>
                <span className="home-hero__temp-unit">° C</span>
              </div>
              <div className="home-hero__temp-range">
                <span>최저 {today?.min != null ? `${Math.round(today.min)}°` : '—'}</span>
                <span>최고 {today?.max != null ? `${Math.round(today.max)}°` : '—'}</span>
              </div>
            </div>
          </div>
        )}

        {/* insight 카드 */}
        <div className="home-insight">
          <div className="home-insight__head">
            <span className="home-insight__badge">insight</span>
            {/* iOS 스타일 토글 */}
            <button
              type="button"
              role="switch"
              aria-checked={insightExpanded}
              className={`home-insight__toggle${insightExpanded ? ' home-insight__toggle--on' : ''}`}
              onClick={() => setInsightExpanded((v) => !v)}
              aria-label="인사이트 펼치기/접기"
            >
              <span className="home-insight__toggle-thumb" />
            </button>
          </div>
          {insightExpanded && (
            <>
              <p className="home-insight__text">{insightText}</p>
              {clothingTags.length > 0 && (
                <div className="home-insight__tags">
                  {clothingTags.map((tag) => (
                    <span key={tag} className="home-insight__tag">{tag}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 로딩 / 에러 */}
      {error ? <PageStatus variant="error" /> : null}
      {loading ? <PageStatus variant="loading" /> : null}

      {!loading && !error && (
        <>
          {/* ══════════════ 오늘 날씨 예상 ══════════════ */}
          <section className="home-section">
            <h2 className="home-section__title">오늘 날씨 예상</h2>
            <div className="home-metric-grid">
              {metricCards.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  className={`home-metric-card home-metric-card--${card.color}${selectedMetric === card.key ? ' home-metric-card--active' : ''}`}
                  onClick={() => setSelectedMetric((prev) => prev === card.key ? null : card.key)}
                >
                  <span className="home-metric-card__label">{card.label}</span>
                  <div className="home-metric-card__val">
                    <strong>{card.value}</strong>
                    <span>{card.unit}</span>
                  </div>
                </button>
              ))}
            </div>
            {/* 인라인 지표 상세 */}
            {selectedMetric && METRIC_DETAIL[selectedMetric] && (
              <div className="home-metric-detail">
                <strong className="home-metric-detail__title">{METRIC_DETAIL[selectedMetric].title}</strong>
                <p className="home-metric-detail__text">{METRIC_DETAIL[selectedMetric].text}</p>
                <button type="button" className="home-metric-detail__close" onClick={() => setSelectedMetric(null)}>
                  닫기
                </button>
              </div>
            )}
          </section>

          {/* ══════════════ 지금 가기 좋은 곳 ══════════════ */}
          <section className="home-section">
            <h2 className="home-section__title">
              {cityName ? `${cityName}, 지금 가기 좋은 곳` : '지금 가기 좋은 곳'}
            </h2>
            {filteredPlaces.length === 0
              ? <PageStatus variant="empty" message="주변 추천 데이터를 준비 중입니다." />
              : (
                <div className="home-place-list">
                  {filteredPlaces.map((place, idx) => {
                    const placeGrade: GsGrade = idx === 0 ? 'gorgeous' : idx === 1 ? 'great' : 'good'
                    return (
                      <div key={`${place.title}-${idx}`} className={`home-place-card home-place-card--${placeGrade}`}>
                        <div className="home-place-card__body">
                          <h3 className="home-place-card__name">{place.title}</h3>
                          <p className="home-place-card__desc">{place.addr ?? ''}</p>
                          <p className="home-place-card__dist">현재 위치에서 도보 근처</p>
                        </div>
                        <GsScore grade={placeGrade} />
                      </div>
                    )
                  })}
                </div>
              )}
          </section>

          {/* ══════════════ 5일 예보 ══════════════ */}
          <section className="home-section">
            <h2 className="home-section__title">5일 예보</h2>
            {daily.length === 0
              ? <PageStatus variant="empty" />
              : (
                <>
                  <div className="home-forecast-summary">
                    <p className="home-forecast-summary__text">{weekSummary}</p>
                  </div>
                  <div className="home-forecast-table">
                    {/* 요일 */}
                    <div className="home-forecast-row home-forecast-row--head">
                      <span className="home-forecast-label" />
                      {daily.slice(0, 5).map((d) => (
                        <span key={d.key} className={`home-forecast-day${d.label === '일' ? ' --sun' : d.label === '토' ? ' --sat' : ''}`}>{d.label}</span>
                      ))}
                    </div>
                    {/* 날씨 아이콘 */}
                    <div className="home-forecast-row">
                      <span className="home-forecast-label">날씨</span>
                      {daily.slice(0, 5).map((d) => (
                        <img key={d.key} src={weatherIcon(d.code)} className="home-forecast-icon" alt="" />
                      ))}
                    </div>
                    {/* 기온 섹션 (파란 배경) */}
                    <div className="home-forecast-group home-forecast-group--blue">
                      <div className="home-forecast-row">
                        <span className="home-forecast-label home-forecast-label--max">최고기온</span>
                        {daily.slice(0, 5).map((d) => (
                          <span key={d.key} className="home-forecast-val home-forecast-val--max">{d.max != null ? Math.round(d.max) : '—'}</span>
                        ))}
                      </div>
                      <div className="home-forecast-row">
                        <span className="home-forecast-label home-forecast-label--min">최저기온</span>
                        {daily.slice(0, 5).map((d) => (
                          <span key={d.key} className="home-forecast-val home-forecast-val--min">{d.min != null ? Math.round(d.min) : '—'}</span>
                        ))}
                      </div>
                      <div className="home-forecast-row">
                        <span className="home-forecast-label home-forecast-label--feels">체감기온</span>
                        {daily.slice(0, 5).map((d) => (
                          <span key={d.key} className="home-forecast-val">{d.feels != null ? Math.round(d.feels) : '—'}</span>
                        ))}
                      </div>
                      <TempGraph days={daily.slice(0, 5)} />
                    </div>
                    {/* 자외선 */}
                    <div className="home-forecast-row home-forecast-row--purple">
                      <span className="home-forecast-label">자외선</span>
                      {daily.slice(0, 5).map((d, i) => (
                        <span key={d.key} className="home-forecast-val">{i === 0 && uvIndex != null ? uvIndex.toFixed(0) : '—'}</span>
                      ))}
                    </div>
                    {/* 바람 */}
                    <div className="home-forecast-row home-forecast-row--blue">
                      <span className="home-forecast-label">바람</span>
                      {daily.slice(0, 5).map((d) => (
                        <span key={d.key} className="home-forecast-val">{d.windAvg != null ? d.windAvg : '—'}</span>
                      ))}
                    </div>
                    {/* 강수 섹션 (노란 배경) */}
                    <div className="home-forecast-group home-forecast-group--yellow">
                      <div className="home-forecast-row">
                        <span className="home-forecast-label">강수확률</span>
                        {daily.slice(0, 5).map((d) => (
                          <span key={d.key} className={`home-forecast-val${(d.rainChance ?? 0) >= 60 ? ' home-forecast-val--alert' : (d.rainChance ?? 0) === 0 ? ' home-forecast-val--zero' : ''}`}>
                            {d.rainChance != null ? `${d.rainChance}%` : '—'}
                          </span>
                        ))}
                      </div>
                      <div className="home-forecast-row">
                        <span className="home-forecast-label">강수량</span>
                        {daily.slice(0, 5).map((d) => (
                          <span key={d.key} className={`home-forecast-val${(d.precipSum ?? 0) > 10 ? ' home-forecast-val--alert' : ''}`}>
                            {d.precipSum != null ? `${d.precipSum}` : '—'}
                          </span>
                        ))}
                      </div>
                      <div className="home-forecast-row">
                        <span className="home-forecast-label">습도</span>
                        {daily.slice(0, 5).map((d) => (
                          <span key={d.key} className="home-forecast-val">{d.humidityAvg != null ? `${d.humidityAvg}%` : '—'}</span>
                        ))}
                      </div>
                    </div>
                    {/* 미세먼지 섹션 (초록 배경) */}
                    <div className="home-forecast-group home-forecast-group--green">
                      <div className="home-forecast-row">
                        <span className="home-forecast-label">미세먼지</span>
                        {daily.slice(0, 5).map((d, i) => (
                          <span key={d.key} className="home-forecast-val">{i === 0 && airPm25 != null ? Math.round(airPm25) : '—'}</span>
                        ))}
                      </div>
                      <div className="home-forecast-row">
                        <span className="home-forecast-label">초미세먼지</span>
                        {daily.slice(0, 5).map((d, i) => (
                          <span key={d.key} className="home-forecast-val">{i === 0 && airPm25 != null ? Math.round(airPm25 * 0.6) : '—'}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
          </section>

          {/* ══════════════ home-cards ══════════════ */}
          <section className="home-section">
            <h2 className="home-section__title">오늘을 위한 플랜</h2>
            <div className="home-cards">
              {cardRows.map((card, idx) => (
                <Link key={`${card.title}-${idx}`} to={card.to} className={`home-card home-card--${card.color}`}>
                  <span className="home-card__emoji">{card.emoji}</span>
                  <div className="home-card__body">
                    <strong className="home-card__title">{card.title}</strong>
                    <p className="home-card__subtitle">{card.subtitle}</p>
                  </div>
                  <span className="home-card__cta">→</span>
                </Link>
              ))}
            </div>
          </section>

          {/* ggg grade */}
          <div className="home-grade-banner">
            <GggDots size={14} />
            <span className="home-grade-banner__text">오늘의 ggg grade</span>
            <span className={`home-grade-chip home-grade-chip--${grade.key}`}>{grade.label}</span>
          </div>
        </>
      )}

      {/* ── btn-assist (fixed) ── */}
      <button type="button" className="home-assist-btn" onClick={() => setAssistOpen(true)} aria-label="날씨 지표 안내">?</button>

      {/* ── assist 바텀시트 ── */}
      {assistOpen && (
        <div className="home-sheet" role="dialog" aria-modal>
          <button type="button" className="home-sheet__backdrop" onClick={() => setAssistOpen(false)} />
          <div className="home-sheet__panel">
            <div className="home-sheet__handle" />
            <strong className="home-sheet__title">화면 날씨 지표 안내</strong>
            <ul className="home-sheet__guide-list">
              <li><strong>체감기온</strong> 습도·바람을 반영한 실제 느낌 온도에요.</li>
              <li><strong>강수확률</strong> 비가 내릴 가능성(24h). 60% 이상이면 우산을 챙기세요.</li>
              <li><strong>습도</strong> 60% 이상이면 끈적함, 40% 이하면 건조함을 느낄 수 있어요.</li>
              <li><strong>강수량</strong> 하루 강수 총량(mm)이에요.</li>
              <li><strong>바람</strong> 20km/h 이상이면 우산이 뒤집힐 수 있어요.</li>
              <li><strong>자외선</strong> UV 6 이상이면 자외선 차단제가 필요해요.</li>
              <li><strong>초미세먼지(PM2.5)</strong> 35㎍/㎥ 이상이면 마스크를 착용하세요.</li>
              <li><strong>ggg grade</strong> 날씨 조건 종합 추천 등급이에요.</li>
            </ul>
            <button type="button" className="home-sheet__close" onClick={() => setAssistOpen(false)}>닫기</button>
          </div>
        </div>
      )}

      {/* ── 도시 선택 바텀시트 ── */}
      {cityPickerOpen && (
        <div className="home-sheet" role="dialog" aria-modal>
          <button type="button" className="home-sheet__backdrop" onClick={() => setCityPickerOpen(false)} />
          <div className="home-sheet__panel">
            <div className="home-sheet__handle" />
            <strong className="home-sheet__title">도시 선택</strong>
            <CityPicker
              cities={cities}
              cityId={cityId}
              setCityId={(id) => { setCityId(id); setCitiesPickedByUser(true); setCityPickerOpen(false) }}
              onUserPick={() => setCitiesPickedByUser(true)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
