/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** `1`이면 헤더에 `/test-data` 링크 표시 (기본: 숨김) */
  readonly VITE_SHOW_TEST_DATA?: string
  /** `1`이면 홈에서 개척 진행 UI(진행률 등) 표시 */
  readonly VITE_SHOW_PIONEER_PROGRESS?: string
  /** 네이버 클라우드 콘솔 Application > Maps > 인증 정보 — 클라이언트 ID (주변 지도 JS v3) */
  readonly VITE_NAVER_MAP_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
