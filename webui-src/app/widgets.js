const m = require('mithril');
const Sidebar = () => {
  let mobileOpen = false;
  let isMobileWidth = false;
  let widthQuery;
  let onWidthChange;

  const links = (v) => v.attrs.tabs.map((panelName) => {
    const href = v.attrs.baseRoute + panelName;
    const selected = m.route.get().toLowerCase().startsWith(href.toLowerCase());
    return m('a', {
      class: selected ? 'selected-sidebar-link' : '',
      href,
      onclick: (event) => {
        event.preventDefault();
        mobileOpen = false;
        m.route.set(href);
      },
    }, panelName);
  });

  return {
    oninit: () => {
      widthQuery = window.matchMedia('(max-width: 700px)');
      isMobileWidth = widthQuery.matches;
      onWidthChange = (event) => {
        isMobileWidth = event.matches;
        if (!isMobileWidth) mobileOpen = false;
        m.redraw();
      };
      if (widthQuery.addEventListener) widthQuery.addEventListener('change', onWidthChange);
      else widthQuery.addListener(onWidthChange);
    },
    onremove: () => {
      if (!widthQuery || !onWidthChange) return;
      if (widthQuery.removeEventListener) widthQuery.removeEventListener('change', onWidthChange);
      else widthQuery.removeListener(onWidthChange);
    },
    view: (v) => {
      if (!v.attrs.mobileDrawer || !isMobileWidth) return m('.sidebar', links(v));
      return m('.sidebar-drawer', [
        m('button.sidebar-mobile-toggle[type=button][aria-label=Open navigation]', {
          'aria-expanded': mobileOpen,
          onclick: () => { mobileOpen = !mobileOpen; },
        }, m('i.fas.fa-bars')),
        mobileOpen ? m('.sidebar-drawer__backdrop', { onclick: () => { mobileOpen = false; } }) : null,
        m('.sidebar', { class: mobileOpen ? 'sidebar--mobile-open' : '' }, [
          m('.sidebar-drawer__title', 'Navigation'),
          ...links(v),
        ]),
      ]);
    },
  };
};
const SidebarQuickView = () => {
  // for the Mail tab, to be moved later.
  let quickactive = -1;
  return {
    view: (v) =>
      m(
        '.sidebarquickview',
        m('h4', 'Quick View'),
        v.attrs.tabs.map((panelName, index) =>
          m(
            m.route.Link,
            {
              class: index === quickactive ? 'selected-sidebarquickview-link' : '',
              onclick: () => (quickactive = index),
              href: v.attrs.baseRoute + panelName,
            },
            panelName
          )
        )
      ),
  };
};

// There are ways of doing this inside m.route but it is probably
// cleaner and faster when kept outside of the main auto
// rendering system
function popupMessage(message) {
  const container = document.getElementById('modal-container');
  container.style.display = 'block';
  m.render(
    container,
    m('.modal-content', [
      m(
        'button.red.close-btn',
        {
          onclick: () => (container.style.display = 'none'),
        },
        m('i.fas.fa-times')
      ),
      message,
    ])
  );
}

module.exports = {
  Sidebar,
  SidebarQuickView,
  popupMessage,
};
