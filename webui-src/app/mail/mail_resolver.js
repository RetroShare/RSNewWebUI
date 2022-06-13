const m = require('mithril');
const rs = require('rswebui');
const util = require('mail/mail_util');
const widget = require('widgets');
const compose = require('mail/mail_compose');

const Messages = {
  all: [],
  inbox: [],
  sent: [],
  outbox: [],
  drafts: [],
  trash: [],
  starred: [],
  system: [],
  spam: [],
  important: [],
  work: [],
  personal: [],
  todo: [],
  later: [],
  load() {
    rs.rsJsonApiRequest('/rsMsgs/getMessageSummaries', {}, (data) => {
      Messages.all = data.msgList;
      Messages.inbox = Messages.all.filter(
        (msg) => (msg.msgflags & util.RS_MSG_BOXMASK) === util.RS_MSG_INBOX
      );
      Messages.sent = Messages.all.filter(
        (msg) => (msg.msgflags & util.RS_MSG_BOXMASK) === util.RS_MSG_SENTBOX
      );
      Messages.outbox = Messages.all.filter(
        (msg) => (msg.msgflags & util.RS_MSG_BOXMASK) === util.RS_MSG_OUTBOX
      );
      Messages.drafts = Messages.all.filter(
        (msg) => (msg.msgflags & util.RS_MSG_BOXMASK) === util.RS_MSG_DRAFTBOX
      );
      Messages.trash = Messages.all.filter(
        (msg) => (msg.msgflags & util.RS_MSG_TRASH)
      );
      Messages.starred = Messages.all.filter(
        (msg) => (msg.msgflags & util.RS_MSG_STAR)
       );
      Messages.system = Messages.all.filter(
        (msg) => (msg.msgflags & util.RS_MSG_SYSTEM)
        );
      Messages.spam = Messages.all.filter(
        (msg) => (msg.msgflags & util.RS_MSG_SPAM)
        );
      Messages.important = Messages.all.filter(
        (msg) => (msg.msgflags & util.RS_MSGTAGTYPE_IMPORTANT)
        );
      Messages.work = Messages.all.filter(
        (msg) => (msg.msgflags & util.RS_MSGTAGTYPE_WORK)
        );
      Messages.personal = Messages.all.filter(
        (msg) => (msg.msgflags & util.RS_MSGTAGTYPE_PERSONAL)
        );
      Messages.todo = Messages.all.filter(
        (msg) => (msg.msgflags & util.RS_MSGTAGTYPE_TODO)
        );
      Messages.later = Messages.all.filter(
        (msg) => (msg.msgflags & util.RS_MSGTAGTYPE_LATER)
        );
    });
  },
};

const sections = {
  inbox: require('mail/mail_inbox'),
  outbox: require('mail/mail_outbox'),
  drafts: require('mail/mail_draftbox'),
  sent: require('mail/mail_sentbox'),
  trash: require('mail/mail_trashbox'),
};
const sectionsquickview = {
  starred: require('mail/mail_starred'),
  system: require('mail/mail_system'),
  spam: require('mail/mail_spam'),
  important: require('mail/mail_important'),
  work: require('mail/mail_work'),
  todo: require('mail/mail_todo'),
  later: require('mail/mail_later'),
  personal: require('mail/mail_personal'),

};
const tagselect = {
  showval: 'Tags',
  opts: ['Tags', 'Important', 'Work', 'Personal']
};
const Layout = {
  oninit: Messages.load,
  view: (vnode) =>

    m('.tab-page', [
      m('button[id=composebtn]', { onclick: () => { util.popupMessageCompose(m(compose)); } }, 'Compose'),
      m('select[id=tags]', {
        value: tagselect.showval,
        onchange: (e) => {
          tagselect.showval = tagselect.opts[e.target.selectedIndex];
        }
      }, [
        tagselect.opts.map((o) => m('option', { value: o }, o.toLocaleString()))
      ]),
      m(util.SearchBar, {
        list: {},
      }),
      m(widget.Sidebar, {
        tabs: Object.keys(sections),
        baseRoute: '/mail/',
      }),
      m(widget.SidebarQuickView, {
        tabs: Object.keys(sectionsquickview),
        baseRoute: '/mail/',
      }),
      m('.mail-node-panel', vnode.children),
    ]),
};

module.exports = {
  view: (v) => {
    const tab = v.attrs.tab;
    // TODO: utilize multiple routing params

    if (Object.prototype.hasOwnProperty.call(v.attrs, 'msgId')) {
      return m(
        Layout,
        m(util.MessageView, {
          id: v.attrs.msgId,
        })
      );
    }
    return m(
      Layout,
      m((sections[tab]) || (sectionsquickview[tab]), {
        list: Messages[tab].reverse(),
      })
    );
  },
};
