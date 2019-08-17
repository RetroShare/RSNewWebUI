let m = require('mithril');
let rs = require('rswebui');


const CreateIdentity = () => {
  return {
    view: () => [
      m('i.fas.fa-user-plus'),
      m('h3', 'Create new Identity'),
      m('hr'),
      m('input[type=text][placeholder=Name]'),
      m('p', '< Not implemented yet >'),
    ]
  };
};

const EditIdentity = () => {
  return {
    view: () => [
      m('i.fas.fa-user-edit'),
      m('h3', 'Edit Identity'),
      m('hr'),
      m('input[type=text][placeholder=Name]',{}),
      m('canvas'),
      m('button', 'Save'),
    ]
  };
};

const DeleteIdentity = () => {
  return {
    view: (v) => [
      m('i.fas.fa-user-times'),
      m('h3', 'Delete Identity: ' + v.attrs.name),
      m('hr'),
      m('p',
        'Are you sure you want to delete this Identity? It cannot be undone'
      ),
      m('button', {
        onclick: () => rs.rsJsonApiRequest('/rsIdentity/deleteIdentity', {
          id: v.attrs.id
        }, () => rs.popupMessage([
          m('i.fas.fa-user-edit'),
          m('h3', 'Delete Identity: ' + v.attrs.name),
          m('hr'),
          m('p', 'Identity Deleted successfuly.'),
        ])),
      }, 'Confirm'),
    ]
  };
};

const Identity = () => {
  let details = {};
  let avatarURI = '';
  return {
    oninit: (v) =>
      rs.rsJsonApiRequest('/rsIdentity/getIdDetails', {
        id: v.attrs.id,
      }, (data) => {
        details = data.details;
        // Creating URI during fetch because `details` is uninitialized
        // during view run, due to request being async.
        avatarURI = 'data:image/png;base64,' + data.details.mAvatar.mData;
      }),
    view: (v) => m('.identity', {
      key: details.mId,
    }, [
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
        m('p', new Date(details.mPublishTS * 1000).toLocaleString()),
        m('p', 'Last used:'),
        m('p', new Date(details.mLastUsageTS * 1000).toDateString()),
      ]),
      m('button', {
        onclick: () => rs.popupMessage(m(EditIdentity, {
          details,
        }))
      }, 'Edit'),
      m('button.red', {
        onclick: () => rs.popupMessage(m(DeleteIdentity, {
          id: details.mId,
          name: details.mNickname,
        }))
      }, 'Delete'),
    ]),
  };
};

const Layout = () => {
  let ownIds = [];
  let pseudonIds = [];
  return {
    oninit: () => {
      rs.rsJsonApiRequest('/rsIdentity/getOwnSignedIds', {},
        (data) => ownIds = data.ids);
      rs.rsJsonApiRequest('/rsIdentity/getOwnPseudonimousIds', {},
        (data) => pseudonIds = data.ids);
    },
    view: () => m('.widget', [
      m('h3', 'Own Identities'),
      m('hr'),
      m('button', {
        onclick: () => rs.popupMessage(m(CreateIdentity)),
      }, 'New Identity'),
      ownIds.map(id => m(Identity, {
        id,
      })),
      pseudonIds.map(id => m(Identity, {
        id,
      })),
    ])
  };
};

module.exports = Layout;

