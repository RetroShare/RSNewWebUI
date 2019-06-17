let m = require('mithril');
let rs = require('rswebui');
let login = require('login');

login.renderLoginPage(onSuccess);

function onSuccess() {
    let home = require('home');
    let dl = require('downloads');

    renderMainStructure();
    m.route(document.getElementById('tab-section'), '/home', {
        '/home': home.component,
        '/downloads': dl.component,
    });
}

function renderMainStructure() {
    m.render(document.getElementById('main'), [
        m('nav.tab-container',
          [
              m('a.tab-header[href=/home]', {oncreate: m.route.link}, 'Home'),
              m('a.tab-header[href=/downloads]', {oncreate: m.route.link}, 'Downloads'),
          ]),
        m('div', {id: 'tab-section'})
    ]);
}

