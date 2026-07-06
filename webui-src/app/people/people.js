const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const Data = require('network/network_data');
const peopleUtil = require('people/people_util');
const compose = require('mail/mail_compose');
const ownIdsLayout = require('people/people_ownids');
const { CreateIdentity, EditIdentity, DeleteIdentity } = ownIdsLayout;

// State variables for People Page
const State = {
  searchString: '',
  selectedId: null, // GXS ID of the selected identity
  activeFilter: 'contacts', // 'all' | 'contacts' | 'own'
  gxsIdToDetailsMap: {},
  ownGxsIds: [],
  gpgToGxsIdMap: {},
  showMailCompose: false,
  activeTab: 'details',
  selectedOwnGxsIdForChat: '',
  chatPid: null,
  chatMessages: [],
  chatInputMsg: '',
};

// Build map GPG ID -> GXS ID for all known identities
function loadGxsIdentities() {
  rs.rsJsonApiRequest('/rsIdentity/getIdentitiesSummaries', {}, (data) => {
    if (data && data.ids) {
      data.ids.forEach((user) => {
        const gxsId = user.mGroupId;
        rs.rsJsonApiRequest('/rsIdentity/getIdDetails', { id: gxsId }, (detData) => {
          if (detData && detData.details) {
            State.gxsIdToDetailsMap[gxsId] = detData.details;
            const pgpId = detData.details.mPgpId;
            if (pgpId && pgpId !== '0000000000000000') {
              State.gpgToGxsIdMap[pgpId.toLowerCase()] = gxsId;
            }
            m.redraw();
          }
        });
      });
    }
  });
}

function loadOwnGxsIds() {
  return new Promise((resolve) => {
    peopleUtil.ownIds((ids) => {
      State.ownGxsIds = ids || [];
      if (State.ownGxsIds.length > 0 && !State.selectedOwnGxsIdForChat) {
        State.selectedOwnGxsIdForChat = State.ownGxsIds[0];
      }
      m.redraw();
      resolve();
    });
  });
}

// Helpers
function getSafeAvatar(details) {
  return details && details.mAvatar ? details.mAvatar : undefined;
}

function getOnlineSslId(gpgId) {
  if (!gpgId) return null;
  const friend = Data.gpgDetails[gpgId.toLowerCase()];
  if (friend && friend.locations) {
    const onlineLoc = friend.locations.find((loc) => loc.isOnline);
    return onlineLoc ? onlineLoc.id : null;
  }
  return null;
}

function isIdentityOnline(gxsId) {
  const details = State.gxsIdToDetailsMap[gxsId];
  if (details && details.mPgpId && details.mPgpId !== '0000000000000000') {
    const friend = Data.gpgDetails[details.mPgpId.toLowerCase()];
    return friend ? friend.isOnline : false;
  }
  return false;
}

function syncFilter(tab) {
  let newFilter = 'all';
  if (tab === 'OwnIdentity') {
    newFilter = 'own';
  } else if (tab === 'MyContacts') {
    newFilter = 'contacts';
  }

  if (State.activeFilter !== newFilter) {
    State.activeFilter = newFilter;
    State.selectedId = null;
    State.chatPid = null;
    State.chatMessages = [];
    State.chatInputMsg = '';
    State.activeTab = 'details';
  }
}

function initializeDistantChat() {
  if (!State.selectedId || !State.selectedOwnGxsIdForChat) return;

  State.chatPid = null;
  State.chatMessages = [];
  m.redraw();

  rs.rsJsonApiRequest(
    '/rsChats/initiateDistantChatConnexion',
    {
      to_pid: State.selectedId,
      from_pid: State.selectedOwnGxsIdForChat,
      notify: true,
    },
    (res) => {
      if (res && res.pid) {
        State.chatPid = rs.idToHex(res.pid);
        loadChatMessages();
      }
    }
  );
}

