import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { PageStatus } from '../components/PageStatus'
import { ProdPageChrome, ProdSection } from '../components/ProdPageChrome'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { PAGE_STATUS_COPY } from '../ui/pageStatus'
import './pages.css'

type DdayRow = {
  id: number
  city_id: string | null
  event_name: string
  event_date: string
  event_type: string
  note: string | null
  notify_d30: boolean
  notify_d7: boolean
  notify_d1: boolean
}

type City = { id: string; name_ko: string }

const eventTypes = [
  { value: 'travel', label: '여행' },
  { value: 'anniversary', label: '기념일' },
  { value: 'birthday', label: '생일' },
] as const

export function DdayPage() {
  const { user, loading: authLoading } = useAuth()
  const [cities, setCities] = useState<City[]>([])
  const [rows, setRows] = useState<DdayRow[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<DdayRow | null>(null)

  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [cityId, setCityId] = useState('')
  const [eventType, setEventType] = useState<string>('travel')
  const [note, setNote] = useState('')
  const [n30, setN30] = useState(true)
  const [n7, setN7] = useState(true)
  const [n1, setN1] = useState(true)

  const resetForm = useCallback(() => {
    setEditing(null)
    setEventName('')
    setEventDate('')
    setCityId('')
    setEventType('travel')
    setNote('')
    setN30(true)
    setN7(true)
    setN1(true)
  }, [])

  const loadList = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    setErr(null)
    const { data, error } = await supabase
      .from('user_dday_events')
      .select(
        'id, city_id, event_name, event_date, event_type, note, notify_d30, notify_d7, notify_d1',
      )
      .order('event_date', { ascending: true })

    if (error) {
      console.warn('[dday] load failed', error)
      setErr(PAGE_STATUS_COPY.error)
      setRows([])
    } else setRows((data ?? []) as DdayRow[])
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (!supabase) return
    void supabase
      .from('cities')
      .select('id, name_ko')
      .order('name_ko')
      .limit(100)
      .then(({ data }) => setCities((data ?? []) as City[]))
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void loadList()
    })
  }, [loadList])

  const startEdit = (r: DdayRow) => {
    setEditing(r)
    setEventName(r.event_name)
    setEventDate(r.event_date)
    setCityId(r.city_id ?? '')
    setEventType(r.event_type)
    setNote(r.note ?? '')
    setN30(r.notify_d30)
    setN7(r.notify_d7)
    setN1(r.notify_d1)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase || !user) return
    setErr(null)
    const payload = {
      user_id: user.id,
      event_name: eventName.trim(),
      event_date: eventDate,
      city_id: cityId || null,
      event_type: eventType,
      note: note.trim() || null,
      notify_d30: n30,
      notify_d7: n7,
      notify_d1: n1,
    }
    if (!payload.event_name || !payload.event_date) {
      setErr('이름과 날짜는 필수입니다.')
      return
    }

    if (editing) {
      const { error } = await supabase
        .from('user_dday_events')
        .update({
          event_name: payload.event_name,
          event_date: payload.event_date,
          city_id: payload.city_id,
          event_type: payload.event_type,
          note: payload.note,
          notify_d30: payload.notify_d30,
          notify_d7: payload.notify_d7,
          notify_d1: payload.notify_d1,
        })
        .eq('id', editing.id)
        .eq('user_id', user.id)
      if (error) {
        console.warn('[dday] update failed', error)
        setErr(PAGE_STATUS_COPY.error)
      } else resetForm()
    } else {
      const { error } = await supabase.from('user_dday_events').insert(payload)
      if (error) {
        console.warn('[dday] insert failed', error)
        setErr(PAGE_STATUS_COPY.error)
      } else resetForm()
    }
    await loadList()
  }

  const remove = async (id: number) => {
    if (!supabase || !user) return
    if (!confirm('이 일정을 삭제할까요?')) return
    const { error } = await supabase
      .from('user_dday_events')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) {
      console.warn('[dday] delete failed', error)
      setErr(PAGE_STATUS_COPY.error)
    } else {
      if (editing?.id === id) resetForm()
      await loadList()
    }
  }

  const signInGoogle = async () => {
    if (!supabase) return
    setErr(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      console.warn('[dday] oauth failed', error)
      setErr(PAGE_STATUS_COPY.error)
    }
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    resetForm()
    setRows([])
  }

  if (!supabase) {
    return (
      <ProdPageChrome title="D-day" lead="중요한 날을 저장하고 알림 옵션을 함께 관리합니다.">
        <PageStatus variant="error" message={PAGE_STATUS_COPY.supabaseMissing} />
      </ProdPageChrome>
    )
  }

  if (authLoading) {
    return (
      <ProdPageChrome title="D-day" lead="중요한 날을 저장하고 알림 옵션을 함께 관리합니다.">
        <PageStatus variant="loading" />
      </ProdPageChrome>
    )
  }

  if (!user) {
    return (
      <ProdPageChrome title="D-day" lead="중요한 날을 저장하고 알림 옵션을 함께 관리합니다.">
        <PageStatus variant="empty" message="로그인하면 일정을 저장할 수 있어요." />
        {err ? <PageStatus variant="error" /> : null}
        <button type="button" className="page-btn page-btn--primary" onClick={signInGoogle}>
          Google로 로그인
        </button>
      </ProdPageChrome>
    )
  }

  return (
    <ProdPageChrome title="D-day" lead="중요한 날을 저장하고 알림 옵션을 함께 관리합니다.">
      <div className="prod-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="prod-kicker" style={{ margin: 0 }}>
          {user.email}
        </p>
        <button type="button" className="page-btn page-btn--ghost" onClick={signOut}>
          로그아웃
        </button>
      </div>

      {err ? <PageStatus variant="error" /> : null}

      <ProdSection title={editing ? '일정 수정' : '새 일정'}>
        <form className="page-form" onSubmit={submit}>
          <label>
            이름
            <input
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="예: 제주 1주년"
              required
            />
          </label>
          <label>
            날짜
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
          </label>
          <label>
            도시 (선택)
            <select
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              aria-label="도시"
            >
              <option value="">—</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_ko}
                </option>
              ))}
            </select>
          </label>
          <label>
            유형
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              aria-label="이벤트 유형"
            >
              {eventTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            메모
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <label className="page-check">
            <input type="checkbox" checked={n30} onChange={(e) => setN30(e.target.checked)} />
            D-30 알림
          </label>
          <label className="page-check">
            <input type="checkbox" checked={n7} onChange={(e) => setN7(e.target.checked)} />
            D-7 알림
          </label>
          <label className="page-check">
            <input type="checkbox" checked={n1} onChange={(e) => setN1(e.target.checked)} />
            D-1 알림
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="submit" className="page-btn page-btn--primary">
              {editing ? '저장' : '추가'}
            </button>
            {editing ? (
              <button
                type="button"
                className="page-btn page-btn--ghost"
                onClick={resetForm}
              >
                취소
              </button>
            ) : null}
          </div>
        </form>
      </ProdSection>

      <ProdSection title="내 일정">
        {loading ? <PageStatus variant="loading" /> : null}
        {!loading && rows.length === 0 ? <PageStatus variant="empty" /> : null}
        {!loading && rows.length ? (
          <ul className="page-list">
            {rows.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{r.event_name}</strong>
                  <div className="page-muted" style={{ fontSize: '0.8rem' }}>
                    {r.event_date} · {r.event_type}
                    {r.city_id ? ` · ${cities.find((c) => c.id === r.city_id)?.name_ko ?? r.city_id}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                  <button
                    type="button"
                    className="page-btn page-btn--ghost"
                    style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                    onClick={() => startEdit(r)}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="page-btn page-btn--danger"
                    style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                    onClick={() => remove(r.id)}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </ProdSection>
    </ProdPageChrome>
  )
}
