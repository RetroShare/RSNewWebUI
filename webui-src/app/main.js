const m = require('mithril');

//  Bumped at every change of the web UI; shown in the rail, the phone header
//  and the Debug page.
const WEBUI_VERSION = 'v180';

const login = require('login');
const rs = require('rswebui');
const home = require('home');
const network = require('network/network');
const people = require('people/people_resolver');
const chat = require('chat/chat');
const mail = require('mail/mail_resolver');
const files = require('files/files_resolver');
const channels = require('channels/channels');
const forums = require('forums/forums');
const boards = require('boards/boards');
const config = require('config/config_resolver');
const statistics = require('statistics/statistics');
const debug = require('debug/debug');
const statusbar = require('statusbar');
const Dialog = require('dialog');
const networkState = require('network/network_state');
const peopleState = require('people/people_state');
const icon = require('icon');
const { ChatRoomsModel, receiveLobbyChatMessage } = require('chat/chat_state');

const sumCounts = (counts) => Object.values(counts || {})
  .reduce((total, count) => total + Number(count || 0), 0);

// Shared by the desktop rail, mobile tabs, and mobile More sheet.
// Count callbacks read current state on every render.
const navigationItems = [
  {
    name: 'home', href: '/home', label: 'Home',
    icon: 'home', mobile: 'primary',
  },
  {
    name: 'network', href: '/network', label: 'Network',
    icon: 'share-alt', mobile: 'primary',
    count: () => sumCounts(networkState.State.unreadChatCount),
  },
  {
    name: 'people', href: '/people/MyContacts', label: 'People',
    icon: 'users', mobile: 'primary',
    count: () => sumCounts(peopleState.State.unreadChatCount),
  },
  {
    name: 'chat', href: '/chat', label: 'Chat',
    icon: 'comments', mobile: 'primary',
    count: () => sumCounts(ChatRoomsModel.unreadCount) + ChatRoomsModel.invitationCount(),
  },
  {
    name: 'mail', href: '/mail/inbox', label: 'Mail',
    icon: 'envelope', mobile: 'primary',
    count: () => mail.Messages.unreadCount(),
  },
  {
    name: 'files', href: '/files/files', label: 'Files',
    icon: 'folder-open', mobile: 'more',
  },
  {
    name: 'channels', href: '/channels/MyChannels', label: 'Channels',
    icon: 'tv', mobile: 'more',
  },
  {
    name: 'forums', href: '/forums/MyForums', label: 'Forums',
    icon: 'bullhorn', mobile: 'more',
  },
  {
    name: 'boards', href: '/boards/MyBoards', label: 'Boards',
    icon: 'globe', mobile: 'more',
  },
  {
    name: 'statistics', href: '/statistics', label: 'Statistics',
    icon: 'chart-pie', mobile: 'more',
  },
  {
    name: 'config', href: '/config/network', label: 'Config',
    icon: 'cogs', mobile: 'more',
  },
  {
    name: 'debug', href: '/debug', label: 'Debug',
    icon: 'bug', mobile: 'more',
  },
];

const mobileItems = navigationItems.filter((item) => item.mobile === 'primary');
const mobileMoreItems = navigationItems.filter((item) => item.mobile === 'more');

function navigationContent(item) {
  const count = item.count ? item.count() : 0;
  return [
    icon(item.icon, { class: 'sidenav-icon', size: 19 }),
    m('span.nav-menu__label', item.label),
    count > 0 && m('b.nav-unread-badge', count),
  ];
}

// The collapse survives a reload; a closure variable would not.
const NAV_KEY = 'rs.webui.nav.collapsed';

function readCollapsed() {
  try {
    const stored = window.localStorage.getItem(NAV_KEY);
    if (stored !== null) return stored === 'true';
  } catch (e) {
    // Private windows and blocked site data throw on access. Fall through to
    // the width default rather than failing to render the sidebar.
  }
  // No stored choice: expanded on a wide screen, a rail below it. The old
  // default was collapsed always, which hid all twelve destination names
  // behind unlabelled icons on a first run.
  return window.innerWidth < 1280;
}

