const m = require('mithril');

const RsEventsType = {
  NONE: 0, // Used internally to detect invalid event type passed

  // @see RsBroadcastDiscovery
  BROADCAST_DISCOVERY: 1,

  // @see RsDiscPendingPgpReceivedEvent
  GOSSIP_DISCOVERY: 2,

  // @see AuthSSL
  AUTHSSL_CONNECTION_AUTENTICATION: 3,

  // @see pqissl
  PEER_STATE: 4,

  // @see RsGxsChanges, used also in @see RsGxsBroadcast
  GXS_CHANGES: 5,

  // Emitted when a peer state changes, @see RsPeers
  _________UNUSED___001_: 6,

  // @see RsMailStatusEvent
  MAIL_STATUS: 7,

  // @see RsGxsCircleEvent
  GXS_CIRCLES: 8,

  // @see RsGxsChannelEvent
  GXS_CHANNELS: 9,

  // @see RsGxsForumEvent
  GXS_FORUMS: 10,

  // @see RsGxsPostedEvent
  GXS_POSTED: 11,

  // @see RsGxsPostedEvent
  GXS_IDENTITY: 12,

  // @see RsFiles @deprecated
  SHARED_DIRECTORIES: 13,

  // @see RsFiles
  FILE_TRANSFER: 14,

  // @see RsChats
  CHAT_SERVICE: 15,

  // @see rspeers.h
  NETWORK: 16,

  // @see RsMailTagEvent
  MAIL_TAG: 17,

  /** Emitted to update library clients about file hashing being completed */
  _________UNUSED___002_: 20,

  // @see rspeers.h
  TOR_MANAGER: 21,

  // @see rsfriendserver.h
  FRIEND_SERVER: 22,

  // _MAX //used internally, keep last
};

const API_URL = 'http://127.0.0.1:9092';
const loginKey = {
  username: sessionStorage.getItem('rs_username') || '',
  passwd: sessionStorage.getItem('rs_passwd') || '',
  isVerified: sessionStorage.getItem('rs_isVerified') === 'true',
  url: sessionStorage.getItem('rs_url') || API_URL,
};

// Make this as object property?
function setKeys(username, password, url = API_URL, verified = true) {
  loginKey.username = username;
  loginKey.passwd = password;
  loginKey.url = url;
  loginKey.isVerified = verified;

  if (verified) {
    sessionStorage.setItem('rs_username', username);
    sessionStorage.setItem('rs_passwd', password);
    sessionStorage.setItem('rs_url', url);
    sessionStorage.setItem('rs_isVerified', 'true');
  } else {
    sessionStorage.removeItem('rs_isVerified');
  }
}

function logout() {
  setKeys('', '', loginKey.url, false);
  m.route.set('/');
}

//  What the API is doing, seen from this browser. Shown on the Debug page: a
//  request that takes ten seconds shows here, and whether it was slow on its
//  own or queued behind others (pending) is what tells the two apart.
const apiStats = {
  pending: 0,
  total: 0,
  //  Last /rsChats/sendChat: the one round trip the user feels directly.
  lastSend: null,
  //  The five slowest requests since load, newest first on a tie.
  slowest: [],
  //  The last twenty requests, newest first.
  recent: [],
  //  Event stream: bytes received since (re)connection, last event time,
  //  number of reconnections.
  eventsBytes: 0,
  lastEventAt: 0,
  eventsRestarts: 0,
  startedAt: Date.now(),
};

function recordRequestTime(path, ms) {
  apiStats.pending = Math.max(0, apiStats.pending - 1);
  const entry = { path, ms: Math.round(ms), at: Date.now() };
  if (path === '/rsChats/sendChat') apiStats.lastSend = entry;
  apiStats.slowest.push(entry);
  apiStats.slowest.sort((a, b) => b.ms - a.ms);
  if (apiStats.slowest.length > 5) apiStats.slowest.length = 5;
  apiStats.recent.unshift(entry);
  if (apiStats.recent.length > 20) apiStats.recent.length = 20;
}

function resetApiStats() {
  apiStats.total = 0;
  apiStats.lastSend = null;
  apiStats.slowest = [];
  apiStats.recent = [];
  apiStats.eventsRestarts = 0;
}

const connectionState = {
  status: true,
  //  Status of the last HTTP response, or 0 when the request never reached the
  //  core. Recorded in extract() so it stays available when the body fails to
  //  parse, which is how a truncated response shows up.
  lastHttpStatus: 0,
};

