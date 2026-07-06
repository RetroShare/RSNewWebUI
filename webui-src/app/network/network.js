const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const Data = require('network/network_data');
const peopleUtil = require('people/people_util');
const compose = require('mail/mail_compose');

// State variables for Network Page
const State = {
  ownProfile: {
    name: 'Loading...',
    ssl_id: '',
    gpg_id: '',
    customState: '',
    avatar: '',
  },
  ownGxsIds: [],
  selectedOwnGxsId: '',
  selectedOwnGxsDetails: null,
  selectedFriendGpgId: null,
  activeTab: 'details', // 'details' | 'chat'
  searchString: '',
  gpgToGxsIdMap: {},
  gxsIdToDetailsMap: {},
  currentChatPeerId: null,
  chatMessages: [],
  chatInputMsg: '',
  showMailCompose: false,
};

// Fetch own node name using the same API as config_node.js
function loadOwnProfile() {
  // Use rsConfig/getConfigNetStatus - the same proven endpoint used in config_node.js
  rs.rsJsonApiRequest('/rsConfig/getConfigNetStatus', {}, (data) => {
    if (data && data.status) {
      State.ownProfile.name = data.status.ownName || 'Unknown';
      State.ownProfile.ssl_id = data.status.ownId || '';

      // Fetch own custom status message using our own Location SSL ID
      if (State.ownProfile.ssl_id) {
        rs.rsJsonApiRequest('/rsChats/getCustomStateString', { peer_id: State.ownProfile.ssl_id }, (statusData) => {
          if (statusData && statusData.retval) {
            State.ownProfile.customState = statusData.retval;
            m.redraw();
          }
        });

        // Also fetch our own node GPG ID via getPeerDetails using our own SSL ID
        rs.rsJsonApiRequest('/rsPeers/getPeerDetails', { sslId: State.ownProfile.ssl_id }, (detData) => {
          if (detData && detData.det && detData.det.gpg_id) {
            State.ownProfile.gpg_id = detData.det.gpg_id;
            m.redraw();
          }
        });

        // Fetch own SSL avatar using our own Location SSL ID
        rs.rsJsonApiRequest('/rsChats/getAvatar', { pid: State.ownProfile.ssl_id }, (avatarData) => {
          if (avatarData && avatarData.retval && avatarData.avatar_base64_string) {
            State.ownProfile.avatar = avatarData.avatar_base64_string;
            m.redraw();
          }
        });
      }
      m.redraw();
    }
  });

  // Load own GXS identities using the existing utility
  peopleUtil.ownIds((ids) => {
    if (ids) {
      State.ownGxsIds = ids.filter(
        (id) => id && id !== '0000000000000000' && Number(id) !== 0
      );
      if (State.ownGxsIds.length > 0 && !State.selectedOwnGxsId) {
        State.selectedOwnGxsId = State.ownGxsIds[0];
        loadSelectedOwnGxsDetails();
      }
      m.redraw();
    }
  });
}

function loadSelectedOwnGxsDetails() {
  if (!State.selectedOwnGxsId) return;
  rs.rsJsonApiRequest(
    '/rsIdentity/getIdDetails',
    { id: State.selectedOwnGxsId },
    (data) => {
      if (data && data.details) {
        State.selectedOwnGxsDetails = data.details;
        m.redraw();
      }
    }
  );
}

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

// Start a direct chat with a friend using their SSL peer ID (type 1)
function startDirectChat(sslId) {
  State.currentChatPeerId = sslId;
  State.chatMessages = [];
  loadDirectChatMessages();
}

// Get the first online SSL ID for a friend, or fallback to first location
function getOnlineSslId(gpgId) {
  const friend = Data.gpgDetails[gpgId];
  if (!friend || !friend.locations || friend.locations.length === 0) return null;
  const onlineLoc = friend.locations.find((loc) => loc.isOnline);
  return onlineLoc ? onlineLoc.id : friend.locations[0].id;
}

// Load message history for direct chat (type 1 is not in the event handler,
// so we manage messages locally)
function loadDirectChatMessages() {
  // Messages are received via the event system and stored locally
  // Register for incoming chat messages
  rs.events[15].notify = (chatMessage) => {
    if (
      chatMessage.chat_id &&
      (chatMessage.chat_id.type === 1 || chatMessage.chat_id.type === 2) &&
      rs.idToHex(chatMessage.chat_id) === State.currentChatPeerId
    ) {
      State.chatMessages.push(chatMessage);
      m.redraw();
      scrollChatToBottom();
    }
  };
}

