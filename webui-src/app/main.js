let m = require('mithril');
let login = require('login');
let rs = require('rswebui');


const navIcon = {
  home: m('i.fas.fa-home'),
  network: m('i.fas.fa-share-alt'),
  chat: m('i.fas.fa-share-alt'),
  mail: m('i.fas.fa-envelope'),
  files: m('i.fas.fa-folder-open'),
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
          chat: '/chat',
          mail: '/mail/inbox',
          files: '/files',
          config: '/config/network',
        },
      }),
      m('#tab-content', vnode.children),
    ]),
  };
};

function onSuccess() {
  let home = require('home');
  let network = require('network');
  let chat = require('chat');
  let mail = require('mail_resolver');
  let files = require('files_resolver');
  let config = require('config_resolver');

  m.route(document.getElementById('main'), '/home', {
    '/home': {
      render: (v) => m(Layout, m(home))
    },
    '/network': {
      render: (v) => m(Layout, m(network))
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
    '/files': {
      render: (v) => m(Layout, m(files))
    },
    '/config/:tab': {
      render: (v) => m(Layout, m(config, v.attrs))
    },
  });
};

login.renderLoginPage(onSuccess);

