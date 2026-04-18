/** Naver Maps JavaScript API v3 — 최소 타입 (공식 SDK 전역) */

declare namespace naver {
  namespace maps {
    class Map {
      constructor(element: HTMLElement, options: MapOptions)
      destroy(): void
      fitBounds(bounds: LatLngBounds, padding?: number): void
    }

    interface MapOptions {
      center: LatLng
      zoom?: number
      minZoom?: number
      maxZoom?: number
    }

    class LatLng {
      constructor(lat: number, lng: number)
    }

    class LatLngBounds {
      constructor()
      extend(latlng: LatLng): void
    }

    class Marker {
      constructor(options: MarkerOptions)
    }

    interface MarkerOptions {
      position: LatLng
      map: Map
      title?: string
      zIndex?: number
    }
  }
}
