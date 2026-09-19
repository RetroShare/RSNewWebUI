const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const peopleUtil = require('people/people_util');
const icon = require('icon');
const toast = require('toast');

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
        //  Cleared here, not only in .catch(): a refused passphrase is a
        //  valid answer, and the button would otherwise stay on "Creating…".
        submitting = false;
        if (data && data.retval) {
          await peopleUtil.refreshOwnIds(previousIds);
          widget.closePopupMessage();
        }
        const message = data && data.retval
          ? 'Successfully created identity.'
          : 'Could not create the identity. Check your profile password and try again.';
        m.redraw();
        toast.result(Boolean(data && data.retval), message, message);
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
      m('label[for=signed-identity-password]', 'Profile password'),
      m('input#signed-identity-password[type=password][placeholder=Password][autocomplete=current-password]', {
        value: passphrase,
        autofocus: true,
        oninput: (e) => (passphrase = e.target.value),
      }),
      m('button.signed-identity-form__submit[type=submit]', {
        disabled: !passphrase || submitting,
      }, [icon('paper-plane'), submitting ? 'Creating…' : 'Create identity']),
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
        }, [icon('upload'), avatarPreview ? ' Change avatar' : ' Choose avatar']),
        avatarPreview && m('button.create-identity-form__remove-avatar[type=button]', {
          onclick: () => {
            avatar = undefined;
            avatarPreview = '';
            avatarFileName = '';
          },
        }, [icon('history'), 'Use default']),
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
      m('button.create-identity-form__submit.is-primary',
        {
          disabled: !name.trim(),
          onclick: () => {
            !pseudonimous
              ? widget.popupMessage(
                m(SignedIdentity, { name: name.trim(), avatar }),
                'signed-identity-modal',
                {
                  title: 'Create Signed Identity',
                  lead: 'Enter your RetroShare profile password to link this identity.',
                }
              )
              : rs.rsJsonApiRequest(
                '/rsIdentity/createIdentity',
                {
                  name: name.trim(),
                  avatar: { mData: { base64: avatar } },
                  pseudonimous,
                },
                async (data) => {
                  if (data.retval) {
                    await peopleUtil.refreshOwnIds();
                    widget.closePopupMessage();
                  }
                  const message = data.retval
                    ? 'Successfully created identity.'
                    : 'An error occured while creating identity.';
                  toast.result(data.retval, message, message);
                }
              );
          },
        }, [icon('plus'), 'Create']),
    ]),
  };
};

//  updateIdentity(id, name, avatar, pseudonimous, pgpPassword) takes the avatar
//  as a mandatory parameter and p3IdService assigns it unconditionally
//  (`group.mImage = avatar`). Leaving it out of the request does not mean "keep
//  the one you have", it means "replace it with nothing" -- it erases the
//  picture. So the current one is always sent back, unless the user picked
//  another.
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
      m('input.passphrase-field[type=password][placeholder=Passphrase]', {
        oninput: (e) => {
          passphrase = e.target.value;
        },
      }),
      m('button.is-primary.passphrase-submit',
        {
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
                if (data && data.retval) widget.closePopupMessage();
                const message = data && data.retval
                  ? 'Identity updated.'
                  : 'Could not update the identity. Check your profile password and try again.';
                toast.result(Boolean(data && data.retval), message, message);
              }
            ),
        }, [icon('check'), 'Enter']),
    ],
  };
};

const EditIdentity = () => {
  //  The field opens with the current name, and Save sends it as it stands:
  //  opening it empty renames the identity to nothing on an avatar-only edit.
  let name;
  let avatar;
  let avatarPreview = '';

  return {
    view: (v) => {
      const details = v.attrs.details || {};
      if (name === undefined) name = details.mNickname || details.mGroupName || '';
      const hasAvatar = Boolean(details.mAvatar && details.mAvatar.mData
        && details.mAvatar.mData.base64);

      return m('.edit-identity-form', [
        m('label.edit-identity-form__name-label[for=edit-identity-name]', 'Identity name'),
        m('input.edit-identity-form__name[type=text][placeholder=Name][id=edit-identity-name]', {
          value: name,
          oninput: (e) => {
            name = e.target.value;
          },
        }),
        m('.edit-identity-form__avatar', [
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
            hidden: true,
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
          m('label.edit-identity-form__avatar-button[for=edit-identity-avatar]',
            [icon('upload'), ' Change avatar']),
          avatarPreview && m('button.edit-identity-form__keep[type=button]', {
            onclick: () => {
              avatar = undefined;
              avatarPreview = '';
            },
          }, [icon('history'), 'Keep current']),
        ]),
        m('button.is-primary',
          {
            class: 'edit-identity-form__save',
            disabled: !String(name).trim(),
            onclick: () => {
              const trimmed = String(name).trim();
              if (!trimmed) return;

              !peopleUtil.checksudo(details.mPgpId)
                ? widget.popupMessage(
                  m(SignedEditIdentity, {
                    name: trimmed,
                    avatar,
                    details,
                  }),
                  '',
                  {
                    title: 'Confirm Your Passphrase',
                    lead: 'Enter your RetroShare profile passphrase to save this change.',
                  }
                )
                : rs.rsJsonApiRequest(
                  '/rsIdentity/updateIdentity',
                  {
                    id: details.mId,
                    name: trimmed,
                    avatar: avatarPayload(details, avatar),
                    pseudonimous: true,
                  },
                  (data) => {
                    if (data && data.retval) widget.closePopupMessage();
                    const message = data && data.retval
                      ? 'Identity updated.'
                      : 'Could not update the identity.';
                    toast.result(Boolean(data && data.retval), message, message);
                  }
                );
            },
          }, [icon('check'), 'Save']),
      ]);
    },
  };
};

const DeleteIdentity = ({ id, name }) => widget.confirmMessage({
  title: `Delete ${name}?`,
  message: 'This identity cannot be restored once deleted.',
  confirmLabel: 'Delete identity',
  danger: true,
  onConfirm: () => rs.rsJsonApiRequest(
    '/rsIdentity/deleteIdentity',
    { id },
    async (data) => {
      //  watchOwnIds only listens for the event refreshOwnIds emits, so
      //  without this the deleted identity stays in the list. The answer
      //  has to be read too: a refused delete must not announce success.
      const done = Boolean(data && data.retval);
      if (done) {
        peopleUtil.invalidateOwnIds();
        await peopleUtil.refreshOwnIds();
      }
      toast.result(done, `Deleted ${name}`, 'The core refused to delete this identity.');
      m.redraw();
    }
  ),
});

//  Only these three are reachable: the details pane and the sidebar open them
//  as modals.
module.exports = { CreateIdentity, EditIdentity, DeleteIdentity };
