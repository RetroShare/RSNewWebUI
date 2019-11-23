var m = require('mithril');
var rs = require('rswebui');

let onSuccessCallback = undefined;

function renderLoginPage(callback) {
  // Cannot use mount because vDOM will not let any other component overrides
  m.render(document.getElementById('main'), m(loginComponent));
  onSuccessCallback = callback;
};

const loginComponent = {
  view: () => {
    let uname = '';
    let passwd = '';
    let port = 9092;
    let advanced = false;
    return m('.login-page',
      m('.login-container', [
        m(
          'img.logo[src=data/retroshare.svg][alt=retroshare_icon][width=30%]'
        ),
        m('input[type=text][placeholder=Username][autofocus]', {
          onchange: (e) => uname = e.target.value
        }),
        m('input[type=password][placeholder=Password]', {
          onchange: (e) => { passwd = e.target.value }
        }),
        m('.extra', [
          'Port:',
          m('input[type=number]', {
            value: port,
            oninput: (e) => { port = e.target.value }
          }),
        ]),
        m('button.submit-btn', {
          onclick: () => verifyLogin(uname, passwd, port),
        }, 'Login'),
        m('p.error[id=error]'),
      ]));
  }
};

function verifyLogin(uname, passwd, port) {
  let loginHeader = {
    'Authorization': 'Basic ' + btoa(uname + ':' + passwd)
  };
  if(port !== 9092) {
    rs.setKeys('', '', port, false);
  }
  rs.rsJsonApiRequest('/rsPeers/GetRetroshareInvite', {},
    (data, successful) => {
      if(successful) {
        rs.setKeys(uname, passwd);
        onSuccessCallback();
      } else {
        displayErrorMessage('Incorrect login/password.');
      }
    },
    true,
    loginHeader);
};


function displayErrorMessage(message) {
  m.render(document.getElementById('error'), message);
};

module.exports = {
  renderLoginPage,
};

