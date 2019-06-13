'use strict';
var m = require('mithril');
var rs = require('rswebui');

let CERT = '';
let component = {
    oninit: getCert,
    view: function() {
        return m('.tab.tab-home.frame-center', [
            m('h3', 'Your Retroshare certificate(click to copy).'),
            m('textarea.field[id=certificate][rows=14][cols=65][placeholder=certificate][readonly]', {
                onclick: copyToClipboard,
            },
              CERT),
        ]);
    }
};

function getCert() {
    let handleCert = function(body, state) {
        if (state === true) {
            CERT = body['retval'];
        }
    };
    rs.rsJsonApiRequest('/rsPeers/GetRetroshareInvite', {}, handleCert);
}

function copyToClipboard() {
    document.getElementById('certificate').select();
    document.execCommand('copy');
};

module.exports = {
    component,
};

