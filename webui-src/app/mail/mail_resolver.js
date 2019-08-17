let m = require('mithril');
let rs = require('rswebui');
let util = require('mail_util');


const Messages = {
  all: [],
  inbox: [],
  sentbox: [],
  outbox: [],
  draftbox: [],
  load() {
    rs.rsJsonApiRequest('/rsMsgs/getMessageSummaries', {},
      (data) => {
        Messages.all = data.msgList
        // RS_MSG_BOXMASK = 0x000f
        // RS_MSG_INBOX
        Messages.inbox = Messages.all.filter(
          (msg) => (msg.msgflags & 0x000f) === 0);
        // RS_MSG_SENTBOX
        Messages.sentbox = Messages.all.filter(
          (msg) => (msg.msgflags & 0x000f) === 1);
        // RS_MSG_OUTBOX
        Messages.outbox = Messages.all.filter(
          (msg) => (msg.msgflags & 0x000f) === 3);
        // RS_MSG_DRAFTBOX
        Messages.draftbox = Messages.all.filter(
          (msg) => (msg.msgflags & 0x000f) === 5);
      });
  },
}

let sections = {
  inbox: require('mail_inbox'),
  outbox: require('mail_outbox'),
};

const sidebar = () => {
  let active = 0;
  return {
    view: (v) => m('.sidebar',
      v.attrs.tabs.map((panelName, index) => m('a', {
          href: v.attrs.baseRoute + panelName,
          oncreate: m.route.link,
          class: index === active ?
            'selected-sidebar-link' : '',
          onclick: function() {
            active = index;
          },
        },
        panelName)),
    ),
  };
};

const Layout = {
  oninit: Messages.load,
  view: vnode => m('.tab-page', [
    m(sidebar, {
      tabs: Object.keys(sections),
      baseRoute: '/mail/',
    }),
    m('.node-panel', vnode.children),
  ])
};

module.exports = {
  view: (v) => {
    const tab = v.attrs.tab;
    // TODO: utilize multiple routing params
    if(tab.startsWith('id=')) {
      return m(Layout, m(util.MessageView, {
        id: v.attrs.tab.slice(3)
      }))
    }
    return m(Layout, m(sections[tab], {
      list: Messages[tab],
    }));
  },
};

