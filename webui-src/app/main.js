const m = require('mithril');

const login = require('login');
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
  let toggleNav = false;
  return {
    view: (vnode) =>
      m('nav.menu', {}, [
        m(
          '.menu__logo',
          {
            style: { width: toggleNav ? '25px' : '130px' },
          },
          [
            m('img', {
              src: '../data/retroshare.svg',
              alt: 'retroshare_icon',
            }),
            m(
              'h4',
              {
                style: { display: toggleNav ? 'none' : 'block' },
              },
              'Retroshare'
            ),
          ]
        ),
        m('.menu__box', [
          Object.keys(vnode.attrs.links).map((linkName, i) => {
            const active = m.route.get().split('/')[1] === linkName;
            return m(
              m.route.Link,
              {
                href: vnode.attrs.links[linkName],
                class: 'item' + (active ? ' item-selected' : ''),
                style: { width: toggleNav ? '2.25rem' : '10rem' },
              },
              [
                navIcon[linkName],
                m(
                  'p[style="margin: 0; align-self: end"]',
                  {
                    style: { display: toggleNav ? 'none' : 'block' },
                  },
                  linkName
                ),
              ]
            );
          }),
          m(
            'button.toggle-nav',
            {
              onclick: () => (toggleNav = !toggleNav),
            },
            m('i.fas.fa-angle-double-right', {
              style: { rotate: toggleNav ? '0deg' : '180deg' },
            })
          ),
        ]),
      ]),
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
            people: '/people/OwnIdentity',
            chat: '/chat',
            mail: '/mail/inbox',
            files: '/files/files',
            channels: '/channels/MyChannels',
            forums: '/forums/MyForums',
            boards: '/boards/MyBoards',
            config: '/config/network',
          },
        }),
        m('#tab-content', vnode.children),
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
