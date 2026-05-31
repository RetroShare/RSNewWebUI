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
  showCreateModal: false,
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
        '.message',
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

      // Lookup for chat-user names (Only for lobbies for now)
      // Lookup for chat-user names
      if (detail.gxs_ids) {
        let names = [];
        if (Array.isArray(detail.gxs_ids)) {
          names = detail.gxs_ids.reduce((a, u) => a.concat(rs.userList.username(u.key)), []);
        } else if (typeof detail.gxs_ids === 'object') {
          names = Object.keys(detail.gxs_ids).map(key => rs.userList.username(key));
        }
        names.sort((a, b) => a.localeCompare(b));
        this.users = [];
        names.forEach((name) => (this.users = this.users.concat([m('.user', name)])));
      } else {
        this.users = [m('.user', detail.lobby_name)];
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

const SubscribedLeftLobbies = {
  view() {
    return [
      m('h5.lefttitle', 'subscribed:'),
      m(LobbyList, {
        rooms: sortLobbies(Object.values(ChatRoomsModel.subscribedRooms)),
        tagname: '.leftlobby.subscribed',
        lobbytagname: 'leftname',
        onclick: ChatLobbyModel.switchToEvent,
      }),
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

const PublicLeftLobbies = {
  view() {
    return [
      m('h5.lefttitle', 'public:'),
      m(LobbyList, {
        rooms: Object.values(ChatRoomsModel.allRooms || {}).filter(
          (info) => !ChatRoomsModel.subscribed(info)
        ),
        tagname: '.leftlobby.public',
        lobbytagname: 'leftname',
        onclick: ChatLobbyModel.setupEvent,
      }),
    ];
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

const LobbyName = () => {
  return m(
    'h3.lobbyName',
    m('.mobile-menu-icons', [
      m('i.fas.fa-bars', { onclick: () => MobileState.toggleLobbies() }),
    ]),
    ChatLobbyModel.isSubscribed
      ? [m('span.chatusername', ChatLobbyModel.lobby_user), m('span.chatatchar', '@')]
      : [],
    ChatLobbyModel.currentLobby.chatType === 2
      ? m('i.fas.fa-circle', {
        style: {
          color:
            ChatLobbyModel.currentLobby.status === 2
              ? '#2ecc71' // Green (Can Talk)
              : ChatLobbyModel.currentLobby.status === 1
                ? '#f39c12' // Orange (Tunnel Down)
                : ChatLobbyModel.currentLobby.status === 3
                  ? '#e74c3c' // Red (Remotely Closed)
                  : '#95a5a6', // Grey (Unknown)
          fontSize: '0.6em',
          marginRight: '10px',
          verticalAlign: 'middle',
        },
        title:
          ChatLobbyModel.currentLobby.status === 2
            ? 'Tunnel Active (Can Talk)'
            : ChatLobbyModel.currentLobby.status === 1
              ? 'Tunnel Down (Negotiating...)'
              : ChatLobbyModel.currentLobby.status === 3
                ? 'Remotely Closed'
                : 'Status Unknown',
      })
      : [],
    m('span.chatlobbyname', ChatLobbyModel.currentLobby.lobby_name),
    m('.mobile-menu-icons', [
      m('i.fas.fa-users', { onclick: () => MobileState.toggleUsers() }),
    ]),
    m.route.param('subaction') !== 'setup' && ChatLobbyModel.currentLobby.chatType === 3
      ? [
        m('i.fas.fa-cog.setupicon', {
          title: 'configure lobby',
          onclick: () =>
            m.route.set(
              '/chat/:lobby/:subaction',
              {
                lobby: m.route.param('lobby'),
                subaction: 'setup',
              },
              { replace: true }
            ),
        }),
      ]
      : [],
    ChatLobbyModel.isSubscribed
      ? [
        m('i.fas.fa-sign-out-alt.leaveicon', {
          title: 'leaving lobby',
          onclick: () =>
            ChatLobbyModel.unsubscribeChatLobby(m.route.param('lobby'), () => {
              m.route.set('/chat', null, { replace: true });
            }),
        }),
      ]
      : []
  );
};



// ***************************** Create Room Modal ******************************

const CreateRoomModal = () => {
  let roomName = '';
  let roomTopic = '';
  let isPrivate = false;

  return {
    view: () =>
      m('.modal-overlay', {
        onclick: (e) => {
          if (e.target.classList.contains('modal-overlay')) {
            ChatRoomsModel.showCreateModal = false;
            m.redraw();
          }
        },
      }, [
        m('.modal-content', [
          m('h3', 'Create Chat Room'),
          m('label', 'Room Name'),
          m('input', {
            type: 'text',
            placeholder: 'Enter room name',
            value: roomName,
            oninput: (e) => (roomName = e.target.value),
          }),
          m('label', 'Topic (optional)'),
          m('input', {
            type: 'text',
            placeholder: 'Room topic',
            value: roomTopic,
            oninput: (e) => (roomTopic = e.target.value),
          }),
          m('label.checkbox-label', [
            m('input', {
              type: 'checkbox',
              checked: isPrivate,
              onchange: (e) => (isPrivate = e.target.checked),
            }),
            ' Private (invite only)',
          ]),
          m('.modal-actions', [
            m('button', {
              onclick: () => {
                if (!roomName.trim()) return;
                rs.rsJsonApiRequest(
                  '/rsChats/createChatLobby',
                  {
                    lobby_name: roomName,
                    lobby_topic: roomTopic,
                    is_private: isPrivate,
                    to: isPrivate ? '0000000000000000' : '',
                    flag: isPrivate ? 1 : 0,
                  },
                  (res) => {
                    if (res.retval) {
                      ChatRoomsModel.showCreateModal = false;
                      ChatRoomsModel.loadSubscribedRooms();
                      m.redraw();
                    }
                  }
                );
              },
            }, 'Create'),
            m('button', {
              onclick: () => {
                ChatRoomsModel.showCreateModal = false;
                m.redraw();
              },
            }, 'Cancel'),
          ]),
        ]),
      ]),
  };
};

// ***************************** Page Layouts ******************************

const Layout = {
  view: () =>
    m('.node-panel.chat-panel.chat-hub', [
      m('.chat-actions', [
        m('button.create-room-btn', {
          onclick: () => ChatRoomsModel.showCreateModal = true,
        }, m('i.fas.fa-plus'), ' Create Room'),
      ]),
      m(SubscribedLobbies),
      m(PublicLobbies),
      ChatRoomsModel.showCreateModal && m(CreateRoomModal),
    ]),
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
          LobbyName(),
          !isPrivate && m('.lobbies', m(SubscribedLeftLobbies), m(PublicLeftLobbies)),
          m('.messages', { onclick: () => MobileState.closeAll() }, ChatLobbyModel.messages),
          m('.rightbar', ChatLobbyModel.users),
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

const LayoutSetup = () => {
  let ownIds = [];
  return {
    oninit: () => peopleUtil.ownIds((data) => (ownIds = data)),
    view: (vnode) =>
      m(
        '.node-panel.chat-panel.chat-room.chat-setup',
        {
          class:
            (MobileState.showLobbies ? 'show-lobbies ' : '') +
            (MobileState.showUsers ? 'show-users' : ''),
        },
        [
          m('.chat-overlay', { onclick: () => MobileState.closeAll() }),
          LobbyName(),
          m('.lobbies', m(SubscribedLeftLobbies), m(PublicLeftLobbies)),
          m('.setup', [
            m('h5.selectidentity', 'Select identity to use'),
            ownIds.map((nick) =>
              m(
                '.identity' +
                (ChatLobbyModel.currentLobby.gxs_id === nick ? '.selectedidentity' : ''),
                {
                  onclick: () => ChatLobbyModel.setupAction(m.route.param('lobby'), nick),
                },
                rs.userList.username(nick)
              )
            ),
          ]),
        ]
      ),
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
  },
  view: (vnode) => {
    if (m.route.param('lobby') === undefined) {
      return m(Layout);
    } else if (m.route.param('subaction') === 'setup') {
      return m(LayoutSetup);
    } else if (m.route.param('subaction') === 'createdistantchat') {
      return m(LayoutCreateDistant);
    } else {
      return m(LayoutSingle);
    }
  },
};
