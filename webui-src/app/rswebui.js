'use strict';

var m = require('mithril');

const API_URL = 'http://127.0.0.1:9092';
let loginKey = {
  username : '',
  passwd : '',
  isVerified : false,
};

function setKeys(username, password, verified = true) {
  loginKey.username = username;
  loginKey.passwd = password;
  loginKey.isVerified = verified;
}

function rsJsonApiRequest(path, data, callback, async = true, headers = {}) {
  // retroshare will crash if data is not of object type.
  headers['Accept'] = 'application/json';
  if (loginKey.isVerified) {
    headers['Authorization'] =
        'Basic ' + btoa(loginKey.username + ':' + loginKey.passwd);
  }

  console.info('Sending request: \nPath: ' + path + '\nData: ' + data +
               '\nHeaders:' + headers);
  m.request({
     method : 'POST',
     url : API_URL + path,
     async,
     extract : (xhr) => {
       // empty string is not valid json and fails on parse
       if (xhr.responseText === '')
         xhr.responseText = '""';
       return {
         status : xhr.status,
         body : JSON.parse(xhr.responseText),
       };
     },
     headers : headers,
     data : data,
   })
      .then((result) => {
        if (typeof(callback) === 'function') {
          if (result.status === 200) {
            callback(result.body, true);
          } else {
            loginKey.isVerified = false;
            callback(result.body, false);
          }
        }
      })
      .catch(function(e) {
        callback({}, false);
        console.error('Error sending request: ', e);
      });
}

function setBackgroundTask(task, interval, checkTaskScope) {
  // Always use bound(.bind) function when accsssing outside objects
  // to avoid loss of scope
  let taskId;
  taskId = setTimeout(function caller() {
    if (checkTaskScope()) {
      task();
      taskId = setTimeout(caller, interval);
    } else {
      clearTimeout(taskId);
    }
  }, interval);
};

module.exports = {
  rsJsonApiRequest,
  setKeys,
  setBackgroundTask,
};

