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
        //  Only .catch() used to clear this, and a refused passphrase is a
        //  perfectly valid answer: the button stayed on "Creating…" for good.
        submitting = false;
        if (data && data.retval) await peopleUtil.refreshOwnIds(previousIds);
        const message = data && data.retval
          ? 'Successfully created identity.'
          : 'Could not create the identity. Check your profile password and try again.';
        m.redraw();
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

//  updateIdentity(id, name, avatar, pseudonimous, pgpPassword) takes the avatar
//  as a mandatory parameter and p3IdService assigns it unconditionally
//  (`group.mImage = avatar`). Leaving it out of the request does not mean "keep
//  the one you have", it means "replace it with nothing": every edit used to
//  erase the picture. So the current one is always sent back, unless the user
//  picked another.
function avatarPayload(details, replacement) {
  if (replacement !== undefined) return { mData: { base64: replacement } };
  const current = details && details.mAvatar && details.mAvatar.mData
    ? details.mAvatar.mData.base64 || ''
    : '';
  return { mData: { base64: current } };
}

const SignedEditIdentity = () => {
  let passphrase = '';
  return {
    view: (v) => [
      m('i.fas.fa-user-edit'),
      m('h3', 'Enter your profile passphrase'),
      m('hr'),

      m('input[type=password][placeholder=Passphrase]', {
        style: 'margin-top:50px;width:80%',
        oninput: (e) => {
          passphrase = e.target.value;
        },
      }),
      m(
        'button',
        {
          style: 'margin-top:160px;',
          disabled: !passphrase,
          onclick: () =>
            rs.rsJsonApiRequest(
              '/rsIdentity/updateIdentity',
              {
                id: v.attrs.details.mId,
                name: v.attrs.name,
                avatar: avatarPayload(v.attrs.details, v.attrs.avatar),
                pseudonimous: false,
                pgpPassword: passphrase,
              },
              (data) => {
                const message = data && data.retval
                  ? 'Identity updated.'
                  : 'Could not update the identity. Check your profile password and try again.';
                widget.popupMessage([m('h3', 'Update Identity'), m('hr'), message]);
              }
            ),
        },
        'Enter'
      ),
    ],
  };
};

const EditIdentity = () => {
  //  The field used to open empty and Save sent it as it stood, so an edit
  //  meant for the avatar alone renamed the identity to nothing.
  let name;
  let avatar;
  let avatarPreview = '';

  return {
    view: (v) => {
      const details = v.attrs.details || {};
      if (name === undefined) name = details.mNickname || details.mGroupName || '';
      const hasAvatar = Boolean(details.mAvatar && details.mAvatar.mData
        && details.mAvatar.mData.base64);

      return [
        m('i.fas.fa-user-edit'),
        m('h3', 'Edit Identity'),
        m('hr'),
        m('input[type=text][placeholder=Name]', {
          value: name,
          oninput: (e) => {
            name = e.target.value;
          },
        }),
        m('.edit-identity-avatar', { style: 'display:flex;align-items:center;gap:0.75rem;margin:0.75rem 0;' }, [
          m(peopleUtil.UserAvatar, {
            avatar: avatarPreview
              ? { mData: { base64: avatarPreview.substring(avatarPreview.indexOf(',') + 1) } }
              : (hasAvatar ? details.mAvatar : null),
            identityId: details.mId,
            firstLetter: (name || '?').slice(0, 1).toUpperCase(),
            size: 64,
            isSquare: true,
          }),
          m('input[type=file][accept=image/*][id=edit-identity-avatar]', {
            style: 'display:none;',
            onchange: (e) => {
              const file = e.target.files && e.target.files[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onloadend = () => {
                avatarPreview = reader.result;
                avatar = avatarPreview.substring(avatarPreview.indexOf(',') + 1);
                m.redraw();
              };
              reader.readAsDataURL(file);
            },
          }),
          m('label.btn[for=edit-identity-avatar]', { style: 'cursor:pointer;' },
            [m('i.fas.fa-upload'), ' Change avatar']),
          avatarPreview && m('button.btn[type=button]', {
            onclick: () => {
              avatar = undefined;
              avatarPreview = '';
            },
          }, 'Keep current'),
        ]),
        m(
          'button',
          {
            disabled: !String(name).trim(),
            onclick: () => {
              const trimmed = String(name).trim();
              if (!trimmed) return;

              !peopleUtil.checksudo(details.mPgpId)
                ? widget.popupMessage([
                  m(SignedEditIdentity, {
                    name: trimmed,
                    avatar,
                    details,
                  }),
                ])
                : rs.rsJsonApiRequest(
                  '/rsIdentity/updateIdentity',
                  {
                    id: details.mId,
                    name: trimmed,
                    avatar: avatarPayload(details, avatar),
                    pseudonimous: true,
                  },
                  (data) => {
                    const message = data && data.retval
                      ? 'Identity updated.'
                      : 'Could not update the identity.';
                    widget.popupMessage([m('h3', 'Update Identity'), m('hr'), message]);
                  }
                );
            },
          },
          'Save'
        ),
      ];
    },
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
              async (data) => {
                //  Nothing used to refresh the own identities after this, and
                //  watchOwnIds only listens for the event refreshOwnIds emits:
                //  the deleted identity stayed in the list. The answer was not
                //  read either -- a refused delete still announced success.
                const done = Boolean(data && data.retval);
                if (done) {
                  peopleUtil.invalidateOwnIds();
                  await peopleUtil.refreshOwnIds();
                }
                widget.popupMessage([
                  m('i.fas.fa-user-times'),
                  m('h3', 'Delete Identity: ' + v.attrs.name),
                  m('hr'),
                  m('p', done
                    ? 'Identity deleted.'
                    : 'The core refused to delete this identity.'),
                ]);
                m.redraw();
              }
            ),
        },
        'Confirm'
      ),
    ],
  };
};

//  Only these three are reachable: the details pane and the sidebar open them
//  as modals. The "Own Identities" widget that used to be exported here, and
//  the Identity card it rendered, were routed nowhere.
module.exports = { CreateIdentity, EditIdentity, DeleteIdentity };
