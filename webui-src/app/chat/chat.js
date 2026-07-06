const m = require('mithril');
const rs = require('rswebui');
const peopleUtil = require('people/people_util');

// **************** utility functions ********************

function loadLobbyDetails(id, apply) {
  rs.rsJsonApiRequest(
    '/rsChats/getChatLobbyInfo',
    {
      id: { xstr64: id },
    },
    (detail, success) => {
      if (success && detail.retval) {
        detail.info.chatType = 3; // LOBBY
        apply(detail.info);
      } else {
        apply(null);
      }
    },
    true
  );
}

function loadDistantChatDetails(pid, apply) {
  // pid is DistantChatPeerId (uint32)
  rs.rsJsonApiRequest(
    '/rsChats/getDistantChatStatus',
    {
      pid: pid,
    },
    (detail, success) => {
      if (success && detail.retval) {
        // Map to lobby-like structure for UI compatibility
        const info = detail.info;
        info.chatType = 2; // DISTANT (matches TYPE_PRIVATE_DISTANT in rschats.h)
        info.lobby_name = rs.userList.username(info.to_id) || 'Distant Chat ' + pid;
        info.lobby_topic = 'Private Encrypted Chat';
        info.gxs_id = info.own_id;
        info.lobby_id = pid; // Distant IDs are 128-bit hex strings, NO xstr64 wrapper
        apply(info);
      } else {
        apply(null);
      }
    },
    true
  );
}

function sortLobbies(lobbies) {
  if (lobbies !== undefined && lobbies !== null) {
    const list = [...lobbies];
    list.sort((a, b) => a.lobby_name.localeCompare(b.lobby_name));
    return list;
  }
  return []; // return empty array instead of undefined
}

// ***************************** models ***********************************

const MobileState = {
  showLobbies: false,
  showUsers: false,
  toggleLobbies() {
    this.showLobbies = !this.showLobbies;
    this.showUsers = false;
  },
  toggleUsers() {
    this.showUsers = !this.showUsers;
    this.showLobbies = false;
  },
  closeAll() {
    this.showLobbies = false;
    this.showUsers = false;
  },
};