function loadChatMessages() {
  if (!State.chatPid) return;

  const chatPeerId = {
    broadcast_status_peer_id: '00000000000000000000000000000000',
    type: 2, // DISTANT
    peer_id: '00000000000000000000000000000000',
    distant_chat_id: State.chatPid,
    lobby_id: { xstr64: '0' },
  };

  rs.rsJsonApiRequest(
    '/rsHistory/getMessages',
    {
      chatPeerId: chatPeerId,
      loadCount: 50,
    },
    (data, success) => {
      if (success && data.msgs) {
        State.chatMessages = data.msgs;
        m.redraw();
        // Scroll to bottom
        setTimeout(() => {
          const element = document.querySelector('.chat-messages');
          if (element) element.scrollTop = element.scrollHeight;
        }, 100);
      }
    }
  );
}

function sendDistantChatMessage() {
  if (!State.chatInputMsg.trim() || !State.chatPid) return;

  const cid = {
    broadcast_status_peer_id: '00000000000000000000000000000000',
    type: 2, // DISTANT
    peer_id: '00000000000000000000000000000000',
    distant_chat_id: State.chatPid,
    lobby_id: { xstr64: '0' },
  };

  const text = State.chatInputMsg;
  State.chatInputMsg = '';

  // Optimistic echo
  const echoMsg = {
    chat_id: cid,
    msg: text,
    sendTime: Math.floor(Date.now() / 1000),
    incoming: false,
    lobby_peer_gxs_id: State.selectedOwnGxsIdForChat,
  };
  State.chatMessages.push(echoMsg);
  m.redraw();
  setTimeout(() => {
    const element = document.querySelector('.chat-messages');
    if (element) element.scrollTop = element.scrollHeight;
  }, 100);

  rs.rsJsonApiRequest(
    '/rsChats/sendChat',
    {
      id: cid,
      msg: text,
    },
    (data, success) => {
      if (!success) {
        console.error('[RS] Failed to send distant chat message');
      }
    }
  );
}

const DetailsTab = () => {
  return {
    view: () => {
      const details = State.selectedId ? State.gxsIdToDetailsMap[State.selectedId] : null;
      if (!details) return null;

      const name = details.mNickname || details.mGroupName || 'Unknown';
      const isOwn = State.ownGxsIds.includes(State.selectedId);
      const entry = rs.userList.userMap[State.selectedId];
      const isContact = entry && entry.isContact;
      const pgpId = details.mPgpId;

      return m('.network-detail-view', [
        m('.detail-header', [
          m('.friend-avatar', m(peopleUtil.UserAvatar, {
            avatar: getSafeAvatar(details),
            firstLetter: (name || '?').slice(0, 1).toUpperCase(),
            identityId: State.selectedId,
            size: 128,
            isSquare: true,
          })),
          m('.detail-title', [
            m('h2', name),
            m('.detail-subtitle', [
              m('i.fas.fa-id-card'),
              m('span', isOwn ? 'My Identity' : isContact ? 'Saved Contact' : 'Discovered Identity'),
            ]),
          ]),
          m('.detail-actions', [
            isOwn
              ? [
                  m(
                    'button.btn',
                    {
                      onclick: () =>
                        widget.popupMessage(
                          m(EditIdentity, {
                            details,
                          })
                        ),
                    },
                    [m('i.fas.fa-edit'), ' Edit']
                  ),
                  m(
                    'button.btn.red',
                    {
                      onclick: () =>
                        widget.popupMessage(
                          m(DeleteIdentity, {
                            id: details.mId,
                            name: details.mNickname,
                          })
                        ),
                    },
                    [m('i.fas.fa-trash-alt'), ' Delete']
                  ),
                ]
              : [
                  m(
                    'button.btn.blue',
                    {
                      onclick: () => {
                        State.activeTab = 'chat';
                        initializeDistantChat();
                      },
                    },
                    [m('i.fas.fa-comment-alt'), ' Start Chat']
                  ),
                  m(
                    'button.btn',
                    {
                      onclick: () => {
                        State.showMailCompose = true;
                      },
                    },
                    [m('i.fas.fa-envelope'), ' Send Mail']
                  ),
                  m(
                    'button.btn' + (isContact ? '.red' : '.blue'),
                    {
                      onclick: () => {
                        rs.rsJsonApiRequest(
                          '/rsIdentity/setAsRegularContact',
                          { id: State.selectedId, isContact: !isContact },
                          () => {
                            rs.userList.loadUsers();
                            loadGxsIdentities();
                          }
                        );
                      },
                    },
                    isContact
                      ? [m('i.fas.fa-user-minus'), ' Remove Contact']
                      : [m('i.fas.fa-user-plus'), ' Add Contact']
                  ),
                ],
          ]),
        ]),
        m('.detail-section', [
          m('h3', 'Identity Info'),
          m('.info-grid', [
            m('.info-label', 'GXS ID'),
            m('.info-value', details.mId),
            m('.info-label', 'Type'),
            m('.info-value', details.mFlags === 14 ? 'Signed ID' : 'Anonymous ID'),
            m('.info-label', 'Owner Node GPG'),
            m('.info-value', pgpId && pgpId !== '0000000000000000' ? pgpId : 'None'),
            m('.info-label', 'Created On'),
            m(
              '.info-value',
              typeof details.mPublishTS === 'object'
                ? new Date(details.mPublishTS.xint64 * 1000).toLocaleString()
                : 'Unknown'
            ),
            m('.info-label', 'Last Used'),
            m(
              '.info-value',
              typeof details.mLastUsageTS === 'object'
                ? new Date(details.mLastUsageTS.xint64 * 1000).toLocaleDateString()
                : 'Unknown'
            ),
          ]),
        ]),
      ]);
    },
  };
};

