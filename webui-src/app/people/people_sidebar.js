const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const peopleUtil = require('people/people_util');
const ownIdsLayout = require('people/people_ownids');
const { CreateIdentity } = ownIdsLayout;
const {
  State,
  fetchIdDetails,
  loadGxsIdentities,
  getSafeAvatar,
  stopStatusPolling,
  initializeDistantChat,
} = require('people/people_state');

const PeopleSidebar = () => {
  return {
    view: () => {
      // 1. Get base list based on filter
      let baseList = [];
      if (State.activeFilter === 'own') {
        baseList = peopleUtil.sortIds(State.ownGxsIds) || [];
      } else if (State.activeFilter === 'contacts') {
        baseList = peopleUtil.contactlist(rs.userList.users) || [];
      } else {
        baseList = peopleUtil.sortUsers(rs.userList.users) || [];
      }

      // 2. Apply search filter
      const filteredList = baseList.filter((item) => {
        let name = '';
        if (State.activeFilter === 'own') {
          name = rs.userList.username(item) || 'Unknown';
        } else {
          name = item.mGroupName || 'Unknown';
        }
        return name.toLowerCase().includes(State.searchString.toLowerCase());
      });

      // Sort alphabetically by name
      filteredList.sort((a, b) => {
        let nameA = '';
        let nameB = '';
        if (State.activeFilter === 'own') {
          nameA = rs.userList.username(a) || '';
          nameB = rs.userList.username(b) || '';
        } else {
          nameA = a.mGroupName || '';
          nameB = b.mGroupName || '';
        }
        return nameA.localeCompare(nameB);
      });

      return m('.people-left-pane', [
        // Filter Tabs Group
        m('.people-filter-group', [
          m(
            'button.filter-btn' + (State.activeFilter === 'contacts' ? '.active' : ''),
            {
              onclick: () => {
                m.route.set('/people/MyContacts');
              },
            },
            'Contacts'
          ),
          m(
            'button.filter-btn' + (State.activeFilter === 'own' ? '.active' : ''),
            {
              onclick: () => {
                m.route.set('/people/OwnIdentity');
              },
            },
            'My Identities'
          ),
          m(
            'button.filter-btn' + (State.activeFilter === 'all' ? '.active' : ''),
            {
              onclick: () => {
                m.route.set('/people/All');
              },
            },
            'All'
          ),
        ]),

        // Create Identity container (only shown for "My Identities")
        State.activeFilter === 'own' &&
          m('.create-id-container', [
            m(
              'button.create-id-btn.blue',
              {
                onclick: () => widget.popupMessage(m(CreateIdentity)),
              },
              [m('i.fas.fa-plus-circle'), ' Create New Identity']
            ),
          ]),

        // Search bar
        m('.friends-list-container', [
          m('.searchbar-container', [
            m('input.searchbar[type=text][placeholder=Search Identities...]', {
              value: State.searchString,
              oninput: (e) => {
                State.searchString = e.target.value;
              },
            }),
          ]),

          // Scrollable list
          m('.friends-scroll', [
            filteredList.length === 0
              ? m('.network-pane-placeholder', { style: 'padding: 2rem 0;' }, 'No identities found')
              : filteredList.map((item) => {
                  let gxsId, displayName;
                  if (State.activeFilter === 'own') {
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

                  return m(
                    '.friend-list-item',
                    {
                      class: isSelected ? 'selected' : '',
                      onclick: (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const rect = e.currentTarget.getBoundingClientRect();
                        const container = document.querySelector('.friends-list-container');
                        if (container) {
                          const parentRect = container.getBoundingClientRect();
                          const top = rect.bottom - parentRect.top;
                          if (State.activeMenu && State.activeMenu.gxsId === gxsId) {
                            State.activeMenu = null;
                          } else {
                            State.activeMenu = { gxsId, displayName, isContact: itemIsContact, top };
                          }
                        }

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

                        const rect = e.currentTarget.getBoundingClientRect();
                        const container = document.querySelector('.friends-list-container');
                        if (container) {
                          const parentRect = container.getBoundingClientRect();
                          const top = rect.bottom - parentRect.top;
                          State.activeMenu = { gxsId, displayName, isContact: itemIsContact, top };
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
