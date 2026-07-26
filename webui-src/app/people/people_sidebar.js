const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const peopleUtil = require('people/people_util');
const ownIdsLayout = require('people/people_ownids');
const { CreateIdentity } = ownIdsLayout;
const {
  State,
  isSystemMsg,
  preloadAllChatHistory,
  fetchIdDetails,
  loadGxsIdentities,
  getSafeAvatar,
  get64Num,
  stopStatusPolling,
  initializeDistantChat,
} = require('people/people_state');

function formatRelativeTime(ts) {
  if (!ts) return '';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 30) return 'Just Now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min${Math.floor(diff / 60) > 1 ? 's' : ''}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr${Math.floor(diff / 3600) > 1 ? 's' : ''}`;
  return `${Math.floor(diff / 86400)} d`;
}

const PeopleSidebar = () => {
  return {
    oninit: () => {
      preloadAllChatHistory();
    },
    view: () => {
      // 1. Determine list based on mainTab ('people' vs 'chats')
      let displayItems = [];

      // 0. Compute active chats count (conversations with real message history)
      const allUserGroupIds = new Set((rs.userList.users || []).map((u) => u.mGroupId));
      Object.keys(State.chatHistoryMap || {}).forEach((id) => allUserGroupIds.add(id));
      let activeChatsCount = 0;
      allUserGroupIds.forEach((gxsId) => {
        const hist = State.chatHistoryMap && State.chatHistoryMap[gxsId];
        if (hist && hist.lastMsg && !isSystemMsg(hist.lastMsg)) {
          activeChatsCount++;
        }
      });

      if (State.mainTab === 'people') {
        let baseList = [];
        if (State.activeFilter === 'own') {
          baseList = peopleUtil.sortIds(State.ownGxsIds) || [];
        } else if (State.activeFilter === 'contacts') {
          baseList = peopleUtil.contactlist(rs.userList.users) || [];
        } else {
          baseList = peopleUtil.sortUsers(rs.userList.users) || [];
        }

        displayItems = baseList.filter((item) => {
          let name = State.activeFilter === 'own' ? (rs.userList.username(item) || 'Unknown') : (item.mGroupName || 'Unknown');
          return name.toLowerCase().includes(State.searchString.toLowerCase());
        });

        displayItems.sort((a, b) => {
          let nameA = State.activeFilter === 'own' ? (rs.userList.username(a) || '') : (a.mGroupName || '');
          let nameB = State.activeFilter === 'own' ? (rs.userList.username(b) || '') : (b.mGroupName || '');
          return nameA.localeCompare(nameB);
        });
      } else {
        // Chats Tab: ONLY contacts and identities that have real chat history (ignoring system tunnel status logs)
        displayItems = Array.from(allUserGroupIds)
          .map((gxsId) => {
            const entry = rs.userList.userMap[gxsId];
            const name = entry && entry.name ? entry.name : (rs.userList.username(gxsId) || 'Unknown');
            return { mGroupId: gxsId, mGroupName: name };
          })
          .filter((item) => {
            const gxsId = item.mGroupId;
            fetchIdDetails(gxsId);
            const hist = State.chatHistoryMap && State.chatHistoryMap[gxsId];

            const hasRealHistory = Boolean(hist && hist.lastMsg && !isSystemMsg(hist.lastMsg));

            if (!hasRealHistory) return false;

            const name = item.mGroupName || 'Unknown';
            return name.toLowerCase().includes(State.searchString.toLowerCase());
          });

        // Sort by chat timestamp descending
        displayItems.sort((a, b) => {
          const histA = State.chatHistoryMap[a.mGroupId];
          const histB = State.chatHistoryMap[b.mGroupId];
          const detailsA = State.gxsIdToDetailsMap[a.mGroupId];
          const detailsB = State.gxsIdToDetailsMap[b.mGroupId];

          const timeA = histA ? histA.lastTime : (detailsA ? get64Num(detailsA.mLastUsageTS) : 0);
          const timeB = histB ? histB.lastTime : (detailsB ? get64Num(detailsB.mLastUsageTS) : 0);
          return timeB - timeA;
        });
      }

      return m('.people-left-pane', [
        // Sidebar Header Container
        m('.people-sidebar-header', [
          // 1. Top Search Bar
          m('.searchbar-wrapper', [
            m('i.fas.fa-search'),
            m('input.searchbar-input[type=text][placeholder=Search...]', {
              value: State.searchString,
              oninput: (e) => {
                State.searchString = e.target.value;
              },
            }),
          ]),

          // 2. Dual Segmented Tab Control: [People] | [Chats]
          m('.segmented-control', [
            m(
              'button.segment-tab' + (State.mainTab === 'people' ? '.active' : ''),
              {
                onclick: () => {
                  State.mainTab = 'people';
                  m.redraw();
                },
              },
              [m('i.fas.fa-users'), ' People']
            ),
            m(
              'button.segment-tab' + (State.mainTab === 'chats' ? '.active' : ''),
              {
                onclick: () => {
                  State.mainTab = 'chats';
                  preloadAllChatHistory();
                  m.redraw();
                },
              },
              [
                m('i.fas.fa-comments'),
                ' Chats',
                activeChatsCount > 0 && m('span.segment-badge', activeChatsCount),
              ]
            ),
          ]),


          // 3. Sub-Filter Row (People Tab)
          State.mainTab === 'people' &&
            m('.sub-filter-row', [
              m(
                'select.filter-select',
                {
                  value: State.activeFilter,
                  onchange: (e) => {
                    State.activeFilter = e.target.value;
                    m.route.set(
                      '/people/' +
                        (State.activeFilter === 'contacts'
                          ? 'MyContacts'
                          : State.activeFilter === 'own'
                          ? 'OwnIdentity'
                          : 'All')
                    );
                  },
                },
                [
                  m('option[value=contacts]', 'Contacts'),
                  m('option[value=own]', 'My Identities'),
                  m('option[value=all]', 'All Users'),
                ]
              ),
              State.activeFilter === 'own' &&
                m(
                  'button.btn-add-id[title=Create New Identity]',
                  {
                    onclick: () => widget.popupMessage(m(CreateIdentity)),
                  },
                  m('i.fas.fa-plus')
                ),
            ]),
        ]),

        // Scrollable List Container
        m('.friends-list-container', [
          m('.friends-scroll', [
            displayItems.length === 0
              ? m('.network-pane-placeholder', { style: 'padding: 2rem 0;' }, State.mainTab === 'chats' ? 'No active chats' : 'No identities found')
              : displayItems.map((item) => {
                  let gxsId, displayName;
                  if (State.mainTab === 'people' && State.activeFilter === 'own') {
                    gxsId = item;
                    displayName = rs.userList.username(gxsId) || 'Unknown';
                  } else {
                    gxsId = item.mGroupId;
                    displayName = item.mGroupName || 'Unknown';
                  }

                  fetchIdDetails(gxsId);
                  const itemDetails = State.gxsIdToDetailsMap[gxsId];
                  const itemAvatar = getSafeAvatar(itemDetails);
                  const itemFirstLetter = (displayName || '?').slice(0, 1).toUpperCase();
                  const isSelected = State.selectedId === gxsId;

                  const itemEntry = rs.userList.userMap[gxsId];
                  const itemIsContact = itemEntry && itemEntry.isContact;
                  const itemIsOwn = State.ownGxsIds.includes(gxsId);

                  const hist = State.chatHistoryMap[gxsId];
                  const lastTS = hist ? hist.lastTime : (itemDetails ? get64Num(itemDetails.mLastUsageTS) : 0);
                  const relativeTimeStr = formatRelativeTime(lastTS);
                  const lastMsgText = hist && hist.lastMsg ? hist.lastMsg : (itemIsOwn ? 'My Identity' : itemIsContact ? 'Saved Contact' : 'Distant Chat');

                  if (State.mainTab === 'chats') {
                    return m(
                      '.chat-item',
                      {
                        class: isSelected ? 'selected' : '',
                        onclick: (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          State.activeMenu = null;
                          State.selectedId = gxsId;
                          State.activeTab = 'chat';
                          initializeDistantChat();
                          m.redraw();
                        },
                        oncontextmenu: (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          State.selectedId = gxsId;
                          const container = document.querySelector('.friends-list-container');
                          if (container) {
                            const parentRect = container.getBoundingClientRect();
                            const top = e.clientY - parentRect.top;
                            const left = Math.min(Math.max(e.clientX - parentRect.left, 10), 160);
                            State.activeMenu = { gxsId, displayName, isContact: itemIsContact, top, left };
                          }
                          m.redraw();
                        },
                      },
                      [
                        m('.chat-avatar-wrapper', [
                          m(peopleUtil.UserAvatar, {
                            avatar: itemAvatar,
                            firstLetter: itemFirstLetter,
                            identityId: gxsId,
                            size: 40,
                          }),
                          m('.status-dot', {
                            style: {
                              backgroundColor: itemIsContact || itemIsOwn ? '#22c55e' : '#cbd5e1',
                            },
                          }),
                        ]),
                        m('.chat-info', [
                          m('.chat-name', displayName),
                          m('.chat-last-msg', lastMsgText),
                        ]),
                        m('.chat-meta', [
                          relativeTimeStr && m('.chat-time', relativeTimeStr),
                        ]),
                      ]
                    );
                  }

                  // People tab list item
                  return m(
                    '.friend-list-item',
                    {
                      class: isSelected ? 'selected' : '',
                      onclick: (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        State.activeMenu = null;

                        const idChanged = State.selectedId !== gxsId;
                        State.selectedId = gxsId;
                        if (idChanged) {
                          State.chatPid = null;
                          State.chatMessages = [];
                          stopStatusPolling();
                          if (State.activeTab === 'chat') {
                            initializeDistantChat();
                          }
                        }
                        m.redraw();
                      },
                      oncontextmenu: (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        State.selectedId = gxsId;

                        const container = document.querySelector('.friends-list-container');
                        if (container) {
                          const parentRect = container.getBoundingClientRect();
                          const top = e.clientY - parentRect.top;
                          const left = Math.min(Math.max(e.clientX - parentRect.left, 10), 160);
                          State.activeMenu = { gxsId, displayName, isContact: itemIsContact, top, left };
                        }
                        m.redraw();
                      },
                    },
                    [
                      m('.friend-avatar', m(peopleUtil.UserAvatar, {
                        avatar: itemAvatar,
                        firstLetter: itemFirstLetter,
                        identityId: gxsId,
                      })),
                      m('.friend-meta', [
                        m('.friend-name', displayName),
                        m(
                          '.friend-status',
                          itemIsOwn
                            ? 'My Identity'
                            : itemIsContact
                            ? 'Contact'
                            : 'Identity'
                        ),
                      ]),
                    ]
                  );
                }),
          ]),

          // Context Menu
          State.activeMenu && (() => {
            const menu = State.activeMenu;
            const isOwn = State.ownGxsIds.includes(menu.gxsId);

            return m('.people-context-menu', {
              style: {
                top: `${menu.top}px`,
                left: menu.left !== undefined ? `${menu.left}px` : '10px',
                position: 'absolute',
                zIndex: 1000,
              },
              onclick: (e) => {
                e.stopPropagation();
              },
            }, [
              !isOwn && m('.menu-item', {
                onclick: () => {
                  State.activeMenu = null;
                  State.selectedId = menu.gxsId;
                  State.activeTab = 'chat';
                  State.chatPid = null;
                  State.chatMessages = [];
                  initializeDistantChat();
                  m.redraw();
                },
              }, [
                m('i.fas.fa-comments', { style: 'color: #3b82f6; margin-right: 0.5rem;' }),
                'Start chat',
              ]),
              !isOwn && m('.menu-item', {
                onclick: () => {
                  State.activeMenu = null;
                  State.selectedId = menu.gxsId;
                  State.activeTab = 'details';
                  State.showMailCompose = true;
                  m.redraw();
                },
              }, [
                m('i.fas.fa-envelope', { style: 'color: #10b981; margin-right: 0.5rem;' }),
                'Send mail',
              ]),
              !isOwn && m('.menu-item', {
                onclick: () => {
                  State.activeMenu = null;
                  rs.rsJsonApiRequest(
                    '/rsIdentity/setAsRegularContact',
                    { id: menu.gxsId, isContact: !menu.isContact },
                    (data, success) => {
                      if (success) {
                        loadGxsIdentities();
                      }
                    }
                  );
                },
              }, [
                m('i.fas' + (menu.isContact ? '.fa-user-minus' : '.fa-user-plus'), {
                  style: {
                    color: menu.isContact ? '#ef4444' : '#3b82f6',
                    marginRight: '0.5rem',
                  },
                }),
                menu.isContact ? 'Remove from Contacts' : 'Add to Contacts',
              ]),
            ]);
          })(),
        ]),
      ]);
    },
  };
};

module.exports = PeopleSidebar;
