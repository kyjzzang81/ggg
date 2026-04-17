/**
 * CLIMATE Shell
 * - 각 화면 페이지에 사이드바를 자동 주입한다.
 * - 모바일에서는 CSS로 숨겨져 있고, 태블릿(>=768px)부터 노출된다.
 * - 현재 URL의 파일명을 읽어 active 상태를 표시한다.
 */
(function () {
  const NAV_GROUPS = [
    {
      title: '메인',
      items: [
        { id: 'home',           label: '홈',              icon: 'home',       href: 'home.html' },
        { id: 'score',          label: 'Climate Score™', icon: 'analytics',  href: 'score.html' },
        { id: 'place',          label: '장소 추천',        icon: 'explore',    href: 'place.html' },
        { id: 'nearby',         label: '주변',             icon: 'near_me',    href: 'nearby.html' },
        { id: 'hidden-season',  label: '숨은 황금 시즌',    icon: 'auto_awesome', href: 'hidden-season.html' },
        { id: 'compare',        label: '도시 비교',         icon: 'compare_arrows', href: 'compare.html' },
      ],
    },
    {
      title: '내 여행',
      items: [
        { id: 'dday',    label: 'D-day 알림', icon: 'event',            href: 'dday.html', badge: 'D-12' },
        { id: 'mode',    label: '모드 설정',    icon: 'tune',             href: 'mode.html' },
        { id: 'mypage',  label: '마이페이지',   icon: 'account_circle',   href: 'mypage.html' },
      ],
    },
    {
      title: '임팩트',
      items: [
        { id: 'impact',  label: '소셜 임팩트', icon: 'eco', href: 'impact.html', badgeTone: 'new', badge: 'NEW' },
      ],
    },
  ];

  function getCurrentScreen() {
    const path = location.pathname.split('/').pop() || 'home.html';
    return path.replace('.html', '');
  }

  function createSidebar() {
    const current = getCurrentScreen();

    const sections = NAV_GROUPS.map((group) => {
      const items = group.items.map((item) => {
        const isActive = item.id === current;
        const badge = item.badge
          ? `<span class="sidebar__item-badge ${item.badgeTone === 'new' ? 'sidebar__item-badge--new' : ''}">${item.badge}</span>`
          : '';
        return `
          <a href="${item.href}"
             class="sidebar__item ${isActive ? 'sidebar__item--active' : ''}"
             data-screen="${item.id}"
             ${isActive ? 'aria-current="page"' : ''}>
            <span class="material-symbols-rounded" aria-hidden="true">${item.icon}</span>
            <span class="sidebar__item-label">${item.label}</span>
            ${badge}
          </a>
        `;
      }).join('');

      return `
        <div class="sidebar__section">${group.title}</div>
        ${items}
      `;
    }).join('');

    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    sidebar.setAttribute('aria-label', '주 네비게이션');
    sidebar.innerHTML = `
      <header class="sidebar__brand">
        <div class="sidebar__logo" aria-hidden="true">C</div>
        <div class="sidebar__brand-text">
          <div class="sidebar__name">CLIMATE</div>
          <div class="sidebar__tag">날씨 기반 여행 서비스</div>
        </div>
      </header>

      <nav class="sidebar__nav">
        ${sections}
      </nav>

      <footer class="sidebar__user">
        <div class="sidebar__avatar" aria-hidden="true">YJ</div>
        <div class="sidebar__user-info">
          <div class="sidebar__user-name">강용진</div>
          <div class="sidebar__user-tag">Plus 구독중</div>
        </div>
        <button class="icon-btn" aria-label="설정">
          <span class="material-symbols-rounded" aria-hidden="true">settings</span>
        </button>
      </footer>
    `;

    return sidebar;
  }

  function init() {
    if (document.querySelector('.sidebar')) return;

    const sidebar = createSidebar();
    document.body.insertBefore(sidebar, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
