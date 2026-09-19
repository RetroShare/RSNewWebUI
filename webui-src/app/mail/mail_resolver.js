const m = require('mithril');
const rs = require('rswebui');
const util = require('mail/mail_util');
const compose = require('mail/mail_compose');
const icon = require('icon');
const widget = require('widgets');

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
  refreshTimer: null,
  unread: 0,

  recountUnread() {
    Messages.unread = (Messages.inbox || []).filter((msg) => {
      const status = msg.msgflags & 0xf0;
      return (
        (status === util.RS_MSG_NEW || status === util.RS_MSG_UNREAD_BY_USER) &&
        !(msg.msgflags & util.RS_MSG_TRASH) &&
        !(msg.msgflags & util.RS_MSG_SPAM)
      );
    }).length;
    return Messages.unread;
  },
  unreadCount() {
    return Messages.unread;
  },
  refreshSoon() {
    if (Messages.refreshTimer) return;
    Messages.refreshTimer = setTimeout(() => {
      Messages.refreshTimer = null;
      Messages.load();
    }, 250);
  },
  markReadLocally(msgId) {
    if (!msgId) return;
    let changed = false;
    Messages.all.forEach((msg) => {
      if (msg.msgId === msgId) {
        if (msg.msgflags & (util.RS_MSG_NEW | util.RS_MSG_UNREAD_BY_USER)) {
          msg.msgflags &= ~(util.RS_MSG_NEW | util.RS_MSG_UNREAD_BY_USER);
          changed = true;
        }
      }
    });
    if (
      util.MessageCache &&
      util.MessageCache[msgId] &&
      util.MessageCache[msgId].msgflags !== undefined
    ) {
      if (util.MessageCache[msgId].msgflags & (util.RS_MSG_NEW | util.RS_MSG_UNREAD_BY_USER)) {
        util.MessageCache[msgId].msgflags &= ~(util.RS_MSG_NEW | util.RS_MSG_UNREAD_BY_USER);
        changed = true;
      }
    }
    if (changed) {
      Messages.recountUnread();
      util.triggerMessageUpdated(msgId, util.RS_MSG_NEW, false);
    }
  },
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
        //  The core keeps the DRAFT bit on a draft moved to Trash, so it has
        //  to be excluded here or it is listed in both folders.
        Messages.drafts = Messages.all.filter(
          (msg) => util.isDraftMessage(msg.msgflags) && !(msg.msgflags & util.RS_MSG_TRASH)
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
        Messages.recountUnread();
        m.redraw();
      }
    });
  },
};

util.onMessageUpdated((msgId, flag, isSet) => {
  Messages.all.forEach((msg) => {
    if (msg.msgId === msgId) {
      if (isSet) {
        msg.msgflags |= flag;
      } else {
        msg.msgflags &= ~flag;
        if (flag === util.RS_MSG_NEW || flag === util.RS_MSG_UNREAD_BY_USER) {
          msg.msgflags &= ~(util.RS_MSG_NEW | util.RS_MSG_UNREAD_BY_USER);
        }
      }
    }
  });
  if (
    util.MessageCache &&
    util.MessageCache[msgId] &&
    util.MessageCache[msgId].msgflags !== undefined
  ) {
    if (isSet) {
      util.MessageCache[msgId].msgflags |= flag;
    } else {
      util.MessageCache[msgId].msgflags &= ~flag;
      if (flag === util.RS_MSG_NEW || flag === util.RS_MSG_UNREAD_BY_USER) {
        util.MessageCache[msgId].msgflags &= ~(util.RS_MSG_NEW | util.RS_MSG_UNREAD_BY_USER);
      }
    }
  }
  Messages.spam = Messages.all.filter((msg) => msg.msgflags & util.RS_MSG_SPAM);
  Messages.starred = Messages.all.filter((msg) => msg.msgflags & util.RS_MSG_STAR);
  Messages.recountUnread();
  Messages.refreshSoon();
  m.redraw();
});

const folderConfigs = [
  { id: 'inbox', title: 'Inbox', icon: 'inbox' },
  { id: 'sent', title: 'Sent', icon: 'envelope-open' },
  { id: 'drafts', title: 'Drafts', icon: 'edit' },
  { id: 'outbox', title: 'Outbox', icon: 'envelope-open-text' },
  { id: 'starred', title: 'Starred', icon: 'star' },
  { id: 'trash', title: 'Trash', icon: 'trash-alt' },
  { id: 'spam', title: 'Spam', icon: 'fire' },
  { id: 'attachment', title: 'Attachments', icon: 'paperclip' },
  { id: 'system', title: 'System', icon: 'bell' },
];

