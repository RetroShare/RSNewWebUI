const m = require('mithril');
const rs = require('rswebui');

const displayErrorMessage = function(message) {
  m.render(document.getElementById('error'), message);
};

const verifyLogin = async function(uname, passwd, port, url) {
  const loginHeader = {
    Authorization: 'Basic ' + btoa(uname + ':' + passwd)
  };
  rs.setKeys('', '', port, false, url);
  rs.rsJsonApiRequest(
    '/rsPeers/GetRetroshareInvite',
    {},
    (data, successful) => {
      if (successful) {
        rs.setKeys(uname, passwd, port, true, url);
        m.route.set('/home');
      } else if (data.status == 401) {
        displayErrorMessage('Incorrect login/password.');
      } else if (data.status == 0) {
        displayErrorMessage(['Retroshare-jsonapi not available.',m('br'),'Please fix host and/or port.']);
      } else {
        displayErrorMessage('Login failed: HTTP ' + data.status + ' ' + data.statusText);
      }
    },
    true,
    loginHeader
  );
};

function loginComponent() {
  var urlParams = new URLSearchParams(window.location.search);
  let uname = urlParams.get('Username')||'';
  let passwd = '';
  let port = Number(urlParams.get('Port') || window.location.protocol=='file:' ? '9092': window.location.port );
  let server = urlParams.get('Server')|| window.location.protocol=='file:' ? '127.0.0.1' : window.location.hostname;
  return {
    view: () => {
      return m(
        '.login-page',
        m('.login-container', [
          m('img.logo[width=30%]', {
            src: '../data/retroshare.svg',
            alt: 'retroshare_icon'
          }),
          m('input' + (uname == '' ? '[autofocus]':''), {
            type: 'text',
            value: uname,
            placeholder: 'Username',
            onchange: e => (uname = e.target.value)
          }),
          m('input'+ (uname != '' ? '[autofocus]':''), {
            type: 'password',
            placeholder: 'Password',
            onchange: e => (passwd = e.target.value),
            onkeyup: e => {if (e.code=='Enter') loginBtn.click();}
          }),
          m('.extra', [
            'Port:',
            m('input', {
              type: 'number',
              value: port,
              oninput: e => (port = e.target.value)
            })
          ]),
          m('.extra',[
            'Server:',
            m('input',{
              type: 'text',
              value: server,
              oninput: e => (server = e.target.value)
            })
          ]),
          m(
            'button.submit-btn',
            {
              id: 'loginBtn',
              onclick: () => verifyLogin(uname, passwd, port, 'http://' + server+':')
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
