'use strict';
var m = require('mithril');
var rs = require('rswebui');

let CERT = '';
let component = {
  oninit: getCert,
  view: function() {
    return m('.tab-page.fadein', [
      m('.widget.widget-half', [
        m('h3', 'Certificate'),
        m('p', 'Your Retroshare certificate, click to copy'),
        m('hr'),
        m('textarea.field[id=certificate][rows=14][cols=65][placeholder=certificate][readonly]', {
            onclick: copyToClipboard,
          },
          CERT),
      ]),
    ]);
  }
};

function getCert() {
  let handleCert = function(body, state) {
    if(state === true) {
      CERT = body['retval'];
    }
  };
  rs.rsJsonApiRequest('/rsPeers/GetRetroshareInvite', {}, handleCert);
}

function copyToClipboard() {
  document.getElementById('certificate')
    .select();
  document.execCommand('copy');
};

new rs.Tab('home', component);
module.exports = {
  component,
};

