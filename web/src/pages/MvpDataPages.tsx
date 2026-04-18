import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import './pages.css'

type ProbeSection = {
  key: string
  title: string
  table: string
  select: string
  limit?: number
  requiresUser?: boolean
  description?: string
}

type ProbeResult = {
  loading: boolean
  error: string | null
  count: number | null
  sample: Record<string, unknown>[]
}

type ProbeStatus = 'loading' | 'ok' | 'empty' | 'error'

function useProbe(section: ProbeSection, userId: string | null): ProbeResult {
  const [state, setState] = useState<ProbeResult>({
    loading: true,
    error: null,
    count: null,
    sample: [],
  })

  useEffect(() => {
    if (!supabase) {
      setState({ loading: false, error: 'Supabase 환경 변수가 없습니다.', count: null, sample: [] })
      return
    }
    if (section.requiresUser && !userId) {
      setState({ loading: false, error: '로그인 후 확인 가능합니다.', count: null, sample: [] })
      return
    }

    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: null }))

    const q = supabase.from(section.table).select(section.select, { count: 'exact' }).limit(section.limit ?? 5)
    const filtered = section.requiresUser && userId ? q.eq('user_id', userId) : q

    void filtered.then(({ data, error, count }) => {
      if (cancelled) return
      if (error) {
        setState({ loading: false, error: error.message, count: null, sample: [] })
        return
      }
      setState({
        loading: false,
        error: null,
        count: count ?? null,
        sample: ((data ?? []) as unknown) as Record<string, unknown>[],
      })
    })

    return () => {
      cancelled = true
    }
  }, [section, userId])

  return state
}

function probeStatusOf(r: ProbeResult): ProbeStatus {
  if (r.loading) return 'loading'
  if (r.error) return 'error'
  if ((r.count ?? 0) === 0) return 'empty'
  return 'ok'
}

function statusLabel(s: ProbeStatus): string {
  if (s === 'ok') return 'OK'
  if (s === 'empty') return 'EMPTY'
  if (s === 'error') return 'ERROR'
  return 'LOADING'
}

function statusColor(s: ProbeStatus): string {
  if (s === 'ok') return '#027a48'
  if (s === 'empty') return '#b54708'
  if (s === 'error') return '#b42318'
  return '#344054'
}

function DataPage({
  title,
  subtitle,
  sections,
}: {
  title: string
  subtitle: string
  sections: ProbeSection[]
}) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [statuses, setStatuses] = useState<Record<string, ProbeStatus>>({})

  const updateStatus = (key: string, status: ProbeStatus) => {
    setStatuses((prev) => (prev[key] === status ? prev : { ...prev, [key]: status }))
  }

  const statusSummary = useMemo(() => {
    const vals = sections.map((s) => statuses[s.key] ?? 'loading')
    return {
      ok: vals.filter((v) => v === 'ok').length,
      empty: vals.filter((v) => v === 'empty').length,
      error: vals.filter((v) => v === 'error').length,
      loading: vals.filter((v) => v === 'loading').length,
      total: vals.length,
    }
  }, [sections, statuses])

  return (
    <article>
      <h1 style={{ fontSize: '1.25rem', marginTop: 0 }}>{title}</h1>
      <p className="page-muted" style={{ marginTop: 0 }}>
        ggg MVP 데이터 검증 화면 · {subtitle}
      </p>
      <section className="page-block" style={{ marginBottom: '1rem' }}>
        <h2>기획 체크리스트 요약</h2>
        <p className="page-muted" style={{ marginTop: 0 }}>
          총 {statusSummary.total}개 소스 · OK {statusSummary.ok} · EMPTY {statusSummary.empty} · ERROR{' '}
          {statusSummary.error} · LOADING {statusSummary.loading}
        </p>
      </section>
      {sections.map((s) => (
        <ProbeCardWithStatus
          key={s.key}
          section={s}
          userId={userId}
          onStatus={(st) => updateStatus(s.key, st)}
        />
      ))}
    </article>
  )
}

function ProbeCardWithStatus({
  section,
  userId,
  onStatus,
}: {
  section: ProbeSection
  userId: string | null
  onStatus: (status: ProbeStatus) => void
}) {
  const r = useProbe(section, userId)
  const st = probeStatusOf(r)
  useEffect(() => {
    onStatus(st)
  }, [onStatus, st])

  return <ProbeCardContent section={section} result={r} status={st} />
}

