const m = require('mithril');
const rs = require('rswebui');
const Data = require('network/network_data');
const peopleUtil = require('people/people_util');

const State = {
  searchString: '',
  selectedId: null, // GXS ID of the selected identity
  mainTab: 'people', // 'people' | 'chats'
  activeFilter: 'contacts', // 'all' | 'contacts' | 'own'
  gxsIdToDetailsMap: {},
  ownGxsIds: [],
  gpgToGxsIdMap: {},
  chatHistoryMap: {}, // gxsId -> { lastMsg, lastTime }
  showMailCompose: false,
  activeTab: 'details',
  mobilePane: 'list', // Phone master/detail navigation: 'list' | 'detail'
  selectedOwnGxsIdForChat: '',
  chatPid: null,
  chatMessages: [],
  chatInputMsg: '',
  distantChatStatus: null,
  statusPollInterval: null,
  chatDisconnected: false,
  activeDistantChats: {}, // gxsId -> { pid, status, messages, inputMsg, disconnected }
  activeMenu: null,
  showHistoryModal: false,
  historySearchQuery: '',
  fullHistoryMessages: [],
  isHistoryLoading: false,
};

function getDistantChatSession(gxsId) {
  if (!gxsId) return null;
  if (!State.activeDistantChats[gxsId]) {
    State.activeDistantChats[gxsId] = {
      pid: null,
      status: null,
      messages: [],
      msgKeys: new Set(),
      inputMsg: '',
      disconnected: false,
    };
  }
  const session = State.activeDistantChats[gxsId];
  //  Sessions created by an older build of this file have no key set.
  if (!session.msgKeys) session.msgKeys = new Set();
  return session;
}

//  The chat view renders `State.chatMessages`, while the live event handler and
//  the history loader work on the per peer `session.messages`. Those two MUST
//  remain the very same array: the moment one side is *reassigned* instead of
//  mutated, the other one becomes an orphan and the messages written into it
//  are never displayed. That is exactly what used to happen -- the history
//  answer rebound `State.chatMessages` to a fresh array, so every incoming
//  message landed in the now invisible `session.messages` and the conversation
//  looked one-way. Everything below therefore mutates the session array in
//  place, and `State.chatMessages` is only ever re-pointed *at* it.
function chatMessageKey(msg) {
  const text = msg.msg || msg.message || '';
  //  System notices are identified by their text alone: they are re-emitted on
  //  every status poll and must not pile up.
  if (msg.isSystem) return 'sys_' + text;
  const time = msg.sendTime || msg.recvTime || 0;
  return (msg.incoming ? 'in_' : 'out_') + time + '_' + text;
}

function scrollChatToBottom() {
  setTimeout(() => {
    const element = document.querySelector('.chat-messages');
    if (element) element.scrollTop = element.scrollHeight;
  }, 100);
}

//  Returns true when at least one message was really new, so callers can skip
//  the redraw/scroll when the core just replayed something already displayed.
function addSessionMessages(session, msgs) {
  if (!session || !msgs || msgs.length === 0) return false;
  let added = false;
  msgs.forEach((msg) => {
    if (!msg) return;
    const key = chatMessageKey(msg);
    if (session.msgKeys.has(key)) return;
    session.msgKeys.add(key);
    session.messages.push(msg);
    added = true;
  });
  if (!added) return false;
  session.messages.sort(
    (a, b) => (a.sendTime || a.recvTime || 0) - (b.sendTime || b.recvTime || 0)
  );
  return true;
}

function resetSessionMessages(session, msgs) {
  if (!session) return;
  session.messages.length = 0;
  session.msgKeys.clear();
  addSessionMessages(session, msgs);
}

function addSessionSystemMessage(session, text) {
  return addSessionMessages(session, [{
    incoming: true,
    isSystem: true,
    msg: text,
    sendTime: Math.floor(Date.now() / 1000),
  }]);
}

