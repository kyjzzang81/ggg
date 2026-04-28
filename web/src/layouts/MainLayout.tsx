import { useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Compass,
  Home,
  Navigation,
  type LucideIcon,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { SidebarProvider } from "./SidebarContext";
import "./MainLayout.css";

type TabItem = {
  to: string;
  label: string;
  end?: boolean;
  Icon: LucideIcon;
};

const tabs: TabItem[] = [
  { to: "/", label: "홈", end: true, Icon: Home },
  { to: "/score", label: "ggg score", Icon: BarChart3 },
  { to: "/place", label: "장소", Icon: Compass },
  { to: "/nearby", label: "주변", Icon: Navigation },
  { to: "/dday", label: "D-day", Icon: CalendarDays },
];

const sideLinks = [
  { to: "/mission", label: "미션" },
  { to: "/hidden-season", label: "숨은 황금 시즌" },
  { to: "/compare", label: "도시 비교" },
  { to: "/impact", label: "소셜 임팩트" },
  { to: "/mypage", label: "마이페이지" },
] as const;

const showTestData = import.meta.env.VITE_SHOW_TEST_DATA === "1";

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const headerTitle = useMemo(() => {
    const all = [...tabs, ...sideLinks];
    return all.find((item) =>
      item.to === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(item.to),
    )?.label;
  }, [location.pathname]);

  return (
    <SidebarProvider onOpen={() => setSidebarOpen(true)}>
      <div className="shell">
        <aside className="shell__sidebar-desktop" aria-label="사이드 메뉴">
          <div className="shell__sidebar-head">
            <a href="/" className="shell__sidebar-brand logo-symbol">
              <img src="/logo-symbol.png" alt="ggg" />
            </a>
            <span className="shell__sidebar-badge">beta</span>
          </div>
          <nav className="shell__sidebar-nav" aria-label="주요 메뉴">
            {tabs.map(({ to, label, end, Icon }) => (
              <NavLink
                key={`desktop-tab-${to}`}
                to={to}
                end={Boolean(end)}
                className={({ isActive }) =>
                  `shell__sidebar-link${isActive ? " shell__sidebar-link--active" : ""}`
                }
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="shell__sidebar-divider" />
          <nav className="shell__sidebar-nav" aria-label="부가 메뉴">
            {sideLinks.map(({ to, label }) => (
              <NavLink
                key={`desktop-side-${to}`}
                to={to}
                className={({ isActive }) =>
                  `shell__sidebar-link${isActive ? " shell__sidebar-link--active" : ""}`
                }
              >
                {label}
              </NavLink>
            ))}
            {showTestData && (
              <NavLink
                to="/test-data"
                className="shell__sidebar-link shell__sidebar-link--dev"
              >
                데이터 검증
              </NavLink>
            )}
          </nav>
        </aside>

        <main className="shell__main">
          <header className="shell__topbar">
            <div className="shell__topbar-brand">
              <div className="shell__topbar-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <strong>{headerTitle ?? "ggg"}</strong>
            </div>
            <button
              type="button"
              className="shell__topbar-menu"
              aria-label="메뉴 열기"
              onClick={() => setSidebarOpen(true)}
            >
              <span />
              <span />
              <span />
            </button>
          </header>
          <Outlet />
        </main>

        {/* 하단 탭 */}
        <nav className="shell__bottom" aria-label="하단 탭">
          {tabs.map(({ to, label, end, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={Boolean(end)}
              className={({ isActive }) =>
                `shell__tab${isActive ? " shell__tab--active" : ""}`
              }
            >
              <span className="shell__tab-icon" aria-hidden="true">
                <Icon size={20} />
              </span>
              <span className="shell__tab-label">{label}</span>
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
                    className={({ isActive }) =>
                      `sidebar__link${isActive ? " sidebar__link--active" : ""}`
                    }
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
  );
}
