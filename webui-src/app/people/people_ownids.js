const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const peopleUtil = require('people/people_util');

const SignedIdentity = () => {
  let passphrase = '';
  let submitting = false;

  const submit = async (v) => {
    if (submitting || !passphrase) return;
    submitting = true;
    const previousIds = await peopleUtil.ownIds();
    rs.rsJsonApiRequest(
      '/rsIdentity/createIdentity',
      {
        name: v.attrs.name,
        avatar: { mData: { base64: v.attrs.avatar } },
        pseudonimous: false,
        pgpPassword: passphrase,
      },
      async (data) => {
        if (data.retval) await peopleUtil.refreshOwnIds(previousIds);
        const message = data.retval
          ? 'Successfully created identity.'
          : 'Could not create the identity. Check your profile password and try again.';
        widget.popupMessage(
          m('.signed-identity-result', [m('h3', 'Create new identity'), m('p', message)]),
          'signed-identity-modal'
        );
      }
    ).catch(() => {
      submitting = false;
      m.redraw();
    });
  };

  return {
    view: (v) => m('form.signed-identity-form', {
      onsubmit: (event) => {
        event.preventDefault();
        submit(v);
      },
    }, [
      m('.signed-identity-form__heading', [
        m('i.fas.fa-user-edit'),
        m('div', [
          m('h3', 'Create signed identity'),
          m('p', 'Enter your RetroShare profile password to link this identity.'),
        ]),
      ]),
      m('label[for=signed-identity-password]', 'Profile password'),
      m('input#signed-identity-password[type=password][placeholder=Password][autocomplete=current-password]', {
        value: passphrase,
        autofocus: true,
        oninput: (e) => (passphrase = e.target.value),
      }),
      m('button.signed-identity-form__submit[type=submit]', {
        disabled: !passphrase || submitting,
      }, submitting ? 'Creating…' : 'Create identity'),
    ]),
  };
};
const CreateIdentity = () => {
  let name = '',
    pseudonimous = false;
  let avatar;
  let avatarPreview = '';
  let avatarFileName = '';
  return {
    view: () => m('.create-identity-form', [
      m('.create-identity-form__heading', [
        m('i.fas.fa-user-plus'),
        m('div', [
          m('h3', 'Create new Identity'),
          m('p', 'Choose a name, identity type, and optional custom avatar.'),
        ]),
      ]),
      m('input.create-identity-form__name[type=text][placeholder=Identity name]', {
        value: name,
        oninput: (e) => (name = e.target.value),
      }),
      m('.create-identity-form__avatar', [
        m('.create-identity-avatar-preview', [
          avatarPreview
            ? m('img', { src: avatarPreview, alt: 'Identity avatar preview' })
            : m(peopleUtil.UserAvatar, {
              identityId: `new-identity:${name || 'identity'}`,
              firstLetter: (name || '?').slice(0, 1).toUpperCase(),
              size: 128,
              isSquare: true,
            }),
        ]),
        m('span.create-identity-form__avatar-label', 'Avatar'),
        m('input.create-identity-form__file-input[type=file][id=create-identity-avatar][accept=image/*]', {
          onchange: (e) => {
            const file = e.target.files[0];
            if (!file) return;
            avatarFileName = file.name;
            const reader = new FileReader();
            reader.onloadend = () => {
              avatarPreview = reader.result;
              avatar = avatarPreview.substring(avatarPreview.indexOf(',') + 1);
              m.redraw();
            };
            reader.readAsDataURL(file);
          },
        }),
        m('label.create-identity-form__file-button[for=create-identity-avatar]', {
          title: avatarFileName || 'Choose a custom avatar',
        }, [m('i.fas.fa-upload'), avatarPreview ? ' Change avatar' : ' Choose avatar']),
        avatarPreview && m('button.create-identity-form__remove-avatar[type=button]', {
          onclick: () => {
            avatar = undefined;
            avatarPreview = '';
            avatarFileName = '';
          },
        }, 'Use default'),
        m('small', avatarPreview ? 'Custom avatar selected.' : 'A unique default avatar is generated automatically.'),
      ]),
      m('.create-identity-form__field', [
        m('label[for=create-identity-type]', 'Identity type'),
        m('select.config-style-select[id=create-identity-type]', {
          value: String(pseudonimous),
          onchange: (e) => (pseudonimous = e.target.value === 'true'),
        }, [
          m('option[value=false]', 'Linked to your Profile'),
          m('option[value=true]', 'Pseudonymous'),
        ]),
      ]),
      m('p.create-identity-form__help',
        'You can have one or more identities. ' +
        'They are used when you chat in lobbies, ' +
        'forums and channel comments. ' +
        'They act as the destination for distant chat and ' +
        'the Retroshare distant mail system.'
      ),
      m('button.create-identity-form__submit',
        {
          disabled: !name.trim(),
          onclick: () => {
            !pseudonimous
              ? widget.popupMessage(
                m(SignedIdentity, { name: name.trim(), avatar }),
                'signed-identity-modal'
              )
              : rs.rsJsonApiRequest(
                '/rsIdentity/createIdentity',
                {
                  name: name.trim(),
                  avatar: { mData: { base64: avatar } },
                  pseudonimous,
                },
                async (data) => {
                  if (data.retval) await peopleUtil.refreshOwnIds();
                  const message = data.retval
                    ? 'Successfully created identity.'
                    : 'An error occured while creating identity.';
                  widget.popupMessage([m('h3', 'Create new Identity'), m('hr'), message]);
                }
              );
          },
        },
        'Create'
      ),
    ]),
  };
};