function writeCollapsed(value) {
  try {
    window.localStorage.setItem(NAV_KEY, String(value));
  } catch (e) {
    // Not being able to remember the choice is not a reason to refuse it.
  }
}

const navbar = () => {
  let isCollapsed = readCollapsed();

  const toggle = () => {
    isCollapsed = !isCollapsed;
    writeCollapsed(isCollapsed);
  };

  return {
    view: () =>
      m(
        'nav.nav-menu',
        {
          class: isCollapsed ? 'collapsed' : '',
          'aria-label': 'Main',
        },
        [
          m('.nav-menu__logo', [
            m('img.nav-menu__mark', { src: 'images/retroshare.svg', alt: '' }),
            m('.nav-menu__logo-text', [m('h5', 'RetroShare')]),
          ]),
          m('.nav-menu__box', { style: { flex: 1 } }, [
            navigationItems.map((item) => {
              const active = m.route.get().split('/')[1] === item.name;
              return m(
                m.route.Link,
                {
                  href: item.href,
                  class: (active ? 'active-link' : '') + ' item',
                  'aria-current': active ? 'page' : undefined,
                  title: isCollapsed ? item.label : undefined,
                },
                navigationContent(item)
              );
            }),
          ]),
          m('.nav-menu__footer', [
            m(
              'button.nav-menu__action[type=button]',
              { onclick: () => window.location.reload(true), title: 'Reload the web UI' },
              [icon('sync-alt', { class: 'sidenav-icon', size: 19 }), m('span.nav-menu__label', 'Reload')]
            ),
            m(
              'button.nav-menu__action[type=button]',
              { onclick: () => rs.logout(), title: 'Log out' },
              [icon('sign-out-alt', { class: 'sidenav-icon', size: 19 }), m('span.nav-menu__label', 'Log out')]
            ),
            // Pinned, and always visible: behind .nav-menu:hover it is
            // unreachable on touch and undiscoverable on a pointer.
            m(
              'button.nav-menu__toggle[type=button]',
              {
                onclick: toggle,
                'aria-expanded': String(!isCollapsed),
                title: isCollapsed ? 'Expand sidebar' : 'Collapse sidebar',
              },
              [
                icon('angle-double-left', { class: 'sidenav-icon', size: 19 }),
                m('span.nav-menu__label', 'Collapse'),
              ]
            ),
          ]),
        ]
      ),
  };
};

