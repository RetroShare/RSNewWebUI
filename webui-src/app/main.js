const m = require('mithril');

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
const statusbar = require('statusbar');

const navIcon = {
  home: m('i.fas.fa-home.sidenav-icon'),
  network: m('i.fas.fa-share-alt.sidenav-icon'),
  people: m('i.fas.fa-users.sidenav-icon'),
  chat: m('i.fas.fa-comments.sidenav-icon'),
  mail: m('i.fas.fa-envelope.sidenav-icon'),
  files: m('i.fas.fa-folder-open.sidenav-icon'),
  channels: m('i.fas.fa-tv.sidenav-icon'),
  forums: m('i.fas.fa-bullhorn.sidenav-icon'),
  boards: m('i.fas.fa-globe.sidenav-icon'),
  config: m('i.fas.fa-cogs.sidenav-icon'),
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
                  marginRight: '10px',
                },
              },
              [
                m('img', {
                  src: 'images/retroshare.svg',
                  alt: 'retroshare_icon',
                }),
                m('i.fas.fa-circle', {
                  style: {
                    color: rs.connectionState.status ? '#2ecc71' : '#e74c3c',
                    fontSize: '0.6em',
                    marginTop: '5px',
                    transition: 'color 0.3s ease',
                  },
                  title: rs.connectionState.status ? 'Connected to RetroShare Core' : 'Connection Lost',
                }),
                m('span.webui-version', { style: { fontSize: '0.7em', marginTop: '3px', color: '#888' } }, 'v131'),
                m('i.fas.fa-sync-alt.refresh-icon', {
                  style: { fontSize: '0.8em', marginTop: '2px', cursor: 'pointer', color: '#888' },
                  onclick: () => window.location.reload(true),
                  title: 'Force reload application',
                }),
              ]
            ),
            m('.nav-menu__logo-text', [
              m('h5', 'RetroShare'),
            ]),
          ]),
          m('.nav-menu__box', [
            Object.keys(vnode.attrs.links).map((linkName) => {
              const active = m.route.get().split('/')[1] === linkName;
              return m(
                m.route.Link,
                {
                  href: vnode.attrs.links[linkName],
                  class: (active ? 'active-link' : '') + ' item',
                },
                [
                  navIcon[linkName],
                  m('span', linkName.charAt(0).toUpperCase() + linkName.slice(1)),
                ]
              );
            }),
            m(
              'a.logout-link.item',
              {
                onclick: () => rs.logout(),
                style: { marginTop: 'auto', cursor: 'pointer' },
              },
              [m('i.fas.fa-sign-out-alt'), m('span', 'Logout')]
            ),
            m(
              'button.toggle-nav',
              {
                onclick: () => (isCollapsed = !isCollapsed),
              },
              m('i.fas.fa-angle-double-left')
            ),
          ]),
        ]
      ),
  };
};

const Layout = () => {
  return {
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
            config: '/config/network',
          },
        }),
        m('.main-container', { style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' } }, [
          m('.tab-content', { style: { flex: '1', overflow: 'auto' } }, vnode.children),
          m(statusbar)
        ]),
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
});

// v51 architectural fix: ensure event queue starts on direct route refresh
if (rs.loginKey.isVerified && rs.loginKey.username && rs.loginKey.passwd) {
  rs.logon(
    { Authorization: `Basic ${btoa(`${rs.loginKey.username}:${rs.loginKey.passwd}`)}` },
    () => { }, // displayAuthError
    () => { }, // displayErrorMessage
    () => { }
  );
}
