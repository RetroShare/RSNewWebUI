let m = require("mithril");
let rs = require("rswebui");

function getInfo(id) {
  let name = "";
  let imageURI = "";
  rs.rsJsonApiRequest(
    "/rsIdentity/getIdentitiesInfo",
    {
      id,
    },
    function (data) {
      console.log("data: ", data.idsInfo);
      //name = data.details.mNickname
      //imageURI = data.details.mAvatar.mData;
    }
  );
  //return m('.profile-detail', [
  //m('img[src=data:image/png;base64,' + imageURI + ']'),
  //  name//,
  //]);
  return "name";
}

function checksudo(id) {
  return id === "0000000000000000";
}

function sortUsers(list) {
  if (list !== undefined) {
    let result = [...list];
    result.sort((a, b) => a.mGroupName.localeCompare(b.mGroupName));
    return result;
  }
  return list;
}

function sortIds(list) {
  if (list !== undefined) {
    let result = [...list];
    result.sort((a, b) =>
      rs.userList.username(a).localeCompare(rs.userList.username(b))
    );
    return result;
  }
  return list;
}

function ownIds(consumer = (list) => {}, onlySigned = false) {
  rs.rsJsonApiRequest("/rsIdentity/getOwnSignedIds", {}, (owns) => {
    if (onlySigned) {
      consumer(sortIds(owns.ids));
    } else {
      rs.rsJsonApiRequest("/rsIdentity/getOwnPseudonimousIds", {}, (pseudo) =>
        consumer(sortIds(pseudo.ids.concat(owns.ids)))
      );
    }
  });
}

function createAvatarURI(avatar) {
  return avatar.mData.base64 === ""
    ? {
        view: () => [],
      }
    : {
        view: () =>
          m("img.avatar", {
            src: "data:image/png;base64," + avatar.mData.base64,
          }),
      };
}

module.exports = {
  getInfo,
  sortUsers,
  sortIds,
  ownIds,
  createAvatarURI,
  checksudo
};
