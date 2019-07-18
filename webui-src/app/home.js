'use strict';
let m = require('mithril');
let rs = require('rswebui');

let CERT = '';

function getCert() {
  let handleCert = function(body, state) {
    if(state === true) {
      CERT = body['retval'];
    }
  };
  rs.rsJsonApiRequest('/rsPeers/GetRetroshareInvite', {}, handleCert);
}

function copyToClipboard() {
  document.getElementById('certificate').select();
  document.execCommand('copy');
};

let Certificate = {
  oninit: getCert,
  view: function() {
    return m('.widget.widget-half', [
      m('h3', 'Certificate'),
      m('p', 'Your Retroshare certificate, click to copy'),
      m('hr'),
      m(
        'textarea[id=certificate][rows=14][cols=65][placeholder=certificate][readonly]', {
          onclick: copyToClipboard,
        },
        CERT),
    ]);
  },
};

const AddFriend = () => {
  return {
    oninit: () => {},
    view: (vnode) => m('.widget.widget-half', [
      m('h3', 'Add friend'),
      m('p',
        'Did you recieve a certificate from a friend? You can also drag and drop the file below'
      ),
      m('hr'),
      m('.cert-drop-zone', {
        // Styling element when file is dragged
        isDragged: false,
        ondragenter: () => vnode.state.isDragged = true,
        ondragexit: () => vnode.state.isDragged = false,
        style: vnode.state.isDragged ? {
          border: '5px solid #3ba4d7',
        } : {},
        ondragover: (e) => e.preventDefault(),
        ondrop: (e) => {
          e.preventDefault();
          console.log('e:', e)
        },
      }, [
        m('input[type=file][name=certificate]'),
        'Or paste the certificate here',
        m('textarea[rows=5][style="width: 90%; display: block;"]'),
        m('button', 'Add'),
      ]),
    ])
  }
};

const Layout = () => {
  return {
    view: () => m('.tab-page', [
      m(Certificate),
      m(AddFriend),
    ])
  }
};

module.exports = Layout;

