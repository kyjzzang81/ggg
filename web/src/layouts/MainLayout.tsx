import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { SidebarProvider } from './SidebarContext'
import './MainLayout.css'

type TabItem = { to: string; label: string; end?: boolean }

const tabs: TabItem[] = [
  { to: '/', label: '홈', end: true },
  { to: '/score', label: 'ggg score' },
  { to: '/place', label: '장소' },
  { to: '/nearby', label: '주변' },
  { to: '/dday', label: 'D-day' },
]

const sideLinks = [
  { to: '/mission', label: '미션' },
  { to: '/hidden-season', label: '숨은 황금 시즌' },
  { to: '/compare', label: '도시 비교' },
  { to: '/impact', label: '소셜 임팩트' },
  { to: '/mypage', label: '마이페이지' },
] as const

const showTestData = import.meta.env.VITE_SHOW_TEST_DATA === '1'

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <SidebarProvider onOpen={() => setSidebarOpen(true)}>
      <div className="shell">
        <main className="shell__main">
          <Outlet />
        </main>

        {/* 하단 탭 */}
        <nav className="shell__bottom" aria-label="하단 탭">
          {tabs.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={Boolean(end)}
              className={({ isActive }) => `shell__tab${isActive ? ' shell__tab--active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* 사이드바 드로어 */}
        {sidebarOpen && (
          <div className="sidebar" role="dialog" aria-modal aria-label="메뉴">
            {/* backdrop */}
            <button
              type="button"
              className="sidebar__backdrop"
              onClick={() => setSidebarOpen(false)}
            />
            {/* 패널 */}
            <div className="sidebar__panel">
              <div className="sidebar__head">
                <span className="sidebar__brand">ggg</span>
                <span className="sidebar__badge">베타</span>
                <button
                  type="button"
                  className="sidebar__close"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>

              <nav className="sidebar__nav" aria-label="사이드 메뉴">
                {sideLinks.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    {label}
                  </NavLink>
                ))}
                {showTestData && (
                  <NavLink
                    to="/test-data"
                    className="sidebar__link sidebar__link--dev"
                    onClick={() => setSidebarOpen(false)}
                  >
                    데이터 검증
                  </NavLink>
                )}
              </nav>
            </div>
          </div>
        )}
      </div>
    </SidebarProvider>
  )
}