//  Messages received while the People tab was not mounted -- or before its
//  event handler was installed -- are still sitting in the rswebui event queue
//  buffer, keyed by chat type and distant chat id.
function drainBufferedChatMessages(session) {
  if (!session || !session.pid) return false;
  const owner = rs.events && rs.events[15];
  const buckets = owner && owner.messages ? owner.messages[2] : null;
  const buffered = buckets ? buckets[session.pid] : null;
  if (!buffered || buffered.length === 0) return false;
  return addSessionMessages(session, buffered);
}


function fetchIdDetails(gxsId, attempt = 0) {
  if (!peopleUtil.isUsableIdentityId(gxsId)) return;
  if (State.gxsIdToDetailsMap[gxsId] === undefined) {
    State.gxsIdToDetailsMap[gxsId] = null; // Mark as loading
    rs.rsJsonApiRequest('/rsIdentity/getIdDetails', { id: gxsId }, (detData) => {
      const details = detData && detData.details;
      const detailsId = details && String(details.mId || '');
      if (details && peopleUtil.isUsableIdentityId(detailsId)) {
        State.gxsIdToDetailsMap[gxsId] = detData.details;
        const pgpId = detData.details.mPgpId;
        if (pgpId && pgpId !== '0000000000000000') {
          State.gpgToGxsIdMap[pgpId.toLowerCase()] = gxsId;
        }
        m.redraw();
      } else if (attempt < 5) {
        setTimeout(() => {
          State.gxsIdToDetailsMap[gxsId] = undefined;
          fetchIdDetails(gxsId, attempt + 1);
        }, 250 * (attempt + 1));
      } else {
        //  Give up on this id, but do NOT restore `undefined`: that is the
        //  value which makes this function fire a request, and two of the
        //  callers sit inside a view (people_sidebar). Every redraw would then
        //  start the whole six request chain again, forever, for any id the
        //  core never resolves. `null` keeps the entry marked as attempted.
        State.gxsIdToDetailsMap[gxsId] = null;
      }
    });
  }
}