const SignedEditIdentity = () => {
  let passphase = '';
  return {
    view: (v) => [
      m('i.fas.fa-user-edit'),
      m('h3', 'Enter your passpharse'),
      m('hr'),

      m('input[type=password][placeholder=Passpharse]', {
        style: 'margin-top:50px;width:80%',
        oninput: (e) => {
          passphase = e.target.value;
        },
      }),
      m(
        'button',
        {
          style: 'margin-top:160px;',
          onclick: () =>
            rs.rsJsonApiRequest(
              '/rsIdentity/updateIdentity',
              {
                id: v.attrs.details.mId,
                name: v.attrs.name,
                pseudonimous: false,
                pgpPassword: passphase,
              },
              (data) => {
                const message = data.retval
                  ? 'Successfully created identity.'
                  : 'An error occured while creating identity.';
                widget.popupMessage([m('h3', 'Create new Identity'), m('hr'), message]);
              }
            ),
        },
        'Enter'
      ),
    ],
  };
};

const EditIdentity = () => {
  let name = '';
  return {
    view: (v) => [
      m('i.fas.fa-user-edit'),
      m('h3', 'Edit Identity'),
      m('hr'),
      m('input[type=text][placeholder=Name]', {
        value: name,
        oninput: (e) => {
          name = e.target.value;
        },
      }),
      m('canvas'),
      m(
        'button',
        {
          onclick: () => {
            !peopleUtil.checksudo(v.attrs.details.mPgpId)
              ? widget.popupMessage([
                m(SignedEditIdentity, {
                  name,
                  details: v.attrs.details,
                }),
              ])
              : rs.rsJsonApiRequest(
                '/rsIdentity/updateIdentity',
                {
                  id: v.attrs.details.mId,

                  name,

                  // avatar: v.attrs.details.mAvatar.mData.base64,
                  pseudonimous: true,
                },
                (data) => {
                  const message = data.retval
                    ? 'Successfully Updated identity.'
                    : 'An error occured while updating  identity.';
                  widget.popupMessage([m('h3', 'Update Identity'), m('hr'), message]);
                }
              );
          },
        },
        'Save'
      ),
    ],
  };
};

const DeleteIdentity = () => {
  return {
    view: (v) => [
      m('i.fas.fa-user-times'),
      m('h3', 'Delete Identity: ' + v.attrs.name),
      m('hr'),
      m('p', 'Are you sure you want to delete this Identity? It cannot be restore'),
      m(
        'button',
        {
          onclick: () =>
            rs.rsJsonApiRequest(
              '/rsIdentity/deleteIdentity',
              {
                id: v.attrs.id,
              },
              () => {
                widget.popupMessage([
                  m('i.fas.fa-user-edit'),
                  m('h3', 'Delete Identity: ' + v.attrs.name),
                  m('hr'),
                  m('p', 'Identity Deleted successfuly.'),
                ]);
              }
            ),
        },
        'Confirm'
      ),
    ],
  };
};

const Identity = () => {
  let details = {};

  return {
    oninit: (v) =>
      rs.rsJsonApiRequest(
        '/rsIdentity/getIdDetails',
        {
          id: v.attrs.id,
        },
        (data) => {
          details = data.details;
        }
      ),
    view: (v) =>
      m(
        '.identity',
        {
          key: details.mId,
        },
        [
          m('h4', details.mNickname),
          details.mNickname &&
          m(peopleUtil.UserAvatar, {
            avatar: details.mAvatar,
            firstLetter: details.mNickname.slice(0, 1).toUpperCase(),
            identityId: details.mId,
          }),
          m('.details', [
            m('p', 'ID:'),
            m('p', details.mId),
            m('p', 'Type:'),
            m('p', details.mFlags === 14 ? 'Signed ID' : 'Anonymous ID'),
            m('p', 'Owner node ID:'),
            m('p', details.mPgpId),
            m('p', 'Created on:'),
            m(
              'p',
              typeof details.mPublishTS === 'object'
                ? new Date(details.mPublishTS.xint64 * 1000).toLocaleString()
                : 'undefiend'
            ),
            m('p', 'Last used:'),
            m(
              'p',
              typeof details.mLastUsageTS === 'object'
                ? new Date(details.mLastUsageTS.xint64 * 1000).toLocaleDateString()
                : 'undefiend'
            ),
          ]),
          m(
            'button',
            {
              onclick: () =>
                m.route.set('/chat/:userid/createdistantchat', {
                  userid: details.mId,
                }),
            },
            'Chat'
          ),
          m(
            'button',
            {
              onclick: () =>
                widget.popupMessage(
                  m(EditIdentity, {
                    details,
                  })
                ),
            },
            'Edit'
          ),
          m(
            'button.red',
            {
              onclick: () =>
                widget.popupMessage(
                  m(DeleteIdentity, {
                    id: details.mId,
                    name: details.mNickname,
                  })
                ),
            },
            'Delete'
          ),
        ]
      ),
  };
};

const Layout = () => {
  let ownIds = [];
  let stopWatching;
  return {
    oninit: () => {
      stopWatching = peopleUtil.watchOwnIds((data) => {
        ownIds = data;
        m.redraw();
      });
    },
    onremove: () => stopWatching && stopWatching(),
    view: () =>
      m('.widget', [
        m('.widget__heading', [
          m('h3', 'Own Identities', m('span.counter', ownIds.length)),
          m(
            'button',
            {
              onclick: () => widget.popupMessage(m(CreateIdentity), 'create-identity-modal'),
            },
            'New Identity'
          ),
        ]),
        m('.widget__body', [ownIds.map((id) => m(Identity, { id }))]),
      ]),
  };
};

Layout.CreateIdentity = CreateIdentity;
Layout.EditIdentity = EditIdentity;
Layout.DeleteIdentity = DeleteIdentity;

module.exports = Layout;