const ChatTab = () => {
  return {
    view: () => {
      const details = State.selectedId ? State.gxsIdToDetailsMap[State.selectedId] : null;
      if (!details) return null;

      const name = details.mNickname || details.mGroupName || 'Unknown';

      if (State.ownGxsIds.length === 0) {
        return m('.chat-warning', [
          m('i.fas.fa-exclamation-triangle'),
          m('h4', 'No Identities Found'),
          m('p', 'You need to create a GXS identity in the "My Identities" tab before you can start distant chats.'),
        ]);
      }

      if (!State.chatPid) {
        return m('.chat-warning', [
          m('i.fas.fa-spinner.fa-spin'),
          m('h4', 'Connecting...'),
          m('p', 'Initiating distant chat tunnel to the peer identity...'),
        ]);
      }

      return m('.network-chat-view', [
        m('.chat-identity-select-container', {
          style: 'padding: 0.5rem 1rem; background-color: #ffffff; border-bottom: 1px solid #cbd5e1; display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem;'
        }, [
          m('span', { style: 'color: #64748b; font-weight: 500;' }, 'Distant Chat Tunnel'),
          m('.select-own-profile', [
            m('span', { style: 'margin-right: 0.5rem; color: #64748b;' }, 'Chatting as:'),
            m('select', {
              style: 'padding: 0.25rem 0.5rem; border-radius: 0.25rem; border: 1px solid #cbd5e1; outline: none; background: #f8fafc; font-weight: 600;',
              value: State.selectedOwnGxsIdForChat,
              onchange: (e) => {
                State.selectedOwnGxsIdForChat = e.target.value;
                initializeDistantChat();
              },
            }, State.ownGxsIds.map(id => m('option', { value: id }, rs.userList.username(id)))),
          ]),
        ]),

        // Messages area
        m('.chat-messages', [
          State.chatMessages.length === 0
            ? m('.chat-warning', [
                m('i.fas.fa-comments'),
                m('h4', 'No Messages'),
                m('p', 'Distant chats are secure and encrypted. Start the conversation by typing a message below.'),
              ])
            : State.chatMessages.map((msg) => {
                const isIncoming = msg.incoming;
                const senderName = isIncoming ? name : rs.userList.username(State.selectedOwnGxsIdForChat);
                
                return m('.chat-bubble-container' + (isIncoming ? '.incoming' : '.outgoing'), [
                  m('.chat-sender', senderName),
                  m('.chat-bubble', msg.msg || msg.message),
                  m('.chat-time', new Date(msg.sendTime * 1000).toLocaleTimeString()),
                ]);
              }),
        ]),

        // Input area
        m('.chat-input-area', [
          m('textarea.chat-textarea[placeholder=Type your encrypted message here...]', {
            value: State.chatInputMsg,
            oninput: (e) => {
              State.chatInputMsg = e.target.value;
            },
            onkeydown: (e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendDistantChatMessage();
              }
            },
          }),
          m(
            'button.send-btn.blue',
            {
              onclick: () => sendDistantChatMessage(),
            },
            [m('i.fas.fa-paper-plane'), ' Send']
          ),
        ]),
      ]);
    },
  };
};

