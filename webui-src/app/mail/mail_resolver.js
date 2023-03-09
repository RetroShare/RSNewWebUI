const m = require('mithril');
const rs = require('rswebui');
const util = require('mail/mail_util');
const widget = require('widgets');
const peopleUtil = require('people/people_util');
const compose = require('mail/mail_compose');

const composeData = {
  allUsers: undefined,
  ownId: undefined,
};

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
    rs.rsJsonApiRequest('/rsMsgs/getMessageSummaries', { box: util.BOX_ALL }, (data) => {
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
      Messages.trash = Messages.all.filter((msg) => msg.msgflags & util.RS_MSG_TRASH);
      Messages.starred = Messages.all.filter((msg) => msg.msgflags & util.RS_MSG_STAR);
      Messages.system = Messages.all.filter((msg) => msg.msgflags & util.RS_MSG_SYSTEM);
      Messages.spam = Messages.all.filter((msg) => msg.msgflags & util.RS_MSG_SPAM);

      // Messages.important = Messages.all.filter(
      //   (msg) => msg.msgflags & util.RS_MSGTAGTYPE_IMPORTANT
      // );
      // Messages.work = Messages.all.filter((msg) => msg.msgflags & util.RS_MSGTAGTYPE_WORK);
      // Messages.personal = Messages.all.filter((msg) => msg.msgflags & util.RS_MSGTAGTYPE_PERSONAL);
      // Messages.todo = Messages.all.filter((msg) => msg.msgflags & util.RS_MSGTAGTYPE_TODO);
      // Messages.later = Messages.all.filter((msg) => msg.msgflags & util.RS_MSGTAGTYPE_LATER);
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
  opts: ['Tags', 'Important', 'Work', 'Personal'],
};
const Layout = {
  oninit: async () => {
    Messages.load();
    await peopleUtil.ownIds(async (data) => {
      composeData.ownId = await data;
      for (let i = 0; i < composeData.ownId.length; i++) {
        if (Number(composeData.ownId[i]) === 0) {
          composeData.ownId.splice(i, 1); // workaround for id '0'
        }
      }
      // identity = ownId[0];
    });
    composeData.allUsers = await peopleUtil.sortUsers(rs.userList.users);
  },
  view: (vnode) => {
    const sectionsSize = {
      inbox: Messages.inbox.length,
      outbox: Messages.outbox.length,
      drafts: Messages.drafts.length,
      sent: Messages.sent.length,
      trash: Messages.trash.length,
    };
    const sectionsquickviewSize = {
      starred: Messages.starred.length,
      system: Messages.system.length,
      spam: Messages.spam.length,
      important: Messages.important.length,
      work: Messages.work.length,
      todo: Messages.todo.length,
      later: Messages.later.length,
      personal: Messages.personal.length,
    };

    return [
      m('.tab-page', [
        m(
          'button[id=composebtn]',
          {
            onclick: () =>
              composeData.allUsers &&
              composeData.ownId &&
              util.popupMessageCompose(
                m(compose, { allUsers: composeData.allUsers, ownId: composeData.ownId })
              ),
          },
          'Compose'
        ),
        m(
          'select[id=tags]',
          {
            value: tagselect.showval,
            onchange: (e) => {
              tagselect.showval = tagselect.opts[e.target.selectedIndex];
            },
          },
          [tagselect.opts.map((o) => m('option', { value: o }, o.toLocaleString()))]
        ),
        m(util.SearchBar, {
          list: {},
        }),
        m(util.Sidebar, {
          tabs: Object.keys(sections),
          size: sectionsSize,
          baseRoute: '/mail/',
        }),
        m(util.SidebarQuickView, {
          tabs: Object.keys(sectionsquickview),
          size: sectionsquickviewSize,
          baseRoute: '/mail/',
        }),
        m('.mail-node-panel', vnode.children),
      ]),
    ];
  },
};

module.exports = {
  composeData,
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
      m(sections[tab] || sectionsquickview[tab], {
        list: Messages[tab].reverse(),
      })
    );
  },
};
