const m = require('mithril');
const rs = require('rswebui');

const displayErrorMessage = function(message) {
  m.render(document.getElementById('error'), message);
};

const verifyLogin = async function(uname, passwd, url) {
  const loginHeader = {
    Authorization: 'Basic ' + btoa(uname + ':' + passwd)
  };
  if (!url.trim()) {
    displayErrorMessage("Server-url is missing, please enter json-api url");
    return;
  }
  rs.setKeys('', '', url, false);
  rs.rsJsonApiRequest(
    '/rsPeers/GetRetroshareInvite',
    {},
    (data, successful) => {
      if (successful) {
        rs.setKeys(uname, passwd, url);
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
  let url = urlParams.get('Url') || window.location.protocol==='file:' ? 'http://127.0.0.1:9092' : window.location.protocol + '//' + window.location.host + window.location.pathname.replace('/index.html','');
  return {
    view: () => {
      return m(
        '.login-page',
        m('.login-container', [
          m('img.logo[width=30%]', {
            src: '../data/retroshare.svg',
            alt: 'retroshare_icon'
          }),
          m('input' + (uname === '' ? '[autofocus]':''), {
            type: 'text',
            value: uname,
            placeholder: 'Username',
            onchange: e => (uname = e.target.value)
          }),
          m('input'+ (uname !== '' ? '[autofocus]':''), {
            type: 'password',
            placeholder: 'Password',
            onchange: e => (passwd = e.target.value),
            onkeyup: e => {if (e.code==='Enter') loginBtn.click();}
          }),
          m('.extra',[
            'Url:',
            m('input',{
              type: 'text',
              value: url,
              oninput: e => (url = e.target.value)
            })
          ]),
          m(
            'button.submit-btn',
            {
              id: 'loginBtn',
              onclick: () => verifyLogin(uname, passwd, url)
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
