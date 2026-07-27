const m = require('mithril');
const rs = require('rswebui');
const Data = require('network/network_data');
const peopleUtil = require('people/people_util');

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
};

function loadOwnProfile() {
  rs.rsJsonApiRequest('/rsConfig/getConfigNetStatus', {}, (data) => {
    if (data && data.status) {
      State.ownProfile.name = data.status.ownName || 'Unknown';
      State.ownProfile.ssl_id = data.status.ownId || '';

      if (State.ownProfile.ssl_id) {
        rs.rsJsonApiRequest('/rsChats/getCustomStateString', { peer_id: State.ownProfile.ssl_id }, (statusData) => {
          if (statusData && statusData.retval) {
            State.ownProfile.customState = statusData.retval;
            m.redraw();
          }
        });

        rs.rsJsonApiRequest('/rsPeers/getPeerDetails', { sslId: State.ownProfile.ssl_id }, (detData) => {
          if (detData && detData.det && detData.det.gpg_id) {
            State.ownProfile.gpg_id = detData.det.gpg_id;
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
    if (
      chatMessage.chat_id &&
      (chatMessage.chat_id.type === 1 || chatMessage.chat_id.type === 2) &&
      rs.idToHex(chatMessage.chat_id) === State.currentChatPeerId
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

module.exports = {
  State,
  loadOwnProfile,
  loadSelectedOwnGxsDetails,
  fetchIdDetails,
  loadGxsIdentities,
  startDirectChat,
  getOnlineSslId,
  preloadNetworkChatHistory,
  loadDirectChatMessages,
  sendDirectChatMessage,
  scrollChatToBottom,
};