const MobileStatus = () => {
  let isOpen = false;
  return {
    view: () => {
      const state = statusbar.State;
      const summary = statusbar.getMobileStatusSummary();
      const isHiddenMode = state.hiddenType === 2 || state.hiddenType === 4;
      return [
        m('.mobile-app-header', [
          m('.mobile-app-header__brand', [
            m('img', { src: 'images/retroshare.svg', alt: '' }),
            m('strong', 'RetroShare'),
            m('span.mobile-app-header__version', WEBUI_VERSION),
          ]),
          m('button.mobile-status-trigger[type=button]', {
            'aria-label': `Open connection status. ${summary.label}`,
            'aria-expanded': String(isOpen),
            'aria-haspopup': 'dialog',
            onclick: () => (isOpen = true),
          }, [
            m('span.mobile-status-trigger__dot', { class: `is-${summary.tone}` }),
            m('span', `${state.onlineCount}/${state.friendCount}`),
            icon('chevron-up'),
          ]),
        ]),
        isOpen && m(Dialog, {
          label: 'Connection status',
          overlayClass: 'mobile-status-overlay',
          sheetClass: 'mobile-status-sheet',
          onclose: () => (isOpen = false),
        }, [
          m('.mobile-status-sheet__handle'),
          m('.mobile-status-sheet__heading', [
            m('div', [
              m('span.mobile-status-trigger__dot', { class: `is-${summary.tone}` }),
              m('strong', summary.label),
            ]),
            m('button.is-icon[type=button][aria-label=Close status]', {
              onclick: () => (isOpen = false),
            }, icon('times')),
          ]),
          m('.mobile-status-sheet__grid', [
            m('.mobile-status-sheet__item', [m('span', 'Friends online'), m('strong', `${state.onlineCount}/${state.friendCount}`)]),
            isHiddenMode
              ? m('.mobile-status-sheet__item', [
                  m('span', state.hiddenType === 2 ? 'Tor' : 'I2P'),
                  m('strong', state.torChecking ? 'Checking' : state.torProxyOk ? 'Ready' : 'Unavailable'),
                ])
              : [
                  m('.mobile-status-sheet__item', [m('span', 'NAT'), m('strong', summary.label)]),
                  m('.mobile-status-sheet__item', [m('span', 'DHT'), m('strong', state.dhtActive ? state.dhtOk ? 'Connected' : 'Searching' : 'Disabled')]),
                ],
            m('.mobile-status-sheet__item', [
              m('span', [icon('arrow-down'), ' Download']),
              m('strong', `${state.rateIn.toFixed(1)} kB/s`),
              m('small', statusbar.formatBytes(state.totalIn)),
            ]),
            m('.mobile-status-sheet__item', [
              m('span', [icon('arrow-up'), ' Upload']),
              m('strong', `${state.rateOut.toFixed(1)} kB/s`),
              m('small', statusbar.formatBytes(state.totalOut)),
            ]),
          ]),
          m('.mobile-status-sheet__version', [
            'WebUI ' + WEBUI_VERSION,
            //  The page keeps the code it loaded until it is reloaded, and a
            //  phone browser hides that action away. A new build shows up
            //  here only after this.
            m('button[type=button]', {
              onclick: () => window.location.reload(true),
            }, [icon('sync-alt'), ' Reload']),
          ]),
        ]),
      ];
    },
  };
};

const MobileNavigation = () => {
  let isMoreOpen = false;
  const routeName = () => m.route.get().split('/')[1];
  const link = (item, className = '') => m(m.route.Link, {
    href: item.href,
    class: `${className}${routeName() === item.name ? ' active' : ''}`.trim(),
    onclick: () => (isMoreOpen = false),
  }, navigationContent(item));

  return {
    view: () => [
      isMoreOpen && m(Dialog, {
        label: 'More navigation',
        overlayClass: 'mobile-more-overlay',
        sheetClass: 'mobile-more-sheet',
        onclose: () => (isMoreOpen = false),
      }, [
        m('.mobile-more-sheet__handle'),
        m('h3', 'More'),
        m('.mobile-more-sheet__links', mobileMoreItems.map((item) => link(item))),
        m('.mobile-more-sheet__actions', [
          m('button[type=button]', { onclick: () => (isMoreOpen = false) }, [icon('check'), 'Close']),
          m('button[type=button]', { onclick: () => window.location.reload(true) }, [icon('sync-alt'), ' Reload']),
          m('button[type=button]', { onclick: () => rs.logout() }, [icon('sign-out-alt'), ' Logout']),
        ]),
      ]),
      m('nav.mobile-bottom-nav[aria-label=Main navigation]', [
        mobileItems.map((item) => link(item, 'mobile-bottom-nav__item')),
        m('button.mobile-bottom-nav__item[type=button]', {
          class: isMoreOpen || mobileMoreItems.some((item) => item.name === routeName()) ? 'active' : '',
          'aria-expanded': String(isMoreOpen),
          'aria-haspopup': 'dialog',
          onclick: () => (isMoreOpen = !isMoreOpen),
          //  Same mark size and same label element as navigationContent gives
          //  the real links, or More sits lower than the five beside it and
          //  its label is clipped by the bar.
        }, [icon('bars', { class: 'sidenav-icon', size: 19 }), m('span.nav-menu__label', 'More')]),
      ]),
    ],
  };
};

