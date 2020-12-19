const m = require('mithril');

const API_URL = 'http://127.0.0.1:';
let loginKey = {
  username: '',
  passwd: '',
  isVerified: false,
  port: 9092,
  url: API_URL
};

// Make this as object property?
function setKeys(username, password, port = 9092, verified = true, url = API_URL) {
  loginKey.username = username;
  loginKey.passwd = password;
  loginKey.port = port;
  loginKey.isVerified = verified;
  loginKey.url = url;
}

function rsJsonApiRequest(
  path,
  data = {},
  callback = () => {},
  async = true,
  headers = {},
  handleDeserialize = JSON.parse,
  handleSerialize = JSON.stringify
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
      url: loginKey.url + loginKey.port + path,
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
      body: data
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

module.exports = {
  rsJsonApiRequest,
  setKeys,
  setBackgroundTask
};
