'use strict';

let m = require('mithril');

const API_URL = 'http://127.0.0.1:9092';
let loginKey = {
  username: '',
  passwd: '',
  isVerified: false,
};

// Make this as object property?
function setKeys(username, password, verified = true) {
  loginKey.username = username;
  loginKey.passwd = password;
  loginKey.isVerified = verified;
}

function rsJsonApiRequest(path, data, callback, async = true, headers = {}) {
  // Retroshare will crash if data is not of object type.
  data = data || {};
  headers['Accept'] = 'application/json';
  if(loginKey.isVerified) {
    headers['Authorization'] =
      'Basic ' + btoa(loginKey.username + ':' + loginKey.passwd);
  }

  console.info('Sending request: \nPath: ' + path + '\nData: ' + data +
    '\nHeaders:' + headers);
  // TODO: Properly handle types of fail situtations
  // Eg. Retroshare switched off, wrong path, incorrect data, etc.
  m.request({
      method: 'POST',
      url: API_URL + path,
      async,
      extract: (xhr) => {
        // Empty string is not valid json and fails on parse
        if(xhr.responseText === '')
          xhr.responseText = '""';
        return {
          status: xhr.status,
          body: JSON.parse(xhr.responseText),
        };
      },
      headers: headers,
      data: data,
    })
    .then((result) => {
      if(typeof(callback) === 'function') {
        if(result.status === 200) {
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
  let taskId = setTimeout(function caller() {
    if(checkTaskScope()) {
      task();
      taskId = setTimeout(caller, interval);
    } else {
      clearTimeout(taskId);
    }
  }, interval);
  return taskId;
};

// There are ways of doing this in m.route but it is probably
// cleaner and faster when kept outside of the main auto
// rendering system
function popupAlert(message) {
  let container = document.getElementById('modal-container');
  let popup = document.createElement('div');
  popup.setAttribute('id', 'modal-content');
    //TODO use m.render
  popup.innerHTML =
    `
    <button id="modal-cancel-button" class="red">
        <i class="fas fa-times-circle"></i>
    </button>
    <h1><i class="fas fa-info-circle"></i></h1>
    <p>` + message + `</p>`;
  container.appendChild(popup);
  container.style.display = 'block';
  let removeMessage = function() {
    popup.remove();
    container.style.display = 'none';
  }
  container.onclick = removeMessage;
  document.getElementById('modal-cancel-button')
    .onckick = removeMessage;
}

module.exports = {
  rsJsonApiRequest,
  setKeys,
  setBackgroundTask,
  popupAlert,
};

