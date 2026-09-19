const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const peopleUtil = require('people/people_util');
const chatPreviewText = require('chat/chat_preview');
const ownIdsLayout = require('people/people_ownids');
const icon = require('icon');
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
  markDistantChatRead,
  isDistantChatActive,
} = require('people/people_state');

const LIST_RENDER_CAP = 200;

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
      let displayItems;

      //  0. The conversations we know of. Only peers with a real message ever
      //  get an entry in chatHistoryMap, so reading it directly answers both
      //  the badge and the list. Sweeping the whole identity list instead --
      //  tens of thousands of them on an old node -- costs that sweep on every
      //  redraw, and it counts nothing the map does not already hold.
      const chatPeerIds = Object.keys(State.chatHistoryMap || {}).filter((gxsId) => {
        const hist = State.chatHistoryMap[gxsId];
        return Boolean(hist && hist.lastMsg && !isSystemMsg(hist.lastMsg));
      });
      const unreadChatsCount = Object.values(State.unreadChatCount || {})
        .reduce((total, count) => total + count, 0);

      if (State.mainTab === 'people') {
        let baseList;
        if (State.activeFilter === 'own') {
          baseList = peopleUtil.sortIds(State.ownGxsIds) || [];
        } else if (State.activeFilter === 'contacts') {
          baseList = peopleUtil.contactlist(rs.userList.users) || [];
        } else {
          baseList = peopleUtil.sortUsers(rs.userList.users) || [];
        }

        displayItems = baseList.filter((item) => {
          const name = State.activeFilter === 'own' ? (rs.userList.username(item) || 'Unknown') : (item.mGroupName || 'Unknown');
          return name.toLowerCase().includes(State.searchString.toLowerCase());
        });

        displayItems.sort((a, b) => {
          const nameA = State.activeFilter === 'own' ? (rs.userList.username(a) || '') : (a.mGroupName || '');
          const nameB = State.activeFilter === 'own' ? (rs.userList.username(b) || '') : (b.mGroupName || '');
          return nameA.localeCompare(nameB);
        });
      } else {
        // Chats Tab: ONLY identities that have real chat history (ignoring system tunnel status logs)
        displayItems = chatPeerIds
          .map((gxsId) => {
            //  Details are fetched for the handful of peers actually listed,
            //  not for every identity the node has ever seen.
            fetchIdDetails(gxsId);
            const entry = rs.userList.userMap[gxsId];
            const name = entry && entry.name ? entry.name : (rs.userList.username(gxsId) || 'Unknown');
            return { mGroupId: gxsId, mGroupName: name };
          })
          .filter((item) => (item.mGroupName || 'Unknown')
            .toLowerCase()
            .includes(State.searchString.toLowerCase()));

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

      //  "All Users" is every identity the node has ever seen -- tens of
      //  thousands on an old profile. Rendering them all builds that many DOM
      //  rows and fires one getIdDetails per row from inside this view. The
      //  list is capped instead, and the search narrows it.
      const shownItems = displayItems.slice(0, LIST_RENDER_CAP);
      const hiddenCount = displayItems.length - shownItems.length;
      const createIdentityButton = State.mainTab === 'people' && State.activeFilter === 'own' &&
        m('button.btn-add-id.is-primary[title=Create New Identity]', {
          onclick: () => widget.popupMessage(
            m(CreateIdentity),
            'create-identity-modal',
            {
              title: 'Create New Identity',
              lead: 'Choose a name, identity type, and optional custom avatar.',
            }
          ),
        }, icon('plus'));

      return m('.people-left-pane', [
        // Sidebar Header Container
        m('.people-sidebar-header', [
          // 1. Top Search Bar
          m('.people-search-row', [
            m(widget.SearchField, {
              class: 'searchbar-wrapper',
              placeholder: 'Search',
              value: State.searchString,
              oninput: (e) => {
                State.searchString = e.target.value;
              },
              onclear: () => {
                State.searchString = '';
              },
            }),
            createIdentityButton,
          ]),

          //  2. Tabs, and the People filter beside them -- same shape as the
          //  mail list, tabs left and filter right. A row of its own would be
          //  an empty strip on the Chats tab.
          m('.people-filter-row', [
            m(widget.Segmented, {
              class: 'segmented-control',
              ariaLabel: 'Show',
              value: State.mainTab,
              options: [
                { id: 'people', label: 'People', icon: 'users' },
                {
                  id: 'chats',
                  label: 'Chats',
                  icon: 'comments',
                  badge: unreadChatsCount > 0 ? unreadChatsCount : undefined,
                },
              ],
              onSelect: (tab) => {
                State.mainTab = tab;
                if (tab === 'chats') preloadAllChatHistory();
                m.redraw();
              },
            }),

            //  Filter and its add button travel together: on a narrow pane
            //  they wrap to a second line as a pair, still right-aligned,
            //  rather than the button dropping off on its own.
            State.mainTab === 'people' &&
              m('.people-filter-row__end', [
              //  A menu, not a select: a native select is as wide as its
              //  longest option at every width, and "My Identities" left no
              //  room for the tabs beside it on a phone.
              (() => {
                const filters = [
                  { id: 'contacts', label: 'Contacts', icon: 'user-friends', route: 'MyContacts' },
                  { id: 'own', label: 'My Identities', icon: 'user', route: 'OwnIdentity' },
                  { id: 'all', label: 'All Users', icon: 'users', route: 'All' },
                ];
                const active = filters.find((f) => f.id === State.activeFilter) || filters[0];
                return m(widget.Menu, {
                  class: 'people-filter-menu',
                  mark: active.icon,
                  label: active.label,
                  title: `Showing ${active.label}`,
                  items: filters.map((f) => ({
                    label: f.label,
                    icon: f.icon,
                    selected: f.id === State.activeFilter,
                    onclick: () => {
                      State.activeFilter = f.id;
                      m.route.set('/people/' + f.route);
                    },
                  })),
                });
              })(),
              ]),
          ]),
        ]),

        // Scrollable List Container
        m('.friends-list-container', [
          m('.friends-scroll', [
            displayItems.length === 0
              ? m('.network-pane-placeholder', State.mainTab === 'chats' ? 'No active chats' : 'No identities found')
              : shownItems.map((item) => {
                  let gxsId;
                  if (State.mainTab === 'people' && State.activeFilter === 'own') {
                    gxsId = item;
                  } else {
                    gxsId = item.mGroupId;
                  }

                  fetchIdDetails(gxsId);
                  const itemDetails = State.gxsIdToDetailsMap[gxsId];
                  const displayName = (itemDetails && (itemDetails.mNickname || itemDetails.mGroupName))
                    || (State.mainTab === 'people' && State.activeFilter === 'own'
                      ? rs.userList.username(gxsId)
                      : item.mGroupName)
                    || 'Loading…';
                  const itemAvatar = getSafeAvatar(itemDetails);
                  const itemFirstLetter = (displayName || '?').slice(0, 1).toUpperCase();
                  const isSelected = State.selectedId === gxsId;

                  const itemEntry = rs.userList.userMap[gxsId];
                  const itemIsContact = itemEntry && itemEntry.isContact;
                  const itemIsOwn = State.ownGxsIds.includes(gxsId);
                  const hasActiveTunnel = isDistantChatActive(gxsId);

                  const hist = State.chatHistoryMap[gxsId];
                  const lastTS = hist ? hist.lastTime : (itemDetails ? get64Num(itemDetails.mLastUsageTS) : 0);
                  const relativeTimeStr = formatRelativeTime(lastTS);
                  const lastMsgText = hist && hist.lastMsg
                    ? chatPreviewText(hist.lastMsg)
                    : (itemIsOwn ? 'My Identity' : itemIsContact ? 'Saved Contact' : 'Distant Chat');

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
                          State.mobilePane = 'detail';
                          markDistantChatRead(gxsId);
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
                            class: hasActiveTunnel ? 'is-good' : 'is-off',
                            title: hasActiveTunnel
                              ? 'Distant chat tunnel active'
                              : 'Distant chat tunnel inactive',
                          }),
                        ]),
                        m('.chat-info', [
                          m('.chat-name', displayName),
                          m('.chat-last-msg', lastMsgText),
                        ]),
                        m('.chat-meta', [
                          relativeTimeStr && m('.chat-time', relativeTimeStr),
                          (State.unreadChatCount[gxsId] || 0) > 0
                            && m('.chat-unread-badge', State.unreadChatCount[gxsId]),
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
                        State.mobilePane = 'detail';
                        if (idChanged) {
                          State.chatPid = null;
                          State.chatMessages = [];
                          stopStatusPolling();
                          //  Selecting somebody is not asking to talk to them.
                          //  The chat tab is sticky, so inheriting it here meant
                          //  that once a conversation had been opened, every
                          //  later click in the list silently requested a GXS
                          //  tunnel toward the contact -- an action the peer
                          //  sees. Show the profile; the tunnel waits for the
                          //  Chat Conversation tab.
                          State.activeTab = 'details';
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
            hiddenCount > 0 && m('.friends-list-more',
              `${hiddenCount} more identities — search to narrow the list`),
          ]),

          // Context Menu
          State.activeMenu && (() => {
            const menu = State.activeMenu;
            const isOwn = State.ownGxsIds.includes(menu.gxsId);

            return [
              m('.menu-backdrop', {
                onclick: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  State.activeMenu = null;
                  m.redraw();
                },
                oncontextmenu: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  State.activeMenu = null;
                  m.redraw();
                },
              }),
              m('.people-context-menu', {
                style: {
                  top: `${menu.top}px`,
                  left: menu.left !== undefined ? `${menu.left}px` : '10px',
                  position: 'absolute',
                  zIndex: 9999,
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
                  icon('comments'),
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
                  icon('envelope'),
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
                          //  isContact is read from rs.userList.userMap, which
                          //  only loadUsers() refreshes: reloading the identity
                          //  summaries alone left the list showing the old state.
                          rs.userList.loadUsers();
                          loadGxsIdentities();
                        }
                      }
                    );
                  },
                }, [
                  icon(menu.isContact ? 'user-minus' : 'user-plus'),
                  menu.isContact ? 'Remove from contacts' : 'Add to contacts',
                ]),
              ]),
            ];
          })(),
        ]),
      ]);
    },
  };
};

module.exports = PeopleSidebar;
