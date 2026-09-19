const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const NetworkData = require('network/network_data');
const icon = require('icon');
const toast = require('toast');

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

const DOCS_URL = 'https://retrosharedocs.readthedocs.io/en/latest/';

//  The head names the question, so the body is the URL you are agreeing to
//  open and the reason to read it before agreeing.
const webhelpConfirm = {
  view: () => [
    m('.web-help-confirmation__url', DOCS_URL),
    m('p.web-help-confirmation__warning',
      'Make sure this link has not been forged to drag you to a malicious website.'),
    m('.modal__foot', [
      m('button[type=button]', { onclick: () => widget.closePopupMessage() }, 'Cancel'),
      m('button.is-primary[type=button]', {
        onclick: () => {
          window.open(DOCS_URL);
          //  The documentation opens in another tab; leaving this one behind
          //  it means coming back to a dialog that has nothing left to ask.
          widget.closePopupMessage();
        },
      }, 'Open link'),
    ]),
  ],
};

const webhelp = () => {
  return {
    view() {
      //  A button, like the Add Friend one beside it -- this was a div with an
      //  onclick, which no keyboard could reach and which had to draw its own
      //  chrome instead of the product's.
      return m(
        'button.webhelp[type=button]',
        {
          onclick: () => {
            widget.popupMessage(m(webhelpConfirm), 'web-help-modal', {
              title: 'Open Web Help',
              lead: 'Do you want this link to be handled by your system?',
            });
          },
        },
        [icon('globe-europe'), 'Open Web Help']
      );
    },
  };
};

const retroshareId = () => {
  function autoResize(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  function copyIdFallback() {
    const field = document.getElementById('retroId');
    if (!field) return false;
    field.select();
    //  Deprecated, but the Clipboard API is only exposed in a secure context
    //  and the web UI is normally served over plain http on the LAN.
    return document.execCommand('copy');
  }

  async function copyId(value) {
    let copied;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        copied = true;
      } catch (_) {
        //  Denied permission or an unfocused document: fall back rather than
        //  leaving the promise rejected and no feedback at all.
        copied = copyIdFallback();
      }
    } else {
      copied = copyIdFallback();
    }
    toast.result(
      copied,
      'RetroShare ID copied. Send it to your friend however you like.',
      'Your browser refused the copy. Select the ID above and copy it by hand.'
    );
  }

  async function shareId(value) {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My RetroShare ID',
          text: value,
        });
        return;
      } catch (error) {
        // Closing the native share sheet is intentional and needs no fallback.
        if (error && error.name === 'AbortError') return;
      }
    }

    await copyId(value);
  }

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
            oncreate: (vnode) => autoResize(vnode.dom),
            onupdate: (vnode) => autoResize(vnode.dom),
          },
          v.attrs.ownCert
        ),
        icon('copy', {
          role: 'button',
          tabindex: 0,
          title: 'Copy RetroShare ID',
          'aria-label': 'Copy RetroShare ID',
          onclick: () => copyId(v.attrs.ownCert),
          onkeydown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              copyId(v.attrs.ownCert);
            }
          },
        }),
        icon('share-alt', {
          role: 'button',
          tabindex: 0,
          title: 'Share RetroShare ID',
          'aria-label': 'Share RetroShare ID',
          onclick: () => shareId(v.attrs.ownCert),
          onkeydown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              shareId(v.attrs.ownCert);
            }
          },
        }),
      ]);
    },
  };
};

function invalidCertPrompt() {
  toast.error('Check the ID and try again.');
}

async function refreshFriendLists(expectedGpgId) {
  const expected = String(expectedGpgId || '').toLowerCase();
  const retryDelays = [0, 300, 1000];

  for (const delay of retryDelays) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      await NetworkData.refreshGpgDetails({ force: true });
      if (!expected || NetworkData.gpgDetails[expected]) break;
    } catch (_) {
      // RetroShare may still be storing the imported certificate/location.
    }
  }

  rs.userList.loadUsers();
  m.redraw();
}

