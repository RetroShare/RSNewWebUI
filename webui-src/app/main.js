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
    // TODO: move the tabs sections to all components,
    // so that highlighting the active one becomes easier
    m.render(document.body, [
        m('nav.tab-container',
          [
              m('a.tab-header[href=/home]', {oncreate: m.route.link}, 'Home'),
              m('a.tab-header[href=/downloads]', {oncreate: m.route.link}, 'Downloads'),
          ]),
        m('div', {id: 'tab-section'})
    ]);
}