function rsJsonApiRequest(
  path,
  data = {},
  callback = () => { },
  async = true,
  headers = {},
  handleDeserialize = JSON.parse,
  handleSerialize = JSON.stringify,
  config = null
) {
  headers['Accept'] = 'application/json';
  if (loginKey.isVerified) {
    if (loginKey.username && loginKey.passwd) {
      headers['Authorization'] = 'Basic ' + btoa(loginKey.username + ':' + loginKey.passwd);
    }
  }
  apiStats.pending += 1;
  apiStats.total += 1;
  const startedAt = performance.now();
  // NOTE: After upgrading to mithrilv2, options.extract is no longer required
  // since the status will become part of return value and then
  // handleDeserialize can also be simply passed as options.deserialize
  return m
    .request({
      method: 'POST',
      url: loginKey.url + path,
      async,
      extract: (xhr) => {
        connectionState.lastHttpStatus = xhr.status;
        // Empty string is not valid json and fails on parse
        const response = xhr.responseText || '""';
        return {
          status: xhr.status,
          statusText: xhr.statusText,
          body: handleDeserialize(response),
        };
      },
      serialize: handleSerialize,
      headers,
      body: data,

      xhr: config,
    })
    .then((result) => {
      recordRequestTime(path, performance.now() - startedAt);
      if (result.status === 200) {
        connectionState.status = true;
        try {
          callback(result.body, true);
        } catch (e) {
          console.error('[RS] Error in success callback for path:', path, e);
        }
      } else {
        //  An answer, whatever its code, proves the core is there. A 404 on an
        //  endpoint this build does not expose, or a 401 on a stale password,
        //  is not a lost connection: only status 0, i.e. no HTTP response at
        //  all, is. Flipping the flag on every error made the status LED blink
        //  red on each optional endpoint that is probed.
        connectionState.status = result.status !== 0;
        if (result.status === 401 || result.status === 403) {
          setKeys(loginKey.username, loginKey.passwd, loginKey.url, false);
          m.route.set('/');
        } else if (result.status === 0) {
          console.error('[RS] Retroshare-jsonapi not available.');
        } else {
          console.error('[RS] HTTP error:', result.status, result.statusText);
        }
        try {
          callback(result, false);
        } catch (e) {
          console.error('[RS] Error in error callback for path:', path, e);
        }
      }
      return result;
    })
    .catch(function (e) {
      recordRequestTime(path, performance.now() - startedAt);
      //  Reaching here after a valid 200 means the body could not be parsed,
      //  i.e. the response was cut short. The core answered and is still there;
      //  it is the answer that did not survive the trip.
      connectionState.status = connectionState.lastHttpStatus === 200;
      try {
        callback(e, false);
      } catch (cbErr) {
        // console.error('[RS] Error in catch callback for path:', path, cbErr);
      }
      console.error('[RS] Error: While sending request for path:', path, '\ninfo:', e);
      //  Resolve to the same shape as a real answer, with an empty body. Most
      //  call sites go straight for res.body.retval, and resolving undefined
      //  turned every failed request into a TypeError thrown inside an onclick,
      //  where nothing catches it: the button silently does nothing. Every
      //  defensive check in the code base tests res.body.retval or res.body, so
      //  an empty body still reads as a failure to all of them.
      return { status: connectionState.lastHttpStatus, statusText: 'request failed', body: {} };
    });
}

function setBackgroundTask(task, interval, taskInScope) {
  // Always use bound(.bind) function when accsssing outside objects
  // to avoid loss of scope
  task();
  let taskId = setTimeout(function caller() {
    if (taskInScope()) {
      task();
      taskId = setTimeout(caller, interval);
    } else {
      clearTimeout(taskId);
    }
  }, interval);
  return taskId;
}

function computeIfMissing(map, key, missing = () => ({})) {
  if (!Object.prototype.hasOwnProperty.call(map, key)) {
    map[key] = missing();
  }
  return map[key];
}

function deeperIfExist(map, key, action) {
  if (Object.prototype.hasOwnProperty.call(map, key)) {
    action(map[key]);
    return true;
  } else {
    return false;
  }
}

