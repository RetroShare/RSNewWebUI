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
  pendingChatOpen: null, // gxsId a chat was explicitly asked for from another page
  chatCloseFoundNothing: false, // the core had no connection left to close
  statusPollFailures: 0, // consecutive getDistantChatStatus answers of false
  showEmojiPicker: false,
  attachPath: '', // file being hashed for a retroshare:// link
  isHashing: false,
  attachError: '',
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

//  The text being typed belongs to the conversation it is being typed in. It
//  used to live in State.chatInputMsg alone, which nothing cleared when the
//  selected peer changed: a message written to one contact stayed in the box
//  when the next conversation opened, one Enter away from the wrong recipient.
function setChatDraft(text) {
  State.chatInputMsg = text;
  const session = State.selectedId ? getDistantChatSession(State.selectedId) : null;
  if (session) session.inputMsg = text;
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


//  Details are fetched once and kept for good, which is what makes the lists
//  cheap. The identity being *looked at* is another matter: its reputation,
//  its usage record and its avatar move while the pane is open, so that one is
//  allowed to go stale and be asked again.
const SELECTED_DETAILS_TTL_MS = 60 * 1000;
const detailsFetchedAt = {};

function refreshSelectedIdDetails() {
  const gxsId = State.selectedId;
  if (!peopleUtil.isUsableIdentityId(gxsId)) return;
  const at = detailsFetchedAt[gxsId] || 0;
  if (Date.now() - at < SELECTED_DETAILS_TTL_MS) return;

  //  Asked again over what is already displayed, never by clearing it first:
  //  the entry is what the pane renders, and emptying it would blank the whole
  //  profile for the length of a round trip.
  detailsFetchedAt[gxsId] = Date.now();
  rs.rsJsonApiRequest('/rsIdentity/getIdDetails', { id: gxsId }, (detData) => {
    const details = detData && detData.details;
    if (details && peopleUtil.isUsableIdentityId(String(details.mId || ''))) {
      State.gxsIdToDetailsMap[gxsId] = details;
      m.redraw();
    }
  });
}

function fetchIdDetails(gxsId, attempt = 0) {
  if (!peopleUtil.isUsableIdentityId(gxsId)) return;
  if (State.gxsIdToDetailsMap[gxsId] === undefined) {
    detailsFetchedAt[gxsId] = Date.now();
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

//  RsIdentityUsage::mServiceId is an RsServiceType (rsserviceids.h), a 16 bit
//  service number -- 0x0215 for the forums, 0x0217 for the channels. Matching it
//  against 1..8 could never succeed, so every line of the usage panel used to
//  read "Unknown (533)".
const SERVICE_NAMES = {
  0x0012: 'Chat',
  0x0022: 'Mail',
  0x0023: 'Direct mail',
  0x0024: 'Distant mail',
  0x0027: 'Distant chat',
  0x0028: 'GXS tunnels',
  0x0211: 'Identities',
  0x0213: 'Wiki',
  0x0214: 'Wire',
  0x0215: 'Forums',
  0x0216: 'Boards',
  0x0217: 'Channels',
  0x0218: 'Circles',
  0x0219: 'Reputation',
  0x0221: 'Calendar',
  0x0230: 'Distant messages',
};

function getServiceName(serviceId) {
  const id = Number(serviceId);
  return SERVICE_NAMES[id] || ('Unknown (0x' + id.toString(16) + ')');
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
      //  getDistantChatStatus answers false once the tunnel is gone from the
      //  core -- died of inaction, closed by the peer, closed by us. Ignoring
      //  that answer left the last known status on screen for good: a dead
      //  conversation kept its green dot and its "You can talk", and the Leave
      //  button then had nothing left to close.
      if (!success || !detail || !detail.retval) {
        State.statusPollFailures += 1;
        if (State.statusPollFailures >= 2) {
          if (session) {
            addSessionSystemMessage(session, 'The distant chat tunnel is gone.');
            session.disconnected = true;
          }
          State.distantChatStatus = null;
          State.chatDisconnected = true;
          State.chatCloseFoundNothing = false;
          stopStatusPolling();
          m.redraw();
        }
        return;
      }

      State.statusPollFailures = 0;
      State.distantChatStatus = detail.info;
      if (session) {
        session.status = detail.info;

        if (detail.info.status === 2) {
          addSessionSystemMessage(session, 'Tunnel is secured. You can talk!');
          //  The tunnel just went up: anything the peer sent while it was still
          //  pending is waiting in the event buffer.
          drainBufferedChatMessages(session);
        } else if (detail.info.status === 3) {
          addSessionSystemMessage(session, 'Your partner closed the conversation.');
        }
      }
      m.redraw();
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
    State.chatInputMsg = session.inputMsg || '';

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
  State.chatCloseFoundNothing = false;
  State.statusPollFailures = 0;
  State.chatInputMsg = session.inputMsg || '';
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
  setChatDraft('');

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
        //  No size limit is involved: getMaxMessageSecuritySize() answers 0,
        //  unlimited, for distant chat, and the core slices anything longer
        //  than 15000 characters and reassembles it on the other side. Blaming
        //  the payload was a guess, and a wrong one.
        alert('Failed to send the message. The tunnel may have closed -- check the connection state above.');
        setChatDraft(text);
        m.redraw();
      }
    }
  );
}

