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

let navIcon = {
  'home': 'i.fas.fa-home',
  'downloads': 'i.fas.fa-folder-open',
  'config': 'i.fas.fa-cogs',
};

class Tab {
  constructor(name, content) {
    Tab.componentList[name] = this;
    // Overriding view function to add menubar
    this.mainView = content.view;
    delete content.view;
    // Object itself will be passed as mithril component
    Object.assign(this, content);

    Tab.routeTable['/' + name] = this;
  }
  view() {
    return m('.content', [
      Tab.menuBar(),
      m('#tab-content', this.mainView()),
    ]);
  }

  static menuBar() {
    return m('nav.tab-menu',
      Object.keys(this.componentList)
      .map(function(tabName) {
        return m('a.tab-menu-item' + (tabName === Tab.active ?
            '#selected-tab-item' : '') + '[href=/' + tabName + ']', {
            oncreate: m.route.link,
            onclick: function() {
              // NOTE: investigate why onclick does not run when clicked on downloads tab
              // NOTE 2: does not run ONLY when clicked before its backgroundtask first returns
              // Note 3: workaround: not use oncreate, set #! link in href
              Tab.active = tabName;
            },
          },
          [m(navIcon[tabName]), tabName]);
      })
    );
  }
}
// Static class variables are still experimental
Tab.active = '';
Tab.componentList = {};
Tab.routeTable = {};

module.exports = {
  rsJsonApiRequest,
  setKeys,
  setBackgroundTask,
  Tab,
};