function ProbeCardContent({
  section,
  result,
  status,
}: {
  section: ProbeSection
  result: ProbeResult
  status: ProbeStatus
}) {
  const r = result
  const st = status

  return (
    <section className="page-block" style={{ border: '1px solid #e4e7ec', borderRadius: 10, padding: '0.75rem' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>{section.title}</span>
        <span
          style={{
            fontSize: '0.72rem',
            borderRadius: 999,
            border: `1px solid ${statusColor(st)}`,
            color: statusColor(st),
            padding: '0.1rem 0.45rem',
            lineHeight: 1.4,
          }}
        >
          {statusLabel(st)}
        </span>
      </h2>
      {section.description ? <p className="page-muted" style={{ marginTop: 0 }}>{section.description}</p> : null}

      {r.loading ? <p className="page-muted">로딩 중…</p> : null}
      {r.error ? <p className="page-err">{r.error}</p> : null}

      {!r.loading && !r.error ? (
        <>
          <p className="page-muted" style={{ marginTop: 0 }}>
            테이블 <code>{section.table}</code> · 총 행 수: {r.count ?? '확인 불가'}
          </p>
          {r.sample.length === 0 ? (
            <p className="page-muted">샘플 데이터가 없습니다.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="page-table" style={{ minWidth: 520 }}>
                <thead>
                  <tr>
                    {Object.keys(r.sample[0]).map((k) => (
                      <th key={k}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.sample.map((row, i) => (
                    <tr key={`${section.key}-${i}`}>
                      {Object.keys(r.sample[0]).map((k) => (
                        <td key={`${section.key}-${i}-${k}`}>{String(row[k] ?? '—').slice(0, 40)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </section>
  )
}

export function ScorePage() {
  const sections = useMemo<ProbeSection[]>(
    () => [
      {
        key: 'score-best-week',
        title: '주차별 여행 점수',
        table: 'best_travel_week',
        select: 'city_id, week_of_year, travel_score, temp_score, rain_score',
      },
      {
        key: 'score-monthly',
        title: '월별 기후',
        table: 'monthly_climate',
        select: 'city_id, month, temp_avg, rain_probability, humidity_avg',
      },
      {
        key: 'score-normals',
        title: '일자별 기후 노멀',
        table: 'climate_normals',
        select: 'city_id, day_of_year, temp_avg, rain_probability, cloud_cover_avg',
      },
    ],
    [],
  )
  return <DataPage title="ggg score" subtitle="ggg score·캘린더 핵심 소스" sections={sections} />
}

export function PlacePage() {
  const sections = useMemo<ProbeSection[]>(
    () => [
      {
        key: 'place-activity',
        title: '활동별 날씨 적합도',
        table: 'activity_weather_score',
        select: 'city_id, activity, day_of_year, score',
      },
      {
        key: 'place-rain-risk',
        title: '강수 리스크 캘린더',
        table: 'rain_risk_calendar',
        select: 'city_id, day_of_year, rain_probability, risk_level',
      },
      {
        key: 'place-cities',
        title: '도시 마스터',
        table: 'cities',
        select: 'id, name_ko, country, lat, lon, is_popular',
      },
    ],
    [],
  )
  return <DataPage title="장소 추천" subtitle="추천 계산 입력 데이터" sections={sections} />
}

export function NearbyPage() {
  const sections = useMemo<ProbeSection[]>(
    () => [
      {
        key: 'nearby-cache',
        title: '주변 장소 캐시',
        table: 'nearby_places',
        select: 'city_id, place_id, title, addr, cached_at',
      },
      {
        key: 'nearby-cities',
        title: '기준 도시 좌표',
        table: 'cities',
        select: 'id, name_ko, lat, lon, station_name',
      },
      {
        key: 'nearby-forecast',
        title: '근처 날씨 샘플(예보)',
        table: 'forecast_weather',
        select: 'city_id, timestamp, temperature, precipitation, weather_code',
      },
    ],
    [],
  )
  return <DataPage title="주변" subtitle="위치 추천용 데이터 연결 상태" sections={sections} />
}

export function HiddenSeasonPage() {
  const sections = useMemo<ProbeSection[]>(
    () => [
      {
        key: 'hidden-best-week',
        title: '숨은 시즌 탐색 기반(주차 점수)',
        table: 'best_travel_week',
        select: 'city_id, week_of_year, travel_score, rain_score',
      },
      {
        key: 'hidden-monthly',
        title: '월별 기후 기준',
        table: 'monthly_climate',
        select: 'city_id, month, temp_avg, rain_days, wind_avg',
      },
    ],
    [],
  )
  return <DataPage title="숨은 황금 시즌" subtitle="시즌 발굴용 분석 소스" sections={sections} />
}

export function ComparePage() {
  const sections = useMemo<ProbeSection[]>(
    () => [
      {
        key: 'compare-cities',
        title: '비교 대상 도시',
        table: 'cities',
        select: 'id, name_ko, country, lat, lon',
      },
      {
        key: 'compare-monthly',
        title: '도시별 월 기후 비교 소스',
        table: 'monthly_climate',
        select: 'city_id, month, temp_avg, rain_probability, humidity_avg',
      },
      {
        key: 'compare-frequency',
        title: '도시별 빈도 비교 소스',
        table: 'climate_frequency',
        select: 'city_id, day_of_year, clear_days, rain_days, snow_days',
      },
    ],
    [],
  )
  return <DataPage title="도시 비교" subtitle="비교 카드/차트 검증 데이터" sections={sections} />
}

export function ImpactPage() {
  const sections = useMemo<ProbeSection[]>(
    () => [
      {
        key: 'impact-jobs',
        title: '개척 활동 로그',
        table: 'pioneer_jobs',
        select: 'city_id, status, progress, step, created_at',
      },
      {
        key: 'impact-badges',
        title: '개척자 뱃지 집계 소스',
        table: 'user_badges',
        select: 'user_id, badge, earned_at',
      },
      {
        key: 'impact-dday',
        title: '저장 이벤트(리텐션 지표)',
        table: 'user_dday_events',
        select: 'user_id, city_id, event_name, event_date, created_at',
      },
    ],
    [],
  )
  return <DataPage title="소셜 임팩트" subtitle="활동/참여 데이터 상태" sections={sections} />
}

export function MyPage() {
  const sections = useMemo<ProbeSection[]>(
    () => [
      {
        key: 'mypage-badges',
        title: '내 뱃지',
        table: 'user_badges',
        select: 'user_id, badge, meta, earned_at',
        requiresUser: true,
      },
      {
        key: 'mypage-dday',
        title: '내 D-day 이벤트',
        table: 'user_dday_events',
        select: 'user_id, city_id, event_name, event_date, event_type, created_at',
        requiresUser: true,
      },
      {
        key: 'mypage-pioneer',
        title: '내 개척 히스토리',
        table: 'pioneer_jobs',
        select: 'user_id, city_id, status, progress, error, created_at',
        requiresUser: true,
      },
    ],
    [],
  )
  return <DataPage title="마이페이지" subtitle="개인 데이터 저장 상태" sections={sections} />
}

export function TestDataHomePage() {
  const links = [
    { to: '/test-data/score', label: 'ggg score 데이터 검증' },
    { to: '/test-data/place', label: '장소 추천 데이터 검증' },
    { to: '/test-data/nearby', label: '주변 데이터 검증' },
    { to: '/test-data/hidden-season', label: '숨은 황금 시즌 데이터 검증' },
    { to: '/test-data/compare', label: '도시 비교 데이터 검증' },
    { to: '/test-data/impact', label: '소셜 임팩트 데이터 검증' },
    { to: '/test-data/mypage', label: '마이페이지 데이터 검증' },
  ] as const

  return (
    <article>
      <h1 style={{ fontSize: '1.25rem', marginTop: 0 }}>ggg 테스트 데이터</h1>
      <p className="page-muted" style={{ marginTop: 0 }}>
        배포용 화면과 분리된 데이터 연동 검증 라우트입니다.
      </p>
      <ul className="page-list" style={{ maxWidth: 520 }}>
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to}>{l.label}</Link>
          </li>
        ))}
      </ul>
    </article>
  )
}
