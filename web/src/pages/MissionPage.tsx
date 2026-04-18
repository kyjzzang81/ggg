import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageStatus } from '../components/PageStatus'
import { ProdPageChrome, ProdSection } from '../components/ProdPageChrome'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { PAGE_STATUS_COPY } from '../ui/pageStatus'
import './pages.css'

type PioneerJob = {
  id: string
  city_id: string
  user_display_name: string
  region_label: string
  status: string
  progress: number
  step: string | null
  error: string | null
  created_at: string
}

const ATTACH_KM = 25


export function MissionPage() {
  const { user, session, loading: authLoading } = useAuth()
  const [jobs, setJobs] = useState<PioneerJob[]>([])
  const [badges, setBadges] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const loadFeed = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('pioneer_jobs')
      .select(
        'id, city_id, user_display_name, region_label, status, progress, step, error, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(12)
    if (error) return
    setJobs((data ?? []) as PioneerJob[])
  }, [])

  const loadBadges = useCallback(async () => {
    if (!supabase || !user) {
      setBadges([])
      return
    }
    const { data, error } = await supabase.from('user_badges').select('badge').eq('user_id', user.id)
    if (error) return
    setBadges((data ?? []).map((r) => (r as { badge: string }).badge))
  }, [user])

  useEffect(() => {
    void loadFeed()
    const t = window.setInterval(() => {
      void loadFeed()
    }, 4000)
    return () => window.clearInterval(t)
  }, [loadFeed])

  useEffect(() => {
    void loadBadges()
  }, [loadBadges])

  const startPioneer = async () => {
    if (!supabase) {
      setErr(PAGE_STATUS_COPY.supabaseMissing)
      return
    }
    const client = supabase
    const {
      data: { session: currentSession },
    } = await client.auth.getSession()
    const accessToken = currentSession?.access_token ?? session?.access_token
    if (!accessToken) {
      setErr(null)
      setMsg('로그인이 필요해요. D-day에서 로그인한 뒤 다시 시도해 주세요.')
      return
    }
    if (!navigator.geolocation) {
      setErr(null)
      setMsg('이 기기에서는 위치를 사용할 수 없어요.')
      return
    }
    setErr(null)
    setMsg(null)
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const base = import.meta.env.VITE_SUPABASE_URL
        const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
        if (!base || !anon) {
          setErr(PAGE_STATUS_COPY.supabaseMissing)
          setBusy(false)
          return
        }
        try {
          const res = await fetch(`${base}/functions/v1/pioneer-ensure`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              apikey: anon,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
            }),
          })
          const body = (await res.json()) as {
            ok?: boolean
            error?: string
            mode?: string
            message?: string
            city_id?: string
            distance_km?: number
            region_label?: string
            badge?: string
          }
          if (!res.ok) {
            if (res.status === 401) {
              setErr(null)
              setMsg('로그인이 만료됐어요. D-day에서 다시 로그인한 뒤 시도해 주세요.')
            } else {
              console.warn('[mission] pioneer-ensure failed', { status: res.status, body })
              setErr(PAGE_STATUS_COPY.error)
            }
            setBusy(false)
            void loadFeed()
            return
          }
          if (body.mode === 'existing_catalog' && body.city_id) {
            setMsg(
              `가까운 등록 도시가 있어요(약 ${Math.round((body.distance_km ?? 0) * 10) / 10}km). 홈에서 도시를 선택하면 바로 볼 수 있어요.`,
            )
          } else if (body.mode === 'existing_grid') {
            setMsg('이미 다른 분이 이 지역 데이터를 준비해 두었어요. 홈에서 도시를 선택해 보세요.')
          } else if (body.mode === 'already_running') {
            setMsg(body.message ?? '이미 개척 작업이 진행 중입니다. 잠시 후 피드를 확인해 주세요.')
          } else if (body.ok && body.city_id) {
            setMsg(`준비가 완료됐어요. 홈에서 추천된 도시를 선택해 주세요.`)
          }
          void loadFeed()
          void loadBadges()
        } catch {
          setErr(PAGE_STATUS_COPY.error)
        } finally {
          setBusy(false)
        }
      },
      () => {
        setErr(null)
        setMsg('위치 권한이 필요해요. 설정에서 허용한 뒤 다시 시도해 주세요.')
        setBusy(false)
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
    )
  }

  return (
    <ProdPageChrome
      title="미션"
      lead={`등록되지 않은 위치(약 ${ATTACH_KM}km 밖)에서는 커뮤니티가 데이터를 확장할 수 있어요. 처음 완료하면 “개척자” 뱃지가 주어집니다.`}
    >
      {!supabase ? (
        <PageStatus variant="error" message={PAGE_STATUS_COPY.supabaseMissing} />
      ) : authLoading ? (
        <PageStatus variant="loading" />
      ) : !user ? (
        <PageStatus
          variant="empty"
          message={
            <>
              <Link to="/dday">D-day</Link>에서 로그인한 뒤 이 페이지에서 시작할 수 있어요.
            </>
          }
        />
      ) : (
        <ProdSection title="내 뱃지">
          {badges.includes('pioneer') ? (
            <p style={{ margin: 0 }}>개척자 — 새 지역 데이터를 처음 채운 기록이 있어요.</p>
          ) : (
            <PageStatus variant="empty" message="아직 개척자 뱃지가 없어요. 아래에서 시작해 보세요." />
          )}
          <button
            type="button"
            className="page-btn page-btn--primary"
            style={{ marginTop: '0.75rem' }}
            disabled={busy}
            onClick={() => {
              void startPioneer()
            }}
          >
            {busy ? '진행 중…' : '현재 위치로 시작'}
          </button>
          {msg ? <p className="prod-hint" style={{ marginTop: '0.75rem' }}>{msg}</p> : null}
          {err ? <PageStatus variant="error" message={err} /> : null}
        </ProdSection>
      )}

      <ProdSection title="커뮤니티 피드">
        {jobs.length === 0 ? (
          <PageStatus variant="empty" />
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.9rem', lineHeight: 1.55 }}>
            {jobs.map((j) => (
              <li key={j.id} style={{ marginBottom: '0.65rem' }}>
                {j.status === 'running' ? (
                  <>
                    축하합니다. <strong>{j.user_display_name}</strong>님이{' '}
                    <strong>{j.region_label}</strong> 지역을 개척 중입니다. ({j.progress}%){' '}
                    {j.step ? `— ${j.step}` : ''}
                  </>
                ) : j.status === 'completed' ? (
                  <>
                    <strong>{j.user_display_name}</strong>님이 <strong>{j.region_label}</strong> 개척을
                    마쳤습니다.
                  </>
                ) : (
                  <>
                    <strong>{j.user_display_name}</strong>님의 <strong>{j.region_label}</strong> 작업이
                    잠시 멈췄어요. 잠시 후 다시 시도해 주세요.
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </ProdSection>
    </ProdPageChrome>
  )
}