const PeopleLayout = () => {
  return {
    oninit: (vnode) => {
      syncFilter(vnode.attrs.tab);
      Data.refreshGpgDetails().then(() => m.redraw());
      loadGxsIdentities();
      loadOwnGxsIds();

      // Register for chatEvents to receive live incoming messages
      rs.events[15].notify = (chatMessage) => {
        const msgCid = chatMessage.chat_id;
        if (msgCid && msgCid.type === 2 && State.chatPid) {
          const msgPid = rs.idToHex(msgCid.distant_chat_id);
          if (msgPid === State.chatPid) {
            const isNearDuplicate = State.chatMessages.some(
              (m) => (m.msg || m.message) === chatMessage.msg && Math.abs(m.sendTime - chatMessage.sendTime) < 5
            );
            if (!isNearDuplicate) {
              State.chatMessages.push(chatMessage);
              State.chatMessages.sort((a, b) => a.sendTime - b.sendTime);
              m.redraw();
              setTimeout(() => {
                const element = document.querySelector('.chat-messages');
                if (element) element.scrollTop = element.scrollHeight;
              }, 100);
            }
          }
        }
      };
    },
    onremove: () => {
      // Clean up notify callback when page is left
      if (rs.events[15]) {
        rs.events[15].notify = () => {};
      }
    },
    onupdate: (vnode) => {
      syncFilter(vnode.attrs.tab);
    },
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

      // 3. Selected details details info
      const details = State.selectedId ? State.gxsIdToDetailsMap[State.selectedId] : null;
      const name = details ? details.mNickname || details.mGroupName || 'Unknown' : '';

      return m('.people-container', [
        // Left Side Panel
        m('.people-left-pane', [
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
                        onclick: () => {
                          const idChanged = State.selectedId !== gxsId;
                          State.selectedId = gxsId;
                          if (idChanged) {
                            State.chatPid = null;
                            State.chatMessages = [];
                            if (State.activeTab === 'chat') {
                              initializeDistantChat();
                            }
                          }
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
          ]),
        ]),

        // Right Side Details / Actions Pane
        m('.people-right-pane', [
          State.selectedId && details
            ? [
                m('.network-tabs', [
                  m(
                    'button.tab-btn' + (State.activeTab === 'details' ? '.active' : ''),
                    {
                      onclick: () => {
                        State.activeTab = 'details';
                      },
                    },
                    'Profile Details'
                  ),
                  m(
                    'button.tab-btn' + (State.activeTab === 'chat' ? '.active' : ''),
                    {
                      onclick: () => {
                        State.activeTab = 'chat';
                        initializeDistantChat();
                      },
                    },
                    'Chat Conversation'
                  ),
                ]),
                m('.network-tab-content', [
                  State.activeTab === 'details' ? m(DetailsTab) : m(ChatTab),
                ]),
              ]
            : m('.network-pane-placeholder', [
                m('i.fas.fa-users'),
                m('p', 'Select an identity from the left panel to view profile details or perform actions.'),
              ]),
        ]),

        // Mail composer overlay popup
        State.showMailCompose &&
          State.selectedId &&
          m(
            '.composePopupOverlay#mailComposerPopup',
            { style: { display: 'block' } },
            m(
              '.composePopup',
              m(compose, {
                msgType: 'compose',
                toId: State.selectedId,
                friendName: name,
                isDirectMail: false,
                setShowCompose: (val) => {
                  State.showMailCompose = val;
                },
              }),
              m(
                'button.red.close-btn',
                {
                  onclick: () => {
                    State.showMailCompose = false;
                  },
                },
                m('i.fas.fa-times')
              )
            )
          ),
      ]);
    },
  };
};

module.exports = PeopleLayout;
