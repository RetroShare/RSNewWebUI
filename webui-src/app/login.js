const m = require('mithril');
const rs = require('rswebui');

const displayErrorMessage = function(message) {
  m.render(document.getElementById('error'), message);
};

const verifyLogin = async function(uname, passwd, port) {
  const loginHeader = {
    Authorization: 'Basic ' + btoa(uname + ':' + passwd)
  };
  rs.setKeys('', '', port, false);
  rs.rsJsonApiRequest(
    '/rsPeers/GetRetroshareInvite',
    {},
    (data, successful) => {
      if (successful) {
        rs.setKeys(uname, passwd, port);
        m.route.set('/home');
      } else {
        displayErrorMessage('Incorrect login/password.');
      }
    },
    true,
    loginHeader
  );
};

const loginComponent = function() {
  let uname = '';
  let passwd = '';
  let port = 9092;
  return {
    view: () => {
      return m(
        '.login-page',
        m('.login-container', [
          m('img.logo[width=30%]', {
            src: '../data/retroshare.svg',
            alt: 'retroshare_icon'
          }),
          m('input[autofocus]', {
            type: 'text',
            placeholder: 'Username',
            onchange: e => (uname = e.target.value)
          }),
          m('input', {
            type: 'password',
            placeholder: 'Password',
            onchange: e => (passwd = e.target.value)
          }),
          m('.extra', [
            'Port:',
            m('input', {
              type: 'number',
              value: port,
              oninput: e => {
                port = e.target.value;
              }
            })
          ]),
          m(
            'button.submit-btn',
            {
              onclick: () => verifyLogin(uname, passwd, port)
            },
            'Login'
          ),
          m('p.error[id=error]')
        ])
      );
    }
  };
};

module.exports = loginComponent;
