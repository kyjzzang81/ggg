let cachedClientId: string | null = null
let loadPromise: Promise<void> | null = null

function hasNaverMaps(): boolean {
  return Boolean((window as unknown as { naver?: { maps?: unknown } }).naver?.maps)
}

/**
 * 네이버 지도 JS v3 스크립트를 한 번만 로드한다.
 * @see https://www.ncloud.com/docs/ko/application-maps/tutorial-1
 */
export function loadNaverMapsScript(clientId: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (!clientId.trim()) return Promise.reject(new Error('Naver Map client id is empty'))

  if (hasNaverMaps() && cachedClientId === clientId) return Promise.resolve()

  if (cachedClientId !== clientId) {
    loadPromise = null
    cachedClientId = clientId
  }

  if (!loadPromise) {
    loadPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-naver-maps-sdk="1"]')
      if (existing) {
        if (hasNaverMaps()) {
          resolve()
          return
        }
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener(
          'error',
          () => {
            loadPromise = null
            reject(new Error('Naver Maps script load error'))
          },
          { once: true },
        )
        return
      }

      const script = document.createElement('script')
      script.type = 'text/javascript'
      script.async = true
      script.dataset.naverMapsSdk = '1'
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${encodeURIComponent(clientId)}`
      script.onload = () => resolve()
      script.onerror = () => {
        loadPromise = null
        reject(new Error('Naver Maps script failed to load'))
      }
      document.head.appendChild(script)
    })
  }

  return loadPromise
}
