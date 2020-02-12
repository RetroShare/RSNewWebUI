const m = require('mithril');

const login = require('login');
const home = require('home');
const network = require('network/network');
const people = require('people/people');
const chat = require('chat/chat');
const mail = require('mail/mail_resolver');
const files = require('files/files_resolver');
const channels = require('channels/channels');
const config = require('config/config_resolver');

const navIcon = {
  home: m('i.fas.fa-home'),
  network: m('i.fas.fa-share-alt'),
  people: m('i.fas.fa-users'),
  chat: m('i.fas.fa-comments'),
  mail: m('i.fas.fa-envelope'),
  files: m('i.fas.fa-folder-open'),
  channels: m('i.fas.fa-tv'),
  config: m('i.fas.fa-cogs')
};

const navbar = () => {
  let active = 0;
  return {
    view: vnode =>
      m(
        'nav.tab-menu',
        Object.keys(vnode.attrs.links).map((linkName, i) =>
          m(
            m.route.Link,
            {
              href: vnode.attrs.links[linkName],
              class:
                (active === i ? 'selected-tab-item' : '') + ' tab-menu-item',
              onclick: () => (active = i)
            },
            [navIcon[linkName], linkName]
          )
        )
      )
  };
};

const Layout = () => {
  return {
    view: vnode =>
      m('.content', [
        m(navbar, {
          links: {
            home: '/home',
            network: '/network',
            people: '/people',
            chat: '/chat',
            mail: '/mail/inbox',
            files: '/files/files',
            channels: '/channels',
            config: '/config/network'
          }
        }),
        m('#tab-content', vnode.children)
      ])
  };
};

m.route(document.getElementById('main'), '/', {
  '/': {
    render: () => m(login)
  },
  '/home': {
    render: () => m(Layout, m(home))
  },
  '/network': {
    render: () => m(Layout, m(network))
  },
  '/people': {
    render: () => m(Layout, m(people))
  },
  '/chat': {
    render: () => m(Layout, m(chat))
  },
  '/chat/:lobby': {
    render: v => m(Layout, m(chat, v.attrs))
  },
  '/mail/:tab': {
    render: v => m(Layout, m(mail, v.attrs))
  },
  '/mail/:tab/:msgId': {
    render: v => m(Layout, m(mail, v.attrs))
  },
  '/files/:tab': {
    render: v => m(Layout, m(files, v.attrs))
  },
  '/channels': {
    render: () => m(Layout, m(channels))
  },
  '/config/:tab': {
    render: v => m(Layout, m(config, v.attrs))
  }
});
