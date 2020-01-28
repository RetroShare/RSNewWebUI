let m = require('mithril');
let login = require('login');
let rs = require('rswebui');


const navIcon = {
  home: m('i.fas.fa-home'),
  network: m('i.fas.fa-share-alt'),
  people: m('i.fas.fa-users'),
  chat: m('i.fas.fa-comments'),
  mail: m('i.fas.fa-envelope'),
  files: m('i.fas.fa-folder-open'),
  channels: m('i.fas.fa-tv'),
  config: m('i.fas.fa-cogs'),
};

const navbar = () => {
  active = 0;
  return {
    view: (vnode) => m('nav.tab-menu',
      Object.keys(vnode.attrs.links)
      .map((linkName, i) => m('a.tab-menu-item', {
        href: vnode.attrs.links[linkName],
        class: active === i ? 'selected-tab-item' : '',
        oncreate: m.route.link,
        onclick: () => {
          active = i
        },
      }, [navIcon[linkName], linkName])),
    ),
  };
};

const Layout = () => {
  return {
    view: (vnode) => m('.content', [
      m(navbar, {
        links: {
          home: '/home',
          network: '/network',
          people: '/people',
          chat: '/chat',
          mail: '/mail/inbox',
          files: '/files/files',
          channels: '/channels',
          config: '/config/network',
        },
      }),
      m('#tab-content', vnode.children),
    ]),
  };
};

function onSuccess() {
  let home = require('home');
  let network = require('network/network');
  let people = require('people/people');
  let chat = require('chat/chat');
  let mail = require('mail/mail_resolver');
  let files = require('files/files_resolver');
  let channels = require('channels/channels');
  let config = require('config/config_resolver');

  m.route(document.getElementById('main'), '/home', {
    '/home': {
      render: (v) => m(Layout, m(home))
    },
    '/network': {
      render: (v) => m(Layout, m(network))
    },
    '/people': {
      render: (v) => m(Layout, m(people))
    },
    '/chat': {
      render: (v) => m(Layout, m(chat))
    },
    '/chat/:lobby': {
      render: (v) => m(Layout, m(chat, v.attrs))
    },
    '/mail/:tab': {
      render: (v) => m(Layout, m(mail, v.attrs))
    },
    '/mail/:tab/:msgId': {
      render: (v) => m(Layout, m(mail, v.attrs))
    },
    '/files/:tab': {
      render: (v) => m(Layout, m(files, v.attrs))
    },
    '/channels': {
      render: (v) => m(Layout, m(channels))
    },
    '/config/:tab': {
      render: (v) => m(Layout, m(config, v.attrs))
    },
  });
};

login.renderLoginPage(onSuccess);

