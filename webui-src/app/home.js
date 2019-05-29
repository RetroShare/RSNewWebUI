'use strict';
var m = require('mithril');
var rs = require('rswebui');

let CERT = '';
let component = {
    oninit: getCert,
    view: function() {
        return m('.home-tab', [
            m('p', 'Your Retroshare certificate(click to copy)'),
            m('input', {
                id: 'certificate',
                type: 'text',
                readonly: 'true',
                onclick: copyToClipboard,
                style: 'height: 5em;',
            },
              ''),
        ]);
    }
};

function getCert() {
    let handleCert = function(body, state) {
        if (state === true) {
            console.log('body = ', body);
            CERT = body['retval'];
            document.getElementById('certificate').value = CERT;
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