//  Changing the identity we talk as means another tunnel: its id is
//  sha1(sorted(own || peer)), so the one built for the previous identity is a
//  different tunnel, and nothing but this closes it -- it used to be left open
//  and digging.
function switchChatIdentity(ownGxsId) {
  const previousPid = State.chatPid;
  State.selectedOwnGxsIdForChat = ownGxsId;

  if (!previousPid) {
    initializeDistantChat(true);
    return;
  }
  rs.rsJsonApiRequest(
    '/rsChats/closeDistantChatConnexion',
    { pid: previousPid },
    () => initializeDistantChat(true)
  );
}

//  Ending the conversation on our side. `closed` is what the core answered:
//  false means it had no connection left for that tunnel id, which the card
//  then says rather than claiming the user just closed something.
function leaveDistantChat(closed) {
  if (State.selectedId && State.activeDistantChats[State.selectedId]) {
    delete State.activeDistantChats[State.selectedId];
  }
  State.chatPid = null;
  State.chatMessages = [];
  State.distantChatStatus = null;
  State.chatDisconnected = true;
  State.chatCloseFoundNothing = !closed;
  State.statusPollFailures = 0;
  stopStatusPolling();
  m.redraw();
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

function runQueued(tasks, concurrency, onDone) {
  let next = 0;
  let finished = 0;
  const startNext = () => {
    if (finished >= tasks.length) return;
    if (next >= tasks.length) return;
    tasks[next++](() => {
      finished++;
      if (finished >= tasks.length) {
        if (onDone) onDone();
        return;
      }
      startNext();
    });
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

function distantChatIdFor(pid) {
  return {
    broadcast_status_peer_id: '00000000000000000000000000000000',
    type: 2, // TYPE_PRIVATE_DISTANT
    peer_id: '00000000000000000000000000000000',
    distant_chat_id: pid,
    lobby_id: { xstr64: '0' },
  };
}

function privateChatIdFor(sslId) {
  return {
    broadcast_status_peer_id: '00000000000000000000000000000000',
    type: 1, // TYPE_PRIVATE
    peer_id: sslId,
    distant_chat_id: '00000000000000000000000000000000',
    lobby_id: { xstr64: '0' },
  };
}

//  Private chat history is keyed by the *location* (SSL) id of the friend, not
//  by their PGP id. A PGP id is half the length of an RsPeerId, so the core
//  cannot parse it: it builds a null id -- which happens to be the key of the
//  public/broadcast history -- and prints a stack trace for every single
//  request. One identity per known PGP key means hundreds of those per visit.
function locationIdsOf(gxsId) {
  const details = State.gxsIdToDetailsMap[gxsId];
  const pgpId = details ? details.mPgpId : null;
  if (!pgpId || pgpId === '0000000000000000') return [];
  const friend = Data.gpgDetails[pgpId.toLowerCase()];
  if (!friend || !friend.locations) return [];
  return friend.locations.map((loc) => loc && loc.id).filter(Boolean);
}

//  Only peers we can actually have a conversation with are probed. Sweeping
//  every identity the node ever saw -- tens of thousands on an old profile --
//  is what made the Chats badge climb for minutes at every visit, one tick per
//  answer, and start over at every click on the tab.
function chatPeerCandidates() {
  const ids = new Set();

  peopleUtil.contactlist(rs.userList.users || []).forEach((u) => {
    if (u && u.mGroupId) ids.add(u.mGroupId);
  });
  Object.keys(State.chatHistoryMap || {}).forEach((id) => ids.add(id));
  Object.keys(State.activeDistantChats || {}).forEach((id) => ids.add(id));

  //  Identities that belong to one of our own friends: their direct chat
  //  history is part of the same conversation as far as the user is concerned.
  (rs.userList.users || []).forEach((u) => {
    const gxsId = u && u.mGroupId;
    if (gxsId && !ids.has(gxsId) && locationIdsOf(gxsId).length > 0) ids.add(gxsId);
  });

  return Array.from(ids).filter(peopleUtil.isUsableIdentityId);
}

//  Repeated calls are the norm here: the layout, the sidebar and the Chats tab
//  all ask for a preload, and the tab asks again at every click.
const HISTORY_PRELOAD_MIN_INTERVAL_MS = 30 * 1000;
let historyPreloadRunning = false;
let historyPreloadedAt = 0;

function preloadAllChatHistory() {
  if (historyPreloadRunning) return;
  const now = Date.now();
  if (historyPreloadedAt && now - historyPreloadedAt < HISTORY_PRELOAD_MIN_INTERVAL_MS) return;

  historyPreloadRunning = true;
  historyPreloadedAt = now;

  peopleUtil.ownIds((ownIds) => {
    //  The candidates come from the friend list and the contact flags, which
    //  are loaded in parallel with this: nothing to probe yet only means the
    //  answers have not landed, so the interval must not lock the next try out.
    const tasks = [];

    chatPeerCandidates().forEach((gxsId) => {
      (ownIds || []).forEach((ownId) => {
        const pid = peopleUtil.distantChatPid(ownId, gxsId);
        if (pid) tasks.push(historyPreloadTask(gxsId, distantChatIdFor(pid), false));
      });

      locationIdsOf(gxsId).forEach((sslId) => {
        tasks.push(historyPreloadTask(gxsId, privateChatIdFor(sslId), true));
      });
    });

    if (tasks.length === 0) {
      historyPreloadRunning = false;
      historyPreloadedAt = 0;
      return;
    }
    runQueued(tasks, HISTORY_PRELOAD_CONCURRENCY, () => {
      historyPreloadRunning = false;
    });
  });
}

function loadAllHistoryForSelectedPeer(callback) {
  if (!State.selectedId) return;

  State.isHistoryLoading = true;
  State.fullHistoryMessages = [];
  m.redraw();

  const pids = new Set();

  // Distant chat history of the conversation currently open
  if (State.chatPid) pids.add(State.chatPid);

  //  Distant chat history of the earlier conversations with this peer: one
  //  tunnel per own identity, and the tunnel id is the key -- the peer's GXS id
  //  never is, so asking for it could only ever answer an empty list.
  (State.ownGxsIds || []).forEach((ownId) => {
    const pid = peopleUtil.distantChatPid(ownId, State.selectedId);
    if (pid) pids.add(pid);
  });

  const queries = Array.from(pids).map(distantChatIdFor);

  // Direct chat history, one query per location of the friend behind this identity
  locationIdsOf(State.selectedId).forEach((sslId) => {
    queries.push(privateChatIdFor(sslId));
  });

  if (queries.length === 0) {
    State.isHistoryLoading = false;
    m.redraw();
    if (callback) callback();
    return;
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
  leaveDistantChat,
  setChatDraft,
  switchChatIdentity,
  refreshSelectedIdDetails,
};

