const m = require('mithril');

//  Bumped at every change of the web UI; shown in the rail, the phone header
//  and the Debug page.
const WEBUI_VERSION = 'v176';

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
const feedreader = require('feedreader/feedreader');
const config = require('config/config_resolver');
const statistics = require('statistics/statistics');
const debug = require('debug/debug');
const statusbar = require('statusbar');
const Dialog = require('dialog');
const networkState = require('network/network_state');
const peopleState = require('people/people_state');
const { ChatRoomsModel, receiveLobbyChatMessage } = require('chat/chat_state');

const sumCounts = (counts) => Object.values(counts || {})
  .reduce((total, count) => total + Number(count || 0), 0);

// Shared by the desktop rail, mobile tabs, and mobile More sheet.
// Count callbacks read current state on every render.
const navigationItems = [
  {
    name: 'home', href: '/home', label: 'Home',
    icon: 'i.fas.fa-home.sidenav-icon', mobile: 'primary',
  },
  {
    name: 'network', href: '/network', label: 'Network',
    icon: 'i.fas.fa-share-alt.sidenav-icon', mobile: 'primary',
    count: () => sumCounts(networkState.State.unreadChatCount),
  },
  {
    name: 'people', href: '/people/MyContacts', label: 'People',
    icon: 'i.fas.fa-users.sidenav-icon', mobile: 'primary',
    count: () => sumCounts(peopleState.State.unreadChatCount),
  },
  {
    name: 'chat', href: '/chat', label: 'Chat',
    icon: 'i.fas.fa-comments.sidenav-icon', mobile: 'primary',
    count: () => sumCounts(ChatRoomsModel.unreadCount) + ChatRoomsModel.invitationCount(),
  },
  {
    name: 'mail', href: '/mail/inbox', label: 'Mail',
    icon: 'i.fas.fa-envelope.sidenav-icon', mobile: 'primary',
    count: () => mail.Messages.unreadCount(),
  },
  {
    name: 'files', href: '/files/files', label: 'Files',
    icon: 'i.fas.fa-folder-open.sidenav-icon', mobile: 'more',
  },
  {
    name: 'channels', href: '/channels/MyChannels', label: 'Channels',
    icon: 'i.fas.fa-tv.sidenav-icon', mobile: 'more',
  },
  {
    name: 'forums', href: '/forums/MyForums', label: 'Forums',
    icon: 'i.fas.fa-bullhorn.sidenav-icon', mobile: 'more',
  },
  {
    name: 'boards', href: '/boards/MyBoards', label: 'Boards',
    icon: 'i.fas.fa-globe.sidenav-icon', mobile: 'more',
  },
  {
    name: 'feedreader', href: '/feedreader', label: 'FeedReader',
    icon: 'i.fas.fa-rss.sidenav-icon', mobile: 'more',
  },
  {
    name: 'statistics', href: '/statistics', label: 'Statistics',
    icon: 'i.fas.fa-chart-pie.sidenav-icon', mobile: 'more',
  },
  {
    name: 'config', href: '/config/network', label: 'Config',
    icon: 'i.fas.fa-cogs.sidenav-icon', mobile: 'more',
  },
  {
    name: 'debug', href: '/debug', label: 'Debug',
    icon: 'i.fas.fa-bug.sidenav-icon', mobile: 'more',
  },
];

const mobileItems = navigationItems.filter((item) => item.mobile === 'primary');
const mobileMoreItems = navigationItems.filter((item) => item.mobile === 'more');

function navigationContent(item) {
  const count = item.count ? item.count() : 0;
  return [
    m(item.icon),
    m('span', item.label),
    count > 0 && m('b.nav-unread-badge', count),
  ];
}

