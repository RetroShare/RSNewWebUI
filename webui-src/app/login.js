var m = require('mithril');
var rs = require('rswebui');

let onSuccessCallback = function() {};

function renderLoginPage(callback) {
  // Cannot use mount because vDOM will not let any other mount overrides
  m.render(document.getElementById('main'), m(loginComponent));
  onSuccessCallback = callback;
}

let loginComponent = {
  view : function() {
    return m('.frame-center', [
      m('img.logo[src=../../data/retroshare.svg][alt=retroshare_icon][width=10%]'),
      m('input.field[type=text][placeholder=Username][id=uname]'),
      m('input.field[type=password][placeholder=Password][id=passwd]'),
      m('button.submit-btn', {onclick : verifyLogin}, 'Login'),
      m('p.error[id=error]'),
    ]);
  }
};

let uname = '';
let passwd = '';

function verifyLogin() {
  [uname, passwd] = getKeys();
  let loginHeader = {'Authorization' : 'Basic ' + btoa(uname + ':' + passwd)};
  rs.rsJsonApiRequest('/rsPeers/GetRetroshareInvite', {}, onResponse, true,
                      loginHeader);
}

function getKeys() {
  let uname = document.getElementById('uname').value;
  let passwd = document.getElementById('passwd').value;
  return [ uname, passwd ];
}

function onResponse(data, successful) {
  if (successful) {
    rs.setKeys(uname, passwd);
    onSuccessCallback();
  } else {
    displayErrorMessage();
  }
}

function displayErrorMessage() {
  m.render(document.getElementById('error'), 'Incorrect login/password.');
}

module.exports = {
  renderLoginPage,
}
