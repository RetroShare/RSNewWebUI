let m = require('mithril');
let rs = require('rswebui');
let util = require('mail_util');
let widget = require('widgets');


const Messages = {
  all: [],
  inbox: [],
  sent: [],
  outbox: [],
  drafts: [],
  load() {
    rs.rsJsonApiRequest('/rsMsgs/getMessageSummaries', {},
      (data) => {
        Messages.all = data.msgList
        // RS_MSG_BOXMASK = 0x000f
        // RS_MSG_INBOX
        Messages.inbox = Messages.all.filter(
          (msg) => (msg.msgflags & 0x000f) === 0);
        // RS_MSG_SENTBOX
        Messages.sent = Messages.all.filter(
          (msg) => (msg.msgflags & 0x000f) === 1);
        // RS_MSG_OUTBOX
        Messages.outbox = Messages.all.filter(
          (msg) => (msg.msgflags & 0x000f) === 3);
        // RS_MSG_DRAFTBOX
        Messages.drafts = Messages.all.filter(
          (msg) => (msg.msgflags & 0x000f) === 5);
      });
  },
}

let sections = {
  inbox: require('mail_inbox'),
  outbox: require('mail_outbox'),
  drafts: require('mail_draftbox'),
  sent: require('mail_sentbox'),
};

const Layout = {
  oninit: Messages.load,
  view: vnode => m('.tab-page', [
    m(widget.Sidebar, {
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
    if(v.attrs.hasOwnProperty('msgId')) {
      return m(Layout, m(util.MessageView, {
        id: v.attrs.msgId,
      }))
    }
    return m(Layout, m(sections[tab], {
      list: Messages[tab],
    }));
  },
};