// Send direct chat message (type 1 / peer_id)
function sendDirectChatMessage() {
  if (!State.chatInputMsg.trim() || !State.currentChatPeerId) return;

  const msg = State.chatInputMsg;
  State.chatInputMsg = '';

  rs.rsJsonApiRequest(
    '/rsChats/sendChat',
    {
      id: { type: 1, peer_id: State.currentChatPeerId },
      msg: msg,
    },
    (data, success) => {
      if (success) {
        // Add own message to local log
        State.chatMessages.push({
          chat_id: { type: 1, peer_id: State.currentChatPeerId },
          msg,
          sendTime: Date.now() / 1000,
          incoming: false,
          own: true,
        });
        m.redraw();
        scrollChatToBottom();
      } else {
        console.error('[RS] Failed to send direct chat message');
      }
    }
  );
}

function scrollChatToBottom() {
  setTimeout(() => {
    const el = document.getElementById('chat-messages-container');
    if (el) el.scrollTop = el.scrollHeight;
  }, 100);
}

// Popup confirmation to remove friend SSL connection
const ConfirmRemove = () => {
  return {
    view: (vnode) => [
      m('h3', 'Remove Friend'),
      m('hr'),
      m('p', 'Are you sure you want to end connections with this node?'),
      m(
        'button',
        {
          onclick: () => {
            rs.rsJsonApiRequest('/rsPeers/removeFriend', {
              pgpId: vnode.attrs.gpg_id,
            });
            State.selectedFriendGpgId = null;
            Data.refreshGpgDetails().then(() => m.redraw());
            widget.popupMessage(m('p', 'Friend removed successfully.'));
          },
        },
        'Confirm'
      ),
    ],
  };
};

const OwnProfileCard = () => {
  return {
    view: () => {
      const avatar = State.ownProfile.avatar ? { mData: { base64: State.ownProfile.avatar } } : undefined;
      const firstLetter = (State.ownProfile.name || 'U').slice(0, 1).toUpperCase();

      return m('.own-profile-card', [
        m('.profile-header', [
          m(peopleUtil.UserAvatar, { avatar, firstLetter }),
          m('.profile-info', [
            m('.profile-name', State.ownProfile.name || 'Loading...'),
            m('.profile-status', 'Online'),
            State.ownProfile.customState &&
              m(
                '.profile-custom-status',
                {
                  style: 'font-size: 0.8rem; color: #94a3b8; font-style: italic; margin-top: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 150px;',
                  title: State.ownProfile.customState,
                },
                State.ownProfile.customState
              ),
          ]),
        ]),
      ]);
    },
  };
};

const FriendsList = () => {
  return {
    view: () => {
      const search = State.searchString.toLowerCase();
      const filteredFriends = Object.entries(Data.gpgDetails).filter(
        ([gpgId, friend]) => (friend.name || '').toLowerCase().includes(search)
      );

      return m('.friends-list-container', [
        m('.searchbar-container', [
          m('input.searchbar', {
            type: 'text',
            placeholder: 'Search friends...',
            value: State.searchString,
            oninput: (e) => {
              State.searchString = e.target.value;
            },
          }),
        ]),
        m('.friends-scroll', [
          filteredFriends.length === 0
            ? m('p', { style: 'padding: 1rem; color: #94a3b8; text-align: center;' }, 'No friends found')
            : filteredFriends
                .sort((a, b) => (a[1].isOnline === b[1].isOnline ? 0 : a[1].isOnline ? -1 : 1))
                .map(([gpgId, friend]) => {
                  const avatar = friend.avatar ? { mData: { base64: friend.avatar } } : undefined;
                  const firstLetter = (friend.name || '?').slice(0, 1).toUpperCase();
                  const isSelected = State.selectedFriendGpgId === gpgId;

                  return m(
                    `.friend-list-item${isSelected ? '.selected' : ''}`,
                    {
                      key: gpgId,
                      onclick: () => {
                        State.selectedFriendGpgId = gpgId;
                        State.currentChatPeerId = null;
                        State.chatMessages = [];
                        if (State.activeTab === 'chat') {
                          const sslId = getOnlineSslId(gpgId);
                          if (sslId) startDirectChat(sslId);
                        }
                      },
                    },
                    [
                      m('.friend-avatar', m(peopleUtil.UserAvatar, { avatar, firstLetter })),
                      m('.friend-meta', [
                        m('.friend-name', friend.name),
                        m(
                          `.friend-status${friend.isOnline ? '.online' : ''}`,
                          friend.isOnline ? 'Online' : 'Offline'
                        ),
                        friend.customState &&
                          m(
                            '.friend-custom-status',
                            {
                              style: 'font-size: 0.85rem; color: #64748b; margin-top: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 160px;',
                              title: friend.customState,
                            },
                            friend.customState
                          ),
                      ]),
                    ]
                  );
                }),
        ]),
      ]);
    },
  };
};