function loadGxsIdentities() {
  rs.rsJsonApiRequest('/rsIdentity/getIdentitiesSummaries', {}, (data) => {
    if (data && data.ids) {
      m.redraw();
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

function get64Num(val) {
  if (!val) return 0;
  if (typeof val === 'object') {
    return val.xint64 || parseInt(val.xstr64) || 0;
  }
  return Number(val) || 0;
}

function getServiceName(serviceId) {
  switch (serviceId) {
    case 1: return 'Channels';
    case 2: return 'Forums';
    case 3: return 'Boards';
    case 4: return 'Chat';
    case 5: return 'GxsCircles';
    case 6: return 'GxsMail';
    case 7: return 'GxsCircles';
    case 8: return 'Wire';
    default: return 'Unknown (' + serviceId + ')';
  }
}

function createUsageString(u) {
  if (!u) return '[Unknown]';
  const serviceName = getServiceName(u.mServiceId);
  const usageCode = u.mUsageCode;

  switch (usageCode) {
    case 0:
      return '[Unknown]';
    case 1:
      return `Admin signature in service ${serviceName}`;
    case 2:
      return `Admin signature verification in service ${serviceName}`;
    case 3:
      return `Creation of author signature in service ${serviceName}`;
    case 4:
    case 7:
      return `Group author for group ${u.mGrpId || 'Unknown'} in service ${serviceName}`;
    case 5:
      return `Message signature creation in group ${u.mGrpId || 'Unknown'} of service ${serviceName}`;
    case 6:
    case 8:
      return `Vote/comment in ${serviceName} service (Group: ${u.mGrpId || 'Unknown'}, Msg: ${u.mMsgId || 'Unknown'})`;
    case 9:
      return `Message in chat room (Id: ${get64Num(u.mAdditionalId)})`;
    case 10:
      return 'Distant message signature validation.';
    case 11:
      return 'Distant message signature creation.';
    case 12:
      return 'Signature validation in distant tunnel system.';
    case 13:
      return 'Signature in distant tunnel system.';
    case 14:
      return 'Received from GXS sync.';
    case 15:
      return 'Received from GXS discovery.';
    case 16:
      return 'Explicit request to friend.';
    case 17:
      return 'Generic signature validation.';
    case 18:
      return 'Generic signature creation.';
    case 19:
      return 'Generic encryption.';
    case 20:
      return 'Generic decryption.';
    case 21:
      return 'Circle membership check.';
    default:
      return `Usage code ${usageCode} in service ${serviceName}`;
  }
}

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
  fetchIdDetails(gxsId);
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
  }
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

function pollDistantChatStatus() {
  if (!State.chatPid) return;
  const session = State.selectedId ? getDistantChatSession(State.selectedId) : null;

  rs.rsJsonApiRequest(
    '/rsChats/getDistantChatStatus',
    {
      pid: State.chatPid,
    },
    (detail, success) => {
      if (success && detail.retval) {
        State.distantChatStatus = detail.info;
        if (session) session.status = detail.info;

        if (session) {
          if (detail.info.status === 2) {
            addSessionSystemMessage(session, 'Tunnel is secured. You can talk!');
            //  The tunnel just went up: anything the peer sent while it was
            //  still pending is waiting in the event buffer.
            drainBufferedChatMessages(session);
          } else if (detail.info.status === 3) {
            addSessionSystemMessage(session, 'Your partner closed the conversation.');
          }
        }
        m.redraw();
      }
    }
  );
}

function startStatusPolling() {
  stopStatusPolling();
  pollDistantChatStatus();
  State.statusPollInterval = setInterval(pollDistantChatStatus, 3000);
}

function stopStatusPolling() {
  if (State.statusPollInterval) {
    clearInterval(State.statusPollInterval);
    State.statusPollInterval = null;
  }
}

function isSystemMsg(msgText) {
  if (!msgText || typeof msgText !== 'string') return true;
  const lower = msgText.toLowerCase();
  return (
    lower.includes('starting distant chat') ||
    lower.includes('please wait for secure tunnel') ||
    lower.includes('tunnel is secured') ||
    lower.includes('chat initiated') ||
    lower.includes('closed the conversation')
  );
}

function initializeDistantChat(force = false) {
  if (!State.selectedId || !State.selectedOwnGxsIdForChat) return;

  const session = getDistantChatSession(State.selectedId);

  // If chat session is already established/initiating for this peer and not forced/disconnected:
  if (!force && session.pid && !session.disconnected) {
    State.chatPid = session.pid;
    State.chatMessages = session.messages;
    State.distantChatStatus = session.status;
    State.chatDisconnected = session.disconnected;

    drainBufferedChatMessages(session);
    loadChatMessages();
    pollDistantChatStatus();
    startStatusPolling();
    return;
  }

  // Otherwise, start a new tunnel for this peer
  session.pid = null;
  session.status = null;
  resetSessionMessages(session, [
    {
      incoming: true,
      isSystem: true,
      msg: 'Starting distant chat... Please wait for secure tunnel.',
      sendTime: Math.floor(Date.now() / 1000),
    }
  ]);
  session.disconnected = false;

  State.chatPid = null;
  State.chatMessages = session.messages;
  State.distantChatStatus = null;
  State.chatDisconnected = false;
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
        const hexPid = rs.idToHex(res.pid);
        session.pid = hexPid;
        State.chatPid = hexPid;
        State.distantChatStatus = null;
        drainBufferedChatMessages(session);
        loadChatMessages();
        pollDistantChatStatus();
        startStatusPolling();
      }
    }
  );
}


