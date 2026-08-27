const m = require('mithril');
const theme = require('theme');

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
const statusbar = require('statusbar');
const networkState = require('network/network_state');
const peopleState = require('people/people_state');
const { ChatRoomsModel, receiveLobbyChatMessage } = require('chat/chat_state');

const sumCounts = (counts) => Object.values(counts || {})
  .reduce((total, count) => total + Number(count || 0), 0);

function navigationCount(name) {
  if (name === 'network') return sumCounts(networkState.State.unreadChatCount);
  if (name === 'people') return sumCounts(peopleState.State.unreadChatCount);
  if (name === 'chat') {
    return sumCounts(ChatRoomsModel.unreadCount) + ChatRoomsModel.invitationCount();
  }
  if (name === 'mail') return mail.Messages.unreadCount();
  return 0;
}

const navIcon = {
  home: 'i.fas.fa-home.sidenav-icon',
  network: 'i.fas.fa-share-alt.sidenav-icon',
  people: 'i.fas.fa-users.sidenav-icon',
  chat: 'i.fas.fa-comments.sidenav-icon',
  mail: 'i.fas.fa-envelope.sidenav-icon',
  files: 'i.fas.fa-folder-open.sidenav-icon',
  channels: 'i.fas.fa-tv.sidenav-icon',
  forums: 'i.fas.fa-bullhorn.sidenav-icon',
  boards: 'i.fas.fa-globe.sidenav-icon',
  config: 'i.fas.fa-cogs.sidenav-icon',
  statistics: 'i.fas.fa-chart-pie.sidenav-icon',
};

const navbar = () => {
  let isCollapsed = true;
  return {
    view: (vnode) =>
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
            Object.keys(vnode.attrs.links).map((linkName) => {
              const active = m.route.get().split('/')[1] === linkName;
              const count = navigationCount(linkName);
              return m(
                m.route.Link,
                {
                  href: vnode.attrs.links[linkName],
                  class: (active ? 'active-link' : '') + ' item',
                },
                [
                  m(navIcon[linkName]),
                  m('span', linkName.charAt(0).toUpperCase() + linkName.slice(1)),
                  count > 0 && m('b.nav-unread-badge', count),
                ]
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
              m(theme.ThemeToggle),
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
                  m('span.webui-version', { style: { fontSize: '0.7em' } }, 'v154'),
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

const mobileLinks = {
  home: '/home',
  network: '/network',
  people: '/people/MyContacts',
  chat: '/chat',
  mail: '/mail/inbox',
};

const mobileMoreLinks = {
  files: '/files/files',
  channels: '/channels/MyChannels',
  forums: '/forums/MyForums',
  boards: '/boards/MyBoards',
  config: '/config/network',
  statistics: '/statistics',
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
          ]),
          m('button.mobile-status-trigger[type=button]', {
            'aria-label': `Open connection status. ${summary.label}`,
            'aria-expanded': String(isOpen),
            onclick: () => (isOpen = true),
          }, [
            m('span.mobile-status-trigger__dot', { style: { backgroundColor: summary.color } }),
            m('span', `${state.onlineCount}/${state.friendCount}`),
            m('i.fas.fa-chevron-up'),
          ]),
        ]),
        isOpen && m('.mobile-status-overlay', {
          onclick: (event) => {
            if (event.target === event.currentTarget) isOpen = false;
          },
        }, m('.mobile-status-sheet', [
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
          m('.mobile-status-sheet__version', 'WebUI v154'),
        ])),
      ];
    },
  };
};

const MobileNavigation = () => {
  let isMoreOpen = false;
  const routeName = () => m.route.get().split('/')[1];
  const link = (name, href) => m(m.route.Link, {
    href,
    class: `mobile-bottom-nav__item${routeName() === name ? ' active' : ''}`,
    onclick: () => (isMoreOpen = false),
  }, [
    m(navIcon[name]),
    m('span', name.charAt(0).toUpperCase() + name.slice(1)),
    navigationCount(name) > 0 && m('b.nav-unread-badge', navigationCount(name)),
  ]);

  return {
    view: () => [
      isMoreOpen && m('.mobile-more-overlay', {
        onclick: (event) => {
          if (event.target === event.currentTarget) isMoreOpen = false;
        },
      }, m('.mobile-more-sheet', [
        m('.mobile-more-sheet__handle'),
        m('h3', 'More'),
        m('.mobile-more-sheet__links', Object.entries(mobileMoreLinks).map(([name, href]) =>
          m(m.route.Link, {
            href,
            class: routeName() === name ? 'active' : '',
            onclick: () => (isMoreOpen = false),
          }, [m(navIcon[name]), m('span', name.charAt(0).toUpperCase() + name.slice(1))])
        )),
        m('.mobile-more-sheet__actions', [
          m(theme.ThemeToggle),
          m('button[type=button]', { onclick: () => window.location.reload(true) }, [m('i.fas.fa-sync-alt'), ' Reload']),
          m('button[type=button]', { onclick: () => rs.logout() }, [m('i.fas.fa-sign-out-alt'), ' Logout']),
        ]),
      ])),
      m('nav.mobile-bottom-nav[aria-label=Main navigation]', [
        Object.entries(mobileLinks).map(([name, href]) => link(name, href)),
        m('button.mobile-bottom-nav__item[type=button]', {
          class: isMoreOpen || Object.keys(mobileMoreLinks).includes(routeName()) ? 'active' : '',
          'aria-expanded': String(isMoreOpen),
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
        m(navbar, {
          links: {
            home: '/home',
            network: '/network',
            people: '/people/MyContacts',
            chat: '/chat',
            mail: '/mail/inbox',
            files: '/files/files',
            channels: '/channels/MyChannels',
            forums: '/forums/MyForums',
            boards: '/boards/MyBoards',
            statistics: '/statistics',
            config: '/config/network',
          },
        }),
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
    render: () => [m('.login-theme-control', m(theme.ThemeToggle)), m(login)],
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
