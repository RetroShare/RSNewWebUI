const m = require('mithril');

const API_URL = 'http://127.0.0.1:9092';
let loginKey = {
  username: '',
  passwd: '',
  isVerified: false,
  url: API_URL
};

let navbar = {};

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
    headers['Authorization'] =
      'Basic ' + btoa(loginKey.username + ':' + loginKey.passwd);
  }
  // NOTE: After upgrading to mithrilv2, options.extract is no longer required
  // since the status will become part of return value and then
  // handleDeserialize can also be simply passed as options.deserialize
  return m
    .request({
      method: 'POST',
      url: loginKey.url + path,
      async,
      extract: xhr => {
        // Empty string is not valid json and fails on parse
        let response = xhr.responseText || '""';
        return {
          status: xhr.status,
          statusText: xhr.statusText,
          body: handleDeserialize(response)
        };
      },
      serialize: handleSerialize,
      headers: headers,
      body: data,
      config: config
    })
    .then(result => {
      if (result.status === 200) {
        callback(result.body, true);
      } else {
        loginKey.isVerified = false;
        callback(result, false);
        m.route.set('/');
      }
      return result;
    })
    .catch(function(e) {
      callback(e, false);
      console.error(
        'Error: While sending request for path:',
        path,
        '\ninfo:',
        e
      );
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
    if (!map.hasOwnProperty(key)) {
        map[key] = missing();
    }
    return map[key];
}

function deeperIfExist(map, key, action) {
    if (map.hasOwnProperty(key))  {
        action(map[key]);
        return true;
    } else {
        return false;
    }
}

const eventQueue = {
    events: {
        15: { // Chat-Messages
            types: {
//                #define RS_CHAT_TYPE_PUBLIC  1
//                #define RS_CHAT_TYPE_PRIVATE 2
                2: chat_id => chat_id.distant_chat_id, // distant chat (initiate? -> todo accept)
//                #define RS_CHAT_TYPE_LOBBY   3
                3: chat_id => chat_id.lobby_id.xstr64, // lobby_id
//                #define RS_CHAT_TYPE_DISTANT 4
            },
            messages: {},
            chatMessages: (chat_id, owner, action) => {
              if (!deeperIfExist(
                owner.types,
                chat_id.type,
                keyfn =>  action(computeIfMissing(computeIfMissing(owner.messages,chat_id.type), keyfn(chat_id),()=>[]))
              )) {
                console.info('unknown chat event', chat_id);
              };
            },
            handler: (event,owner) => owner.chatMessages(event.mChatMessage.chat_id, owner, r => {
                console.info('adding chat' ,r , event.mChatMessage);
                r.push(event.mChatMessage);
                owner.notify(event.mChatMessage);
            }),
            notify: () => {},
        },
        8: { // Circles (ignore in the meantime)
            handler: (event,owner) => {},
        }
    },
    handler: event => {
        if (!deeperIfExist(eventQueue.events, event.mType, owner => owner.handler(event, owner))) {
            console.info('unhandled event', event);
        };
    },
}

const userList = {
  users: [],
  userMap: {},
  loadUsers: () => {
    rsJsonApiRequest('/rsIdentity/getIdentitiesSummaries', {},
      list=> {
        if (list!== undefined) {
          console.info('loading ' + list.ids.length + ' users ...');
          userList.users=list.ids;
          userList.userMap = list.ids.reduce((a,c) => {
            a[c.mGroupId] = c.mGroupName;
            return a;
          }, {});
        }
      }
    );
  },
  username: id => {
   return userList.userMap[id]||id;
  },
}

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
function startEventQueue(info, loginHeader = {}, displayAuthError = () => {}, displayErrorMessage = () => {}, successful = () => {}){
  return rsJsonApiRequest('/rsEvents/registerEventsHandler', {},
    (data, success) => {
      if (success) {
        // unused
      } else if (data.status == 401) {
        displayAuthError('Incorrect login/password.');
      } else if (data.status == 0) {
        displayErrorMessage(['Retroshare-jsonapi not available.',m('br'),'Please fix host and/or port.']);
      } else {
        displayErrorMessage('Login failed: HTTP ' + data.status + ' ' + data.statusText);
      }
    },
    true, loginHeader, JSON.parse, JSON.stringify,
    (xhr, args, url) => {
      let lastIndex = 0;
      xhr.onprogress = ev => {
        let currIndex = xhr.responseText.length;
        if (currIndex > lastIndex) {
          let parts = xhr.responseText.substring(lastIndex,currIndex);
          lastIndex=currIndex;
          for(data of parts.trim().split('\n\n').filter(e=> e.startsWith('data: {')).map(e=> e.substr(6)).map(JSON.parse)){
            if (data.hasOwnProperty('retval')) {
              console.info(info + ' [' + data.retval.errorCategory + '] ' + data.retval.errorMessage);
              if (data.retval.errorNumber === 0) {
                successful();
              } else {
                displayErrorMessage(info + ' failed: [' + data.retval.errorCategory + '] ' + data.retval.errorMessage);
              }
            } else if(data.hasOwnProperty('event')) {
              data.event.queueSize = currIndex;
              eventQueue.handler(data.event);
            }
          }
          if (currIndex > 1e5) { // max 100 kB eventQueue
            startEventQueue('restart queue');
            xhr.abort();
          }
        }
      }
      return xhr;
    }
  );
}

function logon(loginHeader, displayAuthError, displayErrorMessage, successful){
  startEventQueue('login', loginHeader, displayAuthError, displayErrorMessage, () => {
    successful();
    userList.loadUsers();
  });
}

module.exports = {
  rsJsonApiRequest,
  setKeys,
  setBackgroundTask,
  logon,
  events: eventQueue.events,
  userList,
  navbar
};
