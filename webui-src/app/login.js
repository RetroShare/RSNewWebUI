var m = require('mithril');
var rs = require('rswebui');

let onSuccessCallback = undefined;

function renderLoginPage(callback) {
  // Cannot use mount because vDOM will not let any other component overrides
  m.render(document.getElementById('main'), m(loginComponent));
  onSuccessCallback = callback;
};

let loginComponent = {
  view: function() {
    return m('.login-page',
      m('.login-container', [
        m('img.logo[src=../../data/retroshare.svg][alt=retroshare_icon][width=30%]'),
        m('input.field[type=text][placeholder=Username][id=uname]'),
        m('input.field[type=password][placeholder=Password][id=passwd]',{
          onchange: verifyLogin,
        }),
        m('button.submit-btn', {
          onclick: verifyLogin,
        }, 'Login'),
        m('p.error[id=error]'),
      ]));
  }
};

function verifyLogin() {
  let [uname, passwd] = getKeys();
  let loginHeader = {
    'Authorization': 'Basic ' + btoa(uname + ':' + passwd)
  };
  rs.rsJsonApiRequest('/rsPeers/GetRetroshareInvite', {}, loginHandleWrapper(uname, passwd), true,
    loginHeader);
};

function getKeys() {
  let uname = document.getElementById('uname')
    .value;
  let passwd = document.getElementById('passwd')
    .value;
  return [uname, passwd];
};

function loginHandleWrapper(uname, passwd) {
  let onResponse = function(data, successful) {
    if(successful) {
      rs.setKeys(uname, passwd);
      onSuccessCallback();
    } else {
      displayErrorMessage();
    }
  };
  return onResponse;
};

function displayErrorMessage() {
  m.render(document.getElementById('error'), 'Incorrect login/password.');
};

module.exports = {
  renderLoginPage,
};

