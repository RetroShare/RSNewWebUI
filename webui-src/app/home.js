const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');

const logo = () => {
  return {
    view() {
      return m('.logo', [
        m('img', {
          src: 'images/retroshare.svg',
          alt: 'retroshare_icon',
        }),
        m('.retroshareText', [
          m('.retrotext', [m('span', 'RETRO'), 'SHARE']),
          m('b', 'secure communication for everyone'),
        ]),
      ]);
    },
  };
};

const webhelpConfirm = () => {
  return {
    view: () => [
      m('h3', 'Confirmation'),
      m('hr'),
      m('p', 'Do you want this link to be handled by your system?'),
      m('p', 'https://retrosharedocs.readthedocs.io/en/latest/'),
      m('p', 'Make sure this link has not been forged to drag you to a malicious website.'),
      m(
        'button',
        {
          onclick: () => {
            window.open('https://retrosharedocs.readthedocs.io/en/latest/');
          },
        },
        'Ok'
      ),
    ],
  };
};

const webhelp = () => {
  return {
    view() {
      return m(
        '.webhelp',
        {
          onclick: () => {
            widget.popupMessage(m(webhelpConfirm));
          },
        },
        [m('i.fas.fa-globe-europe'), m('p', 'Open Web Help')]
      );
    },
  };
};

const ConfirmCopied = () => {
  return {
    view: () => [
      m('h3', 'Copied to Clipboard'),
      m('hr'),
      m('p[style="margin: 12px 0 4px"]', 'Your Retroshare ID has been copied to Clipboard.'),
      m(
        'p[style="margin: 4px 0 12px"]',
        'Now, you can paste and send it to your friend via email or some other way.'
      ),
      m('button', {}, 'Ok'),
    ],
  };
};

const retroshareId = () => {
  return {
    view(v) {
      return m('.retroshareID', [
        m(
          'textarea[readonly].textArea',
          {
            id: 'retroId',
            rows: 1,
            cols: v.attrs.ownCert.length + 2,
            placeholder: 'certificate',
            onclick: () => {
              document.getElementById('retroId').select();
            },
          },
          v.attrs.ownCert
        ),
        m('i.fas.fa-copy', {
          onclick: () => {
            document.getElementById('retroId').select();
            document.execCommand('copy');
            widget.popupMessage(m(ConfirmCopied));
          },
        }),
        m('i.fas.fa-share-alt'),
      ]);
    },
  };
};

function invalidCertPrompt() {
  widget.popupMessage([m('h3', 'Error'), m('hr'), m('p', 'Not a valid Retroshare certificate.')]);
}

function confirmAddPrompt(details, cert, long) {
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

    long
      ? m(
          'button',
          {
            onclick: async () => {
              const res = await rs.rsJsonApiRequest('/rsPeers/loadCertificateFromString', { cert });
              if (res.body.retval) {
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
            },
          },
          'Finish'
        )
      : m(
          'button',
          {
            onclick: async () => {
              const res = await rs.rsJsonApiRequest('/rsPeers/addSslOnlyFriend', {
                sslId: details.id,
                pgpId: details.gpg_id,
              });
              if (res.body.retval) {
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
            },
          },
          'Finish'
        ),
  ]);
}

async function addFriendFromCert(cert) {
  const res = await rs.rsJsonApiRequest('/rsPeers/parseShortInvite', { invite: cert });

  if (res.body.retval) {
    console.log(res.body);
    confirmAddPrompt(res.body.details, cert, false);
  } else {
    rs.rsJsonApiRequest('/rsPeers/loadDetailsFromStringCert', { cert }, (data) => {
      if (!data.retval) {
        invalidCertPrompt();
        return null;
      }
      confirmAddPrompt(data.certDetails, cert, true);
    });
  }
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
      m('.widget', [
        m('h3', 'Add friend'),
        m('h5', 'Did you recieve a certificate from a friend?'),
        m('hr'),
        m(
          '.cert-drop-zone',
          {
            isDragged: false,
            ondragenter: () => (vnode.state.isDragged = true),
            ondragexit: () => (vnode.state.isDragged = false),

            // Styling element when file is dragged
            style: { border: vnode.state.isDragged && '5px solid #3ba4d7' },

            ondragover: (e) => e.preventDefault(),
            ondrop: (e) => {
              vnode.state.isDragged = false;
              e.preventDefault();
              loadFileContents(e.target.files || e.dataTransfer.files);
            },
          },

          [
            m(
              'p[style="margin: 16px 0 4px"]',
              'You can directly upload or Drag and drop the file below'
            ),
            m('input[type=file][name=certificate]', {
              onchange: (e) => {
                // Note: this one is for the 'browse' button
                loadFileContents(e.target.files || e.dataTransfer.files);
              },
            }),
            m('p[style="width: 100%; text-align: center; margin: 5px 0;"]', 'OR'),
            m(
              'textarea[rows=5][placeholder="Paste the certificate here"][style="width: 100%; display: block; resize: vertical;"]',
              {
                oninput: (e) => (certificate = e.target.value),
                value: certificate,
              }
            ),
            m(
              'button[style="margin-top: 10px;"]',
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

const Certificate = () => {
  let ownCert = '';
  function loadOwnCert() {
    rs.rsJsonApiRequest(
      '/rsPeers/GetShortInvite',
      { formatRadix: true },
      (data) => (ownCert = decodeURIComponent(data.invite).substring(34))
    );
  }

  return {
    oninit() {
      // Load long cert by default
      loadOwnCert();
    },

    view() {
      return m('.homepage ', [
        m(logo),
        m('.certificate', [
          m('.certificate__heading', [
            m('h1', 'Welcome to Web Interface of Retroshare!'),
            'Retroshare is an Open Source Cross-platform,',
            m('br'),
            'Private and Secure Decentralized Communication Platform.',
          ]),
          m('.certificate__content', [
            m('.rsId', [
              m('p', 'This is your Retroshare ID. Copy and share with your friends!'),
              m(retroshareId, { ownCert }),
            ]),
            m('.add-friend', [
              m('h6', 'Did you receive a Retroshare ID from your friend ?'),
              m(
                'button',
                {
                  onclick: () => {
                    widget.popupMessage(m(AddFriend));
                  },
                },
                'Add Friend'
              ),
            ]),
            m('.webhelp-container', [m('h6', 'Do you need help with Retoshare ?'), m(webhelp)]),
          ]),
        ]),
      ]);
    },
  };
};

const Layout = () => {
  return {
    view: () => m(Certificate),
  };
};

module.exports = Layout;
