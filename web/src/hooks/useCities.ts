import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export type CityRow = {
  id: string
  name_ko: string
  name_en: string | null
  lat: number | null
  lon: number | null
  country: string | null
}

function readPersistedCityId(persistKey?: string) {
  if (!persistKey || typeof window === 'undefined') return ''
  return window.localStorage.getItem(persistKey) ?? ''
}

export function useCities(limit = 300, persistKey?: string) {
  const [cities, setCities] = useState<CityRow[]>([])
  const [cityId, setCityId] = useState(() => readPersistedCityId(persistKey))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (persistKey && cityId && typeof window !== 'undefined') {
      window.localStorage.setItem(persistKey, cityId)
    }
  }, [cityId, persistKey])

  useEffect(() => {
    if (!supabase) {
      setCities([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const { data, error: qErr } = await supabase
          .from('cities')
          .select('id, name_ko, name_en, lat, lon, country')
          .order('is_popular', { ascending: false })
          .order('name_ko')
          .limit(limit)

        if (qErr) {
          setCities([])
          setCityId('')
          setError(qErr.message)
          return
        }

        const rows = (data ?? []) as CityRow[]
        setCities(rows)
        const persisted = readPersistedCityId(persistKey)
        const persistedHit = persisted && rows.some((r) => r.id === persisted)
        setCityId((prev) => prev || (persistedHit ? persisted : '') || rows[0]?.id || '')
      } finally {
        setLoading(false)
      }
    })()
  }, [limit, persistKey])

  return { cities, cityId, setCityId, citiesLoading: loading, citiesError: error }
}
