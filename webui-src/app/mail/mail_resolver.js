const m = require('mithril');
const rs = require('rswebui');
const util = require('mail/mail_util');
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
  attachment: [],
  important: [],
  work: [],
  personal: [],
  todo: [],
  later: [],
  load() {
    rs.rsJsonApiRequest('/rsMail/getMessageSummaries', { box: util.BOX_ALL }, (data) => {
      if (data && data.msgList) {
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

        Messages.attachment = Messages.all.filter((msg) => msg.count);

        Messages.important = Messages.all.filter(
          (msg) => msg.msgtags && msg.msgtags.includes(util.RS_MSGTAGTYPE_IMPORTANT)
        );
        Messages.work = Messages.all.filter(
          (msg) => msg.msgtags && msg.msgtags.includes(util.RS_MSGTAGTYPE_WORK)
        );
        Messages.personal = Messages.all.filter(
          (msg) => msg.msgtags && msg.msgtags.includes(util.RS_MSGTAGTYPE_PERSONAL)
        );
        Messages.todo = Messages.all.filter(
          (msg) => msg.msgtags && msg.msgtags.includes(util.RS_MSGTAGTYPE_TODO)
        );
        Messages.later = Messages.all.filter(
          (msg) => msg.msgtags && msg.msgtags.includes(util.RS_MSGTAGTYPE_LATER)
        );
      }
    });
  },
};

const sections = {
  inbox: require('mail/mail_inbox'),
  outbox: require('mail/mail_outbox'),
  drafts: require('mail/mail_draftbox'),
  sent: require('mail/mail_sentbox'),
  trash: require('mail/mail_trashbox'),
  starred: require('mail/mail_starred'),
  system: require('mail/mail_system'),
  spam: require('mail/mail_spam'),
  attachment: require('mail/mail_attachment'),
};
const sectionsquickview = {
  important: require('mail/mail_important'),
  work: require('mail/mail_work'),
  todo: require('mail/mail_todo'),
  later: require('mail/mail_later'),
  personal: require('mail/mail_personal'),
};
const tagselect = {
  opts: [
    { label: '🏷️ Filter by Tag...', val: '' },
    { label: '📎 Attachments', val: 'attachment' },
    { label: '🔴 Important', val: 'important' },
    { label: '🟠 Work', val: 'work' },
    { label: '🟢 Personal', val: 'personal' },
    { label: '🔵 Todo', val: 'todo' },
    { label: '🟣 Later', val: 'later' },
  ],
};
const Layout = () => {
  let showCompose = false;
  // setFunction like react to show/hide popup
  function setShowCompose(bool) {
    showCompose = bool;
  }
  return {
    oninit: () => Messages.load(),
    view: (vnode) => {
      const sectionsSize = {
        inbox: (Messages.inbox || []).length,
        outbox: (Messages.outbox || []).length,
        drafts: (Messages.drafts || []).length,
        sent: (Messages.sent || []).length,
        trash: (Messages.trash || []).length,
        starred: (Messages.starred || []).length,
        system: (Messages.system || []).length,
        spam: (Messages.spam || []).length,
        attachment: (Messages.attachment || []).length,
      };
      const sectionsQuickviewSize = {
        important: (Messages.important || []).length,
        work: (Messages.work || []).length,
        todo: (Messages.todo || []).length,
        later: (Messages.later || []).length,
        personal: (Messages.personal || []).length,
      };

      return [
        m('.side-bar', [
          m(
            'button.mail-compose-btn',
            {
              style: 'display: flex; align-items: center; justify-content: center; gap: 0.5rem;',
              onclick: () => setShowCompose(true),
            },
            [m('i.fas.fa-pen'), 'Compose']
          ),
          m(util.Sidebar, {
            tabs: Object.keys(sections),
            size: sectionsSize,
            baseRoute: '/mail/',
          }),
          m(util.SidebarQuickView, {
            tabs: Object.keys(sectionsquickview),
            size: sectionsQuickviewSize,
            baseRoute: '/mail/',
          }),
        ]),
        m(
          '.node-panel',
          m('.widget', [
            m.route.get().split('/').length < 4 &&
            m('.top-heading', [
              m(
                'select.mail-tag',
                {
                  value: m.route.param().tab || '',
                  onchange: (e) => {
                    const selectedTag = e.target.value;
                    if (selectedTag) {
                      m.route.set('/mail/:tab', { tab: selectedTag });
                    }
                  },
                },
                tagselect.opts.map((opt) => m('option', { value: opt.val }, opt.label))
              ),
              m(util.SearchBar, { list: {} }),
            ]),
            vnode.children,
          ])
        ),
        m(
          'button.mobile-fab-compose',
          {
            title: 'Compose Mail',
            onclick: () => setShowCompose(true),
          },
          m('i.fas.fa-pen')
        ),
        showCompose && m(
          '.composePopupOverlay#mailComposerPopup',
          m(
            '.composePopup',
            m(compose, { msgType: 'compose', setShowCompose }),
            m('button.red.close-btn', { onclick: () => setShowCompose(false) }, m('i.fas.fa-times'))
          )
        ),
      ];
    },
  };
};

const tabConfig = {
  inbox: { title: 'Inbox', category: 'inbox' },
  outbox: { title: 'Outbox', category: 'outbox' },
  drafts: { title: 'Draft', category: 'drafts' },
  sent: { title: 'Sent', category: 'sent' },
  trash: { title: 'Trash', category: 'trash' },
  starred: { title: 'Starred', category: 'starred' },
  system: { title: 'System', category: 'system' },
  spam: { title: 'Spam', category: 'spam' },
  attachment: { title: 'Attachments', category: 'attachment' },
  important: { title: 'Important', category: 'important' },
  work: { title: 'Work', category: 'work' },
  todo: { title: 'Todo', category: 'todo' },
  later: { title: 'Later', category: 'later' },
  personal: { title: 'Personal', category: 'personal' },
};

const GenericMailList = () => {
  return {
    view: (vnode) => {
      const { title, category, list } = vnode.attrs;
      return [
        m('.widget__heading', m('h3', title)),
        m('.widget__body', [
          m(
            util.Table,
            m(
              'tbody',
              list.map((msg) =>
                m(util.MessageSummary, {
                  key: msg.msgId,
                  details: msg,
                  category: category,
                })
              )
            )
          ),
        ]),
      ];
    },
  };
};

module.exports = {
  view: ({ attrs, attrs: { tab, msgId } }) => {
    // TODO: utilize multiple routing params
    if (Object.prototype.hasOwnProperty.call(attrs, 'msgId')) {
      return m(Layout, m(util.MessageView, { msgId }));
    }

    if (tab === 'attachment') {
      return m(
        Layout,
        m(sections.attachment, {
          list: util.sortList(Messages[tab]),
        })
      );
    }

    const config = tabConfig[tab];
    if (config) {
      return m(
        Layout,
        m(GenericMailList, {
          title: config.title,
          category: config.category,
          list: util.sortList(Messages[tab]),
        })
      );
    }

    return m(
      Layout,
      m(sections[tab] || sectionsquickview[tab], {
        list: util.sortList(Messages[tab]),
      })
    );
  },
};
