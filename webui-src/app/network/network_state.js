const m = require('mithril');
const rs = require('rswebui');
const Data = require('network/network_data');
const peopleUtil = require('people/people_util');

const State = {
  ownProfile: {
    name: 'Loading...',
    location: '',
    ssl_id: '',
    gpg_id: '',
    customState: '',
    statusValue: 3,
    statusTimestamp: 0,
    avatar: '',
  },
  ownGxsIds: [],
  selectedOwnGxsId: '',
  selectedOwnGxsDetails: null,
  selectedFriendGpgId: null,
  mainTab: 'network', // 'network' | 'chats'
  activeTab: 'details', // 'details' | 'chat'
  searchString: '',
  gpgToGxsIdMap: {},
  gxsIdToDetailsMap: {},
  gxsIdentities: [],
  chatHistoryMap: {}, // gpgId -> { lastMsg, lastTime }
  currentChatPeerId: null,
  chatMessages: [],
  chatInputMsg: '',
  showMailCompose: false,
  showAttachModal: false,
  attachPath: '',
  attachBrowseHint: false,
  isHashing: false,
  hashingError: '',
  showEmojiPicker: false,
  showHistoryModal: false,
  historySearchQuery: '',
  fullHistoryMessages: [],
  isHistoryLoading: false,
};

