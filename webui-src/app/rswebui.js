const m = require('mithril');

const API_URL = 'http://127.0.0.1:9092';
let loginKey = {
  username: '',
  passwd: '',
  isVerified: false,
  url: API_URL
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
        let registered = false;
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
              registered = true;
            } else if(data.hasOwnProperty('event')) {
              data.event.queueSize = currIndex;
              console.info(data.event);
            }
          }
          if (currIndex > 1e6) { // max 1 MB eventQueue
            startEventQueue('restart queue');
            xhr.abort();
          }
        }
      }
      return xhr;
    }
  );
}

module.exports = {
  rsJsonApiRequest,
  setKeys,
  setBackgroundTask,
  startEventQueue
};
