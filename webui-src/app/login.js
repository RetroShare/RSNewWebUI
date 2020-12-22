const m = require('mithril');
const rs = require('rswebui');

const displayErrorMessage = function(message) {
  m.render(document.getElementById('error'), message);
};

const verifyLogin = async function(uname, passwd, url, displayAuthError = true) {
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
      } else if (data.status == 401 && !displayAuthError) {
        // skip - Autologon failed
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
  let uname = urlParams.get('Username')||'webui';
  let passwd = urlParams.get('Password') ||'';
  let url = urlParams.get('Url') || window.location.protocol==='file:' ? 'http://127.0.0.1:9092' : window.location.protocol + '//' + window.location.host + window.location.pathname.replace('/index.html','');
  let withOptions = false;
  let logo = () => m('img.logo[width=30%]', {
                         src: '../data/retroshare.svg',
                         alt: 'retroshare_icon'
                       });
  let inputName = () => m('input', {
                        id: 'username',
                        type: 'text',
                        value: uname,
                        placeholder: 'Username',
                        onchange: e => (uname = e.target.value)
                      });
  let inputPassword = () => m('input[autofocus]', {
                        id: 'password',
                        type: 'password',
                        placeholder: 'Password',
                        onchange: e => (passwd = e.target.value),
                        onkeydown: e => {
                            if (e.keyCode===13) {
                                passwd = e.target.value;
                                loginBtn.click();
                                return false;
                            }
                            return true;
                        }
                      });
  let inputUrl = () => m('input',{
                       id: 'url',
                       type: 'text',
                       placeholder: 'Url',
                       value: url,
                       oninput: e => (url = e.target.value)
                     });

  let linkOptions = action => m('a',{
                       onclick: e => withOptions=!withOptions,
                     }, action + ' options');

  let buttonLogin = () => m('button.submit-btn', {
                      id: 'loginBtn',
                      onclick: () => verifyLogin(uname, passwd, url)
                    }, 'Login');

  let textError = () => m('p.error[id=error]');
  return {
    oninit: () => verifyLogin(uname, passwd, url, false),
    view: () => {
      return m('.login-page',
        m('.login-container', withOptions
        ? [
          logo(),
          m(".extra",[m('label','Username:'),m('br'), inputName()]),
          m(".extra",[m('label','Password:'),m('br'), inputPassword()]),
          m(".extra",[m('label','Url:'),m('br'), inputUrl()]),
          linkOptions('hide'),
          buttonLogin(),
          textError()
        ] : [
          logo(),
          inputPassword(),
          linkOptions('show'),
          buttonLogin(),
          textError()
        ])
      );
    }
  };
};

module.exports = loginComponent;