const eventQueue = {
  events: {
    [RsEventsType.CHAT_SERVICE]: {
      // Chat-Messages
      types: {
        //                #define RS_CHAT_TYPE_PUBLIC  1
        //                #define RS_CHAT_TYPE_PRIVATE 2

        1: (cid) => hexId(cid),
        2: (cid) => hexId(cid),
        3: (cid) => hexId(cid),
        4: (cid) => hexId(cid),
      },
      messages: {},
      chatMessages: (chatId, owner, action) => {
        if (
          !deeperIfExist(owner.types, chatId.type, (keyfn) =>
            action(
              computeIfMissing(
                computeIfMissing(owner.messages, chatId.type),
                keyfn(chatId),

                () => []
              )
            )
          )
        ) {
          if (chatId) {
            // Silent match
          }
        }
      },
      handler: (event, owner) => {
        //  Two event shapes carry a chat message on RsEventType::CHAT_SERVICE.
        //  A message from a peer is posted twice by the core: as an
        //  RsChatServiceEvent {mEventCode: CHAT_MESSAGE_RECEIVED, mMsg} and as
        //  an RsChatMessageEvent {mChatMessage}. A message we send ourselves
        //  -- from the desktop GUI, or from any other client of the same core
        //  -- is posted once, as the RsChatServiceEvent only
        //  (DistributedChatService::sendLobbyChat, p3ChatService::sendChat).
        //  Reading mChatMessage alone therefore showed every peer's line and
        //  none of our own typed elsewhere. Take our own messages from the
        //  RsChatServiceEvent as well, and only those: a peer's message must
        //  keep coming through once, because the room and direct chat unread
        //  counters are bumped before the receivers dedup by message key.
        const chatMessage = event && (
          (event.mChatMessage && event.mChatMessage.chat_id && event.mChatMessage)
          || (Number(event.mEventCode) === 1 && event.mMsg && event.mMsg.chat_id
            && event.mMsg.incoming === false && event.mMsg)
        );
        if (chatMessage) {
          owner.chatMessages(chatMessage.chat_id, owner, (r) => {
            r.push(chatMessage);
            owner.notify(chatMessage);
          });
        } else if (event && (event.mCid || event.mEventCode !== undefined)) {
          // Administrative chat event (e.g. lobby info change, peer join/leave)
          owner.notify(event);
        }
      },
      notify: () => { },
    },
    [RsEventsType.GXS_CIRCLES]: {
      // Circles (ignore in the meantime)
      handler: (event, owner) => { },
    },
    [RsEventsType.SHARED_DIRECTORIES]: {
      // Deprecated/Administrative (ignore quietly)
      handler: (event, owner) => { },
    },
  },
  handler: (event) => {
    if (!deeperIfExist(eventQueue.events, event.mType, (owner) => owner.handler(event, owner))) {
      // Ignore unhandled events silently
    }
  },
};

const userList = {
  users: [],
  userMap: {},
  pendingIds: new Set(),
  fetchTimer: null,

  triggerFetch: () => {
    if (userList.fetchTimer) return;
    userList.fetchTimer = setTimeout(() => {
      userList.fetchTimer = null;
      if (userList.pendingIds.size === 0) return;

      const ids = Array.from(userList.pendingIds);
      userList.pendingIds.clear();

      userList.fetchBulk(ids);
    }, 1000);
  },

  fetchBulk: (ids) => {
    // Chunk requests to avoid too large payloads if necessary, but for now 100 is safe
    const chunkSize = 100;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      rsJsonApiRequest('/rsIdentity/getIdentitiesInfo', { ids: chunk }, (data, success) => {
        if (success && data.idsInfo) {
          data.idsInfo.forEach((info) => {
            const gid = info.mMeta && info.mMeta.mGroupId;
            if (gid) {
              userList.userMap[gid] = {
                name: info.mMeta.mGroupName,
                isContact: info.mIsAContact,
              };
            }
          });
          m.redraw();
        }
      });
    }
  },

  loadUsers: () => {
    rsJsonApiRequest('/rsIdentity/getIdentitiesSummaries', {}, (list) => {
      if (list !== undefined && list.ids) {
        userList.users = list.ids;
        userList.userMap = list.ids.reduce((a, c) => {
          a[c.mGroupId] = { name: c.mGroupName, isContact: false };
          return a;
        }, {});

        // Fetch contact status and details in bulk immediately
        userList.fetchBulk(list.ids.map((u) => u.mGroupId));
      }
    });
  },
  username: (id) => {
    if (!id) return '';
    const entry = userList.userMap[id];
    const name = typeof entry === 'object' ? entry.name : entry;

    if (!name && id.length > 10) {
      if (!userList.pendingIds.has(id)) {
        userList.pendingIds.add(id);
        userList.triggerFetch();
      }
      return id;
    }
    return name || id;
  },
};

