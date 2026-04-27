let cachedClientId: string | null = null
let loadPromise: Promise<void> | null = null

function hasNaverMaps(): boolean {
  return Boolean((window as unknown as { naver?: { maps?: unknown } }).naver?.maps)
}

function resetNaverMapsRuntime() {
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[data-naver-maps-sdk="1"]')
  scripts.forEach((s) => s.remove())
  try {
    delete (window as unknown as { naver?: unknown }).naver
  } catch {
    ;(window as unknown as { naver?: unknown }).naver = undefined
  }
}

function getSdkUrl(clientId: string, paramName: 'ncpClientId' | 'clientId') {
  return `https://oapi.map.naver.com/openapi/v3/maps.js?${paramName}=${encodeURIComponent(clientId)}`
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
    if (cachedClientId) {
      // Client ID가 바뀐 경우 기존 SDK 런타임을 제거해 인증 캐시를 초기화한다.
      resetNaverMapsRuntime()
    }
    cachedClientId = clientId
  }

  if (!loadPromise) {
    loadPromise = new Promise<void>((resolve, reject) => {
      const tryParamNames: Array<'ncpClientId' | 'clientId'> = ['ncpClientId', 'clientId']

      const loadByParam = (index: number) => {
        if (index >= tryParamNames.length) {
          loadPromise = null
          reject(
            new Error(
              'Naver Maps runtime missing after script load (all key param retries failed: ncpClientId, clientId)',
            ),
          )
          return
        }

        resetNaverMapsRuntime()
        const paramName = tryParamNames[index]
        const script = document.createElement('script')
        script.type = 'text/javascript'
        script.async = true
        script.dataset.naverMapsSdk = '1'
        script.dataset.naverMapsClientId = clientId
        script.dataset.naverMapsParamName = paramName
        script.src = getSdkUrl(clientId, paramName)

        script.onload = () => {
          // 인증 실패 시에도 onload는 호출될 수 있어 maps 객체 존재를 확인한다.
          if (hasNaverMaps()) {
            resolve()
            return
          }
          loadByParam(index + 1)
        }

        script.onerror = () => {
          loadByParam(index + 1)
        }

        document.head.appendChild(script)
      }

      loadByParam(0)
    })
  }

  return loadPromise
}
