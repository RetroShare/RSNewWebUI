'use strict'

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
        '/downloads': dl,
    });
}

function renderMainStructure() {
    m.render(document.body, [
        m('.tab-headers', {width: '100%'},
          [
              m('a', {id: 'home-tab-header', href: '#!/home'}, 'home'),
              m('a', {id: 'downloads-tab-header', href: '#!/downloads'},
                'downloads'),
          ]),
        m('div', {id: 'tab-section'})
    ]);
}