// Right Pane Tabs and Tab Views
const DetailsTab = () => {
  return {
    view: () => {
      const gpgId = State.selectedFriendGpgId;
      const friend = Data.gpgDetails[gpgId];
      if (!friend) return null;

      const friendGxsId = State.gpgToGxsIdMap[gpgId.toLowerCase()];

      return m('.network-detail-view', [
        m('.detail-header', [
          m('.friend-avatar', m(peopleUtil.UserAvatar, {
            avatar: friend.avatar ? { mData: { base64: friend.avatar } } : undefined,
            firstLetter: (friend.name || '?').slice(0, 1).toUpperCase(),
            size: 128,
          })),
          m('.detail-title', [
            m('h2', friend.name),
            m('.detail-subtitle', [
              m('i.fas.fa-fingerprint'),
              m('span', 'GPG ID: ' + gpgId),
            ]),
          ]),
          m('.detail-actions', [
            m(
              'button',
              {
                onclick: () => {
                  const sslId = getOnlineSslId(gpgId);
                  if (sslId) {
                    State.activeTab = 'chat';
                    startDirectChat(sslId);
                  }
                },
              },
              [m('i.fas.fa-comments'), ' Start Chat']
            ),
            m(
              'button',
              {
                onclick: () => {
                  State.showMailCompose = true;
                },
              },
              [m('i.fas.fa-envelope'), ' Send Mail']
            ),
          ]),
        ]),

        m('.detail-section', [
          m('h3', 'Profile Info'),
          m('.info-grid', [
            m('.info-label', 'Status'),
            m(
              '.info-value',
              { style: friend.isOnline ? 'color: #10b981; font-weight: 600;' : '' },
              friend.isOnline ? 'Online' : 'Offline'
            ),
            m('.info-label', 'Custom Status'),
            m(
              '.info-value',
              { style: 'font-style: italic; color: #64748b;' },
              friend.customState || 'None'
            ),
            friendGxsId ? [
              m('.info-label', 'GXS Identity'),
              m('.info-value', friendGxsId),
            ] : null,
            m('.info-label', 'Node GPG Key'),
            m('.info-value', gpgId),
          ]),
        ]),

        m('.detail-section', [
          m('h3', 'Locations (' + friend.locations.length + ')'),
          m(
            '.locations-grid',
            friend.locations
              .slice()
              .sort((a, b) => (a.isOnline === b.isOnline ? 0 : a.isOnline ? -1 : 1))
              .map((loc) =>
              m('.location-card', { key: loc.id }, [
                m('.loc-header', [
                  m('.loc-name', loc.name),
                  m(
                    '.loc-status' + (loc.isOnline ? '.online' : '.offline'),
                    loc.isOnline ? 'Online' : 'Offline'
                  ),
                ]),
                m('.loc-body', [
                  m('.loc-label', 'SSL ID'),
                  m('.loc-val', loc.id),
                  m('.loc-label', 'Last Seen'),
                  m('.loc-val', new Date(loc.lastSeen * 1000).toLocaleString()),
                ]),
                m('.loc-footer', [
                  m(
                    'button.red',
                    {
                      onclick: () =>
                        widget.popupMessage(
                          m(ConfirmRemove, {
                            gpg_id: loc.gpg_id,
                          })
                        ),
                    },
                    'Remove Location'
                  ),
                ]),
              ])
            )
          ),
        ]),
      ]);
    },
  };
};