function loadChatMessages() {
  if (!State.chatPid) return;

  //  Captured now: the answer may come back after the user selected another
  //  peer, and it must then land in the session it was asked for.
  const session = State.selectedId ? getDistantChatSession(State.selectedId) : null;
  const chatPeerId = {
    broadcast_status_peer_id: '00000000000000000000000000000000',
    type: 2, // TYPE_PRIVATE_DISTANT
    peer_id: '00000000000000000000000000000000',
    distant_chat_id: State.chatPid,
    lobby_id: { xstr64: '0' },
  };

  rs.rsJsonApiRequest(
    '/rsHistory/getMessages',
    {
      chatPeerId,
      loadCount: 50,
    },
    (data, success) => {
      if (success && data.msgs) {
        if (session) {
          //  Merge, never replace: the session array is the one the view and
          //  the live event handler share.
          addSessionMessages(session, data.msgs);
          if (session.pid === State.chatPid) State.chatMessages = session.messages;
        } else {
          State.chatMessages = data.msgs;
        }
        const realUserMsgs = data.msgs.filter(
          (m) => !m.isSystem && !isSystemMsg(m.message || m.msg)
        );
        if (realUserMsgs.length > 0 && State.selectedId) {
          const last = realUserMsgs[realUserMsgs.length - 1];
          State.chatHistoryMap[State.selectedId] = {
            lastMsg: last.message || last.msg || '',
            lastTime: last.sendTime || last.recvTime || Math.floor(Date.now() / 1000),
          };
        } else if (State.selectedId) {
          delete State.chatHistoryMap[State.selectedId];
        }
        m.redraw();
        scrollChatToBottom();
      }
    }
  );
}

function sendDistantChatMessage() {
  if (!State.chatInputMsg.trim() || !State.chatPid) return;

  const session = State.selectedId ? getDistantChatSession(State.selectedId) : null;
  const cid = {
    broadcast_status_peer_id: '00000000000000000000000000000000',
    type: 2, // TYPE_PRIVATE_DISTANT
    peer_id: '00000000000000000000000000000000',
    distant_chat_id: State.chatPid,
    lobby_id: { xstr64: '0' },
  };

  const text = State.chatInputMsg;
  State.chatInputMsg = '';

  rs.rsJsonApiRequest(
    '/rsChats/sendChat',
    {
      id: cid,
      msg: text,
    },
    (data, success) => {
      if (success) {
        const echoMsg = {
          chat_id: cid,
          msg: text,
          sendTime: Math.floor(Date.now() / 1000),
          incoming: false,
          lobby_peer_gxs_id: State.selectedOwnGxsIdForChat,
        };
        if (session) {
          addSessionMessages(session, [echoMsg]);
          if (session.pid === State.chatPid) State.chatMessages = session.messages;
        } else {
          State.chatMessages.push(echoMsg);
        }
        if (State.selectedId) {
          State.chatHistoryMap[State.selectedId] = {
            lastMsg: text,
            lastTime: Math.floor(Date.now() / 1000),
          };
        }
        m.redraw();
        scrollChatToBottom();
      } else {
        console.error('[RS] Failed to send distant chat message:', data);
        alert('Failed to send distant chat message. The image/payload exceeds RetroShare max chat packet size.');
        State.chatInputMsg = text;
        m.redraw();
      }
    }
  );
}

//  Live incoming distant chat message, coming from the rsEvents stream.
function receiveDistantChatMessage(chatMessage) {
  const msgCid = chatMessage && chatMessage.chat_id;
  if (!msgCid || msgCid.type !== 2) return;

  const msgPid = rs.idToHex(msgCid.distant_chat_id);
  if (!msgPid) return;

  let session = null;
  let targetGxsId = null;
  Object.keys(State.activeDistantChats || {}).forEach((id) => {
    const candidate = State.activeDistantChats[id];
    if (candidate && candidate.pid === msgPid) {
      session = candidate;
      targetGxsId = id;
    }
  });

  //  The tunnel can be answered before `initiateDistantChatConnexion` has
  //  registered its pid on the session: adopt the visible conversation.
  if (!session && State.chatPid === msgPid && State.selectedId) {
    targetGxsId = State.selectedId;
    session = getDistantChatSession(targetGxsId);
    session.pid = msgPid;
  }
  if (!session) return;

  if (!addSessionMessages(session, [chatMessage])) return;

  if (targetGxsId) {
    State.chatHistoryMap[targetGxsId] = {
      lastMsg: chatMessage.msg || chatMessage.message || '',
      lastTime: chatMessage.sendTime || chatMessage.recvTime || Math.floor(Date.now() / 1000),
    };
  }

  //  The view renders State.chatMessages, so it has to point at the session
  //  that just received the message when that session is the visible one.
  if (session.pid === State.chatPid) State.chatMessages = session.messages;

  m.redraw();
  if (State.selectedId === targetGxsId) scrollChatToBottom();
}

