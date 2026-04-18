import { useEffect, useRef } from 'react'
import { loadNaverMapsScript } from '../lib/loadNaverMapsScript'

export type NaverMapMarker = { lat: number; lng: number; title: string }

type Props = {
  clientId: string
  center: { lat: number; lon: number }
  markers: NaverMapMarker[]
  /** 내 위치 마커를 추천 장소보다 위에 표시 */
  userZIndex?: number
  poiZIndex?: number
}

export function NaverNearbyMap({
  clientId,
  center,
  markers,
  userZIndex = 50,
  poiZIndex = 10,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<naver.maps.Map | null>(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el || !clientId) return

    let cancelled = false
    const markersList = markers

    void (async () => {
      try {
        await loadNaverMapsScript(clientId)
        if (cancelled || !containerRef.current) return

        const centerLatLng = new naver.maps.LatLng(center.lat, center.lon)
        const map = new naver.maps.Map(containerRef.current, {
          center: centerLatLng,
          zoom: 14,
        })
        mapRef.current = map

        new naver.maps.Marker({
          position: centerLatLng,
          map,
          title: '내 위치',
          zIndex: userZIndex,
        })

        for (const m of markersList) {
          new naver.maps.Marker({
            position: new naver.maps.LatLng(m.lat, m.lng),
            map,
            title: m.title,
            zIndex: poiZIndex,
          })
        }

        if (markersList.length > 0) {
          const bounds = new naver.maps.LatLngBounds()
          bounds.extend(centerLatLng)
          for (const m of markersList) bounds.extend(new naver.maps.LatLng(m.lat, m.lng))
          map.fitBounds(bounds, 48)
        }
      } catch (e) {
        console.warn('[NaverNearbyMap] init failed', e)
      }
    })()

    return () => {
      cancelled = true
      try {
        mapRef.current?.destroy()
      } catch {
        // ignore
      }
      mapRef.current = null
    }
  }, [clientId, center.lat, center.lon, markers, userZIndex, poiZIndex])

  return <div ref={containerRef} className="naver-nearby-map" role="presentation" />
}
