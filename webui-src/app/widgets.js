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
function closePopupMessage() {
  const container = document.getElementById('modal-container');
  if (!container) return;
  m.mount(container, null);
  container.style.display = 'none';
}

function popupMessage(message, modalClass = '') {
  const container = document.getElementById('modal-container');
  container.style.display = 'block';
  //  A vnode carries the DOM node it owns, so the same one cannot be rendered
  //  twice. popupMessage is handed a ready made vnode and mounts it, which
  //  re-renders it on every global redraw, so it has to hand out a fresh copy
  //  each time -- and a copy all the way down. Cloning only the root leaves the
  //  children array shared, and `old === vnodes` makes mithril skip the whole
  //  subtree: the modal content is then frozen at its first render.
  const freshVnode = (vnode) => {
    if (Array.isArray(vnode)) return vnode.map(freshVnode);
    if (!vnode || typeof vnode !== 'object' || !vnode.tag) return vnode;
    //  '<' is m.trust and '[' is m.fragment: neither is a selector m() knows how
    //  to parse. Rebuilding them with m() would silently turn trusted html into
    //  an empty div, so they go back through their own factory. '#' is a text
    //  vnode, whose children is the string itself.
    if (vnode.tag === '<') return m.trust(vnode.children);
    if (vnode.tag === '#') return vnode.children;
    if (vnode.tag === '[') return m.fragment(vnode.attrs, freshVnode(vnode.children));
    return m(vnode.tag, vnode.attrs, freshVnode(vnode.children));
  };
  const Popup = {
    view: () => m(`.modal-content${modalClass ? `.${modalClass}` : ''}`, [
      m(
        'button.red.close-btn',
        {
          onclick: () => {
            closePopupMessage();
          },
        },
        m('i.fas.fa-times')
      ),
      freshVnode(message),
    ]),
  };

  m.mount(container, Popup);
}

module.exports = {
  Sidebar,
  SidebarQuickView,
  popupMessage,
  closePopupMessage,
};