const ChatRoomsModel = {
  allRooms: [],
  knownSubscrIds: [], // to exclude subscribed from public rooms (subscribedRooms filled to late)
  subscribedRooms: {},
  loadPublicRooms() {
    // TODO: this doesn't preserve id of rooms,
    // use regex on response to extract ids.
    rs.rsJsonApiRequest(
      '/rsChats/getListOfNearbyChatLobbies',
      {},
      (data) => {
        if (data && data.public_lobbies) {
          // Deduplicate by ID to avoid double display if backend returns redundant info
          const seen = new Set();
          const uniqueLobbies = data.public_lobbies.filter((lobby) => {
            const id = rs.idToHex(lobby.lobby_id);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          ChatRoomsModel.allRooms = sortLobbies(uniqueLobbies);
        } else {
          // No public lobbies
          ChatRoomsModel.allRooms = [];
        }
      }
    );
  },
  loadSubscribedRooms(after = null) {
    rs.rsJsonApiRequest(
      '/rsChats/getChatLobbyList',
      {},
      (data) => {
        if (data && data.cl_list) {
          // Robust deduplication of IDs
          const ids = [...new Set(data.cl_list.map((lid) => rs.idToHex(lid)))];
          ChatRoomsModel.knownSubscrIds = ids;

          // Remove stale entries that are no longer in the subscribed list
          Object.keys(ChatRoomsModel.subscribedRooms).forEach((id) => {
            if (!ids.includes(id)) {
              delete ChatRoomsModel.subscribedRooms[id];
            }
          });

          if (ids.length === 0) {
            ChatRoomsModel.loadPublicRooms();
            if (after != null) after();
            m.redraw();
            return;
          }

          let count = 0;
          ids.forEach((id) =>
            loadLobbyDetails(id, (info) => {
              if (info) {
                ChatRoomsModel.subscribedRooms[id] = info;
              }
              count++;
              if (count === ids.length) {
                ChatRoomsModel.loadPublicRooms(); // Load public rooms after we know all subscribed IDs
                if (after != null) {
                  after();
                }
                m.redraw();
              }
            })
          );
        } else {
          // No subscribed lobbies
          ChatRoomsModel.loadPublicRooms();
        }
      }
    );
  },
  subscribed(info) {
    return this.knownSubscrIds.includes(rs.idToHex(info.lobby_id));
  },
};

/**
 * Message displays a single Chat-Message<br>
 * currently removes formatting and in consequence inline links
 * msg: Message to Display
 */
const Message = () => {
  return {
    view: (vnode) => {
      const msg = vnode.attrs;
      const datetime = new Date(msg.sendTime * 1000).toLocaleTimeString();
      // Handle both HistoryMsg (peerId) and ChatMessage (lobby_peer_gxs_id)
      const rawGxsId = msg.lobby_peer_gxs_id || msg.peerId;
      let gxsId = rs.idToHex(rawGxsId);

      // Fallback for 1-to-1 chats where sender ID might be missing (zeros)
      const isZero = (id) => !id || id === '00000000000000000000000000000000';
      if (isZero(gxsId)) {
        const lobby = ChatLobbyModel.currentLobby;
        // Types 1 (Private), 2 (Distant) are "private" conversations here
        if (lobby && (lobby.chatType === 1 || lobby.chatType === 2)) {
          gxsId = msg.incoming ? rs.idToHex(lobby.to_id || lobby.peer_id || lobby.distant_chat_id) : rs.idToHex(lobby.own_id || lobby.gxs_id);
        }
      }

      let username = rs.userList.username(gxsId) || msg.peerName || '???';
      // If we only have the hex ID, try to fallback to the peerName from the message
      if (username === gxsId && msg.peerName) {
        username = msg.peerName;
      }
      if (username === gxsId && gxsId && gxsId.length > 12) {
        username = gxsId.substring(0, 8) + '...';
      }
      const text = (msg.msg || msg.message || '')
        .replaceAll('<br/>', '\n')
        .replace(new RegExp('<style[^<]*</style>|<[^>]*>', 'gm'), '');
      return m(
        '.message' + (msg.incoming ? '.incoming' : '.outgoing'),
        m('span.datetime', datetime),
        m('span.username', username),
        m('span.messagetext', text)
      );
    },
  };
};

const ChatLobbyModel = {
  currentLobby: {
    lobby_name: '...',
  },
  lobby_user: '...',
  isSubscribed: false,
  messages: [],
  users: [],
  messageKeys: new Set(),
  lastLobbyId: null,

  // Helper to generate a unique key for deduplication
  getMessageKey(msg) {
    if (msg.msgId && msg.msgId !== 0) return 'id_' + msg.msgId;
    // Fallback for live messages or history without IDs
    const text = msg.msg || msg.message || '';
    return 't_' + msg.sendTime + '_' + text.substring(0, 32);
  },

  addMessages(newMsgs, scroll = false) {
    let added = false;
    newMsgs.forEach((msg) => {
      const key = this.getMessageKey(msg);
      if (!this.messageKeys.has(key)) {
        // Near-duplicate check for messages without IDs (live events vs optimistic echo)
        const text = msg.msg || msg.message || '';
        const isNearDuplicate = this.messages.some((existingMsg) => {
          const eAttrs = existingMsg.attrs;
          const eText = eAttrs.msg || eAttrs.message || '';
          return (
            eText === text &&
            Math.abs(eAttrs.sendTime - msg.sendTime) < 5 // 5 seconds window
          );
        });

        if (!isNearDuplicate) {
          this.messageKeys.add(key);
          this.messages.push(m(Message, msg));
          added = true;
        }
      }
    });

    if (added) {
      this.messages.sort((a, b) => a.attrs.sendTime - b.attrs.sendTime);
      m.redraw();
      if (scroll) {
        setTimeout(() => {
          const element = document.querySelector('.messages');
          if (element) {
            element.scrollTop = element.scrollHeight;
          }
        }, 100);
      }
    }
  },

  loadHistory(id, type) {
    const chatPeerId = {
      broadcast_status_peer_id: '00000000000000000000000000000000',
      type: type,
      peer_id: '00000000000000000000000000000000',
      distant_chat_id: '00000000000000000000000000000000',
      lobby_id: { xstr64: '0' },
    };

    if (type === 3) chatPeerId.lobby_id.xstr64 = id;
    else if (type === 2) chatPeerId.distant_chat_id = id;
    else if (type === 1) chatPeerId.peer_id = id;

    rs.rsJsonApiRequest(
      '/rsHistory/getMessages',
      {
        chatPeerId: chatPeerId,
        loadCount: 20,
      },
      (data, success) => {
        if (success && data.msgs) {
          this.addMessages(data.msgs);
        }
      }
    );
  },
  setupAction: (lobbyId, nick) => { },
  setIdentity(lobbyId, nick) {
    rs.rsJsonApiRequest(
      '/rsChats/setIdentityForChatLobby',
      {
        lobby_id: { xstr64: lobbyId },
        nick: nick,
      },
      () => m.route.set('/chat/:lobby', { lobby: lobbyId }),
      true
    );
  },
  enterPublicLobby(lobbyId, nick) {
    // Set lobby nickname
    rs.rsJsonApiRequest(
      '/rsChats/joinVisibleChatLobby',
      {
        lobby_id: { xstr64: lobbyId },
        own_id: nick,
      },
      () => {
        loadLobbyDetails(lobbyId, (info) => {
          ChatRoomsModel.subscribedRooms[lobbyId] = info;
          ChatRoomsModel.loadSubscribedRooms(() => {
            m.route.set('/chat/:lobby', { lobby: rs.idToHex(info.lobby_id) });
          });
        });
      },
      true
    );
  },
  unsubscribeChatLobby(lobbyId, follow) {
    // Unsubscribe
    rs.rsJsonApiRequest(
      '/rsChats/unsubscribeChatLobby',
      {
        lobby_id: { xstr64: lobbyId },
      },
      (data, success) => {
        if (success) {
          ChatRoomsModel.loadSubscribedRooms(follow);
        }
      },
      true
    );
  },
  chatId() {
    const type = (this.currentLobby && this.currentLobby.chatType) || 3;
    const id = this.lastLobbyId || m.route.param('lobby');
    const cid = {
      broadcast_status_peer_id: '00000000000000000000000000000000',
      type: type,
      peer_id: '00000000000000000000000000000000',
      distant_chat_id: '00000000000000000000000000000000',
      lobby_id: { xstr64: '0' },
    };
    if (type === 3) cid.lobby_id.xstr64 = id;
    else if (type === 2) cid.distant_chat_id = id;
    else if (type === 1) cid.peer_id = id;
    return cid;
  },
  loadLobby(currentlobbyid) {
    this.lastLobbyId = currentlobbyid;

    const finishLoad = (detail) => {
      this.setupAction = this.setIdentity;
      this.currentLobby = detail;
      this.isSubscribed = true;
      this.lobby_user = rs.userList.username(detail.gxs_id) || '???';

      // Reset local state for this lobby
      this.messages = [];
      this.messageKeys.clear();

      // Load history first
      this.loadHistory(currentlobbyid, detail.chatType);

      // Apply existing messages from live cache
      const cid = this.chatId();
      rs.events[15].chatMessages(cid, rs.events[15], (l) => {
        this.addMessages(l);
      });

      // Register for chatEvents for future messages
      rs.events[15].notify = (chatMessage) => {
        // DEBUG: Log incoming message structure
        console.log('[RS-DEBUG] Incoming Chat Message:', JSON.stringify(chatMessage, null, 2));

        const msgCid = chatMessage.chat_id;
        let msgId;

        if (msgCid.type === 3) {
          msgId = rs.idToHex(msgCid.lobby_id);
        } else if (msgCid.type === 2) {
          // For Distant Chat, the ID is the distant_chat_id
          msgId = rs.idToHex(msgCid.distant_chat_id);
        } else if (msgCid.type === 1) {
          // For Private Chat, the ID is the peer_id
          msgId = rs.idToHex(msgCid.peer_id);
        } else {
          // Fallback
          msgId = rs.idToHex(msgCid);
        }

        console.log('[RS-DEBUG] Resolved Msg ID:', msgId, 'Current Lobby ID:', currentlobbyid, 'Match:', msgId === currentlobbyid);

        if (msgId === currentlobbyid) {
          this.addMessages([chatMessage]);
        }
      };

      // Lookup for chat-user names
      if (detail.gxs_ids) {
        let list = [];
        if (Array.isArray(detail.gxs_ids)) {
          list = detail.gxs_ids.map((u) => {
            const key = u.key;
            return { key, name: rs.userList.username(key) };
          });
        } else if (typeof detail.gxs_ids === 'object') {
          list = Object.keys(detail.gxs_ids).map((key) => {
            return { key, name: rs.userList.username(key) };
          });
        }
        list.sort((a, b) => a.name.localeCompare(b.name));
        this.users = list;
      } else {
        this.users = [{ key: detail.gxs_id || '', name: detail.lobby_name }];
      }
      m.redraw();
    };

    loadLobbyDetails(currentlobbyid, (detail) => {
      if (detail) {
        finishLoad(detail);
      } else {
        // Fallback to Distant Chat
        loadDistantChatDetails(currentlobbyid, (dDetail) => {
          if (dDetail) {
            finishLoad(dDetail);
          }
        });
      }
    });
  },
  loadPublicLobby(currentlobbyid) {
    this.setupAction = this.enterPublicLobby;
    this.isSubscribed = false;
    ChatRoomsModel.allRooms.forEach((it) => {
      if (rs.idToHex(it.lobby_id) === currentlobbyid) {
        this.currentLobby = it;
        this.lobby_user = '???';
        this.lobbyid = currentlobbyid;
      }
    });
    this.users = [];
  },
  sendMessage(msg, onsuccess) {
    const cid = this.chatId();
    // Optimistic echo for immediate feedback
    const echoMsg = {
      chat_id: cid,
      msg: msg,
      sendTime: Math.floor(Date.now() / 1000),
      lobby_peer_gxs_id: this.currentLobby.gxs_id,
    };
    this.addMessages([echoMsg], true);

    rs.rsJsonApiRequest(
      '/rsChats/sendChat',
      {
        id: cid,
        msg: msg,
      },
      (data, success) => {
        if (success) {
          onsuccess();
        } else {
          console.error('[RS] Failed to send chat message');
          onsuccess(); // Clear the input even on failure to avoid stuck 'sending...' state
        }
      }
    );
  },
  selected(info, selName, defaultName) {
    const currid = rs.idToHex(ChatLobbyModel.currentLobby.lobby_id || { xstr64: m.route.param('lobby') });
    return (rs.idToHex(info.lobby_id) === currid ? selName : '') + defaultName;
  },
  switchToEvent(info) {
    return () => {
      ChatLobbyModel.currentLobby = info;
      m.route.set('/chat/:lobby', { lobby: rs.idToHex(info.lobby_id) });
      ChatLobbyModel.loadLobby(rs.idToHex(info.lobby_id)); // update
    };
  },
  setupEvent(info) {
    return () => {
      m.route.set('/chat/:lobby/setup', { lobby: rs.idToHex(info.lobby_id) });
      ChatLobbyModel.loadPublicLobby(rs.idToHex(info.lobby_id)); // update
    };
  },
};

// ************************* Chat Hub State ****************************

function getSafeAvatar(details) {
  if (
    details &&
    details.mAvatar &&
    details.mAvatar.mData &&
    details.mAvatar.mData.base64 !== ''
  ) {
    return details.mAvatar;
  }
  return undefined;
}

const ChatHubState = {
  selectedRoomId: null,
  selectedRoom: null,
  selectedRoomType: null,
  searchString: '',
  ownProfile: { name: 'Loading...' },
  gxsDetails: {},
};

function loadOwnChatProfile() {
  rs.rsJsonApiRequest('/rsConfig/getConfigNetStatus', {}, (data) => {
    if (data && data.status) {
      ChatHubState.ownProfile.name = data.status.ownName || 'Unknown';
      m.redraw();
    }
  });
}

// ************************* views ****************************

const Lobby = () => {
  return {
    view: (vnode) => {
      const { info, tagname, onclick, lobbytagname = 'mainname' } = vnode.attrs;
      return m(
        ChatLobbyModel.selected(info, '.selected-lobby', tagname),
        {
          key: rs.idToHex(info.lobby_id),
          onclick,
        },
        [
          m('h5', { class: lobbytagname }, info.lobby_name === '' ? '<unnamed>' : info.lobby_name),
          m('.topic', info.lobby_topic),
        ]
      );
    },
  };
};

const LobbyList = {
  view(vnode) {
    const tagname = vnode.attrs.tagname;
    const lobbytagname = vnode.attrs.lobbytagname;
    const onclick = vnode.attrs.onclick || (() => null);
    return [
      vnode.attrs.rooms.map((info) =>
        m(Lobby, {
          info,
          tagname,
          lobbytagname,
          onclick: onclick(info),
        })
      ),
    ];
  },
};

const SubscribedLobbies = {
  view() {
    return m('.widget', [
      m('.widget__heading', m('h3', 'Subscribed chat rooms')),
      m('.widget__body', [
        m(LobbyList, {
          rooms: sortLobbies(Object.values(ChatRoomsModel.subscribedRooms)),
          tagname: '.lobby.subscribed',
          onclick: ChatLobbyModel.switchToEvent,
        }),
      ]),
    ]);
  },
};

const PublicLobbies = {
  view() {
    return m('.widget', [
      m('.widget__heading', m('h3', 'Public chat rooms')),
      m('.widget__body', [
        m(LobbyList, {
          rooms: (ChatRoomsModel.allRooms || []).filter((info) => !ChatRoomsModel.subscribed(info)),
          tagname: '.lobby.public',
          onclick: ChatLobbyModel.setupEvent,
        }),
      ]),
    ]);
  },
};

// ************************* Chat Hub Sub-Components ****************************

const ChatRoomHeader = () => {
  return {
    view: (vnode) => {
      const room = vnode.attrs.room;
      const lobbyHexId = rs.idToHex(room.lobby_id);
      return m('.chat-hub-header-bar', [
        m('.chat-header-info', [
          m('.chat-header-name', room.lobby_name || '<unnamed>'),
          m('.chat-header-topic', room.lobby_topic || 'No topic'),
        ]),
        m('.chat-header-actions', [
          m(
            'button.red',
            {
              title: 'Leave Room',
              onclick: () => {
                ChatLobbyModel.unsubscribeChatLobby(lobbyHexId, () => {
                  ChatHubState.selectedRoom = null;
                  ChatHubState.selectedRoomId = null;
                  ChatHubState.selectedRoomType = null;
                  m.route.set('/chat');
                });
              },
            },
            [m('i.fas.fa-sign-out-alt'), ' Leave']
          ),
        ]),
      ]);
    },
  };
};

function scrollChatToBottom() {
  setTimeout(() => {
    const element = document.querySelector('.chat-hub-messages');
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, 50);
}

const ChatConversationView = () => {
  return {
    oninit: () => {
      scrollChatToBottom();
    },
    view: () => {
      return m('.chat-hub-conversation-layout', [
        m('.chat-hub-conversation-main', [
          m(
            '.chat-hub-messages',
            {
              oncreate: () => scrollChatToBottom(),
              onupdate: () => scrollChatToBottom(),
            },
            ChatLobbyModel.messages
          ),
          m(
            '.chat-hub-input-area',
            [
              m('textarea.chat-hub-textarea', {
                placeholder: 'Type a message... Press Enter to send',
                enterkeyhint: 'send',
                onkeydown: (e) => {
                  if ((e.key === 'Enter' || e.keyCode === 13) && !e.shiftKey) {
                    const msg = e.target.value;
                    if (msg.trim() === '') return false;
                    e.target.value = ' sending ... ';
                    ChatLobbyModel.sendMessage(msg, () => {
                      e.target.value = '';
                      scrollChatToBottom();
                    });
                    return false;
                  }
                },
              }),
              m(
                'button.chat-hub-send-btn',
                {
                  onclick: (e) => {
                    const textarea = e.target.closest('.chat-hub-input-area').querySelector('textarea');
                    const msg = textarea.value;
                    if (msg.trim() === '') return;
                    textarea.value = ' sending ... ';
                    ChatLobbyModel.sendMessage(msg, () => {
                      textarea.value = '';
                      scrollChatToBottom();
                    });
                  },
                },
                m('i.fas.fa-paper-plane')
              ),
            ]
          ),
        ]),
        m('.chat-hub-rightbar', [
          m('.rightbar-title', 'Participants'),
          m('.rightbar-users-list', ChatLobbyModel.users.map((user) => {
            const gxsId = user.key;
            const name = user.name;

            // Load details for avatar if not cached
            if (gxsId && ChatHubState.gxsDetails[gxsId] === undefined) {
              ChatHubState.gxsDetails[gxsId] = null; // Mark as loading
              rs.rsJsonApiRequest('/rsIdentity/getIdDetails', { id: gxsId }, (data) => {
                if (data && data.details) {
                  ChatHubState.gxsDetails[gxsId] = data.details;
                  m.redraw();
                }
              });
            }

            const avatar = getSafeAvatar(ChatHubState.gxsDetails[gxsId]);
            const firstLetter = (name || '?').slice(0, 1).toUpperCase();

            return m('.user', [
              m(peopleUtil.UserAvatar, { avatar, firstLetter, identityId: gxsId }),
              m('span.user-name', name),
            ]);
          }))
        ])
      ]);
    },
  };
};

// ***************************** Page Layouts ******************************

const ChatRoomDetailView = () => {
  return {
    view: () => {
      const room = ChatHubState.selectedRoom;
      if (!room) return null;

      let participantCount = 0;
      let participantNames = [];
      if (room.gxs_ids) {
        if (Array.isArray(room.gxs_ids)) {
          participantCount = room.gxs_ids.length;
          participantNames = room.gxs_ids.map((u) => rs.userList.username(u.key) || u.key);
        } else if (typeof room.gxs_ids === 'object') {
          const keys = Object.keys(room.gxs_ids);
          participantCount = keys.length;
          participantNames = keys.map((key) => rs.userList.username(key) || key);
        }
      }
      participantNames.sort((a, b) => a.localeCompare(b));

      const lobbyHexId = rs.idToHex(room.lobby_id);

      return m('.chat-room-detail-view', [
        m('.detail-section', [
          m('h3', 'Room Info'),
          m('.info-grid', [
            m('.info-label', 'Room Name'),
            m('.info-value', room.lobby_name || '<unnamed>'),
            m('.info-label', 'Topic'),
            m('.info-value', room.lobby_topic || 'None'),
            m('.info-label', 'Participants'),
            m('.info-value', participantCount + ' users'),
            m('.info-label', 'Your Identity'),
            m('.info-value', rs.userList.username(room.gxs_id) || room.gxs_id || '???'),
            m('.info-label', 'Lobby ID'),
            m('.info-value', lobbyHexId),
          ]),
        ]),

        m('.detail-section', [
          m('h3', 'Participants (' + participantCount + ')'),
          participantNames.length > 0
            ? m(
                '.participants-grid',
                participantNames.map((name) =>
                  m('.participant-card', m('.participant-name', name))
                )
              )
            : m('p.no-participants', 'No participant information available'),
        ]),
      ]);
    },
  };
};

const ChatRoomJoinView = () => {
  let ownIds = [];
  return {
    oninit: () => peopleUtil.ownIds((data) => (ownIds = data)),
    view: () => {
      const room = ChatHubState.selectedRoom;
      if (!room) return null;

      const lobbyHexId = rs.idToHex(room.lobby_id);
      const participantCount = room.total_number_of_peers || 0;

      return m('.chat-room-detail-view', [
        m('.detail-section', [
          m('h3', 'Room Info'),
          m('.info-grid', [
            m('.info-label', 'Room Name'),
            m('.info-value', room.lobby_name || '<unnamed>'),
            m('.info-label', 'Topic'),
            m('.info-value', room.lobby_topic || 'None'),
            m('.info-label', 'Participants'),
            m('.info-value', participantCount + ' users'),
          ]),
        ]),

        m('.detail-section', [
          m('h3', 'Join Room'),
          m('p.join-description', 'Select an identity to join this chat room:'),
          m(
            '.identities-grid',
            ownIds.map((nick) =>
              m(
                '.identity-card',
                { onclick: () => ChatLobbyModel.enterPublicLobby(lobbyHexId, nick) },
                [
                  m('.identity-name', rs.userList.username(nick) || nick),
                  m('i.fas.fa-sign-in-alt'),
                ]
              )
            )
          ),
        ]),
      ]);
    },
  };
};

const Layout = {
  oninit: () => {
    ChatHubState.activeTab = 'chat';
    const lobbyId = m.route.param('lobby');
    if (lobbyId) {
      ChatHubState.selectedRoomId = lobbyId;
      ChatLobbyModel.loadLobby(lobbyId);
    }
  },
  onupdate: () => {
    const lobbyId = m.route.param('lobby');
    if (lobbyId && ChatHubState.selectedRoomId !== lobbyId) {
      ChatHubState.selectedRoomId = lobbyId;
      ChatLobbyModel.loadLobby(lobbyId);
    }
  },
  view: () => {
    const search = ChatHubState.searchString.toLowerCase();

    const subscribedRooms = sortLobbies(
      Object.values(ChatRoomsModel.subscribedRooms)
    ).filter((info) => (info.lobby_name || '').toLowerCase().includes(search));

    const publicRooms = (ChatRoomsModel.allRooms || [])
      .filter((info) => !ChatRoomsModel.subscribed(info))
      .filter((info) => (info.lobby_name || '').toLowerCase().includes(search));

    const isSelected = (info, type) =>
      ChatHubState.selectedRoomId === rs.idToHex(info.lobby_id);

    const lobbyId = ChatHubState.selectedRoomId;
    let selectedRoom = null;
    let selectedRoomType = null;

    if (lobbyId) {
      if (ChatRoomsModel.subscribedRooms[lobbyId]) {
        selectedRoom = ChatRoomsModel.subscribedRooms[lobbyId];
        selectedRoomType = 'subscribed';
      } else {
        selectedRoom = ChatRoomsModel.allRooms.find(
          (r) => rs.idToHex(r.lobby_id) === lobbyId
        );
        if (selectedRoom) {
          selectedRoomType = 'public';
        }
      }
    }

    if (selectedRoom) {
      ChatHubState.selectedRoom = selectedRoom;
      ChatHubState.selectedRoomType = selectedRoomType;
    } else if (!m.route.param('lobby')) {
      ChatHubState.selectedRoom = null;
      ChatHubState.selectedRoomId = null;
      ChatHubState.selectedRoomType = null;
    }

    return m('.chat-hub-container', [
      m('.chat-hub-left-pane', [
        m('.chat-own-profile-card', [
          m('.profile-header', [
            m('i.fas.fa-comments', { style: { fontSize: '1.5rem', color: '#3ba4d7' } }),
            m('.profile-info', [
              m('.profile-name', 'Chat rooms'),
            ]),
          ]),
        ]),

        m('.chat-rooms-list-container', [
          m('.searchbar-container', [
            m('input.searchbar', {
              type: 'text',
              placeholder: 'Search chat rooms...',
              value: ChatHubState.searchString,
              oninput: (e) => {
                ChatHubState.searchString = e.target.value;
              },
            }),
          ]),
          m('.rooms-scroll', [
            subscribedRooms.length > 0 && [
              m('.rooms-section-title', [
                m('i.fas.fa-bookmark'),
                m('span', 'Subscribed (' + subscribedRooms.length + ')'),
              ]),
              subscribedRooms.map((info) => {
                const hexId = rs.idToHex(info.lobby_id);
                let count = 0;
                if (info.gxs_ids) {
                  if (Array.isArray(info.gxs_ids)) count = info.gxs_ids.length;
                  else if (typeof info.gxs_ids === 'object')
                    count = Object.keys(info.gxs_ids).length;
                }
                return m(
                  '.chat-room-list-item' +
                    (isSelected(info, 'subscribed') ? '.selected' : ''),
                  {
                    key: hexId,
                    onclick: () => {
                      m.route.set('/chat/:lobby', { lobby: hexId });
                    },
                  },
                  [
                    m('.room-icon', m('i.fas.fa-comments')),
                    m('.room-meta', [
                      m('.room-name', info.lobby_name || '<unnamed>'),
                      m('.room-topic', info.lobby_topic || 'No topic'),
                    ]),
                    count > 0 && m('.room-badge', count),
                  ]
                );
              }),
            ],

            publicRooms.length > 0 && [
              m('.rooms-section-title', [
                m('i.fas.fa-globe'),
                m('span', 'Public (' + publicRooms.length + ')'),
              ]),
              publicRooms.map((info) => {
                const hexId = rs.idToHex(info.lobby_id);
                const count = info.total_number_of_peers || 0;
                return m(
                  '.chat-room-list-item.public-room' +
                    (isSelected(info, 'public') ? '.selected' : ''),
                  {
                    key: hexId,
                    onclick: () => {
                      m.route.set('/chat/:lobby', { lobby: hexId });
                    },
                  },
                  [
                    m('.room-icon', m('i.fas.fa-globe')),
                    m('.room-meta', [
                      m('.room-name', info.lobby_name || '<unnamed>'),
                      m('.room-topic', info.lobby_topic || 'No topic'),
                    ]),
                    count > 0 && m('.room-badge', count),
                  ]
                );
              }),
            ],

            subscribedRooms.length === 0 &&
              publicRooms.length === 0 &&
              m('p.no-rooms', 'No chat rooms found'),
          ]),
        ]),
      ]),

      m('.chat-hub-right-pane', [
        ChatHubState.selectedRoom
          ? [
              ChatHubState.selectedRoomType === 'subscribed'
                ? [
                    m(ChatRoomHeader, { room: ChatHubState.selectedRoom }),
                    m('.chat-hub-tabs-container', [
                      m('.chat-hub-tabs', [
                        m(
                          'button.tab-btn' +
                            (ChatHubState.activeTab === 'chat' ? '.active' : ''),
                          {
                            onclick: () => {
                              ChatHubState.activeTab = 'chat';
                              scrollChatToBottom();
                            },
                          },
                          [m('i.fas.fa-comments'), ' Chat']
                        ),
                        m(
                          'button.tab-btn' +
                            (ChatHubState.activeTab === 'details' ? '.active' : ''),
                          {
                            onclick: () => {
                              ChatHubState.activeTab = 'details';
                            },
                          },
                          [m('i.fas.fa-info-circle'), ' Details']
                        ),
                      ]),
                    ]),
                    m('.chat-hub-tab-content', { style: { padding: ChatHubState.activeTab === 'chat' ? '0' : '1.5rem' } }, [
                      ChatHubState.activeTab === 'chat'
                        ? m(ChatConversationView)
                        : m(ChatRoomDetailView),
                    ]),
                  ]
                : [
                    m('.chat-hub-tab-content', m(ChatRoomJoinView)),
                  ],
            ]
          : m('.chat-pane-placeholder', [
              m('i.fas.fa-comments'),
              m(
                'p',
                'Select a chat room from the left panel to view details or join a conversation.'
              ),
            ]),
      ]),
    ]);
  },
};

const LayoutSingle = () => {
  const onResize = () => {
    const element = document.querySelector('.messages');
    if (element) element.scrollTop = element.scrollHeight;
  };
  return {
    oninit: () => {
      ChatLobbyModel.loadLobby(m.route.param('lobby'));
      window.addEventListener('resize', onResize);
    },
    onremove: () => window.removeEventListener('resize', onResize),
    view: (vnode) => {
      const chatType = ChatLobbyModel.currentLobby.chatType;
      const isPrivate = chatType === 1 || chatType === 2;
      return m(
        '.node-panel.chat-panel.chat-room',
        {
          class:
            (MobileState.showLobbies ? 'show-lobbies ' : '') +
            (MobileState.showUsers ? 'show-users ' : '') +
            (isPrivate ? 'no-lobbies' : ''),
        },
        [
          m('.chat-overlay', { onclick: () => MobileState.closeAll() }),
          m('.messages', { onclick: () => MobileState.closeAll() }, ChatLobbyModel.messages),
          m(
            '.chatMessage',
            {},
            [
              m('textarea.chatMsg', {
                placeholder: 'Type a message...',
                enterkeyhint: 'send',
                onkeydown: (e) => {
                  if ((e.key === 'Enter' || e.keyCode === 13) && !e.shiftKey) {
                    const msg = e.target.value;
                    if (msg.trim() === '') return false;
                    e.target.value = ' sending ... ';
                    ChatLobbyModel.sendMessage(msg, () => (e.target.value = ''));
                    return false;
                  }
                },
              }),
              m(
                'button.chat-send-btn',
                {
                  onclick: (e) => {
                    const textarea = e.target.closest('.chatMessage').querySelector('textarea');
                    const msg = textarea.value;
                    if (msg.trim() === '') return;
                    textarea.value = ' sending ... ';
                    ChatLobbyModel.sendMessage(msg, () => (textarea.value = ''));
                  },
                },
                m('i.fas.fa-paper-plane')
              ),
            ]
          ),
        ]
      );
    },
  };
};

/*
    /rsChats/initiateDistantChatConnexion
   * @param[in] to_pid RsGxsId to start the connection
   * @param[in] from_pid owned RsGxsId who start the connection
   * @param[out] pid distant chat id
   * @param[out] error_code if the connection can't be stablished
   * @param[in] notify notify remote that the connection is stablished
*/
const LayoutCreateDistant = () => {
  let ownIds = [];
  return {
    oninit: () => peopleUtil.ownIds((data) => (ownIds = data)),
    view: (vnode) =>
      m('.node-panel.chat-panel.chat-room', [
        m('.createDistantChat', [
          'choose identitiy to chat with ',
          rs.userList.username(m.route.param('lobby')),
          ownIds.map((id) =>
            m(
              '.identity',
              {
                onclick: () =>
                  rs.rsJsonApiRequest(
                    '/rsChats/initiateDistantChatConnexion',
                    {
                      to_pid: m.route.param('lobby'),
                      from_pid: id,
                      notify: true,
                    },
                    (res) => {
                      m.route.set('/chat/:lobby', { lobby: rs.idToHex(res.pid) });
                    }
                  ),
              },
              rs.userList.username(id)
            )
          ),
        ]),
      ]),
  };
};

module.exports = {
  oninit: () => {
    ChatRoomsModel.loadSubscribedRooms();
    loadOwnChatProfile();
  },
  view: (vnode) => {
    if (m.route.param('subaction') === 'createdistantchat') {
      return m(LayoutCreateDistant);
    } else {
      return m(Layout);
    }
  },
};
