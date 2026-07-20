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
  rs.rsJsonApiRequest(
    '/rsChats/getDistantChatStatus',
    {
      pid: pid,
    },
    (detail, success) => {
      if (success && detail.retval) {
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
  return [];
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

/**
 * Wraps emoji characters in a span so CSS can size them independently.
 */
function renderTextWithEmoji(text) {
  if (!text) return '';
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
  knownSubscrIds: [],
  subscribedRooms: {},
  loadPublicRooms() {
    rs.rsJsonApiRequest(
      '/rsChats/getListOfNearbyChatLobbies',
      {},
      (data) => {
        if (data && data.public_lobbies) {
          const seen = new Set();
          const uniqueLobbies = data.public_lobbies.filter((lobby) => {
            const id = rs.idToHex(lobby.lobby_id);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          ChatRoomsModel.allRooms = sortLobbies(uniqueLobbies);
        } else {
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
          const ids = [...new Set(data.cl_list.map((lid) => rs.idToHex(lid)))];
          ChatRoomsModel.knownSubscrIds = ids;

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
                ChatRoomsModel.loadPublicRooms();
                if (after != null) {
                  after();
                }
                m.redraw();
              }
            })
          );
        } else {
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
 * Message displays a single Chat-Message
 * currently removes formatting and in consequence inline links
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
      const rawGxsId = msg.lobby_peer_gxs_id || msg.peerId;
      let gxsId = rs.idToHex(rawGxsId);

      const isZero = (id) => !id || id === '00000000000000000000000000000000';
      if (isZero(gxsId)) {
        const lobby = ChatLobbyModel.currentLobby;
        if (lobby && (lobby.chatType === 1 || lobby.chatType === 2)) {
          gxsId = msg.incoming ? rs.idToHex(lobby.to_id || lobby.peer_id || lobby.distant_chat_id) : rs.idToHex(lobby.own_id || lobby.gxs_id);
        }
      }

      const isMuted = ChatHubState.mutedUsers && ChatHubState.mutedUsers.has(gxsId);
      const details = ChatHubState.gxsDetails[gxsId];
      const opinion = details && details.mReputation ? details.mReputation.mOwnOpinion : 1;
      const isBanned = opinion === 0;

      if (isMuted || isBanned) {
        return null;
      }

      let username = rs.userList.username(gxsId) || msg.peerName || '???';
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

  getMessageKey(msg) {
    if (msg.msgId && msg.msgId !== 0) return 'id_' + msg.msgId;
    const text = msg.msg || msg.message || '';
    return 't_' + msg.sendTime + '_' + text.substring(0, 32);
  },

  addMessages(newMsgs, scroll = false) {
    let added = false;
    newMsgs.forEach((msg) => {
      const key = this.getMessageKey(msg);
      if (!this.messageKeys.has(key)) {
        const text = msg.msg || msg.message || '';
        const isNearDuplicate = this.messages.some((existingMsg) => {
          const eAttrs = existingMsg.attrs;
          const eText = eAttrs.msg || eAttrs.message || '';
          return (
            eText === text &&
            Math.abs(eAttrs.sendTime - msg.sendTime) < 5
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

      this.messages = [];
      this.messageKeys.clear();

      this.loadHistory(currentlobbyid, detail.chatType);

      const cid = this.chatId();
      rs.events[15].chatMessages(cid, rs.events[15], (l) => {
        this.addMessages(l);
      });

      rs.events[15].notify = (chatMessage) => {
        const msgCid = chatMessage.chat_id;
        let msgId;

        if (msgCid.type === 3) {
          msgId = rs.idToHex(msgCid.lobby_id);
        } else if (msgCid.type === 2) {
          msgId = rs.idToHex(msgCid.distant_chat_id);
        } else if (msgCid.type === 1) {
          msgId = rs.idToHex(msgCid.peer_id);
        } else {
          msgId = rs.idToHex(msgCid);
        }

        if (msgId === currentlobbyid) {
          this.addMessages([chatMessage]);
        }
      };

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
          onsuccess();
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
      ChatLobbyModel.loadLobby(rs.idToHex(info.lobby_id));
    };
  },
  setupEvent(info) {
    return () => {
      m.route.set('/chat/:lobby/setup', { lobby: rs.idToHex(info.lobby_id) });
      ChatLobbyModel.loadPublicLobby(rs.idToHex(info.lobby_id));
    };
  },
};

// ************************* Chat Hub State ****************************

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
  newRoomSigned: false,
  ownGxsIdentities: [],
  createRoomError: '',
  userSortMethod: 'name',
  showInviteModal: false,
  friendsList: [],
  selectedFriendsToInvite: new Set(),
};

module.exports = {
  get64Num,
  loadLobbyDetails,
  loadDistantChatDetails,
  sortLobbies,
  getNicknameColor,
  getStatusColor,
  getStatusTooltip,
  renderTextWithEmoji,
  getSafeAvatar,
  MobileState,
  ChatRoomsModel,
  Message,
  ChatLobbyModel,
  ChatHubState,
};