function confirmAddPrompt(details, cert, long) {
  const finishButton = long
    ? m('button.is-primary',
        {
          onclick: async () => {
            const res = await rs.rsJsonApiRequest('/rsPeers/loadCertificateFromString', { cert });
            if (res.body.retval) {
              NetworkData.rememberPendingFriend(details);
              await refreshFriendLists(details.gpg_id || details.pgpId);
              widget.closePopupMessage();
              toast.success('Successfully added friend.');
            } else {
              toast.error('An error occoured during adding. Friend not added.');
            }
          },
        }, [icon('check'), 'Finish'])
    : m('button.is-primary',
        {
          onclick: async () => {
            const res = await rs.rsJsonApiRequest('/rsPeers/addSslOnlyFriend', {
              sslId: details.id,
              pgpId: details.gpg_id,
              details,
            });
            if (res.body.retval) {
              NetworkData.rememberPendingFriend(details);
              await refreshFriendLists(details.gpg_id || details.pgpId);
              widget.closePopupMessage();
              toast.success('Successfully added friend.');
            } else {
              toast.error('An error occoured during adding. Friend not added.');
            }
          },
        }, [icon('check'), 'Finish']);

  widget.popupMessage(
    m('.friend-confirmation', [
      m('.friend-confirmation__details', [
        m('.friend-confirmation__row', [
          m('span.friend-confirmation__label', 'Name'),
          m('strong', details.name || 'Unknown'),
        ]),
        m('.friend-confirmation__row', [
          m('span.friend-confirmation__label', 'Location'),
          m('span', details.location || 'Unknown'),
        ]),
        m('.friend-confirmation__row', [
          m('span.friend-confirmation__label', 'Peer ID'),
          m('code', details.id || 'Unknown'),
        ]),
        m('.friend-confirmation__row', [
          m('span.friend-confirmation__label', details.isHiddenNode ? 'Hidden address' : 'Address'),
          m('span', (details.isHiddenNode ? details.hiddenNodeAddress : details.extAddr) || 'Unknown'),
        ]),
      ]),
      m('.friend-confirmation__actions', finishButton),
    ]),
    'friend-confirmation-modal',
    {
      title: 'Make Friend',
      lead: 'Confirm this is the person you want to add.',
    }
  );
}

async function addFriendFromCert(cert) {
  const retroshareId = rs.cleanRetroshareId(cert);
  if (!retroshareId) return;

  const res = await rs.rsJsonApiRequest('/rsPeers/parseShortInvite', { invite: retroshareId });

  if (res.body.retval) {
    // console.log(res.body);
    confirmAddPrompt(res.body.details, retroshareId, false);
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
  let fileName = '';

  function loadFileContents(fileListObj) {
    const file = fileListObj && fileListObj[0];
    if (!file || file.size === 0) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      certificate = e.target.result;
      fileName = file.name;
      m.redraw();
    };
    reader.readAsText(file);
  }

  return {
    view: (vnode) =>
      m('.add-friend-wizard', [
        m(
          '.cert-drop-zone',
          {
            isDragged: false,
            ondragenter: () => (vnode.state.isDragged = true),
            ondragleave: () => (vnode.state.isDragged = false),

            // Styling element when file is dragged
            class: vnode.state.isDragged ? 'cert-drop-zone--active' : '',

            ondragover: (e) => e.preventDefault(),
            ondrop: (e) => {
              vnode.state.isDragged = false;
              e.preventDefault();
              loadFileContents(e.target.files || e.dataTransfer.files);
            },
          },

          [
            m('label[for=friend-retroshare-id]', 'Friend\'s RetroShare ID'),
            m(
              'textarea#friend-retroshare-id[rows=6][placeholder="Paste the RetroShare ID here"]',
              {
                oninput: (e) => {
                  certificate = e.target.value;
                  fileName = '';
                },
                value: certificate,
              }
            ),
            m('.add-friend-wizard__divider', [m('span', 'or')]),
            m('.add-friend-wizard__file', [
              m('label.button[for=friend-id-file]', [icon('folder-open'), ' Choose ID file']),
              m('input#friend-id-file[type=file][name=certificate][accept="text/*,.rsc,.txt"]', {
                onchange: (e) => loadFileContents(e.target.files),
              }),
              m('span', fileName || 'You can also drop a text file here.'),
            ]),
            m('.add-friend-wizard__actions', [
              m('button.is-primary',
                {
                  disabled: !certificate.trim(),
                  onclick: () => addFriendFromCert(certificate),
                },
                [icon('user-plus'), ' Add friend']
              ),
            ]),
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
              m('button.is-primary',
                {
                  onclick: () => {
                    widget.popupMessage(m(AddFriend), 'add-friend-modal', {
                      title: 'Add a Friend',
                      lead: 'Paste your friend\'s RetroShare ID to connect.',
                    });
                  },
                }, [icon('user-plus'), 'Add Friend']),
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
