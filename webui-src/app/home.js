const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');

const Certificate = () => {
  let ownCert = '';
  let short = false;
  function loadOwnCert(short) {
    if (short) {
      rs.rsJsonApiRequest(
        '/rsPeers/GetShortInvite',
        { formatRadix: true },
        (data) => (ownCert = data.invite)
      );
    } else {
      rs.rsJsonApiRequest('/rsPeers/GetRetroshareInvite', {}, (data) => (ownCert = data.retval));
    }
  }

  return {
    oninit() {
      // Load long cert by default
      loadOwnCert(false);
    },

    view() {
      return m('.widget.widget-half', [
        m('h3', 'Certificate'),
        m('p', 'Your Retroshare certificate, click to copy'),
        m('hr'),
        m(
          'textarea[readonly]',
          {
            id: 'certificate',
            rows: 14,
            cols: 65,
            placeholder: 'certificate',
            onclick: () => {
              document.getElementById('certificate').select();
              document.execCommand('copy');
            },
          },
          ownCert
        ),
        m('input[type=checkbox]', {
          checked: short,
          oninput: (e) => {
            short = e.target.checked;
            loadOwnCert(short);
          },
        }),
        'Short version',
      ]);
    },
  };
};

function invalidCertPrompt() {
  widget.popupMessage([m('h3', 'Error'), m('hr'), m('p', 'Not a valid Retroshare certificate.')]);
}

function confirmAddPrompt(details, cert) {
  widget.popupMessage([
    m('i.fas.fa-user-plus'),
    m('h3', 'Make friend'),
    m('p', 'Details about your friend'),
    m('hr'),
    m('ul', [
      m('li', 'Name: ' + details.name),
      m('li', 'Location: ' + details.location + '(' + details.id + ')'),
      m('li', details.isHiddenNode ? details.hiddenNodeAddress : details.extAddr),
    ]),
    m(
      'button',
      {
        onclick: () =>
          rs.rsJsonApiRequest('/rsPeers/loadCertificateFromString', { cert }, (data) => {
            if (data.retval) {
              widget.popupMessage([
                m('h3', 'Successful'),
                m('hr'),
                m('p', 'Successfully added friend.'),
              ]);
            } else {
              widget.popupMessage([
                m('h3', 'Error'),
                m('hr'),
                m('p', 'An error occoured during adding. Friend not added.'),
              ]);
            }
          }),
      },
      'Finish'
    ),
  ]);
}

function addFriendFromCert(cert) {
  rs.rsJsonApiRequest('/rsPeers/loadDetailsFromStringCert', { cert }, (data) => {
    if (!data.retval) {
      invalidCertPrompt();
      return null;
    }
    confirmAddPrompt(data.certDetails, cert);
  });
}

const AddFriend = () => {
  let certificate = '';

  function loadFileContents(fileListObj) {
    const file = fileListObj[0];
    if (file.type.indexOf('text') !== 0 || file.size === 0) {
      // TODO handle incorrect file
      return null;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      certificate = e.target.result;
      m.redraw();
    };
    reader.readAsText(file);
  }

  return {
    view: (vnode) =>
      m('.widget.widget-half', [
        m('h3', 'Add friend'),
        m(
          'p',
          'Did you recieve a certificate from a friend? You can also drag and drop the file below'
        ),
        m('hr'),
        m(
          '.cert-drop-zone',
          {
            isDragged: false,
            ondragenter: () => (vnode.state.isDragged = true),
            ondragexit: () => (vnode.state.isDragged = false),

            // Styling element when file is dragged
            style: vnode.state.isDragged
              ? {
                  border: '5px solid #3ba4d7',
                }
              : {},

            ondragover: (e) => e.preventDefault(),
            ondrop: (e) => {
              vnode.state.isDragged = false;
              e.preventDefault();
              loadFileContents(e.target.files || e.dataTransfer.files);
            },
          },

          [
            m('input[type=file][name=certificate]', {
              onchange: (e) => {
                // Note: this one is for the 'browse' button
                loadFileContents(e.target.files || e.dataTransfer.files);
              },
            }),
            'Or paste the certificate here',
            m('textarea[rows=5][style="width: 90%; display: block;"]', {
              oninput: (e) => (certificate = e.target.value),
              value: certificate,
            }),
            m(
              'button',
              {
                onclick: () => addFriendFromCert(certificate),
              },
              'Add'
            ),
          ]
        ),
      ]),
  };
};

const Layout = () => {
  return {
    view: () => m('.tab-page', [m(Certificate), m(AddFriend)]),
  };
};

module.exports = Layout;
