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
  PEER_CONNECTION: 4,

  // @see RsGxsChanges, used also in @see RsGxsBroadcast
  GXS_CHANGES: 5,

  // Emitted when a peer state changes, @see RsPeers
  PEER_STATE_CHANGED: 6,

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

  // @see RsMsgs
  CHAT_MESSAGE: 15,

  // @see rspeers.h
  NETWORK: 16,

  // @see RsMailTagEvent
  MAIL_TAG: 17,

  /** Emitted to update library clients about file hashing being completed */
  FILE_HASHING_COMPLETED: 20,

  // @see rspeers.h
  TOR_MANAGER: 21,

  // @see rsfriendserver.h
  FRIEND_SERVER: 22,

  // _MAX //used internally, keep last
};

const API_URL = 'http://127.0.0.1:9092';
const loginKey = {
  username: '',
  passwd: '',
  isVerified: false,
  url: API_URL,
};

// Make this as object property?
function setKeys(username, password, url = API_URL, verified = true) {
  loginKey.username = username;
  loginKey.passwd = password;
  loginKey.url = url;
  loginKey.isVerified = verified;
}

function rsJsonApiRequest(
  path,
  data = {},
  callback = () => {},
  async = true,
  headers = {},
  handleDeserialize = JSON.parse,
  handleSerialize = JSON.stringify,
  config = null
) {
  headers['Accept'] = 'application/json';
  if (loginKey.isVerified) {
    headers['Authorization'] = 'Basic ' + btoa(loginKey.username + ':' + loginKey.passwd);
  }
  // NOTE: After upgrading to mithrilv2, options.extract is no longer required
  // since the status will become part of return value and then
  // handleDeserialize can also be simply passed as options.deserialize
  return m
    .request({
      method: 'POST',
      url: loginKey.url + path,
      async,
      extract: (xhr) => {
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

      config,
    })
    .then((result) => {
      if (result.status === 200) {
        callback(result.body, true);
      } else {
        loginKey.isVerified = false;
        callback(result, false);
        m.route.set('/');
      }
      return result;
    })
    .catch(function (e) {
      callback(e, false);
      console.error('Error: While sending request for path:', path, '\ninfo:', e);
      m.route.set('/');
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
    [RsEventsType.CHAT_MESSAGE]: {
      // Chat-Messages
      types: {
        //                #define RS_CHAT_TYPE_PUBLIC  1
        //                #define RS_CHAT_TYPE_PRIVATE 2

        2: (chatId) => chatId.distant_chat_id, // distant chat (initiate? -> todo accept)
        //                #define RS_CHAT_TYPE_LOBBY   3
        3: (chatId) => chatId.lobby_id.xstr64, // lobby_id
        //                #define RS_CHAT_TYPE_DISTANT 4
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
          console.info('unknown chat event', chatId);
        }
      },
      handler: (event, owner) =>
        owner.chatMessages(event.mChatMessage.chat_id, owner, (r) => {
          console.info('adding chat', r, event.mChatMessage);
          r.push(event.mChatMessage);
          owner.notify(event.mChatMessage);
        }),
      notify: () => {},
    },
    [RsEventsType.GXS_CIRCLES]: {
      // Circles (ignore in the meantime)
      handler: (event, owner) => {},
    },
  },
  handler: (event) => {
    if (!deeperIfExist(eventQueue.events, event.mType, (owner) => owner.handler(event, owner))) {
      console.info('unhandled event', event);
    }
  },
};

const userList = {
  users: [],
  userMap: {},
  loadUsers: () => {
    rsJsonApiRequest('/rsIdentity/getIdentitiesSummaries', {}, (list) => {
      if (list !== undefined) {
        console.info('loading ' + list.ids.length + ' users ...');
        userList.users = list.ids;
        userList.userMap = list.ids.reduce((a, c) => {
          a[c.mGroupId] = c.mGroupName;
          return a;
        }, {});
      }
    });
  },
  username: (id) => {
    return userList.userMap[id] || id;
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
  displayAuthError = () => {},
  displayErrorMessage = () => {},
  successful = () => {}
) {
  return rsJsonApiRequest(
    '/rsEvents/registerEventsHandler',
    {},
    (data, success) => {
      if (success) {
        // unused
      } else if (data.status === 401) {
        displayAuthError('Incorrect login/password.');
      } else if (data.status === 0) {
        displayErrorMessage([
          'Retroshare-jsonapi not available.',
          m('br'),
          'Please fix host and/or port.',
        ]);
      } else {
        displayErrorMessage('Login failed: HTTP ' + data.status + ' ' + data.statusText);
      }
    },
    true,
    loginHeader,
    JSON.parse,
    JSON.stringify,
    (xhr, args, url) => {
      let lastIndex = 0;
      xhr.onprogress = (ev) => {
        const currIndex = xhr.responseText.length;
        if (currIndex > lastIndex) {
          const parts = xhr.responseText.substring(lastIndex, currIndex);
          lastIndex = currIndex;
          parts
            .trim()
            .split('\n\n')
            .filter((e) => e.startsWith('data: {'))
            .map((e) => e.substr(6))
            .map(JSON.parse)
            .forEach((data) => {
              if (Object.prototype.hasOwnProperty.call(data, 'retval')) {
                console.info(
                  info + ' [' + data.retval.errorCategory + '] ' + data.retval.errorMessage
                );
                data.retval.errorNumber === 0
                  ? successful()
                  : displayErrorMessage(
                      `${info} failed: [${data.retval.errorCategory}] ${data.retval.errorMessage}`
                    );
              } else if (Object.prototype.hasOwnProperty.call(data, 'event')) {
                data.event.queueSize = currIndex;
                eventQueue.handler(data.event);
              }
            });
          if (currIndex > 1e5) {
            // max 100 kB eventQueue
            startEventQueue('restart queue');
            xhr.abort();
          }
        }
      };
      return xhr;
    }
  );
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

module.exports = {
  rsJsonApiRequest,
  setKeys,
  setBackgroundTask,
  logon,
  events: eventQueue.events,
  RsEventsType,
  userList,
  loginKey,
  formatBytes,
};