const navbar = () => {
  let isCollapsed = true;
  return {
    view: () =>
      m(
        'nav.nav-menu',
        {
          class: isCollapsed ? 'collapsed' : '',
        },
        [
          m('.nav-menu__logo', [
            m(
              '.logo-container',
              {
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  marginRight: isCollapsed ? 0 : '10px',
                },
              },
              [
                m('img', {
                  src: 'images/retroshare.svg',
                  alt: 'retroshare_icon',
                }),
              ]
            ),
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
                },
                navigationContent(item)
              );
            }),
            m(
              'button.toggle-nav',
              {
                onclick: () => (isCollapsed = !isCollapsed),
              },
              m('i.fas.fa-angle-double-left')
            ),
          ]),
          m(
            '.nav-menu__footer',
            {
              style: {
                marginTop: 'auto',
                padding: '0.75rem 0 0',
                color: '#888',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
              },
            },
            [
              m(
                '.nav-menu__status',
                {
                  style: {
                    display: 'flex',
                    flexDirection: isCollapsed ? 'column' : 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: isCollapsed ? '0.35rem' : '0.6rem',
                  },
                },
                [
                  m('i.fas.fa-circle', {
                    style: {
                      color: rs.connectionState.status ? '#2ecc71' : '#e74c3c',
                      fontSize: '0.6em',
                      transition: 'color 0.3s ease',
                    },
                    title: rs.connectionState.status
                      ? 'Connected to RetroShare Core'
                      : 'Connection Lost',
                  }),
                  m('span.webui-version', { style: { fontSize: '0.7em' } }, WEBUI_VERSION),
                  m('i.fas.fa-sync-alt.refresh-icon', {
                    style: { cursor: 'pointer', fontSize: '0.8em' },
                    onclick: () => window.location.reload(true),
                    title: 'Force reload application',
                  }),
                ]
              ),
              m(
                'a.logout-link.item',
                {
                  onclick: () => rs.logout(),
                  style: {
                    cursor: 'pointer',
                    margin: 0,
                    padding: isCollapsed ? '0.675rem 0' : '0.675rem 0.5rem',
                    width: isCollapsed ? '2.5rem' : '10rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    lineHeight: 1,
                    borderRadius: '0.5rem',
                    textDecoration: 'none',
                    color: '#ccc',
                    textTransform: 'capitalize',
                  },
                },
                [
                  m('i.fas.fa-sign-out-alt.sidenav-icon', {
                    style: {
                      width: '2.5rem',
                      height: '1.4rem',
                      display: 'grid',
                      placeItems: 'center',
                    },
                  }),
                  !isCollapsed && m('span', 'Logout'),
                ]
              ),
            ]
          ),
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
            m('span.mobile-status-trigger__dot', { style: { backgroundColor: summary.color } }),
            m('span', `${state.onlineCount}/${state.friendCount}`),
            m('i.fas.fa-chevron-up'),
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
              m('span.mobile-status-trigger__dot', { style: { backgroundColor: summary.color } }),
              m('strong', summary.label),
            ]),
            m('button[type=button][aria-label=Close status]', {
              onclick: () => (isOpen = false),
            }, m('i.fas.fa-times')),
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
              m('span', [m('i.fas.fa-arrow-down'), ' Download']),
              m('strong', `${state.rateIn.toFixed(1)} kB/s`),
              m('small', statusbar.formatBytes(state.totalIn)),
            ]),
            m('.mobile-status-sheet__item', [
              m('span', [m('i.fas.fa-arrow-up'), ' Upload']),
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
            }, [m('i.fas.fa-sync-alt'), ' Reload']),
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
          m('button[type=button]', { onclick: () => (isMoreOpen = false) }, 'Close'),
          m('button[type=button]', { onclick: () => window.location.reload(true) }, [m('i.fas.fa-sync-alt'), ' Reload']),
          m('button[type=button]', { onclick: () => rs.logout() }, [m('i.fas.fa-sign-out-alt'), ' Logout']),
        ]),
      ]),
      m('nav.mobile-bottom-nav[aria-label=Main navigation]', [
        mobileItems.map((item) => link(item, 'mobile-bottom-nav__item')),
        m('button.mobile-bottom-nav__item[type=button]', {
          class: isMoreOpen || mobileMoreItems.some((item) => item.name === routeName()) ? 'active' : '',
          'aria-expanded': String(isMoreOpen),
          'aria-haspopup': 'dialog',
          onclick: () => (isMoreOpen = !isMoreOpen),
        }, [m('i.fas.fa-bars.sidenav-icon'), m('span', 'More')]),
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
            m(statusbar),
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
  '/feedreader': {
    render: () => m(Layout, m(feedreader)),
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
