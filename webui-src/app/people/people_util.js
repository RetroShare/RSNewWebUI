const m = require('mithril');
const rs = require('rswebui');

function checksudo(id) {
  return id === '0000000000000000';
}

function sortUsers(list) {
  if (list !== undefined) {
    const result = [...list];
    result.sort((a, b) => a.mGroupName.localeCompare(b.mGroupName));
    return result;
  }
  return list;
}

function sortIds(list) {
  if (list !== undefined) {
    const result = [...list];
    result.sort((a, b) => rs.userList.username(a).localeCompare(rs.userList.username(b)));
    return result;
  }
  return list;
}

function ownIds(consumer = (list) => {}, onlySigned = false) {
  rs.rsJsonApiRequest('/rsIdentity/getOwnSignedIds', {}, (owns) => {
    if (onlySigned) {
      consumer(sortIds(owns.ids));
    } else {
      rs.rsJsonApiRequest('/rsIdentity/getOwnPseudonimousIds', {}, (pseudo) =>
        consumer(sortIds(pseudo.ids.concat(owns.ids)))
      );
    }
  });
}

function createAvatarURI(avatar) {
  return avatar.mData.base64 === ''
    ? {
        view: () => [],
      }
    : {
        view: () =>
          m('img.avatar', {
            src: 'data:image/png;base64,' + avatar.mData.base64,
          }),
      };
}

module.exports = {
  sortUsers,
  sortIds,
  ownIds,
  createAvatarURI,
  checksudo,
};