//  Two /rsHistory/getMessages per known identity, and a node knows hundreds of
//  them. Fired all at once they fill the browser's six sockets and the JSON
//  API's single service thread, so everything the user is actually waiting for
//  -- the chat room list, an avatar, a forum -- queues behind the preload. Run
//  them a few at a time: the same work gets done, but interactive requests keep
//  getting a slot.
const HISTORY_PRELOAD_CONCURRENCY = 4;

function runQueued(tasks, concurrency) {
  let next = 0;
  const startNext = () => {
    if (next >= tasks.length) return;
    tasks[next++](startNext);
  };
  for (let i = 0; i < concurrency && i < tasks.length; i++) startNext();
}

//  `newerOnly` keeps the previous behaviour of the two callers: the distant
//  history is the first answer and simply wins, the private one only replaces
//  it when it carries a more recent message.
function rememberLastHistoryMessage(gxsId, msgData, success, newerOnly) {
  if (!success || !msgData || !msgData.msgs) return;
  const userMsgs = msgData.msgs.filter(
    (m) => !m.isSystem && !isSystemMsg(m.message || m.msg)
  );
  if (userMsgs.length === 0) return;

  const last = userMsgs[userMsgs.length - 1];
  const lastTime = last.sendTime || last.recvTime || Math.floor(Date.now() / 1000);
  const existing = State.chatHistoryMap[gxsId];
  if (newerOnly && existing && lastTime <= existing.lastTime) return;

  State.chatHistoryMap[gxsId] = {
    lastMsg: last.message || last.msg || '',
    lastTime,
  };
  m.redraw();
}

function historyPreloadTask(gxsId, chatPeerId, newerOnly) {
  return (done) => rs.rsJsonApiRequest(
    '/rsHistory/getMessages',
    {
      chatPeerId,
      loadCount: 20,
    },
    (msgData, success) => {
      //  done() must run whatever happens: rswebui swallows exceptions thrown
      //  by callbacks, and a lost slot would stall the queue for good.
      try {
        rememberLastHistoryMessage(gxsId, msgData, success, newerOnly);
      } finally {
        done();
      }
    }
  );
}

function preloadAllChatHistory() {
  rs.rsJsonApiRequest('/rsIdentity/getIdentitiesSummaries', {}, (data) => {
    const ids = (data && data.ids) ? data.ids : (rs.userList.users || []);
    if (!ids || ids.length === 0) return;

    const tasks = [];

    ids.forEach((u) => {
      const gxsId = typeof u === 'object' ? u.mGroupId : u;
      if (!gxsId) return;

      // Check Distant Chat History (type: 2 - TYPE_PRIVATE_DISTANT)
      tasks.push(historyPreloadTask(gxsId, {
        broadcast_status_peer_id: '00000000000000000000000000000000',
        type: 2, // TYPE_PRIVATE_DISTANT
        peer_id: '00000000000000000000000000000000',
        distant_chat_id: gxsId,
        lobby_id: { xstr64: '0' },
      }, false));

      // Also check Private Chat History (type: 1) if PGP ID is known
      const details = State.gxsIdToDetailsMap[gxsId];
      const pgpId = details ? details.mPgpId : (typeof u === 'object' ? u.mPgpId : null);
      if (pgpId && pgpId !== '0000000000000000') {
        tasks.push(historyPreloadTask(gxsId, {
          broadcast_status_peer_id: '00000000000000000000000000000000',
          type: 1, // PRIVATE
          peer_id: pgpId,
          distant_chat_id: '00000000000000000000000000000000',
          lobby_id: { xstr64: '0' },
        }, true));
      }
    });

    runQueued(tasks, HISTORY_PRELOAD_CONCURRENCY);
  });
}

