const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');

const retrosemitext = () => {
  return {
    view() {
      return m(
        '.retrotext',
        {
          style: 'font-weight:500;font-size:2.4rem',
        },
        [
          m(
            'span',
            {
              style: 'color: #3ba4d7',
            },
            'RETRO'
          ),
          'SHARE',
        ]
      );
    },
  };
};
const retroshareText = () => {
  return {
    view() {
      return m('.retroshareText', [m(retrosemitext), m('b', 'secure connection for everyone')]);
    },
  };
};

const logo = () => {
  return {
    view() {
      return m('.logo', [
        m('img.logo[width=20%][height=10%]', {
          src: '../data/retroshare.svg',
          alt: 'retroshare_icon',
        }),
        m(retroshareText),
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
        [
          m('i.fas .fa-globe-europe', { style: 'color:green' }),
          m('p', { style: 'border-width:1px' }, 'Open Web Help'),
        ]
      );
    },
  };
};
const ConfirmCopied = () => {
  return {
    view: () => [
      m('h3', 'Copy to Clipboard'),
      m('hr'),
      m(
        'p',
        'Your Retroshare ID is copied to Clipboard, paste and send it to your friend via email or some other way'
      ),
      m('button', {}, 'Ok'),
    ],
  };
};

const retroshareId = () => {
  return {
    view(v) {
      return m('.retroshareID', [
        m('i.fas .fa-copy', {
          style: 'color: #3ba4d7;margin-right:3px',
          onclick: () => {
            document.getElementById('retroId').select();
            document.execCommand('copy');
            widget.popupMessage(m(ConfirmCopied));
          },
        }),

        m(
          'textarea[readonly] .textArea',
          {
            id: 'retroId',
            rows: 1,
            cols: v.attrs.ownCert.substring(31).length + 2,
            placeholder: 'certificate',
          },
          v.attrs.ownCert.substring(31)
        ),
        m('i.fas .fa-share-alt', { style: 'color: #3ba4d7' }),
      ]);
    },
  };
};

const Certificate = () => {
  let ownCert = '';
  function loadOwnCert() {
    rs.rsJsonApiRequest(
      '/rsPeers/GetShortInvite',
      { formatRadix: true },
      (data) => (ownCert = data.invite)
    );
  }

  return {
    oninit() {
      // Load long cert by default
      loadOwnCert();
    },

    view() {
      return m('.certificate ', [
        m(logo),
        m(
          'p',
          {
            style: 'margin-top:25px;font-size:1.1rem;font-weight:500;',
          },
          'Open Source cross-platform,'
        ),
        m(
          'p',
          {
            style: 'margin:0;padding:0; margin-top:5px;font-size:1.1rem;',
          },
          'private and secure decentralized communication platform'
        ),
        m(
          'p',
          {
            style: 'margin-top:80px;color: #3ba4d7;font-size:1.1rem;font-weight:600;',
          },
          'This is your Retroshare ID. Copy and share with your friends!'
        ),
        m(retroshareId, { ownCert }),
        m(
          'p',
          {
            style: 'margin-bottom:5px;margin-top:40px;font-size:1.1rem',
          },
          'Did you receive a Retroshare ID from your friend ?'
        ),
        m(
          'button',
          {
            onclick: () => {
              widget.popupMessage(m(AddFriend));
            },
          },
          'Add Friend'
        ),
        m(
          'p',
          {
            style: 'margin-bottom:5px;margin-top:40px;font-size:1.1rem',
          },
          'Do you need help with Retoshare ?'
        ),

        m(webhelp),
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
    view: () => m('.tab-page ', [m(Certificate)]),
  };
};

module.exports = Layout;
