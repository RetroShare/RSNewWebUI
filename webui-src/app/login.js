const m = require('mithril');
const rs = require('rswebui');

const displayErrorMessage = function (message) {
  m.render(document.getElementById('error'), message);
};

const verifyLogin = async function (uname, passwd, url, displayAuthError = true) {
  const loginHeader = {
    Authorization: `Basic ${btoa(`${uname}:${passwd}`)}`,
  };
  if (!url.trim()) {
    displayErrorMessage('Server-url is missing, please enter json-api url');
    return;
  }
  rs.setKeys('', '', url, false);
  rs.logon(
    loginHeader,
    displayAuthError ? displayErrorMessage : () => {},
    displayErrorMessage,
    () => {
      rs.setKeys(uname, passwd, url);
      m.route.set('/home');
    }
  );
};

function loginComponent() {
  const urlParams = new URLSearchParams(window.location.search);
  let uname = urlParams.get('Username') || 'webui';
  let passwd = urlParams.get('Password') || '';
  let url =
    urlParams.get('Url') || window.location.protocol === 'file:'
      ? 'http://127.0.0.1:9092'
      : window.location.protocol +
        '//' +
        window.location.host +
        window.location.pathname.replace('/index.html', '');
  let withOptions = false;

  const logo = () =>
    m('img.logo[width=30%]', { src: 'images/retroshare.svg', alt: 'retroshare_icon' });

  const inputName = () =>
    m('input', {
      id: 'username',
      type: 'text',
      value: uname,
      placeholder: 'Username',
      onchange: (e) => (uname = e.target.value),
    });
  const buttonLogin = () =>
    m(
      'button[type=submit].submit-btn#loginBtn',
      { onclick: () => verifyLogin(uname, passwd, url) },
      'Login'
    );

  const inputPassword = () =>
    m('input[autofocus]', {
      id: 'password',
      type: 'password',
      placeholder: 'Password',
      oncreate: (e) => e.dom.focus(),
      onchange: (e) => (passwd = e.target.value),
    });

  const inputUrl = () =>
    m('input', {
      id: 'url',
      type: 'text',
      placeholder: 'Url',
      value: url,
      oninput: (e) => (url = e.target.value),
    });

  const linkOptions = (action) =>
    m('a', { onclick: () => (withOptions = !withOptions) }, `${action} options`);

  const textError = () => m('p.error[id=error]');
  return {
    view: () => {
      return m(
        'form.login-page',
        m(
          '.login-container',
          withOptions
            ? [
                logo(),
                m('.extra', [m('label', 'Username:'), m('br'), inputName()]),
                m('.extra', [m('label', 'Password:'), m('br'), inputPassword()]),
                m('.extra', [m('label', 'Url:'), m('br'), inputUrl()]),
                linkOptions('hide'),
                buttonLogin(),
                textError(),
              ]
            : [logo(), inputPassword(), linkOptions('show'), buttonLogin(), textError()]
        )
      );
    },
  };
}

module.exports = loginComponent;
