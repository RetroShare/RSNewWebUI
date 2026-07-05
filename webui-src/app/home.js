const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');

// RetroshareInviteFlags (see libretroshare rspeers.h):
//   CURRENT_LOCAL_IP 0x01 | DNS 0x04 | RADIX_FORMAT 0x08 | CURRENT_EXTERNAL_IP 0x20
// == defaultCertificateFlags | RADIX_FORMAT, i.e. the compact "short invite" as
// plain radix64 text (no URL wrapper) - the short ID favoured by RetroShare.
const SHORT_INVITE_FLAGS = 0x2d;

// Cached own SSL peer id. getOwnId() is not exposed over the JSON API, so we
// derive it by parsing our own short invite.
let ownSslId = null;
async function fetchOwnSslId() {
  if (ownSslId) return ownSslId;
  const inv = await rs.rsJsonApiRequest('/rsPeers/getShortInvite', {
    inviteFlags: SHORT_INVITE_FLAGS,
  });
  if (!inv.body || !inv.body.retval) return null;
  const parsed = await rs.rsJsonApiRequest('/rsPeers/parseShortInvite', {
    invite: inv.body.invite,
  });
  if (parsed.body && parsed.body.retval && parsed.body.details) {
    ownSslId = parsed.body.details.id;
  }
  return ownSslId;
}
async function isOwnCert(details) {
  if (!details || !details.id) return false;
  const own = await fetchOwnSslId();
  return !!own && details.id === own;
}

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
      m('p[style="margin: 12px 0 4px"]', 'Your RetroShare ID has been copied to Clipboard.'),
      m(
        'p[style="margin: 4px 0 12px"]',
        'Now, you can paste and send it to your friend via email or some other way.'
      ),
      m(
        'button',
        {
          onclick: () => {
            document.getElementById('modal-container').style.display = 'none';
          },
        },
        'Ok'
      ),
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
            placeholder: 'certificate',
            onclick: () => {
              document.getElementById('retroId').select();
            },
          },
          v.attrs.ownCert
        ),
        m('i.fas.fa-copy', {
          title: 'Copy to clipboard',
          onclick: () => {
            document.getElementById('retroId').select();
            document.execCommand('copy');
            widget.popupMessage(m(ConfirmCopied));
          },
        }),
        // TODO: wire up sharing (web share / mailto invite) - disabled for now
        m('i.fas.fa-share-alt', {
          style: { color: '#bbb', cursor: 'not-allowed' },
          title: 'Coming soon',
        }),
      ]);
    },
  };
};

function invalidCertPrompt() {
  widget.popupMessage([m('h3', 'Error'), m('hr'), m('p', 'Not a valid RetroShare certificate.')]);
}

function ownCertPrompt() {
  widget.popupMessage([
    m('h3', 'Cannot add yourself'),
    m('hr'),
    m(
      'p',
      "This is your own certificate! You would not want to make friend with yourself. Would you?"
    ),
  ]);
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
    if (await isOwnCert(res.body.details)) {
      ownCertPrompt();
      return;
    }
    confirmAddPrompt(res.body.details, cert, false);
  } else {
    rs.rsJsonApiRequest('/rsPeers/loadDetailsFromStringCert', { cert }, async (data) => {
      if (!data.retval) {
        invalidCertPrompt();
        return null;
      }
      if (await isOwnCert(data.certDetails)) {
        ownCertPrompt();
        return;
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
        m('h5', 'Did you receive a certificate from a friend?'),
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
              'You can directly upload or drag and drop the file below'
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
      '/rsPeers/getShortInvite',
      { inviteFlags: SHORT_INVITE_FLAGS },
      (data) => (ownCert = data.invite)
    );
  }

  return {
    oninit() {
      // Load the short invite (short ID) by default
      loadOwnCert();
    },

    view() {
      return m('.homepage ', [
        m(logo),
        m('.certificate', [
          m('.certificate__heading', [
            m('h1', 'Welcome to Web Interface of RetroShare!'),
            'RetroShare is an Open Source Cross-platform,',
            m('br'),
            'Private and Secure Decentralized Communication Platform.',
          ]),
          m('.certificate__content', [
            m('.rsId', [
              m('p', 'This is your RetroShare ID. Copy and share with your friends!'),
              m(retroshareId, { ownCert }),
            ]),
            m('.add-friend', [
              m('h6', 'Did you receive a RetroShare ID from your friend ?'),
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
            m('.webhelp-container', [m('h6', 'Do you need help with RetroShare ?'), m(webhelp)]),
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
