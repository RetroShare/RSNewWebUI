let m = require('mithril');
let rs = require('rswebui');
let widget = require('widgets');

const CreateIdentity = () => {
  // TODO: set user avatar
  let name = '',
    pgpPassword = '',
    pseudonimous = false;
  return {
    view: () => [
      m('i.fas.fa-user-plus'),
      m('h3', 'Create new Identity'),
      m('hr'),
      m('input[type=text][placeholder=Name]', {
        value: name,
        oninput: e => (name = e.target.value),
      }),
      'Type:',
      m(
        'select',
        {
          value: pseudonimous,
          oninput: e => (type = e.target.value),
        },
        [
          m('option[value=false]', 'Linked to your Profile'),
          m('option[value=true]', 'Pseudonymous'),
        ],
      ),
      m('br'),
      m('input[type=password][placeholder=Retroshare Passphrase]', {
        value: pgpPassword,
        oninput: e => (pgpPassword = e.target.value),
      }),
      m(
        'p',
        'You can have one or more identities. ' +
          'They are used when you chat in lobbies, ' +
          'forums and channel comments. ' +
          'They act as the destination for distant chat and ' +
          'the Retroshare distant mail system.',
      ),
      m(
        'button',
        {
          onclick: () =>
            rs.rsJsonApiRequest(
              '/rsIdentity/createIdentity',
              {
                name,
                pseudonimous,
                pgpPassword,
              },
              data => {
                const message = data.retval
                  ? 'Successfully created identity.'
                  : 'An error occured while creating identity.';
                widget.popupMessage([
                  m('h3', 'Create new Identity'),
                  m('hr'),
                  message,
                ]);
                m.redraw();
              },
            ),
        },
        'Create',
      ),
    ],
  };
};

const EditIdentity = () => {
  return {
    view: () => [
      m('i.fas.fa-user-edit'),
      m('h3', 'Edit Identity'),
      m('hr'),
      m('input[type=text][placeholder=Name]', {}),
      m('canvas'),
      m('button', 'Save'),
    ],
  };
};

const DeleteIdentity = () => {
  return {
    view: v => [
      m('i.fas.fa-user-times'),
      m('h3', 'Delete Identity: ' + v.attrs.name),
      m('hr'),
      m(
        'p',
        'Are you sure you want to delete this Identity? It cannot be undone',
      ),
      m(
        'button',
        {
          onclick: () =>
            rs.rsJsonApiRequest(
              '/rsIdentity/deleteIdentity',
              {
                id: v.attrs.id,
              },
              () =>
                widget.popupMessage([
                  m('i.fas.fa-user-edit'),
                  m('h3', 'Delete Identity: ' + v.attrs.name),
                  m('hr'),
                  m('p', 'Identity Deleted successfuly.'),
                ]),
            ),
        },
        'Confirm',
      ),
    ],
  };
};

const Identity = () => {
  let details = {};
  let avatarURI = '';
  return {
    oninit: v =>
      rs.rsJsonApiRequest(
        '/rsIdentity/getIdDetails',
        {
          id: v.attrs.id,
        },
        data => {
          details = data.details;
          // Creating URI during fetch because `details` is uninitialized
          // during view run, due to request being async.
          avatarURI = data.details.mAvatar.mData.base64 === '' ? '' : 'data:image/png;base64,' + data.details.mAvatar.mData.base64;
        },
      ),
    view: v =>
      m(
        '.identity',
        {
          key: details.mId,
        },
        [
          m('img.avatar', {
            src: avatarURI,
          }),
          m('h4', details.mNickname),
          m('.details', [
            m('p', 'ID:'),
            m('p', details.mId),
            m('p', 'Type:'),
            m('p', details.mFlags === 14 ? 'Signed ID' : 'Anonymous ID'),
            m('p', 'Owner node ID:'),
            m('p', details.mPgpId),
            m('p', 'Created on:'),
            m('p', typeof details.mPublishTS =='object' ? new Date(details.mPublishTS.xint64 * 1000).toLocaleString():'undefiend'),
            m('p', 'Last used:'),
            m('p', typeof details.mLastUsageTS =='object' ? new Date(details.mLastUsageTS.xint64 * 1000).toLocaleDateString():'undefiend'),
          ]),
          m(
            'button',
            {
              onclick: () =>
                widget.popupMessage(
                  m(EditIdentity, {
                    details,
                  }),
                ),
            },
            'Edit',
          ),
          m(
            'button.red',
            {
              onclick: () =>
                widget.popupMessage(
                  m(DeleteIdentity, {
                    id: details.mId,
                    name: details.mNickname,
                  }),
                ),
            },
            'Delete',
          ),
        ],
      ),
  };
};

const Layout = () => {
  let ownIds = [];
  let pseudonIds = [];
  return {
    oninit: () => {
      rs.rsJsonApiRequest(
        '/rsIdentity/getOwnSignedIds',
        {},
        data => (ownIds = data.ids),
      );
      rs.rsJsonApiRequest(
        '/rsIdentity/getOwnPseudonimousIds',
        {},
        data => (pseudonIds = data.ids),
      );
    },
    view: () =>
      m('.widget', [
        m('h3', 'Own Identities'),
        m('hr'),
        m(
          'button',
          {
            onclick: () => widget.popupMessage(m(CreateIdentity)),
          },
          'New Identity',
        ),
        ownIds.map(id =>
          m(Identity, {
            id,
          }),
        ),
        pseudonIds.map(id =>
          m(Identity, {
            id,
          }),
        ),
      ]),
  };
};

module.exports = Layout;
