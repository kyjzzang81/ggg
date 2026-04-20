import { useEffect, useMemo, useRef, useState } from 'react'
import { CityPicker } from '../components/CityPicker'
import { NaverNearbyMap } from '../components/NaverNearbyMap'
import { PageStatus } from '../components/PageStatus'
import { ProdField, ProdPageChrome, ProdSection } from '../components/ProdPageChrome'
import { useAuth } from '../hooks/useAuth'
import { useCities } from '../hooks/useCities'
import { syncNearbyPlaces } from '../lib/nearbySync'
import { supabase } from '../lib/supabaseClient'
import { PAGE_STATUS_COPY } from '../ui/pageStatus'
import './pages.css'

type Monthly = {
  month: number
  temp_avg: number | null
  rain_probability: number | null
  humidity_avg: number | null
}
type WeekScore = {
  week_of_year: number
  travel_score: number | null
  temp_score: number | null
  rain_score: number | null
}

function isMissingColumnError(err: { message?: string } | null | undefined) {
  const m = err?.message ?? ''
  return m.toLowerCase().includes('column') && m.includes('does not exist')
}

export function ScoreProdPage() {
  const { cities, cityId, setCityId, citiesLoading, citiesError } = useCities()
  const [monthly, setMonthly] = useState<Monthly[]>([])
  const [weeks, setWeeks] = useState<WeekScore[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !cityId) {
      setMonthly([])
      setWeeks([])
      setErr(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setErr(null)

    void (async () => {
      try {
        const [m, w] = await Promise.all([
          supabase
            .from('monthly_climate')
            .select('month, temp_avg, rain_probability, humidity_avg')
            .eq('city_id', cityId)
            .order('month'),
          supabase
            .from('best_travel_week')
            .select('week_of_year, travel_score, temp_score, rain_score')
            .eq('city_id', cityId)
            .order('travel_score', { ascending: false })
            .limit(8),
        ])

        const mErr = m.error?.message ?? null
        const wErr = w.error?.message ?? null
        if (mErr || wErr) setErr(PAGE_STATUS_COPY.error)
        setMonthly((m.data ?? []) as Monthly[])
        setWeeks((w.data ?? []) as WeekScore[])
      } catch {
        setErr(PAGE_STATUS_COPY.error)
      } finally {
        setLoading(false)
      }
    })()
  }, [cityId])

  if (!supabase) {
    return (
      <ProdPageChrome title="ggg score" lead="여행 적합도(ggg score)와 월별 기후를 한눈에 봅니다.">
        <PageStatus variant="error" message={PAGE_STATUS_COPY.supabaseMissing} />
      </ProdPageChrome>
    )
  }

  return (
    <ProdPageChrome title="ggg score" lead="여행 적합도(ggg score)와 월별 기후를 한눈에 봅니다.">
      {citiesLoading ? <PageStatus variant="loading" /> : null}
      {citiesError ? <PageStatus variant="error" /> : null}

      {!citiesLoading && !citiesError ? <CityPicker cities={cities} cityId={cityId} setCityId={setCityId} /> : null}

      {err ? <PageStatus variant="error" /> : null}
      {loading ? <PageStatus variant="loading" /> : null}

      <ProdSection title="상위 추천 주차">
        {!loading && !err && weeks.length === 0 ? <PageStatus variant="empty" /> : null}
        {!loading && !err && weeks.length ? (
          <ul className="page-list">
            {weeks.map((w) => (
              <li key={w.week_of_year}>
                <strong>{w.week_of_year}주차</strong>
                <span className="page-muted">
                  총점 {w.travel_score?.toFixed(2) ?? '—'} · 온도 {w.temp_score?.toFixed(2) ?? '—'} · 강수{' '}
                  {w.rain_score?.toFixed(2) ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </ProdSection>

      <ProdSection title="월별 기후 요약">
        {!loading && !err && monthly.length === 0 ? <PageStatus variant="empty" /> : null}
        {!loading && !err && monthly.length ? (
          <div className="prod-tableWrap">
            <table className="page-table">
              <thead>
                <tr>
                  <th>월</th>
                  <th>평균기온</th>
                  <th>강수확률</th>
                  <th>평균습도</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m) => (
                  <tr key={m.month}>
                    <td>{m.month}월</td>
                    <td>{m.temp_avg?.toFixed(1) ?? '—'}°C</td>
                    <td>{m.rain_probability != null ? `${Math.round(m.rain_probability * 100)}%` : '—'}</td>
                    <td>{m.humidity_avg?.toFixed(0) ?? '—'}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </ProdSection>
    </ProdPageChrome>
  )
}

export function PlaceProdPage() {
  const { cities, cityId, setCityId, citiesLoading, citiesError } = useCities()
  const [activity, setActivity] = useState('beach')
  const [rows, setRows] = useState<{ day_of_year: number; score: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !cityId) {
      setRows([])
      setErr(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setErr(null)

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('activity_weather_score')
          .select('day_of_year, score')
          .eq('city_id', cityId)
          .eq('activity', activity)
          .order('score', { ascending: false })
          .limit(12)

        if (error) setErr(PAGE_STATUS_COPY.error)
        setRows((data ?? []) as { day_of_year: number; score: number }[])
      } catch {
        setErr(PAGE_STATUS_COPY.error)
      } finally {
        setLoading(false)
      }
    })()
  }, [activity, cityId])

  if (!supabase) {
    return (
      <ProdPageChrome title="장소 추천" lead="목적에 맞는 날씨 적합도로 여행 타이밍을 고릅니다.">
        <PageStatus variant="error" message={PAGE_STATUS_COPY.supabaseMissing} />
      </ProdPageChrome>
    )
  }

  return (
    <ProdPageChrome title="장소 추천" lead="목적에 맞는 날씨 적합도로 여행 타이밍을 고릅니다.">
      {citiesLoading ? <PageStatus variant="loading" /> : null}
      {citiesError ? <PageStatus variant="error" /> : null}

      {!citiesLoading && !citiesError ? <CityPicker cities={cities} cityId={cityId} setCityId={setCityId} /> : null}

      <ProdField label="활동">
        <select className="page-select" value={activity} onChange={(e) => setActivity(e.target.value)}>
          <option value="beach">해변</option>
          <option value="hiking">하이킹</option>
          <option value="city_sightseeing">도시관광</option>
        </select>
      </ProdField>

      {err ? <PageStatus variant="error" /> : null}
      {loading ? <PageStatus variant="loading" /> : null}

      <ProdSection title="추천 상위 날짜(평년 기준)">
        {!loading && !err && rows.length === 0 ? <PageStatus variant="empty" /> : null}
        {!loading && !err && rows.length ? (
          <ul className="page-list">
            {rows.map((r) => (
              <li key={r.day_of_year}>
                <strong>{r.day_of_year}일차</strong>
                <span className="page-muted">적합도 {r.score.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </ProdSection>
    </ProdPageChrome>
  )
}

export function NearbyProdPage() {
  const naverMapClientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID?.trim() ?? ''
  const { cities, cityId, setCityId, citiesLoading, citiesError } = useCities(500, 'nearby:last-city-id')
  const skipGpsCitySyncRef = useRef(false)
  const [nearest, setNearest] = useState<{ id: string; name_ko: string; lat: number; lon: number } | null>(null)
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [geoState, setGeoState] = useState<'pending' | 'ok' | 'unavailable' | 'denied'>('pending')
  const [places, setPlaces] = useState<
    { title: string; addr: string | null; lat: number | null; lon: number | null }[]
  >([])
  const [placesLoading, setPlacesLoading] = useState(false)
  const [placesErr, setPlacesErr] = useState<string | null>(null)

  useEffect(() => {
    if (!cities.length || typeof navigator === 'undefined') {
      setGeoState(cities.length ? 'unavailable' : 'pending')
      return
    }
    if (!navigator.geolocation) {
      setGeoState('unavailable')
      return
    }

    setGeoState('pending')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setUserCoords({ lat: latitude, lon: longitude })
        let best: { id: string; name_ko: string; lat: number; lon: number } | null = null
        let d = Infinity
        for (const c of cities) {
          if (c.lat == null || c.lon == null) continue
          const dx = (latitude - c.lat) ** 2 + (longitude - c.lon) ** 2
          if (dx < d) {
            d = dx
            best = { id: c.id, name_ko: c.name_ko, lat: c.lat, lon: c.lon }
          }
        }
        setNearest(best)
        if (best && !skipGpsCitySyncRef.current) {
          setCityId(best.id)
        }
        setGeoState('ok')
      },
      () => {
        setUserCoords(null)
        setGeoState('denied')
      },
      { enableHighAccuracy: false, maximumAge: 120_000, timeout: 12_000 },
    )
  }, [cities, setCityId])

  const mapCenter = useMemo(() => {
    if (userCoords) return userCoords
    if (nearest) return { lat: nearest.lat, lon: nearest.lon }
    const c = cities.find((x) => x.id === cityId)
    if (c?.lat != null && c?.lon != null && Number.isFinite(c.lat) && Number.isFinite(c.lon)) {
      return { lat: c.lat, lon: c.lon }
    }
    return null
  }, [userCoords, nearest, cities, cityId])

  const mapMarkers = useMemo(
    () =>
      places
        .filter(
          (p) =>
            p.lat != null &&
            p.lon != null &&
            Number.isFinite(p.lat) &&
            Number.isFinite(p.lon),
        )
        .map((p) => ({ lat: p.lat as number, lng: p.lon as number, title: p.title })),
    [places],
  )

  useEffect(() => {
    if (!supabase || !cityId) {
      setPlaces([])
      setPlacesErr(null)
      setPlacesLoading(false)
      return
    }

    setPlacesLoading(true)
    setPlacesErr(null)

    void (async () => {
      try {
        const full = await supabase
          .from('nearby_places')
          .select('title, addr, lat, lon')
          .eq('city_id', cityId)
          .order('cached_at', { ascending: false })
          .limit(12)

        if (full.error && isMissingColumnError(full.error)) {
          const basic = await supabase
            .from('nearby_places')
            .select('title, addr')
            .eq('city_id', cityId)
            .order('cached_at', { ascending: false })
            .limit(12)
          if (basic.error) {
            setPlacesErr(PAGE_STATUS_COPY.error)
            setPlaces([])
          } else {
            setPlacesErr(null)
            setPlaces(
              (basic.data ?? []).map((row) => ({
                title: row.title,
                addr: row.addr,
                lat: null,
                lon: null,
              })),
            )
          }
          return
        }

        if (full.error) {
          setPlacesErr(PAGE_STATUS_COPY.error)
          setPlaces([])
          return
        }

        let nextPlaces = (full.data ?? []) as {
          title: string
          addr: string | null
          lat: number | null
          lon: number | null
        }[]
        let nextErr: string | null = null
        if (nextPlaces.length === 0) {
          const sync = await syncNearbyPlaces(cityId)
          if (!sync.ok) {
            nextErr = sync.error ?? PAGE_STATUS_COPY.error
          } else {
            const retry = await supabase
              .from('nearby_places')
              .select('title, addr, lat, lon')
              .eq('city_id', cityId)
              .order('cached_at', { ascending: false })
              .limit(12)
            if (retry.error) nextErr = retry.error.message
            else {
              nextPlaces = (retry.data ?? []) as {
                title: string
                addr: string | null
                lat: number | null
                lon: number | null
              }[]
            }
          }
        }
        setPlacesErr(nextErr)
        setPlaces(nextPlaces)
      } catch {
        setPlacesErr(PAGE_STATUS_COPY.error)
        setPlaces([])
      } finally {
        setPlacesLoading(false)
      }
    })()
  }, [cityId])

  const selectedCityName = cities.find((c) => c.id === cityId)?.name_ko ?? ''

  if (!supabase) {
    return (
      <ProdPageChrome title="주변" lead="내 위치에 가까운 도시를 기준으로 주변 추천을 보여줍니다.">
        <PageStatus variant="error" message={PAGE_STATUS_COPY.supabaseMissing} />
      </ProdPageChrome>
    )
  }

  return (
    <ProdPageChrome
      title="주변"
      lead="아래에서 도시를 고르면 Supabase에 넣어 둔 주변 장소가 표시됩니다. 위치를 허용하면 가까운 도시로 자동 맞춤할 수 있어요."
    >
      {citiesLoading ? <PageStatus variant="loading" /> : null}
      {citiesError ? <PageStatus variant="error" /> : null}

      {!citiesLoading && !citiesError ? (
        <CityPicker
          cities={cities}
          cityId={cityId}
          setCityId={setCityId}
          onUserPick={() => {
            skipGpsCitySyncRef.current = true
          }}
        />
      ) : null}

      {mapCenter ? (
        <ProdSection title="지도">
          {naverMapClientId ? (
            <>
              <p className="page-muted prod-map-hint">
                내 위치와 캐시된 추천 장소 좌표를 표시합니다. 좌표가 없는 장소는 아래 목록에만 표시됩니다.
              </p>
              <NaverNearbyMap clientId={naverMapClientId} center={mapCenter} markers={mapMarkers} />
            </>
          ) : (
            <PageStatus
              variant="empty"
              message="네이버 지도를 보려면 web/.env.local에 VITE_NAVER_MAP_CLIENT_ID를 설정한 뒤 개발 서버를 다시 시작해 주세요. (네이버 클라우드 콘솔 → Application → Maps → 인증 정보)"
            />
          )}
        </ProdSection>
      ) : null}

      <ProdSection title="위치 기준 도시">
        {geoState === 'pending' ? <PageStatus variant="loading" message="위치를 확인하는 중이에요." /> : null}
        {geoState === 'unavailable' ? (
          <PageStatus
            variant="empty"
            message="이 환경에서는 위치를 쓸 수 없어요. 위 도시 선택으로 데이터가 있는 city_id를 맞춰 주세요."
          />
        ) : null}
        {geoState === 'denied' ? (
          <PageStatus
            variant="empty"
            message="위치 권한이 꺼져 있어요. 위 도시 선택으로 조회할 지역을 고르거나, 설정에서 위치를 허용해 주세요."
          />
        ) : null}
        {geoState === 'ok' && !nearest ? (
          <PageStatus
            variant="empty"
            message="도시 목록에 위도·경도가 없으면 가까운 도시를 자동으로 잡지 못해요. 위에서 직접 도시를 선택하면 됩니다."
          />
        ) : null}
        {geoState === 'ok' && nearest ? (
          <p className="prod-kicker">
            위치 기준 가까운 도시: {nearest.name_ko}
            {selectedCityName && nearest.id !== cityId ? ` · 선택 도시: ${selectedCityName}` : null}
          </p>
        ) : null}
        {selectedCityName ? (
          <p className="page-muted" style={{ margin: '0.35rem 0 0' }}>
            현재 조회 도시: <strong>{selectedCityName}</strong>
          </p>
        ) : null}
      </ProdSection>

      <ProdSection title="주변 추천">
        {placesErr ? <PageStatus variant="error" /> : null}
        {placesLoading ? <PageStatus variant="loading" /> : null}
        {!placesLoading && !placesErr && places.length === 0 ? (
          <PageStatus
            variant="empty"
            message="이 도시에 대한 nearby_places 행이 없거나, 넣으신 city_id가 cities.id와 다를 수 있어요. 테이블에서 city_id를 선택 중인 도시와 동일하게 맞춰 주세요."
          />
        ) : null}
        {!placesLoading && !placesErr && places.length ? (
          <ul className="page-list">
            {places.map((p, i) => (
              <li key={`${p.title}-${i}`}>
                <strong>{p.title}</strong>
                <span className="page-muted">{p.addr ?? '주소 정보 없음'}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </ProdSection>
    </ProdPageChrome>
  )
}

export function HiddenSeasonProdPage() {
  const { cities, cityId, setCityId, citiesLoading, citiesError } = useCities()
  const [rows, setRows] = useState<WeekScore[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !cityId) {
      setRows([])
      setErr(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setErr(null)

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('best_travel_week')
          .select('week_of_year, travel_score, temp_score, rain_score')
          .eq('city_id', cityId)
          .order('travel_score', { ascending: false })
          .limit(12)

        if (error) setErr(PAGE_STATUS_COPY.error)
        setRows((data ?? []) as WeekScore[])
      } catch {
        setErr(PAGE_STATUS_COPY.error)
      } finally {
        setLoading(false)
      }
    })()
  }, [cityId])

  if (!supabase) {
    return (
      <ProdPageChrome title="숨은 황금 시즌" lead="점수가 높은 주차를 빠르게 모아봅니다.">
        <PageStatus variant="error" message={PAGE_STATUS_COPY.supabaseMissing} />
      </ProdPageChrome>
    )
  }

  return (
    <ProdPageChrome title="숨은 황금 시즌" lead="점수가 높은 주차를 빠르게 모아봅니다.">
      {citiesLoading ? <PageStatus variant="loading" /> : null}
      {citiesError ? <PageStatus variant="error" /> : null}

      {!citiesLoading && !citiesError ? <CityPicker cities={cities} cityId={cityId} setCityId={setCityId} /> : null}

      {err ? <PageStatus variant="error" /> : null}
      {loading ? <PageStatus variant="loading" /> : null}

      <ProdSection title="후보 주차">
        {!loading && !err && rows.length === 0 ? <PageStatus variant="empty" /> : null}
        {!loading && !err && rows.length ? (
          <ul className="page-list">
            {rows.map((r) => (
              <li key={r.week_of_year}>
                <strong>{r.week_of_year}주차</strong>
                <span className="page-muted">총점 {r.travel_score?.toFixed(2) ?? '—'}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </ProdSection>
    </ProdPageChrome>
  )
}

export function CompareProdPage() {
  const { cities, citiesLoading, citiesError } = useCities()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [ma, setMa] = useState<Monthly | null>(null)
  const [mb, setMb] = useState<Monthly | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const month = useMemo(() => new Date().getMonth() + 1, [])

  useEffect(() => {
    if (!cities.length) return
    setA((prev) => prev || cities[0]?.id || '')
    setB((prev) => prev || cities[1]?.id || cities[0]?.id || '')
  }, [cities])

  useEffect(() => {
    if (!supabase || !a || !b) {
      setMa(null)
      setMb(null)
      setErr(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setErr(null)

    void (async () => {
      try {
        const [ra, rb] = await Promise.all([
          supabase
            .from('monthly_climate')
            .select('month,temp_avg,rain_probability,humidity_avg')
            .eq('city_id', a)
            .eq('month', month)
            .maybeSingle(),
          supabase
            .from('monthly_climate')
            .select('month,temp_avg,rain_probability,humidity_avg')
            .eq('city_id', b)
            .eq('month', month)
            .maybeSingle(),
        ])

        if (ra.error || rb.error) setErr(PAGE_STATUS_COPY.error)
        setMa((ra.data as Monthly | null) ?? null)
        setMb((rb.data as Monthly | null) ?? null)
      } catch {
        setErr(PAGE_STATUS_COPY.error)
      } finally {
        setLoading(false)
      }
    })()
  }, [a, b, month])

  const name = (id: string) => cities.find((c) => c.id === id)?.name_ko ?? id

  if (!supabase) {
    return (
      <ProdPageChrome title="도시 비교" lead="같은 달의 핵심 지표로 두 도시를 비교합니다.">
        <PageStatus variant="error" message={PAGE_STATUS_COPY.supabaseMissing} />
      </ProdPageChrome>
    )
  }

  return (
    <ProdPageChrome title="도시 비교" lead="같은 달의 핵심 지표로 두 도시를 비교합니다.">
      {citiesLoading ? <PageStatus variant="loading" /> : null}
      {citiesError ? <PageStatus variant="error" /> : null}

      <div className="prod-row">
        <select className="page-select prod-row__grow" value={a} onChange={(e) => setA(e.target.value)}>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_ko}
            </option>
          ))}
        </select>
        <select className="page-select prod-row__grow" value={b} onChange={(e) => setB(e.target.value)}>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_ko}
            </option>
          ))}
        </select>
      </div>

      {err ? <PageStatus variant="error" /> : null}
      {loading ? <PageStatus variant="loading" /> : null}

      <ProdSection title={`${month}월 비교`}>
        {!loading && !err && !ma && !mb ? <PageStatus variant="empty" /> : null}
        {!loading && !err && (ma || mb) ? (
          <div className="prod-tableWrap">
            <table className="page-table">
              <thead>
                <tr>
                  <th>지표</th>
                  <th>{name(a)}</th>
                  <th>{name(b)}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>평균기온</td>
                  <td>{ma?.temp_avg?.toFixed(1) ?? '—'}°C</td>
                  <td>{mb?.temp_avg?.toFixed(1) ?? '—'}°C</td>
                </tr>
                <tr>
                  <td>강수확률</td>
                  <td>{ma?.rain_probability != null ? `${Math.round(ma.rain_probability * 100)}%` : '—'}</td>
                  <td>{mb?.rain_probability != null ? `${Math.round(mb.rain_probability * 100)}%` : '—'}</td>
                </tr>
                <tr>
                  <td>습도</td>
                  <td>{ma?.humidity_avg?.toFixed(0) ?? '—'}%</td>
                  <td>{mb?.humidity_avg?.toFixed(0) ?? '—'}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </ProdSection>
    </ProdPageChrome>
  )
}

export function ImpactProdPage() {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [stats, setStats] = useState({ pioneer: 0, badges: 0, dday: 0 })

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      setErr(null)
      return
    }

    setLoading(true)
    setErr(null)

    void (async () => {
      try {
        const [p, b, d] = await Promise.all([
          supabase.from('pioneer_jobs').select('*', { count: 'exact', head: true }),
          supabase.from('user_badges').select('*', { count: 'exact', head: true }),
          supabase.from('user_dday_events').select('*', { count: 'exact', head: true }),
        ])

        if (p.error || b.error || d.error) setErr(PAGE_STATUS_COPY.error)
        setStats({ pioneer: p.count ?? 0, badges: b.count ?? 0, dday: d.count ?? 0 })
      } catch {
        setErr(PAGE_STATUS_COPY.error)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (!supabase) {
    return (
      <ProdPageChrome title="소셜 임팩트" lead="서비스 안에서 만들어지는 작은 변화들을 모읍니다.">
        <PageStatus variant="error" message={PAGE_STATUS_COPY.supabaseMissing} />
      </ProdPageChrome>
    )
  }

  return (
    <ProdPageChrome title="소셜 임팩트" lead="서비스 안에서 만들어지는 작은 변화들을 모읍니다.">
      {err ? <PageStatus variant="error" /> : null}
      {loading ? <PageStatus variant="loading" /> : null}

      {!loading && !err ? (
        <div className="prod-metricGrid">
          <div className="prod-metric">
            <div className="prod-metric__label">데이터 확장 시도</div>
            <div className="prod-metric__value">{stats.pioneer.toLocaleString('ko-KR')}</div>
          </div>
          <div className="prod-metric">
            <div className="prod-metric__label">기여 뱃지</div>
            <div className="prod-metric__value">{stats.badges.toLocaleString('ko-KR')}</div>
          </div>
          <div className="prod-metric">
            <div className="prod-metric__label">저장된 일정</div>
            <div className="prod-metric__value">{stats.dday.toLocaleString('ko-KR')}</div>
          </div>
        </div>
      ) : null}
    </ProdPageChrome>
  )
}

export function MyPageProd() {
  const { user, loading } = useAuth()
  const [badges, setBadges] = useState<{ badge: string; earned_at: string }[]>([])
  const [events, setEvents] = useState<{ event_name: string; event_date: string }[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !user) {
      setBadges([])
      setEvents([])
      setErr(null)
      setDataLoading(false)
      return
    }

    setDataLoading(true)
    setErr(null)

    void (async () => {
      try {
        const [b, e] = await Promise.all([
          supabase
            .from('user_badges')
            .select('badge, earned_at')
            .eq('user_id', user.id)
            .order('earned_at', { ascending: false }),
          supabase
            .from('user_dday_events')
            .select('event_name, event_date')
            .eq('user_id', user.id)
            .order('event_date', { ascending: true }),
        ])

        if (b.error || e.error) setErr(PAGE_STATUS_COPY.error)
        setBadges((b.data ?? []) as { badge: string; earned_at: string }[])
        setEvents((e.data ?? []) as { event_name: string; event_date: string }[])
      } catch {
        setErr(PAGE_STATUS_COPY.error)
      } finally {
        setDataLoading(false)
      }
    })()
  }, [user])

  if (!supabase) {
    return (
      <ProdPageChrome title="마이페이지" lead="내 기록과 저장 데이터를 확인합니다.">
        <PageStatus variant="error" message={PAGE_STATUS_COPY.supabaseMissing} />
      </ProdPageChrome>
    )
  }

  if (loading) {
    return (
      <ProdPageChrome title="마이페이지" lead="내 기록과 저장 데이터를 확인합니다.">
        <PageStatus variant="loading" />
      </ProdPageChrome>
    )
  }

  if (!user) {
    return (
      <ProdPageChrome title="마이페이지" lead="내 기록과 저장 데이터를 확인합니다.">
        <PageStatus variant="empty" message="로그인하면 내 정보를 볼 수 있어요." />
      </ProdPageChrome>
    )
  }

  return (
    <ProdPageChrome title="마이페이지" lead="내 기록과 저장 데이터를 확인합니다.">
      {err ? <PageStatus variant="error" /> : null}
      {dataLoading ? <PageStatus variant="loading" /> : null}

      <ProdSection title="내 뱃지">
        {!dataLoading && !err && badges.length === 0 ? <PageStatus variant="empty" /> : null}
        {!dataLoading && !err && badges.length ? (
          <ul className="page-list">
            {badges.map((b, i) => (
              <li key={`${b.badge}-${i}`}>
                <strong>{b.badge}</strong>
                <span className="page-muted">{b.earned_at.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </ProdSection>

      <ProdSection title="내 D-day">
        {!dataLoading && !err && events.length === 0 ? <PageStatus variant="empty" /> : null}
        {!dataLoading && !err && events.length ? (
          <ul className="page-list">
            {events.map((e, i) => (
              <li key={`${e.event_name}-${i}`}>
                <strong>{e.event_name}</strong>
                <span className="page-muted">{e.event_date}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </ProdSection>
    </ProdPageChrome>
  )
}
