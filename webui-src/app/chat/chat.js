const m = require('mithril');
const rs = require('rswebui');
const peopleUtil = require('people/people_util');
const people = require('people/people');

// **************** utility functions ********************

function get64Num(val) {
  if (!val) return 0;
  if (typeof val === 'object') {
    return val.xint64 || parseInt(val.xstr64) || 0;
  }
  return Number(val) || 0;
}

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

function getNicknameColor(id, name) {
  const hashString = id && id !== '00000000000000000000000000000000' ? id : (name || '');
  let hash = 0;
  for (let i = 0; i < hashString.length; i++) {
    hash = hashString.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 75%, 35%)`;
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
 * Wraps emoji characters in a span so CSS can size them independently.
 */
function renderTextWithEmoji(text) {
  if (!text) return '';
  // Match emoji sequences (flags, ZWJ sequences, variation selectors, skin tones, etc.)
  const emojiRegex = /(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})(?:[\u{1F3FB}-\u{1F3FF}])?(?:\u{FE0F})?(?:\u{20E3})?(?:(?:\u{200D}(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})(?:[\u{1F3FB}-\u{1F3FF}])?(?:\u{FE0F})?)*)/gu;
  const parts = [];
  let last = 0;
  let match;
  // eslint-disable-next-line no-cond-assign
  while ((match = emojiRegex.exec(text)) !== null) {
    if (match[0].length === 0) { emojiRegex.lastIndex++; continue; }
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(m('span.chat-emoji', match[0]));
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : text;
}

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
      if (msg.isSystem) {
        const text = msg.msg || msg.message;
        const isSecured = text.includes('secured') || text.includes('talk');
        const bgColor = isSecured ? '#fffbeb' : '#f8fafc';
        const borderColor = isSecured ? '#fcd34d' : '#cbd5e1';
        const textColor = isSecured ? '#b45309' : '#475569';
        const borderStyle = isSecured ? 'solid' : 'dashed';

        return m(
          '.message.incoming',
          [
            m('span.datetime', datetime),
            m('span.username', 'Chat status'),
            m('.messagetext', {
              style: {
                backgroundColor: bgColor,
                border: `1px ${borderStyle} ${borderColor}`,
                color: textColor,
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                display: 'inline-block',
                marginTop: '0.25rem',
              }
            }, text)
          ]
        );
      }
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

      const chatType = ChatLobbyModel.currentLobby && ChatLobbyModel.currentLobby.chatType;
      const isRoom = chatType === 3;

      if (isRoom) {
        const nickColor = getNicknameColor(gxsId, username);
        return m(
          '.message.compact',
          m('span.datetime', datetime),
          m('span.username', { style: { color: nickColor } }, username + ':'),
          m('span.messagetext', renderTextWithEmoji(text))
        );
      }

      return m(
        '.message' + (msg.incoming ? '.incoming' : '.outgoing'),
        m('span.datetime', datetime),
        m('span.username', username),
        m('span.messagetext', renderTextWithEmoji(text))
      );
    },
  };
};

function getStatusColor(status) {
  switch (status) {
    case 1: return '#eab308'; // Yellow
    case 2: return '#22c55e'; // Green
    case 3: return '#ef4444'; // Red
    default: return '#94a3b8'; // Grey
  }
}

function getStatusTooltip(status) {
  switch (status) {
    case 1: return 'Tunnel is pending. Please wait...';
    case 2: return 'End-to-end encrypted conversation established. You can talk!';
    case 3: return 'Your partner closed the conversation.';
    default: return 'Remote status unknown.';
  }
}

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
  distantChatStatus: null,
  statusPollInterval: null,

  pollDistantChatStatus() {
    if (!this.currentLobby || this.currentLobby.chatType !== 2) return;
    rs.rsJsonApiRequest(
      '/rsChats/getDistantChatStatus',
      {
        pid: this.currentLobby.lobby_id,
      },
      (detail, success) => {
        if (success && detail.retval) {
          const oldStatus = this.distantChatStatus ? this.distantChatStatus.status : null;
          this.distantChatStatus = detail.info;

          if (oldStatus !== null && oldStatus !== detail.info.status) {
            if (detail.info.status === 2) {
              this.addMessages([{
                chat_id: this.chatId(),
                isSystem: true,
                msg: 'Tunnel is secured. You can talk!',
                sendTime: Math.floor(Date.now() / 1000)
              }]);
            } else if (detail.info.status === 3) {
              this.addMessages([{
                chat_id: this.chatId(),
                isSystem: true,
                msg: 'Your partner closed the conversation.',
                sendTime: Math.floor(Date.now() / 1000)
              }]);
            }
          }
          m.redraw();
        }
      }
    );
  },

  startStatusPolling() {
    this.stopStatusPolling();
    this.pollDistantChatStatus();
    this.statusPollInterval = setInterval(() => this.pollDistantChatStatus(), 3000);
  },

  stopStatusPolling() {
    if (this.statusPollInterval) {
      clearInterval(this.statusPollInterval);
      this.statusPollInterval = null;
    }
    this.distantChatStatus = null;
  },

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
    this.stopStatusPolling();
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
      let list = [];
      if (detail.gxs_ids) {
        if (Array.isArray(detail.gxs_ids)) {
          list = detail.gxs_ids.map((u) => {
            const key = u.key;
            return { key, name: rs.userList.username(key) || key, lastAct: get64Num(u.value) };
          });
        } else if (typeof detail.gxs_ids === 'object') {
          list = Object.keys(detail.gxs_ids).map((key) => {
            return { key, name: rs.userList.username(key) || key, lastAct: get64Num(detail.gxs_ids[key]) };
          });
        }
      }

      const ownId = detail.gxs_id;
      if (ownId && ownId !== '00000000000000000000000000000000') {
        const hasOwn = list.some((u) => u.key === ownId);
        if (!hasOwn) {
          list.push({
            key: ownId,
            name: rs.userList.username(ownId) || ownId,
            lastAct: Math.floor(Date.now() / 1000)
          });
        }
      }

      if (list.length === 0) {
        list = [{ key: ownId || '', name: rs.userList.username(ownId) || detail.lobby_name || '???', lastAct: Math.floor(Date.now() / 1000) }];
      }

      list.sort((a, b) => a.name.localeCompare(b.name));
      this.users = list;

      if (detail.chatType === 2) {
        this.startStatusPolling();
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
  hoveredUser: null,
  mutedUsers: new Set(),
  activeMenu: null,
  showAttachModal: false,
  attachPath: '',
  attachBrowseHint: false,
  isHashing: false,
  hashingError: '',
  showEmojiPicker: false,
  emojiSearch: '',
  emojiCategory: 'Smileys',
  showCreateRoomModal: false,
  newRoomName: '',
  newRoomTopic: '',
  newRoomIdentity: '',
  newRoomPublic: true,
  ownGxsIdentities: [],
  createRoomError: '',
};

// ========================= Emoji Data =========================
const EMOJI_CATEGORIES = ['Smileys', 'People', 'Animals', 'Food', 'Travel', 'Activities', 'Objects', 'Symbols'];
const EMOJI_ICONS = {
  Smileys: '😊', People: '👥', Animals: '🐾', Food: '🍎',
  Travel: '✈️', Activities: '⚽', Objects: '💡', Symbols: '❤️',
};
const EMOJI_DATA = {
  Smileys: [
    '😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','😘','🥰','😗','😙','😚',
    '🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','🥱',
    '😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','☹️','🙁','😖','😞','😟',
    '😤','😢','😭','😦','😧','😨','😩','🤯','😬','😰','😱','🥵','🥶','😳','🤪','😵','😡','😠',
    '🤬','😷','🤒','🤕','🤢','🤮','🤧','🥴','😇','🥳','🥺','🤠','🤡','🤥','🤫','🤭','🧐','🤓',
    '😈','👿','👹','👺','💀','☠️','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾',
  ],
  People: [
    '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇',
    '☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾',
    '🦿','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁️','👅','👄','🫦','👶','🧒',
    '👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵','🙍','🙎','🙅','🙆','💁','🙋','🧏','🙇',
    '🤦','🤷','👮','🕵️','💂','🥷','👷','🫅','🤴','👸','👲','🧕','🤵','👰','🤰','🫃','🫄','🤱',
    '👼','🎅','🤶','🧑‍🎄','🦸','🦹','🧙','🧝','🧛','🧟','🧞','🧜','🧚','🧑‍🤝‍🧑','👫','👬','👭','💏','💑','👪',
  ],
  Animals: [
    '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉',
    '🙊','🐒','🦆','🦅','🦉','🦇','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪲','🦗','🪳','🕷️','🦂',
    '🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🦭',
    '🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄',
    '🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🐓','🦃','🦤','🦚','🦜',
    '🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿️','🦔','🐾','🐉','🐲','🌵',
  ],
  Food: [
    '🍎','🍊','🍋','🍌','🍍','🥭','🍓','🍒','🍑','🥝','🍅','🥥','🥑','🍆','🥔','🥕','🌽','🌶️',
    '🫑','🥒','🥬','🥦','🧄','🧅','🍄','🥜','🌰','🍞','🥐','🥖','🫓','🥨','🧀','🥚','🍳','🧈',
    '🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔','🍟','🍕','🫔','🌮','🌯','🥙','🧆','🥚','🍱',
    '🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🦪','🍦',
    '🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕','🫖','🍵',
    '🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊','🥄','🍴','🍽️','🥢',
  ],
  Travel: [
    '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🦯','🦽','🦼','🛺',
    '🚲','🛴','🛵','🏍️','🛺','🚨','🚔','🚍','🚘','🚖','🚡','🚠','🚟','🚃','🚋','🚞','🚝','🚄',
    '🚅','🚈','🚂','🚆','🚇','🚊','🚉','✈️','🛫','🛬','🛩️','💺','🛸','🚁','🛶','⛵','🚤','🛥️',
    '🛳️','⛴️','🚢','⚓','🗺️','🧭','🏔️','⛰️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🏟️','🏛️','🏗️',
    '🧱','🪨','🪵','🛖','🏘️','🏚️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬',
    '🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩️','🕋','⛲','⛺','🌁','🌃','🏙️','🌄',
  ],
  Activities: [
    '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅',
    '⛳','🪁','🛝','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️',
    '🤼','🤸','⛹️','🤺','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅',
    '🎖️','🏵️','🎗️','🎫','🎟️','🎪','🤹','🎭','🩰','🎨','🖼️','🎰','🎲','🧩','🪄','🎯','🪅','🎮',
    '🕹️','🎳','🎻','🎷','🥁','🪘','🎺','🎸','🪗','🎹','🎵','🎶','🎼','🎤','🎧','📻','🎙️','🎚️',
    '🎬','📽️','🎞️','📱','📲','☎️','📞','📟','📠','🔋','🪫','🔌','💡','🔦','🕯️','💸','💵','🪙',
  ],
  Objects: [
    '⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','💾','💿','📀','🧮','📷','📸','📹','🎥','📽️',
    '📞','☎️','📟','📠','📺','📻','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🪫','🔌','💡',
    '🔦','🕯️','🪔','🧱','💰','💴','💵','💶','💷','💸','💳','🪙','💹','✉️','📧','📨','📩','📤',
    '📥','📦','📫','📪','📬','📭','📮','🗳️','✏️','✒️','🖊️','🖋️','📝','📁','📂','🗂️','📅','📆',
    '🗒️','🗓️','📇','📈','📉','📊','📋','📌','📍','🗺️','📏','📐','✂️','🗃️','🗄️','🗑️','🔒','🔓',
    '🔏','🔐','🔑','🗝️','🔨','🪓','⛏️','⚒️','🛠️','🗡️','⚔️','🔫','🪃','🏹','🛡️','🪚','🔧','🪛',
  ],
  Symbols: [
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝',
    '💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌',
    '♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺',
    '🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘',
    '❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕',
    '❓','❔','‼️','⁉️','🔅','🔆','📶','🛜','📳','📴','🔱','📛','🔰','♻️','✅','🈯','💹','❎',
    '🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗','🈳','🈹','🚰','🔤','🔡','🔠','🆖','🆗',
    '🆙','🆒','🆕','🆓','🔟','📊','🔣','✔️','☑️','🔘','🔲','🔳','⬛','⬜','◼️','◻️','◾','◽',
    '▪️','▫️','🔶','🔷','🔸','🔹','🔺','🔻','💠','🔘','🔲','🔳','🏁','🚩','🎌','🏴','🏳️','⭐',
    '🌟','💫','✨','🌈','☀️','🌤️','⛅','🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','⛄','🌬️',
  ],
};

function insertEmojiIntoTextarea(emoji) {
  const textarea = document.querySelector('.chat-hub-textarea');
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);
  textarea.value = before + emoji + after;
  const newPos = start + emoji.length;
  textarea.selectionStart = newPos;
  textarea.selectionEnd = newPos;
  textarea.focus();
}

const EmojiPicker = () => ({
  view: () => {
    const search = ChatHubState.emojiSearch.toLowerCase();
    const cat = ChatHubState.emojiCategory;
    let emojis;
    if (search) {
      emojis = Object.values(EMOJI_DATA).flat();
    } else {
      emojis = EMOJI_DATA[cat] || [];
    }
    return m('.emoji-picker', [
      // Search bar
      m('.emoji-search-row', [
        m('i.fas.fa-search.emoji-search-icon'),
        m('input.emoji-search-input[type=text][placeholder=Search emoji...]', {
          value: ChatHubState.emojiSearch,
          oninput: (e) => { ChatHubState.emojiSearch = e.target.value; },
        }),
        ChatHubState.emojiSearch && m('button.emoji-search-clear', {
          onclick: () => { ChatHubState.emojiSearch = ''; },
        }, m('i.fas.fa-times')),
      ]),
      // Category tabs (hidden while searching)
      !search && m('.emoji-categories', EMOJI_CATEGORIES.map(c =>
        m('button.emoji-cat-btn' + (c === cat ? '.active' : ''), {
          title: c,
          onclick: () => { ChatHubState.emojiCategory = c; },
        }, EMOJI_ICONS[c])
      )),
      // Emoji grid
      m('.emoji-grid',
        emojis.map(e =>
          m('button.emoji-btn', {
            onclick: () => {
              insertEmojiIntoTextarea(e);
              ChatHubState.showEmojiPicker = false;
              m.redraw();
            },
          }, e)
        )
      ),
    ]);
  },
});

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
      const isDistant = room.chatType === 2;
      return m('.chat-hub-header-bar', [
        m('.chat-header-info', [
          m('.chat-header-name-container', { style: 'display: flex; align-items: center; gap: 0.5rem;' }, [
            m('.chat-header-name', room.lobby_name || '<unnamed>'),
            isDistant && m('i.fas.fa-circle', {
              style: {
                color: getStatusColor(ChatLobbyModel.distantChatStatus ? ChatLobbyModel.distantChatStatus.status : 0),
                fontSize: '0.85rem',
                transition: 'color 0.3s ease',
              },
              title: getStatusTooltip(ChatLobbyModel.distantChatStatus ? ChatLobbyModel.distantChatStatus.status : 0),
            })
          ]),
          m('.chat-header-topic', room.lobby_topic || 'No topic'),
        ]),
        m('.chat-header-actions', [
          isDistant
            ? m(
                'button.red',
                {
                  title: 'Leave Distant Chat',
                  onclick: () => {
                    if (confirm('Are you sure you want to leave this distant chat conversation?')) {
                      rs.rsJsonApiRequest(
                        '/rsChats/closeDistantChatConnexion',
                        {
                          pid: lobbyHexId,
                        },
                        (data, success) => {
                          if (success) {
                            ChatLobbyModel.stopStatusPolling();
                            ChatHubState.selectedRoom = null;
                            ChatHubState.selectedRoomId = null;
                            ChatHubState.selectedRoomType = null;
                            m.route.set('/chat');
                          }
                        }
                      );
                    }
                  },
                },
                [m('i.fas.fa-sign-out-alt'), ' Leave Chat']
              )
            : m(
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

function pollHashStatus(localpath) {
  rs.rsJsonApiRequest('/rsFiles/ExtraFileStatus', { localpath }, (data) => {
    if (data && data.retval && data.info && data.info.hash && data.info.hash !== '0000000000000000000000000000000000000000') {
      const info = data.info;
      const sizeNum = info.size.xint64 || parseInt(info.size.xstr64) || info.size;
      const fileLink = `<a href="retroshare://file?name=${encodeURIComponent(info.name)}&size=${sizeNum}&hash=${info.hash}">${info.name}</a> (${rs.formatBytes(sizeNum)})`;
      
      const textarea = document.querySelector('.chat-hub-textarea');
      if (textarea) {
        const val = textarea.value;
        textarea.value = val ? val + '\n' + fileLink : fileLink;
      }
      
      ChatHubState.showAttachModal = false;
      ChatHubState.isHashing = false;
      ChatHubState.attachPath = '';
      m.redraw();
    } else {
      if (ChatHubState.isHashing) {
        setTimeout(() => pollHashStatus(localpath), 1000);
      }
    }
  });
}

const ChatConversationView = () => {
  function onDocClick(e) {
    if (ChatHubState.showEmojiPicker && !e.target.closest('.emoji-picker-wrapper')) {
      ChatHubState.showEmojiPicker = false;
      m.redraw();
    }
  }
  return {
    oninit: () => {
      scrollChatToBottom();
    },
    oncreate: () => {
      document.addEventListener('click', onDocClick, true);
    },
    onremove: () => {
      document.removeEventListener('click', onDocClick, true);
    },
    view: () => {
      const chatType = ChatLobbyModel.currentLobby && ChatLobbyModel.currentLobby.chatType;
      const isRoom = chatType === 3;
      const isDistant = chatType === 2;
      const canTalk = !isDistant || (ChatLobbyModel.distantChatStatus && ChatLobbyModel.distantChatStatus.status === 2);
      return m('.chat-hub-conversation-layout', [
        m('.chat-hub-conversation-main', [
          m(
            '.chat-hub-messages' + (isRoom ? '.compact-container' : ''),
            {
              oncreate: () => scrollChatToBottom(),
              onupdate: () => scrollChatToBottom(),
            },
            ChatLobbyModel.messages
          ),
          m(
            '.chat-hub-input-area',
            [
              m(
                'button.chat-hub-attach-btn',
                {
                  disabled: !canTalk,
                  style: !canTalk ? 'opacity: 0.5; cursor: not-allowed;' : '',
                  title: 'Attach file',
                  onclick: () => {
                    ChatHubState.showAttachModal = true;
                    ChatHubState.showEmojiPicker = false;
                  }
                },
                m('i.fas.fa-paperclip')
              ),
              m('.emoji-picker-wrapper', [
                m(
                  'button.chat-hub-emoji-btn',
                  {
                    disabled: !canTalk,
                    style: !canTalk ? 'opacity: 0.5; cursor: not-allowed;' : '',
                    title: 'Insert emoji',
                    onclick: (e) => {
                      e.stopPropagation();
                      ChatHubState.showEmojiPicker = !ChatHubState.showEmojiPicker;
                    },
                  },
                  '😊'
                ),
                ChatHubState.showEmojiPicker && m(EmojiPicker),
              ]),
              m('textarea.chat-hub-textarea', {
                placeholder: canTalk ? 'Type a message... Press Enter to send' : 'Waiting for tunnel to be secured...',
                disabled: !canTalk,
                enterkeyhint: 'send',
                onkeydown: (e) => {
                  if ((e.key === 'Enter' || e.keyCode === 13) && !e.shiftKey) {
                    if (!canTalk) return false;
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
                  disabled: !canTalk,
                  style: !canTalk ? 'opacity: 0.5; cursor: not-allowed;' : '',
                  onclick: (e) => {
                    if (!canTalk) return;
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
          ChatHubState.showAttachModal && m('.attach-modal-overlay', {
            onclick: (e) => {
              if (e.target === e.currentTarget && !ChatHubState.isHashing) {
                ChatHubState.showAttachModal = false;
                ChatHubState.attachPath = '';
                ChatHubState.attachBrowseHint = false;
                ChatHubState.hashingError = '';
              }
            }
          }, [
            m('.attach-modal', [
              m('.attach-modal-header', [
                m('i.fas.fa-paperclip.attach-modal-icon'),
                m('h4', 'Attach File to Chat'),
              ]),
              m('p', 'Browse for a file or type the absolute path on your local system:'),
              // Hidden native file input for browsing
              m('input#attach-file-picker[type=file]', {
                style: 'display:none',
                onchange: (e) => {
                  const file = e.target.files && e.target.files[0];
                  if (file) {
                    // file.path is only available in Electron/desktop; browsers restrict full path
                    const fullPath = file.path;
                    const hasFullPath = fullPath && (fullPath.includes('/') || fullPath.includes('\\')) && fullPath !== file.name;
                    if (hasFullPath) {
                      ChatHubState.attachPath = fullPath;
                      ChatHubState.attachBrowseHint = false;
                    } else {
                      // Browser security: only the filename is available, not the full path
                      ChatHubState.attachPath = file.name;
                      ChatHubState.attachBrowseHint = true;
                    }
                    // Reset the picker so the same file can be re-selected
                    e.target.value = '';
                    ChatHubState.hashingError = '';
                    m.redraw();
                  }
                },
              }),
              m('.attach-path-row', [
                m('input[type=text]', {
                  placeholder: 'e.g. C:\\Downloads\\file.zip',
                  value: ChatHubState.attachPath,
                  oninput: (e) => {
                    ChatHubState.attachPath = e.target.value;
                    ChatHubState.attachBrowseHint = false; // user is editing manually, hint no longer relevant
                  },
                  disabled: ChatHubState.isHashing,
                }),
                m('button.attach-browse-btn', {
                  type: 'button',
                  disabled: ChatHubState.isHashing,
                  title: 'Browse for file',
                  onclick: () => {
                    const picker = document.getElementById('attach-file-picker');
                    if (picker) picker.click();
                  },
                },
                  [m('i.fas.fa-folder-open'), m('span', ' Browse…')]
                ),
              ]),
              ChatHubState.attachBrowseHint && m('.attach-path-hint', [
                m('i.fas.fa-info-circle'),
                m('span', [
                  ' Your browser cannot expose the full file path. ',
                  m('strong', 'Edit the path above'),
                  ' and add your folder prefix — e.g. change ',
                  m('code', 'file.zip'),
                  ' to ',
                  m('code', 'C:\\Downloads\\file.zip'),
                  ' — then click Attach.',
                ]),
              ]),
              ChatHubState.isHashing && m('.hashing-spinner', [
                m('i.fas.fa-spinner.fa-spin'),
                m('span', ' Hashing file... Please wait.')
              ]),
              !ChatHubState.attachBrowseHint && ChatHubState.hashingError && m('p.error-text', ChatHubState.hashingError),
              m('.modal-buttons', [
                m('button.btn.blue', {
                  disabled: ChatHubState.isHashing || !ChatHubState.attachPath.trim() || ChatHubState.attachBrowseHint,
                  onclick: () => {
                    const path = ChatHubState.attachPath.trim();
                    ChatHubState.isHashing = true;
                    ChatHubState.hashingError = '';
                    m.redraw();

                    rs.rsJsonApiRequest('/rsFiles/ExtraFileHash', {
                      localpath: path,
                      period: 86400 * 7,
                      flags: 0
                    }, (data, success) => {
                      if (success && data.retval) {
                        pollHashStatus(path);
                      } else {
                        ChatHubState.isHashing = false;
                        ChatHubState.hashingError = 'Failed to initiate file hashing. Check the path and try again.';
                        m.redraw();
                      }
                    });
                  }
                }, [m('i.fas.fa-link'), m('span', ' Attach')]),
                m('button.btn.red', {
                  disabled: ChatHubState.isHashing,
                  onclick: () => {
                    ChatHubState.showAttachModal = false;
                    ChatHubState.attachPath = '';
                    ChatHubState.attachBrowseHint = false;
                    ChatHubState.hashingError = '';
                  }
                }, 'Cancel')
              ])
            ])
          ]),
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

            const details = ChatHubState.gxsDetails[gxsId];
            const avatar = getSafeAvatar(details);
            const firstLetter = (name || '?').slice(0, 1).toUpperCase();

            // Calculate status color and tooltip
            const now = Math.floor(Date.now() / 1000);
            const tLastAct = user.lastAct || 0;
            const isOwn = gxsId === rs.idToHex(ChatLobbyModel.currentLobby.gxs_id || '');
            const isMuted = ChatHubState.mutedUsers && ChatHubState.mutedUsers.has(gxsId);

            let statusColor = '#22c55e'; // active (green)
            let statusTooltip = 'Active';

            if (isMuted) {
              statusColor = '#ef4444'; // muted (red)
              statusTooltip = 'Muted';
            } else if (isOwn) {
              statusColor = '#3ba4d7'; // own identity (blue)
              statusTooltip = 'You';
            } else if (tLastAct + 600 < now) {
              statusColor = '#cbd5e1'; // inactive > 10 mins (grey)
              statusTooltip = 'Inactive';
            } else if (tLastAct + 300 < now) {
              statusColor = '#eab308'; // away > 5 mins (yellow)
              statusTooltip = 'Away';
            }

            return m('.user', {
              onmouseenter: (e) => {
                if (ChatHubState.activeMenu) return; // skip tooltip if menu is open
                const rect = e.currentTarget.getBoundingClientRect();
                const rightbar = document.querySelector('.chat-hub-rightbar');
                if (rightbar) {
                  const parentRect = rightbar.getBoundingClientRect();
                  const top = rect.top - parentRect.top + rect.height / 2;
                  ChatHubState.hoveredUser = { gxsId, name, top };
                }
              },
              onmouseleave: () => {
                ChatHubState.hoveredUser = null;
              },
              onclick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                ChatHubState.hoveredUser = null; // hide tooltip

                const rect = e.currentTarget.getBoundingClientRect();
                const rightbar = document.querySelector('.chat-hub-rightbar');
                if (rightbar) {
                  const parentRect = rightbar.getBoundingClientRect();
                  const top = rect.bottom - parentRect.top;
                  if (ChatHubState.activeMenu && ChatHubState.activeMenu.gxsId === gxsId) {
                    ChatHubState.activeMenu = null;
                  } else {
                    ChatHubState.activeMenu = { gxsId, name, top };
                  }
                  m.redraw();
                }
              },
              oncontextmenu: (e) => {
                e.preventDefault();
                e.stopPropagation();
                ChatHubState.hoveredUser = null; // hide tooltip

                const rect = e.currentTarget.getBoundingClientRect();
                const rightbar = document.querySelector('.chat-hub-rightbar');
                if (rightbar) {
                  const parentRect = rightbar.getBoundingClientRect();
                  const top = rect.bottom - parentRect.top;
                  ChatHubState.activeMenu = { gxsId, name, top };
                  m.redraw();
                }
              }
            }, [
              m(peopleUtil.UserAvatar, { avatar, firstLetter, identityId: gxsId, size: 32 }),
              m('span.user-name', name),
              statusColor !== '#22c55e' && m('i.fas.fa-circle', {
                style: {
                  color: statusColor,
                  fontSize: '0.65rem',
                  marginLeft: 'auto',
                  flexShrink: 0,
                  transition: 'color 0.3s ease',
                },
                title: statusTooltip
              })
            ]);
          })),
          ChatHubState.hoveredUser && (() => {
            const hUser = ChatHubState.hoveredUser;
            const details = ChatHubState.gxsDetails[hUser.gxsId];
            if (!details) return null;

            const avatar = getSafeAvatar(details);
            const firstLetter = (hUser.name || '?').slice(0, 1).toUpperCase();
            const votes = details.mReputation
              ? (details.mReputation.mFriendsPositiveVotes - details.mReputation.mFriendsNegativeVotes)
              : 0;

            return m('.user-tooltip', {
              style: {
                top: `${hUser.top}px`,
              }
            }, [
              m('.tooltip-avatar', m(peopleUtil.UserAvatar, { avatar, firstLetter, identityId: hUser.gxsId, size: 64 })),
              m('.tooltip-details', [
                m('.tooltip-row', [m('span.tooltip-label', 'Identity name: '), m('span.tooltip-value', hUser.name)]),
                m('.tooltip-row', [m('span.tooltip-label', 'Identity Id: '), m('span.tooltip-value.tooltip-id', hUser.gxsId)]),
                details.mPgpId && details.mPgpId !== '0000000000000000' && m('.tooltip-row', [
                  m('span.tooltip-label', 'Node: '),
                  m('span.tooltip-value', `${rs.userList.username(details.mPgpId) || hUser.name} [${details.mPgpId}]`)
                ]),
                m('.tooltip-row', [
                  m('span.tooltip-label', 'Votes: '),
                  m('span.tooltip-value', {
                    style: {
                      color: votes >= 0 ? '#22c55e' : '#ef4444',
                      fontWeight: 'bold'
                    }
                  }, (votes >= 0 ? '+' : '') + votes)
                ])
              ])
            ]);
          })(),
          ChatHubState.activeMenu && (() => {
            const menu = ChatHubState.activeMenu;
            const isOwn = menu.gxsId === rs.idToHex(ChatLobbyModel.currentLobby.gxs_id || '');
            const isMuted = ChatHubState.mutedUsers && ChatHubState.mutedUsers.has(menu.gxsId);

            return m('.rightbar-context-menu', {
              style: {
                top: `${menu.top}px`,
              },
              onclick: (e) => {
                e.stopPropagation();
              }
            }, [
              !isOwn && m('.menu-item', {
                onclick: () => {
                  if (isMuted) {
                    ChatHubState.mutedUsers.delete(menu.gxsId);
                  } else {
                    ChatHubState.mutedUsers.add(menu.gxsId);
                  }
                  ChatHubState.activeMenu = null;
                  m.redraw();
                }
              }, [
                m('i.fas.fa-volume-mute', { style: 'color: #ef4444; margin-right: 0.5rem;' }),
                isMuted ? 'Unmute participant' : 'Mute participant'
              ]),
              !isOwn && m('.menu-item', {
                onclick: () => {
                  ChatHubState.activeMenu = null;
                  people.setSelectedId(menu.gxsId, 'chat');
                }
              }, [
                m('i.fas.fa-comments', { style: 'color: #3b82f6; margin-right: 0.5rem;' }),
                'Start private chat'
              ]),
              !isOwn && m('.menu-item', {
                onclick: () => {
                  ChatHubState.activeMenu = null;
                  people.setSelectedId(menu.gxsId, 'details', true);
                }
              }, [
                m('i.fas.fa-envelope', { style: 'color: #10b981; margin-right: 0.5rem;' }),
                'Send Message'
              ]),
              m('.menu-item', {
                onclick: () => {
                  ChatHubState.activeMenu = null;
                  people.setSelectedId(menu.gxsId, 'details');
                }
              }, [
                m('i.fas.fa-user', { style: 'color: #8b5cf6; margin-right: 0.5rem;' }),
                'Show author in people tab'
              ])
            ]);
          })()
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
      let participants = [];

      if (room.gxs_ids) {
        if (Array.isArray(room.gxs_ids)) {
          participants = room.gxs_ids.map((u) => ({
            key: u.key,
            name: rs.userList.username(u.key) || u.key
          }));
        } else if (typeof room.gxs_ids === 'object') {
          participants = Object.keys(room.gxs_ids).map((key) => ({
            key: key,
            name: rs.userList.username(key) || key
          }));
        }
      }

      const ownId = room.gxs_id;
      if (ownId && ownId !== '00000000000000000000000000000000') {
        const hasOwn = participants.some((p) => p.key === ownId);
        if (!hasOwn) {
          participants.push({
            key: ownId,
            name: rs.userList.username(ownId) || ownId
          });
        }
      }

      participantCount = participants.length;
      participantNames = participants.map((p) => p.name);
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
  dismissMenu: () => {
    if (ChatHubState.activeMenu) {
      ChatHubState.activeMenu = null;
      m.redraw();
    }
  },
  oninit: () => {
    ChatHubState.activeTab = 'chat';
    const lobbyId = m.route.param('lobby');
    if (lobbyId) {
      ChatHubState.selectedRoomId = lobbyId;
      ChatLobbyModel.loadLobby(lobbyId);
    }
    window.addEventListener('click', Layout.dismissMenu);

    // Load own identities for room creation
    peopleUtil.ownIds((ids) => {
      ChatHubState.ownGxsIdentities = ids || [];
      if (ChatHubState.ownGxsIdentities.length > 0) {
        ChatHubState.newRoomIdentity = ChatHubState.ownGxsIdentities[0];
      }
      ChatHubState.ownGxsIdentities.forEach((id) => {
        if (ChatHubState.gxsDetails[id] === undefined) {
          rs.rsJsonApiRequest('/rsIdentity/getIdDetails', { id }, (data) => {
            if (data && data.details) {
              ChatHubState.gxsDetails[id] = data.details;
              m.redraw();
            }
          });
        }
      });
      m.redraw();
    });
  },
  onupdate: () => {
    const lobbyId = m.route.param('lobby');
    if (lobbyId && ChatHubState.selectedRoomId !== lobbyId) {
      ChatHubState.selectedRoomId = lobbyId;
      ChatLobbyModel.loadLobby(lobbyId);
    }
  },
  onremove: () => {
    ChatLobbyModel.stopStatusPolling();
    window.removeEventListener('click', Layout.dismissMenu);
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
        } else if (
          ChatLobbyModel.currentLobby &&
          rs.idToHex(ChatLobbyModel.currentLobby.lobby_id || '') === lobbyId
        ) {
          selectedRoom = ChatLobbyModel.currentLobby;
          selectedRoomType = 'subscribed';
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
          m('button.chat-create-lobby-btn', {
            onclick: () => {
              ChatHubState.showCreateRoomModal = true;
            }
          }, [
            m('i.fas.fa-plus'),
            ' Create'
          ])
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
                let hasOwn = false;
                if (info.gxs_ids) {
                  if (Array.isArray(info.gxs_ids)) {
                    count = info.gxs_ids.length;
                    hasOwn = info.gxs_ids.some((u) => u.key === info.gxs_id);
                  } else if (typeof info.gxs_ids === 'object') {
                    count = Object.keys(info.gxs_ids).length;
                    hasOwn = info.gxs_ids[info.gxs_id] !== undefined;
                  }
                }
                if (!hasOwn && info.gxs_id && info.gxs_id !== '00000000000000000000000000000000') {
                  count++;
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
        ChatHubState.showCreateRoomModal && m('.attach-modal-overlay', [
          m('.attach-modal', [
            m('h4', 'Create New Chat Room'),
            
            m('.form-field', { style: 'display: flex; flex-direction: column; gap: 0.25rem;' }, [
              m('label', { style: 'font-weight: bold; font-size: 0.9rem; color: #475569;' }, 'Room Name:'),
              m('input[type=text]', {
                value: ChatHubState.newRoomName,
                oninput: (e) => { ChatHubState.newRoomName = e.target.value; },
                placeholder: 'Enter room name',
                style: 'padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.25rem; font-size: 0.9rem;'
              })
            ]),
            
            m('.form-field', { style: 'display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.5rem;' }, [
              m('label', { style: 'font-weight: bold; font-size: 0.9rem; color: #475569;' }, 'Topic:'),
              m('input[type=text]', {
                value: ChatHubState.newRoomTopic,
                oninput: (e) => { ChatHubState.newRoomTopic = e.target.value; },
                placeholder: 'Enter room topic',
                style: 'padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.25rem; font-size: 0.9rem;'
              })
            ]),

            m('.form-field', { style: 'display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.5rem;' }, [
              m('label', { style: 'font-weight: bold; font-size: 0.9rem; color: #475569;' }, 'Admin Identity:'),
              m('select', {
                value: ChatHubState.newRoomIdentity,
                onchange: (e) => { ChatHubState.newRoomIdentity = e.target.value; },
                style: 'padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.25rem; font-size: 0.9rem; background-color: #ffffff;'
              }, [
                ChatHubState.ownGxsIdentities && ChatHubState.ownGxsIdentities.map(id => {
                  const details = ChatHubState.gxsDetails[id];
                  const name = details ? (details.mNickname || details.mGroupName) : id;
                  return m('option', { value: id }, name);
                })
              ])
            ]),

            m('.form-field', { style: 'display: flex; gap: 0.5rem; align-items: center; margin-top: 0.75rem;' }, [
              m('input[type=checkbox]', {
                checked: ChatHubState.newRoomPublic,
                onclick: (e) => { ChatHubState.newRoomPublic = e.target.checked; }
              }),
              m('label', { style: 'font-size: 0.9rem; color: #475569;' }, 'Public Room')
            ]),

            ChatHubState.createRoomError && m('p.error-text', { style: 'color: #ef4444; font-size: 0.85rem; margin: 0.5rem 0 0 0;' }, ChatHubState.createRoomError),

            m('.modal-buttons', { style: 'display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem;' }, [
              m('button.btn.blue', {
                disabled: !ChatHubState.newRoomName.trim() || !ChatHubState.newRoomIdentity,
                onclick: () => {
                  const name = ChatHubState.newRoomName.trim();
                  const topic = ChatHubState.newRoomTopic.trim();
                  const identity = ChatHubState.newRoomIdentity;
                  const isPublic = ChatHubState.newRoomPublic;
                  const flags = isPublic ? 4 : 0; // RS_CHAT_LOBBY_FLAGS_PUBLIC
                  
                  rs.rsJsonApiRequest('/rsChats/createChatLobby', {
                    lobby_name: name,
                    lobby_identity: identity,
                    lobby_topic: topic,
                    invited_friends: [],
                    lobby_privacy_type: flags
                  }, (data, success) => {
                    if (success) {
                      ChatHubState.showCreateRoomModal = false;
                      ChatHubState.newRoomName = '';
                      ChatHubState.newRoomTopic = '';
                      ChatHubState.createRoomError = '';
                      // Refresh rooms list
                      ChatRoomsModel.loadSubscribedRooms();
                      m.redraw();
                    } else {
                      ChatHubState.createRoomError = 'Failed to create room. Check parameters.';
                      m.redraw();
                    }
                  });
                }
              }, 'Create'),
              m('button.btn.red', {
                onclick: () => {
                  ChatHubState.showCreateRoomModal = false;
                  ChatHubState.newRoomName = '';
                  ChatHubState.newRoomTopic = '';
                  ChatHubState.createRoomError = '';
                }
              }, 'Cancel')
            ])
          ])
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
      const isRoom = chatType === 3;
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
          m(
            '.messages' + (isRoom ? '.compact-container' : ''),
            { onclick: () => MobileState.closeAll() },
            ChatLobbyModel.messages
          ),
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