function loadAllHistoryForSelectedPeer(callback) {
  if (!State.selectedId) return;

  State.isHistoryLoading = true;
  State.fullHistoryMessages = [];
  m.redraw();

  const queries = [];

  // Query 1: Distant Chat History by active chatPid (type: 2 - TYPE_PRIVATE_DISTANT)
  if (State.chatPid) {
    queries.push({
      broadcast_status_peer_id: '00000000000000000000000000000000',
      type: 2, // TYPE_PRIVATE_DISTANT
      peer_id: '00000000000000000000000000000000',
      distant_chat_id: State.chatPid,
      lobby_id: { xstr64: '0' },
    });
  }

  // Query 2: Distant Chat History by selectedId if different (type: 2 - TYPE_PRIVATE_DISTANT)
  if (State.selectedId && State.selectedId !== State.chatPid) {
    queries.push({
      broadcast_status_peer_id: '00000000000000000000000000000000',
      type: 2, // TYPE_PRIVATE_DISTANT
      peer_id: '00000000000000000000000000000000',
      distant_chat_id: State.selectedId,
      lobby_id: { xstr64: '0' },
    });
  }

  // Query 3: Private Chat History by PGP ID if available (type: 1 - TYPE_PRIVATE)
  const details = State.gxsIdToDetailsMap[State.selectedId];
  const pgpId = details ? details.mPgpId : null;
  if (pgpId && pgpId !== '0000000000000000') {
    queries.push({
      broadcast_status_peer_id: '00000000000000000000000000000000',
      type: 1, // TYPE_PRIVATE
      peer_id: pgpId,
      distant_chat_id: '00000000000000000000000000000000',
      lobby_id: { xstr64: '0' },
    });
  }

  let accumulatedMsgs = [];
  let completed = 0;

  queries.forEach((chatPeerId) => {
    rs.rsJsonApiRequest(
      '/rsHistory/getMessages',
      {
        chatPeerId,
        loadCount: 0, // 0 = load all messages in C++
      },
      (msgData, success) => {
        if (success && msgData && msgData.msgs) {
          accumulatedMsgs = accumulatedMsgs.concat(msgData.msgs);
        }
        completed++;
        if (completed === queries.length) {
          const map = new Map();
          accumulatedMsgs.forEach((mItem) => {
            const text = mItem.msg || mItem.message || '';
            const key = `${mItem.sendTime || mItem.recvTime}_${text}`;
            if (!map.has(key)) map.set(key, mItem);
          });
          const uniqueMsgs = Array.from(map.values());
          uniqueMsgs.sort((a, b) => (a.sendTime || a.recvTime) - (b.sendTime || b.recvTime));
          State.fullHistoryMessages = uniqueMsgs;
          State.isHistoryLoading = false;
          m.redraw();
          if (callback) callback();
        }
      }
    );
  });
}

module.exports = {
  State,
  getDistantChatSession,
  addSessionMessages,
  drainBufferedChatMessages,
  receiveDistantChatMessage,
  scrollChatToBottom,
  isSystemMsg,
  preloadAllChatHistory,
  loadAllHistoryForSelectedPeer,
  fetchIdDetails,
  loadGxsIdentities,
  loadOwnGxsIds,
  get64Num,
  getServiceName,
  createUsageString,
  getSafeAvatar,
  getOnlineSslId,
  isIdentityOnline,
  syncFilter,
  getStatusColor,
  getStatusTooltip,
  pollDistantChatStatus,
  startStatusPolling,
  stopStatusPolling,
  initializeDistantChat,
  loadChatMessages,
  sendDistantChatMessage,
};

