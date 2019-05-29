'use strict';
var m = require('mithril');
var rs = require('rswebui');

let onSuccessCallback = function() {};

function renderLoginPage(callback) {
    // Cannot use mount because vDOM will not let it override
    m.render(document.body, loginComponent.view());
    onSuccessCallback = callback;
}

let loginComponent = {
    view: function() {
        return m('div[id=loginbox]', [
            m('input', {type: 'text', placeholder: 'Username', id: 'uname'}),
            m('input',
              {type: 'password', placeholder: 'Password', id: 'passwd'}),
            m('button', {onclick: verifyLogin, style: 'width:5em;height:2em;'},
              'Login'),
            m('p', {id: 'warning', style: 'color:red'}),
        ]);
    }
};

let uname = '';
let passwd = '';

function verifyLogin() {
    [uname, passwd] = getKeys();
    let loginHeader = {'Authorization': 'Basic ' + btoa(uname + ':' + passwd)};
    rs.rsJsonApiRequest(
        '/rsPeers/GetRetroshareInvite', {}, onResponse, true, loginHeader);
}

function getKeys() {
    let uname = document.getElementById('uname').value;
    let passwd = document.getElementById('passwd').value;
    return [uname, passwd];
}

function onResponse(data, successful) {
    if (successful) {
        rs.setKeys(uname, passwd);
        onSuccessCallback();
    } else {
        displayErrorMessage();
    }
}

function displayErrorMessage() {
    m.render(document.getElementById('warning'), 'Incorrent login/password.');
}

module.exports = {
    renderLoginPage,
}