//  The five tag categories. Their colours are the core's, so they are read
//  from the one place that knows them rather than written a second time here.
const categoryConfigs = [
  { id: 'important', title: 'Important', tagId: 1 },
  { id: 'work', title: 'Work', tagId: 2 },
  { id: 'personal', title: 'Personal', tagId: 3 },
  { id: 'todo', title: 'Todo', tagId: 4 },
  { id: 'later', title: 'Later', tagId: 5 },
];

//  Unread is a flag on *received* mail. Sent, Outbox and Drafts are mail you
//  wrote, and the unread filter below explicitly skips anything in Trash or
//  Spam -- so in these five folders the switcher can only ever return zero.
const UNREAD_FILTER_FOLDERS_EXCLUDED = ['sent', 'outbox', 'drafts', 'trash', 'spam'];

const tagFilterOptions = [
  { label: 'Filter by tag', val: '' },
  { label: 'Important', val: '1' },
  { label: 'Work', val: '2' },
  { label: 'Personal', val: '3' },
  { label: 'Todo', val: '4' },
  { label: 'Later', val: '5' },
];

const MailComponent = () => {
  let showCompose = false;
  let mobileNavOpen = false;
  //  Which message the auto-mark-read already ran for. Running it on EVERY
  //  redraw re-cleared the local unread bits the instant "Mark as unread"
  //  set them, and the change notification scheduled a summaries reload
  //  whose redraw re-triggered it: a full getMessageSummaries fetch every
  //  ~250 ms for as long as the message stayed open.
  let lastAutoReadMsgId = null;
  const autoMarkRead = (msgId) => {
    if (!msgId) {
      lastAutoReadMsgId = null;
      return;
    }
    if (msgId === lastAutoReadMsgId) return;
    lastAutoReadMsgId = msgId;
    Messages.markReadLocally(msgId);
  };
  let searchQuery = '';
  let filterUnreadOnly = false;
  let selectedTagFilter = '';
  let viewMode = localStorage.getItem('rs_mail_view_mode') || 'cards';
  //  Cards fetch a body each (for the snippet): unpaginated, a large folder
  //  fired one getMessage per mail in one burst. Same page size as the table.
  const CARD_PAGE_SIZE = 50;
  let cardPage = 0;
  let cardPageTab = null;

  function setShowCompose(bool) {
    showCompose = bool;
  }

  return {
    oninit: (vnode) => {
      Messages.load();
      autoMarkRead(vnode.attrs.msgId);
    },
    onupdate: (vnode) => {
      autoMarkRead(vnode.attrs.msgId);
    },
    view: (vnode) => {
      const activeTab = vnode.attrs.tab || 'inbox';
      const activeMsgId = vnode.attrs.msgId || null;

      const currentFolder = folderConfigs.find((f) => f.id === activeTab) ||
        categoryConfigs.find((c) => c.id === activeTab) || {
          title: activeTab.charAt(0).toUpperCase() + activeTab.slice(1),
          icon: 'envelope',
        };

      let list = Messages[activeTab] || [];

      const canFilterUnread = !UNREAD_FILTER_FOLDERS_EXCLUDED.includes(activeTab);
      //  Leaving it set while it is hidden would silently empty the folder.
      if (!canFilterUnread) filterUnreadOnly = false;

      // Filter by Unread
      if (filterUnreadOnly) {
        list = list.filter((msg) => {
          const status = msg.msgflags & 0xf0;
          return (
            (status === util.RS_MSG_NEW || status === util.RS_MSG_UNREAD_BY_USER) &&
            !(msg.msgflags & util.RS_MSG_TRASH) &&
            !(msg.msgflags & util.RS_MSG_SPAM)
          );
        });
      }

      // Filter by tag
      if (selectedTagFilter) {
        const tId = parseInt(selectedTagFilter, 10);
        list = list.filter((msg) => msg.msgtags && msg.msgtags.includes(tId));
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        list = list.filter((msg) => {
          const title = (msg.title || '').toLowerCase();
          return title.includes(q);
        });
      }

      // Sort
      const sortedList = util.sortList(list);

      function selectMessage(id) {
        Messages.markReadLocally(id);
        //  No markMessageRead here: MessageView.loadMail() sends it when the
        //  message opens -- both did, two server calls and two summaries
        //  reloads per click.
        m.route.set('/mail/:tab/:msgId', { tab: activeTab, msgId: id });
      }

      function deselectMessage() {
        m.route.set('/mail/:tab', { tab: activeTab });
      }

      return m('.mail-outlook-container', [
        // Backdrop overlay for mobile drawer
        mobileNavOpen &&
          m('.mail-drawer-backdrop', {
            onclick: () => {
              mobileNavOpen = false;
            },
          }),

        // 1. LEFT PANE: Folders & Categories Navigation
        m('.mail-folders-pane', { class: mobileNavOpen ? 'mail-folders-pane--open' : '' }, [
          m('.mail-folders-header', [
            m(
              'button.mail-compose-btn.is-primary[type=button]',
              {
                onclick: () => {
                  mobileNavOpen = false;
                  setShowCompose(true);
                },
              },
              [icon('edit'), m('span', 'New email')]
            ),
          ]),

          m('.mail-nav-scroll', [
            m('.mail-nav-section-title', 'Folders'),
            m(
              '.mail-nav-list',
              folderConfigs.map((folder) => {
                const isActive = activeTab === folder.id;
                const count = (Messages[folder.id] || []).length;
                const unread = folder.id === 'inbox' ? Messages.unreadCount() : 0;
                return m(
                  m.route.Link,
                  {
                    key: folder.id,
                    href: `/mail/${folder.id}`,
                    class: `mail-nav-item ${isActive ? 'active' : ''}`,
                    onclick: () => {
                      mobileNavOpen = false;
                    },
                  },
                  [
                    icon(folder.icon, { size: 19 }),
                    m('span.mail-nav-label', folder.title),
                    unread > 0
                      ? m('span.mail-nav-badge.mail-nav-badge--unread', unread)
                      : count > 0
                        ? m('span.mail-nav-badge', count)
                        : null,
                  ]
                );
              })
            ),

            m('.mail-nav-section-title', 'Categories'),
            m(
              '.mail-nav-list',
              categoryConfigs.map((cat) => {
                const isActive = activeTab === cat.id;
                const count = (Messages[cat.id] || []).length;
                return m(
                  m.route.Link,
                  {
                    key: cat.id,
                    href: `/mail/${cat.id}`,
                    class: `mail-nav-item ${isActive ? 'active' : ''}`,
                    onclick: () => {
                      mobileNavOpen = false;
                    },
                  },
                  [
                    m('span.mail-category-dot', { style: { backgroundColor: util.getTagDetails(cat.tagId).color } }),
                    m('span.mail-nav-label', cat.title),
                    count > 0 && m('span.mail-nav-badge', count),
                  ]
                );
              })
            ),
          ]),
        ]),

        // 2. MIDDLE PANE: Message List
        m(
          '.mail-list-pane',
          {
            class: [
              activeMsgId ? 'mail-list-pane--mobile-hidden' : '',
              viewMode === 'table' ? 'mail-list-pane--table-view' : '',
              viewMode === 'table' && activeMsgId ? 'mail-list-pane--table-selected-hidden' : '',
            ]
              .filter(Boolean)
              .join(' '),
          },
          [
            m('.mail-list-header', [
              m('.mail-list-header-top', [
                m(
                  'button.mail-mobile-nav-toggle[type=button][aria-label=Open navigation]',
                  {
                    onclick: () => {
                      mobileNavOpen = !mobileNavOpen;
                    },
                  },
                  icon('bars')
                ),
                m('.mail-folder-title-row', [
                  icon(currentFolder.icon || 'envelope', { size: 22 }),
                  m('h2.mail-folder-heading', currentFolder.title),
                  m('span.mail-folder-count', `(${sortedList.length})`),
                ]),
                m(widget.Segmented, {
                  class: 'mail-view-toggle',
                  ariaLabel: 'Message list layout',
                  value: viewMode,
                  options: [
                    { id: 'cards', icon: 'th-large', title: 'Card view' },
                    { id: 'table', icon: 'bars', title: 'Table view' },
                  ],
                  onSelect: (mode) => {
                    viewMode = mode;
                    localStorage.setItem('rs_mail_view_mode', mode);
                    deselectMessage();
                  },
                }),
              ]),

              // Search bar
              m(widget.SearchField, {
                class: 'mail-search-wrapper',
                placeholder: 'Search subject',
                value: searchQuery,
                oninput: (e) => {
                  searchQuery = e.target.value;
                },
                onclear: () => {
                  searchQuery = '';
                },
              }),

              // Filter subheader
              m('.mail-filter-row', [
                canFilterUnread && m(widget.Segmented, {
                  class: 'mail-filter-tabs',
                  ariaLabel: 'Filter messages',
                  value: filterUnreadOnly ? 'unread' : 'all',
                  options: [
                    { id: 'all', label: 'All' },
                    {
                      id: 'unread',
                      label: 'Unread',
                      badge:
                        activeTab === 'inbox' && Messages.unreadCount() > 0
                          ? Messages.unreadCount()
                          : undefined,
                    },
                  ],
                  onSelect: (id) => {
                    filterUnreadOnly = id === 'unread';
                  },
                }),
                m(
                  'select.mail-tag-select',
                  {
                    value: selectedTagFilter,
                    onchange: (e) => {
                      selectedTagFilter = e.target.value;
                    },
                  },
                  tagFilterOptions.map((opt) => m('option', { value: opt.val }, opt.label))
                ),
              ]),
            ]),

            m('.mail-list-body', [
              sortedList.length === 0
                ? m('.mail-empty-state', [
                    icon('inbox', { class: 'mail-empty-icon' }),
                    m('h4', 'No messages'),
                    m(
                      'p',
                      searchQuery || filterUnreadOnly || selectedTagFilter
                        ? 'No emails match your filter criteria.'
                        : 'This folder is currently empty.'
                    ),
                  ])
                : viewMode === 'cards'
                  ? (() => {
                      if (cardPageTab !== activeTab) {
                        cardPageTab = activeTab;
                        cardPage = 0;
                      }
                      const totalCardPages = Math.ceil(sortedList.length / CARD_PAGE_SIZE) || 1;
                      if (cardPage >= totalCardPages) cardPage = totalCardPages - 1;
                      const pageStart = cardPage * CARD_PAGE_SIZE;
                      const pagedCards = sortedList.slice(pageStart, pageStart + CARD_PAGE_SIZE);
                      return [
                        m(
                          '.mail-cards-container',
                          pagedCards.map((msg) =>
                            m(util.MessageCard, {
                              key: msg.msgId,
                              msg,
                              isSelected: msg.msgId === activeMsgId,
                              category: activeTab,
                              onSelect: (id) => selectMessage(id),
                            })
                          )
                        ),
                        sortedList.length > CARD_PAGE_SIZE &&
                          m('.mail-cards-pagination', [
                            m(
                              'button.is-icon[type=button]',
                              {
                                disabled: cardPage === 0,
                                onclick: () => {
                                  cardPage -= 1;
                                },
                              },
                              icon('chevron-left')
                            ),
                            m('span', `${cardPage + 1} / ${totalCardPages}`),
                            m(
                              'button.is-icon[type=button]',
                              {
                                disabled: cardPage >= totalCardPages - 1,
                                onclick: () => {
                                  cardPage += 1;
                                },
                              },
                              icon('chevron-right')
                            ),
                          ]),
                      ];
                    })()
                  : m(
                      util.Table,
                      { category: activeTab },
                      m(
                        'tbody',
                        sortedList.map((msg) =>
                          m(util.MessageSummary, {
                            key: msg.msgId,
                            details: msg,
                            category: activeTab,
                            isSelected: msg.msgId === activeMsgId,
                            onSelect: (id) => selectMessage(id),
                          })
                        )
                      )
                    ),
            ]),
          ]
        ),

        // 3. RIGHT PANE: Reading Pane
        (viewMode === 'cards' || activeMsgId) &&
          m(
            '.mail-reading-pane',
            {
              class: [
                !activeMsgId ? 'mail-reading-pane--mobile-hidden' : '',
                viewMode === 'table' ? 'mail-reading-pane--table-view' : '',
              ]
                .filter(Boolean)
                .join(' '),
            },
            [
              activeMsgId
                ? m(util.MessageView, {
                    key: activeMsgId,
                    msgId: activeMsgId,
                    onBack: deselectMessage,
                    onDeleted: () => {
                      deselectMessage();
                      Messages.load();
                    },
                    onRefresh: () => {
                      Messages.load();
                    },
                  })
                : m(util.ReadingPanePlaceholder),
            ]
          ),

        // Mobile Compose FAB
        m(
          'button.mobile-fab-compose',
          {
            title: 'Compose Mail',
            onclick: () => setShowCompose(true),
          },
          icon('pen')
        ),

        // Compose Modal Overlay
        showCompose &&
          m(
            '.composePopupOverlay#mailComposerPopup',
            m(
              '.composePopup',
              m(compose, { msgType: 'compose', setShowCompose }),
              m('button.red.close-btn', {
                onclick: () => compose.requestClose(() => setShowCompose(false)),
              }, icon('times'))
            )
          ),
      ]);
    },
  };
};

module.exports = {
  Messages,
  view: ({ attrs }) => m(MailComponent, attrs),
};
