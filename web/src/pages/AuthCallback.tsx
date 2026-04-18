import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import './pages.css'

export function AuthCallback() {
  const nav = useNavigate()
  const [msg, setMsg] = useState(() =>
    supabase ? '로그인 처리 중…' : 'Supabase 설정 없음',
  )

  useEffect(() => {
    if (!supabase) {
      const t = setTimeout(() => nav('/dday', { replace: true }), 1200)
      return () => clearTimeout(t)
    }

    void supabase.auth.getSession().then(({ error }) => {
      if (error) setMsg(error.message)
      nav('/dday', { replace: true })
    })
  }, [nav])

  return (
    <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
      <p className="page-muted">{msg}</p>
    </div>
  )
}
