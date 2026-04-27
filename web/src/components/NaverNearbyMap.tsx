import { useEffect, useRef } from 'react'
import { loadNaverMapsScript } from '../lib/loadNaverMapsScript'

export type NaverMapMarker = { lat: number; lng: number; title: string }

type Props = {
  clientId: string
  center: { lat: number; lon: number }
  markers: NaverMapMarker[]
  selectedMarkerTitle?: string | null
  onError?: (message: string) => void
  /** 내 위치 마커를 추천 장소보다 위에 표시 */
  userZIndex?: number
  poiZIndex?: number
}

export function NaverNearbyMap({
  clientId,
  center,
  markers,
  selectedMarkerTitle = null,
  onError,
  userZIndex = 50,
  poiZIndex = 10,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<naver.maps.Map | null>(null)

  const getNaverMaps = () => {
    const maps = (
      window as unknown as { naver?: { maps?: typeof naver.maps | null } }
    ).naver?.maps
    if (!maps) {
      throw new Error(
        'Naver Maps runtime unavailable (likely authentication failed: check Client ID and allowed origins)',
      )
    }
    return maps
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el || !clientId) return

    let cancelled = false
    const markersList = markers

    void (async () => {
      try {
        await loadNaverMapsScript(clientId)
        if (cancelled || !containerRef.current) return

        const maps = getNaverMaps()
        const centerLatLng = new maps.LatLng(center.lat, center.lon)
        const map = new maps.Map(containerRef.current, {
          center: centerLatLng,
          zoom: 14,
        })
        mapRef.current = map

        new maps.Marker({
          position: centerLatLng,
          map,
          title: '내 위치',
          icon: {
            content:
              '<div class="nearby-map-user-pulse"><span class="nearby-map-user-pulse__dot"></span></div>',
            anchor: { x: 9, y: 9 },
          },
          zIndex: userZIndex,
        } as any)

        for (const m of markersList) {
          const picked = selectedMarkerTitle != null && m.title === selectedMarkerTitle
          new maps.Marker({
            position: new maps.LatLng(m.lat, m.lng),
            map,
            title: m.title,
            icon: {
              content: picked
                ? '<div class="nearby-map-poi-marker nearby-map-poi-marker--active"></div>'
                : '<div class="nearby-map-poi-marker"></div>',
              anchor: { x: picked ? 10 : 7, y: picked ? 26 : 7 },
            },
            zIndex: poiZIndex,
          } as any)
        }

        if (markersList.length > 0) {
          const bounds = new maps.LatLngBounds()
          bounds.extend(centerLatLng)
          for (const m of markersList) bounds.extend(new maps.LatLng(m.lat, m.lng))
          map.fitBounds(bounds, 48)
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Naver map init failed'
        console.warn('[NaverNearbyMap] init failed', e)
        onError?.(message)
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
  }, [clientId, center.lat, center.lon, markers, onError, poiZIndex, selectedMarkerTitle, userZIndex])

  return <div ref={containerRef} className="naver-nearby-map" role="presentation" />
}
