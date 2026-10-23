const m = require('mithril');
const rs = require('rswebui');
const icon = require('icon');
const brandLogo = require('brand_logo');

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
    displayAuthError ? displayErrorMessage : () => { },
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
  //  Parenthesised on purpose: === binds tighter than ||, so without them the
  //  test read `(Url || protocol === 'file:') ? default : origin`, and any
  //  ?Url= given was thrown away in favour of the hardcoded default -- the one
  //  case the parameter exists for.
  let url =
    urlParams.get('Url') ||
    (window.location.protocol === 'file:'
      ? 'http://127.0.0.1:9092'
      : window.location.protocol +
      '//' +
      window.location.host +
      window.location.pathname.replace('/index.html', ''));
  let withOptions = false;

  const logo = () =>
    m('img.login-logo', { src: brandLogo, alt: '', width: 200, height: 200 });

  const inputName = () =>
    m('input', {
      id: 'username',
      type: 'text',
      value: uname,
      placeholder: 'Enter your username',
      autocomplete: 'username',
      oninput: (e) => (uname = e.target.value),
    });
  const buttonLogin = () =>
    m('button.is-primary[type=submit].submit-btn#loginBtn', [
      icon('sign-in-alt'),
      'Login',
    ]);

  const inputPassword = (placeholder) =>
    m('input[autofocus]', {
      id: 'password',
      type: 'password',
      placeholder,
      autocomplete: 'current-password',
      oncreate: (e) => e.dom.focus(),
      oninput: (e) => (passwd = e.target.value),
    });

  const inputUrl = () =>
    m('input', {
      id: 'url',
      type: 'text',
      placeholder: 'Enter node URL',
      value: url,
      spellcheck: false,
      oninput: (e) => (url = e.target.value),
    });

  const optionsButton = () =>
    m('button.login-options.is-quiet[type=button]', {
      'aria-expanded': String(withOptions),
      onclick: () => (withOptions = !withOptions),
    }, [
      'Advanced options',
      icon(withOptions ? 'chevron-up' : 'chevron-down'),
    ]);

  const field = (id, label, input) =>
    m('.form-field', [m('label', { for: id }, label), input]);

  const textError = () => m('p.error[id=error][aria-live=polite]');

  return {
    oninit: () => {
      if (rs.loginKey.isVerified && rs.loginKey.username && rs.loginKey.passwd) {
        verifyLogin(rs.loginKey.username, rs.loginKey.passwd, rs.loginKey.url, false);
      }
    },
    view: () => {
      return m(
        'form.login-page',
        {
          onsubmit: (ev) => {
            ev.preventDefault();
            verifyLogin(uname, passwd, url);
          },
        },
        m(
          '.login-container',
          [
            m('.login-brand', [
              logo(),
              m('h1', 'RetroShare'),
              m('p', 'Connect to your node'),
            ]),
            m('.login-fields', [
              withOptions && field('username', 'Username', inputName()),
              withOptions
                ? field('password', 'Password', inputPassword('Enter your password'))
                : inputPassword('Password'),
              withOptions && field('url', 'Node URL', inputUrl()),
            ]),
            optionsButton(),
            buttonLogin(),
            textError(),
          ]
        )
      );
    },
  };
}

module.exports = loginComponent;