const Layout = () => {
  return {
    oninit: () => {
      mail.Messages.load();
      [rs.RsEventsType.MAIL_STATUS, rs.RsEventsType.MAIL_TAG].forEach((eventType) => {
        if (!rs.events[eventType]) {
          rs.events[eventType] = {
            handler: (event, owner) => owner.notify(event),
            notify: () => {},
          };
        }
        rs.events[eventType].notify = () => mail.Messages.refreshSoon();
      });
      if (!rs.events[15]) return;
      rs.events[15].notify = (messageOrEvent) => {
        if (messageOrEvent && messageOrEvent.mEventCode !== undefined) {
          ChatRoomsModel.receiveAdministrativeEvent(messageOrEvent);
          return;
        }
        networkState.receiveDirectChatMessage(messageOrEvent);
        peopleState.receiveDistantChatMessage(messageOrEvent);
        receiveLobbyChatMessage(messageOrEvent);
      };
    },
    view: (vnode) =>
      m('.content', [
        m(navbar),
        m(
          '.main-container',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              height: '100%',
              overflow: 'hidden',
            },
          },
          [
            m(MobileStatus),
            m('.tab-content', { style: { flex: '1', overflow: 'auto' } }, vnode.children),
            m(statusbar, { version: WEBUI_VERSION }),
            m(MobileNavigation),
          ]
        ),
      ]),
  };
};

m.route(document.getElementById('main'), '/', {
  '/': {
    render: () => m(login),
  },
  '/home': {
    render: () => m(Layout, m(home)),
  },
  '/network': {
    render: () => m(Layout, m(network)),
  },

  '/people/:tab': {
    render: (v) => m(Layout, m(people, v.attrs)),
  },
  '/chat/:lobby/:subaction': {
    render: (v) => m(Layout, m(chat, v.attrs)),
  },
  '/chat/:lobby': {
    render: (v) => m(Layout, m(chat, v.attrs)),
  },
  '/chat': {
    render: () => m(Layout, m(chat)),
  },
  '/mail/:tab': {
    render: (v) => m(Layout, m(mail, v.attrs)),
  },
  '/mail/:tab/:msgId': {
    render: (v) => m(Layout, m(mail, v.attrs)),
  },
  '/files/:tab': {
    render: (v) => m(Layout, m(files, v.attrs)),
  },
  '/files/:tab/:resultId': {
    render: (v) => m(Layout, m(files, v.attrs)),
  },
  '/channels/:tab': {
    render: (v) => m(Layout, m(channels, v.attrs)),
  },
  '/channels/:tab/:mGroupId': {
    render: (v) => m(Layout, m(channels, v.attrs)),
  },
  '/channels/:tab/:mGroupId/:mMsgId': {
    render: (v) => m(Layout, m(channels, v.attrs)),
  },
  '/forums/:tab': {
    render: (v) => m(Layout, m(forums, v.attrs)),
  },
  '/forums/:tab/:mGroupId': {
    render: (v) => m(Layout, m(forums, v.attrs)),
  },

  '/forums/:tab/:mGroupId/:mMsgId': {
    render: (v) => m(Layout, m(forums, v.attrs)),
  },
  '/boards/:tab': {
    render: (v) => m(Layout, m(boards, v.attrs)),
  },
  '/boards/:tab/:mGroupId': {
    render: (v) => m(Layout, m(boards, v.attrs)),
  },
  '/boards/:tab/:mGroupId/:mMsgId': {
    render: (v) => m(Layout, m(boards, v.attrs)),
  },
  '/config/:tab': {
    render: (v) => m(Layout, m(config, v.attrs)),
  },
  '/statistics': {
    render: () => m(Layout, m(statistics)),
  },
  '/debug': {
    render: () => m(Layout, m(debug, { version: WEBUI_VERSION })),
  },
});

// v51 architectural fix: ensure event queue starts on direct route refresh
if (rs.loginKey.isVerified && rs.loginKey.username && rs.loginKey.passwd) {
  rs.logon(
    { Authorization: `Basic ${btoa(`${rs.loginKey.username}:${rs.loginKey.passwd}`)}` },
    () => {}, // displayAuthError
    () => {}, // displayErrorMessage
    () => {}
  );
}