const ChatTab = () => {
  return {
    view: () => {
      const gpgId = State.selectedFriendGpgId;
      const friend = Data.gpgDetails[gpgId];
      if (!friend) return null;

      const sslId = getOnlineSslId(gpgId);

      if (!sslId) {
        return m('.network-chat-view', [
          m('.chat-warning', [
            m('i.fas.fa-exclamation-triangle'),
            m('h4', 'No Location Found'),
            m('p', 'This friend has no known locations to start a direct chat with.'),
          ]),
        ]);
      }

      if (!State.currentChatPeerId) {
        return m('.network-chat-view', [
          m('.chat-warning', [
            m('i.fas.fa-comments'),
            m('h4', 'Direct Chat'),
            m('p', 'Click below to start a direct chat with ' + friend.name + '.'),
            m(
              'button',
              {
                onclick: () => startDirectChat(sslId),
              },
              'Start Chat'
            ),
          ]),
        ]);
      }

      return m('.network-chat-view', [
        (() => {
          const activeLoc = friend.locations.find((loc) => loc.id === State.currentChatPeerId);
          const locName = activeLoc ? activeLoc.name : 'Unknown Location';
          const locOnline = activeLoc ? activeLoc.isOnline : false;
          return m('.chat-header-bar', {
            style: {
              padding: '0.75rem 1rem',
              backgroundColor: '#ffffff',
              borderBottom: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }
          }, [
            m('.chat-header-info', [
              m('.chat-header-name', { style: { fontWeight: '700', color: '#1e293b' } }, friend.name),
              m('.chat-header-location', { style: { fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', marginTop: '0.25rem' } }, [
                m('span', 'Location: ' + locName),
                m('span.status-dot', {
                  style: {
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: locOnline ? '#10b981' : '#ef4444',
                    marginLeft: '6px',
                    marginRight: '4px'
                  }
                }),
                m('span', { style: { color: locOnline ? '#10b981' : '#ef4444', fontWeight: '500' } }, locOnline ? 'Online' : 'Offline')
              ])
            ])
          ]);
        })(),
        m(
          '.chat-messages[id=chat-messages-container]',
          State.chatMessages.map((msg) => {
            const isOwn = msg.own === true;
            const senderName = isOwn
              ? (State.ownProfile.name || 'Me')
              : friend.name;
            const time = new Date(msg.sendTime * 1000).toLocaleTimeString();
            const text = (msg.msg || '')
              .replaceAll('<br/>', '\n')
              .replace(new RegExp('<style[^<]*</style>|<[^>]*>', 'gm'), '');

            return m(
              '.chat-bubble-container' + (isOwn ? '.outgoing' : '.incoming'),
              [
                !isOwn && m('.chat-sender', senderName),
                m('.chat-bubble', text),
                m('.chat-time', time),
              ]
            );
          })
        ),
        m('.chat-input-area', [
          m('textarea.chat-textarea', {
            placeholder: 'Type your message... Press Enter to send',
            value: State.chatInputMsg,
            oninput: (e) => {
              State.chatInputMsg = e.target.value;
            },
            onkeydown: (e) => {
              if (e.code === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendDirectChatMessage();
              }
            },
          }),
          m(
            'button.send-btn',
            {
              onclick: () => sendDirectChatMessage(),
            },
            [m('i.fas.fa-paper-plane'), ' Send']
          ),
        ]),
      ]);
    },
  };
};

const NetworkLayout = () => {
  return {
    oninit: () => {
      Data.refreshGpgDetails().then(() => m.redraw());
      loadOwnProfile();
      loadGxsIdentities();
    },
    onremove: () => {
      // Clean up notify callback when page is left
      if (rs.events[15]) {
        rs.events[15].notify = () => {};
      }
    },
    view: () => {
      const selectedFriend = State.selectedFriendGpgId
        ? Data.gpgDetails[State.selectedFriendGpgId]
        : null;

      const selectedGxsId = State.selectedFriendGpgId
        ? State.gpgToGxsIdMap[State.selectedFriendGpgId.toLowerCase()]
        : null;

      return m('.network-container', [
        m('.network-left-pane', [m(OwnProfileCard), m(FriendsList)]),
        m('.network-right-pane', [
          selectedFriend
            ? [
                m('.network-tabs', [
                  m(
                    'button.tab-btn' + (State.activeTab === 'details' ? '.active' : ''),
                    {
                      onclick: () => {
                        State.activeTab = 'details';
                      },
                    },
                    'Details View'
                  ),
                  m(
                    'button.tab-btn' + (State.activeTab === 'chat' ? '.active' : ''),
                    {
                      onclick: () => {
                        State.activeTab = 'chat';
                        const sslId = getOnlineSslId(State.selectedFriendGpgId);
                        if (sslId && !State.currentChatPeerId) {
                          startDirectChat(sslId);
                        }
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
                m('i.fas.fa-network-wired'),
                m('p', 'Select a friend node from the left side panel to view locations details or start a private chat.'),
              ]),
        ]),
        // Mail composer overlay popup
        State.showMailCompose &&
          State.selectedFriendGpgId &&
          m(
            '.composePopupOverlay#mailComposerPopup',
            { style: { display: 'block' } },
            m(
              '.composePopup',
              m(compose, {
                msgType: 'compose',
                toId: selectedGxsId || State.selectedFriendGpgId,
                friendName: selectedFriend ? selectedFriend.name : 'Unknown Friend',
                isDirectMail: true,
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

module.exports = NetworkLayout;