function loadOwnProfile() {
  rs.rsJsonApiRequest('/rsStatus/getOwnStatus', {}, (statusData) => {
    if (statusData && statusData.retval && statusData.statusInfo) {
      State.ownProfile.statusValue = statusData.statusInfo.status;
      State.ownProfile.statusTimestamp = statusData.statusInfo.time_stamp || 0;
      m.redraw();
    }
  }).catch(() => {});

  const fetchOwnCustomState = () => {
    rs.rsJsonApiRequest('/rsChats/getOwnCustomStateString', {}, (statusData) => {
      if (statusData) {
        let customState;
        if (typeof statusData.retval === 'string') {
          customState = statusData.retval;
        } else if (typeof statusData === 'string') {
          customState = statusData;
        } else if (statusData.retval && typeof statusData.retval === 'object') {
          customState =
            statusData.retval.status ||
            statusData.retval.customState ||
            statusData.retval.custom_state ||
            statusData.retval.status_string ||
            '';
        } else {
          customState =
            statusData.customState ||
            statusData.custom_state ||
            statusData.status ||
            statusData.status_string ||
            statusData.ownCustomStateString ||
            '';
        }
        State.ownProfile.customState = customState;
        m.redraw();
      }
    }).catch(() => {
      if (State.ownProfile.ssl_id) {
        rs.rsJsonApiRequest(
          '/rsChats/getCustomStateString',
          { peer_id: State.ownProfile.ssl_id },
          (statusData) => {
            if (statusData) {
              const customState =
                typeof statusData.retval === 'string'
                  ? statusData.retval
                  : statusData.customState || statusData.custom_state || statusData.status || '';
              State.ownProfile.customState = customState;
              m.redraw();
            }
          }
        ).catch(() => {});
      }
    });
  };

  fetchOwnCustomState();

  rs.rsJsonApiRequest('/rsConfig/getConfigNetStatus', {}, (data) => {
    if (data && data.status) {
      State.ownProfile.name = data.status.ownName || 'Unknown';
      State.ownProfile.ssl_id = data.status.ownId || '';

      if (State.ownProfile.ssl_id) {
        fetchOwnCustomState();

        rs.rsJsonApiRequest('/rsPeers/getPeerDetails', { sslId: State.ownProfile.ssl_id }, (detData) => {
          if (detData && detData.det) {
            State.ownProfile.gpg_id = detData.det.gpg_id || '';
            State.ownProfile.location = detData.det.location || '';
            m.redraw();
          }
        });

        /* Disabled getAvatar API call to avoid 404 network errors
        rs.rsJsonApiRequest('/rsChats/getAvatar', { pid: State.ownProfile.ssl_id }, (avatarData) => {
          if (avatarData && avatarData.retval && avatarData.avatar_base64_string) {
            State.ownProfile.avatar = avatarData.avatar_base64_string;
            m.redraw();
          }
        });
        */
      }
      m.redraw();
    }
  });

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

function fetchIdDetails(gxsId) {
  if (!gxsId) return;
  if (State.gxsIdToDetailsMap[gxsId] === undefined) {
    State.gxsIdToDetailsMap[gxsId] = null;
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
  }
}

function loadGxsIdentities() {
  rs.rsJsonApiRequest('/rsIdentity/getIdentitiesSummaries', {}, (data) => {
    if (data && data.ids) {
      State.gxsIdentities = data.ids.map((u) => u.mGroupId);
      m.redraw();
    }
  });
}

function startDirectChat(sslId) {
  State.currentChatPeerId = sslId;
  State.chatMessages = [];
  loadDirectChatMessages();
  loadRecentDirectChatHistory();
}

function getOnlineSslId(gpgId) {
  const friend = Data.gpgDetails[gpgId];
  if (!friend || !friend.locations || friend.locations.length === 0) return null;
  const onlineLoc = friend.locations.find((loc) => loc.isOnline);
  return onlineLoc ? onlineLoc.id : friend.locations[0].id;
}

function isSystemMsg(msg) {
  if (!msg) return false;
  const str = String(msg);
  return (
    str.includes('Distant chat requested') ||
    str.includes('Distant chat established') ||
    str.includes('Distant chat closed') ||
    str.includes('Distant chat status')
  );
}

function preloadNetworkChatHistory() {
  const gpgIds = Object.keys(Data.gpgDetails || {});
  gpgIds.forEach((gpgId) => {
    if (!gpgId || gpgId === '0000000000000000') return;

    const privatePeerId = {
      broadcast_status_peer_id: '00000000000000000000000000000000',
      type: 1, // PRIVATE
      peer_id: gpgId,
      distant_chat_id: '00000000000000000000000000000000',
      lobby_id: { xstr64: '0' },
    };

    rs.rsJsonApiRequest(
      '/rsHistory/getMessages',
      {
        chatPeerId: privatePeerId,
        loadCount: 20,
      },
      (msgData, success) => {
        if (success && msgData && msgData.msgs) {
          const userMsgs = msgData.msgs.filter(
            (m) => !m.isSystem && !isSystemMsg(m.message || m.msg)
          );
          if (userMsgs.length > 0) {
            const last = userMsgs[userMsgs.length - 1];
            State.chatHistoryMap[gpgId] = {
              lastMsg: last.message || last.msg || '',
              lastTime: last.sendTime || last.recvTime || Math.floor(Date.now() / 1000),
            };
            m.redraw();
          }
        }
      }
    );
  });
}

function loadDirectChatMessages() {
  rs.events[15].notify = (chatMessage) => {
    const messagePeerId = chatMessage.chat_id && chatMessage.chat_id.peer_id
      ? rs.idToHex(chatMessage.chat_id.peer_id)
      : '';
    if (
      chatMessage.chat_id &&
      chatMessage.chat_id.type === 1 &&
      messagePeerId === State.currentChatPeerId
    ) {
      State.chatMessages.push(chatMessage);
      if (State.selectedFriendGpgId) {
        State.chatHistoryMap[State.selectedFriendGpgId] = {
          lastMsg: chatMessage.msg || chatMessage.message || '',
          lastTime: chatMessage.sendTime || chatMessage.recvTime || Math.floor(Date.now() / 1000),
        };
      }
      m.redraw();
      scrollChatToBottom();
    }
  };
}

function directChatId(peerId) {
  return {
    broadcast_status_peer_id: '00000000000000000000000000000000',
    type: 1,
    peer_id: peerId,
    distant_chat_id: '00000000000000000000000000000000',
    lobby_id: { xstr64: '0' },
  };
}

function mergeDirectChatMessages(messages) {
  const unique = new Map();
  messages.forEach((message) => {
    const text = message.msg || message.message || '';
    const time = message.sendTime || message.recvTime || 0;
    const incoming = message.incoming === true;
    unique.set(`${time}_${incoming}_${text}`, message);
  });
  return Array.from(unique.values()).sort(
    (a, b) => (a.sendTime || a.recvTime || 0) - (b.sendTime || b.recvTime || 0)
  );
}

function loadRecentDirectChatHistory() {
  const peerId = State.currentChatPeerId;
  if (!peerId) return;
  rs.rsJsonApiRequest('/rsHistory/getMessages', {
    chatPeerId: directChatId(peerId),
    loadCount: 20,
  }, (data, success) => {
    if (peerId !== State.currentChatPeerId) return;
    if (success && data && Array.isArray(data.msgs)) {
      State.chatMessages = mergeDirectChatMessages(data.msgs.concat(State.chatMessages));
      m.redraw();
      scrollChatToBottom();
    }
  });
}

function loadAllDirectChatHistory() {
  const peerId = State.currentChatPeerId;
  if (!peerId) return;
  State.isHistoryLoading = true;
  State.fullHistoryMessages = [];
  m.redraw();
  rs.rsJsonApiRequest('/rsHistory/getMessages', {
    chatPeerId: directChatId(peerId),
    loadCount: 0,
  }, (data, success) => {
    if (peerId !== State.currentChatPeerId) return;
    State.fullHistoryMessages = success && data && Array.isArray(data.msgs)
      ? mergeDirectChatMessages(data.msgs)
      : [];
    State.isHistoryLoading = false;
    m.redraw();
  });
}

function sendDirectChatMessage() {
  if (!State.chatInputMsg.trim() || !State.currentChatPeerId) return;

  const msg = State.chatInputMsg;
  State.chatInputMsg = '';

  rs.rsJsonApiRequest(
    '/rsChats/sendChat',
    {
      id: { type: 1, peer_id: State.currentChatPeerId },
      msg,
    },
    (data, success) => {
      if (success) {
        const nowSec = Math.floor(Date.now() / 1000);
        State.chatMessages.push({
          chat_id: { type: 1, peer_id: State.currentChatPeerId },
          msg,
          sendTime: nowSec,
          incoming: false,
          own: true,
        });

        if (State.selectedFriendGpgId) {
          State.chatHistoryMap[State.selectedFriendGpgId] = {
            lastMsg: msg,
            lastTime: nowSec,
          };
        }
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

function setOwnCustomStateString(statusString) {
  const str = (statusString || '').trim();
  rs.rsJsonApiRequest('/rsChats/setCustomStateString', { status_string: str }, () => {
    State.ownProfile.customState = str;
    m.redraw();
  }).catch(() => {
    State.ownProfile.customState = str;
    m.redraw();
  });
}

async function setOwnStatus(statusValue) {
  const value = Number(statusValue);
  if (![1, 2, 3].includes(value)) return false;

  try {
    const response = await rs.rsJsonApiRequest('/rsStatus/sendStatus', { status: value });
    if (response && response.body && response.body.retval === false) return false;

    State.ownProfile.statusValue = value;
    State.ownProfile.statusTimestamp = Math.floor(Date.now() / 1000);
    m.redraw();
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  State,
  loadOwnProfile,
  setOwnCustomStateString,
  setOwnStatus,
  loadSelectedOwnGxsDetails,
  fetchIdDetails,
  loadGxsIdentities,
  startDirectChat,
  getOnlineSslId,
  preloadNetworkChatHistory,
  loadDirectChatMessages,
  loadRecentDirectChatHistory,
  loadAllDirectChatHistory,
  sendDirectChatMessage,
  scrollChatToBottom,
};