/*
  path,
  data = {},
  callback = () => {},
  async = true,
  headers = {},
  handleDeserialize = JSON.parse,
  handleSerialize = JSON.stringify
  config
*/
function startEventQueue(
  info,
  loginHeader = {},
  displayAuthError = () => { },
  displayErrorMessage = () => { },
  successful = () => { }
) {
  const xhr = new window.XMLHttpRequest();
  let lastIndex = 0;
  xhr.open('POST', loginKey.url + '/rsEvents/registerEventsHandler', true);

  // Set headers for authentication
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...loginHeader,
  };

  if (loginKey.isVerified && !headers['Authorization']) {
    if (loginKey.username && loginKey.passwd) {
      headers['Authorization'] = 'Basic ' + btoa(loginKey.username + ':' + loginKey.passwd);
    }
  }

  Object.keys(headers).forEach((key) => {
    xhr.setRequestHeader(key, headers[key]);
  });

  xhr.onreadystatechange = () => {
    if (xhr.readyState === 4) {
      if (xhr.status === 401) {
        displayAuthError('Incorrect login/password.');
      }
    }
  };

  xhr.onprogress = (ev) => {
    const currIndex = xhr.responseText.length;
    apiStats.eventsBytes = currIndex;
    apiStats.lastEventAt = Date.now();
    if (currIndex > lastIndex) {
      const parts = xhr.responseText.substring(lastIndex, currIndex);
      lastIndex = currIndex;
      parts
        .trim()
        .split('\n\n')
        .filter((e) => e.trim().length > 0)
        .forEach((e) => {
          if (e.startsWith('data: {')) {
            try {
              const data = JSON.parse(e.substr(6));
              if (Object.prototype.hasOwnProperty.call(data, 'retval')) {
                if (data.retval.errorNumber !== 0) {
                  displayErrorMessage(
                    `${info} failed: [${data.retval.errorCategory}] ${data.retval.errorMessage}`
                  );
                } else {
                  successful();
                }
              } else if (Object.prototype.hasOwnProperty.call(data, 'event')) {
                data.event.queueSize = currIndex;
                try {
                  eventQueue.handler(data.event);
                } catch (err) {
                  console.error('[RS] Error in event handler:', err, data.event);
                }
              }
            } catch (err) {
              console.error('[RS] JSON parse error for part:', e, err);
            }
          }
        });
      if (currIndex > 1e6) {
        // max 1 MB eventQueue
        startEventQueue('restart queue');
        xhr.abort();
      }
    }
  };

  xhr.onload = () => { };

  xhr.onerror = (err) => {
    apiStats.eventsRestarts += 1;
    console.error('[RS] Event Queue XHR error occurred:', err);
    // Retry after 5 seconds to avoid silent event loss
    setTimeout(() => {
      console.log('[RS] Retrying event queue connection...');
      startEventQueue(info, loginHeader, displayAuthError, displayErrorMessage, successful);
    }, 5000);
  };

  // We need to send an eventType to registerEventsHandler
  // 0 means all events
  xhr.send(JSON.stringify({ eventType: 0 }));
  return xhr;
}

function logon(loginHeader, displayAuthError, displayErrorMessage, successful) {
  startEventQueue('login', loginHeader, displayAuthError, displayErrorMessage, () => {
    successful();
    userList.loadUsers();
  });
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function hexId(id) {
  if (!id) return '';
  if (typeof id === 'string') return id;
  if (typeof id === 'number') return String(id);
  if (typeof id === 'object') {
    // 1. Check for xstr64 (64-bit wrapped ID)
    if (id.xstr64 && id.xstr64 !== '0') return id.xstr64;

    // 2. Search for any hex string of appropriate length (128-bit or 64-bit)
    const keys = Object.keys(id);
    for (let i = 0; i < keys.length; i++) {
      const val = id[keys[i]];
      if (typeof val === 'string' && val.length >= 16 && val !== '00000000000000000000000000000000') return val;
      // Search deeper for nested xstr64
      if (val && typeof val === 'object' && val.xstr64 && val.xstr64 !== '0') return val.xstr64;
    }
    // 3. Last resort fallbacks
    if (id.xstr64 !== undefined) return String(id.xstr64);
  }
  return String(id);
}

//  A RetroShare ID can be pasted bare, or inside a retroshare://... link where
//  it sits url-encoded behind rsInvite=. Both the Add friend wizard and the
//  location details dialog had their own copy of this; they now share one, the
//  variant that trims after decoding, since a pasted link often carries a
//  trailing newline.
function cleanRetroshareId(value) {
  const input = String(value || '').trim();
  const marker = 'rsInvite=';
  const markerPosition = input.indexOf(marker);
  const id = markerPosition >= 0 ? input.slice(markerPosition + marker.length) : input;

  try {
    return decodeURIComponent(id).trim();
  } catch (_) {
    return id.trim();
  }
}

module.exports = {
  rsJsonApiRequest,
  idToHex: hexId,
  connectionState,
  apiStats,
  resetApiStats,
  setKeys,
  setBackgroundTask,
  logon,
  events: eventQueue.events,
  RsEventsType,
  userList,
  loginKey,
  formatBytes,
  logout,
  cleanRetroshareId,
};
