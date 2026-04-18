import type { Session, User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAuth(): {
  user: User | null
  session: Session | null
  loading: boolean
} {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(() => supabase !== null)

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user: session?.user ?? null, session, loading }
}
