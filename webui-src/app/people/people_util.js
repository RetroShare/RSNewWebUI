let m = require('mithril');
let rs = require('rswebui');


function getInfo(id) {
  let name = '';
  let imageURI = '';
  rs.rsJsonApiRequest('/rsIdentity/getIdentitiesInfo', {
    id
  }, function(data) {
      console.log('data: ', data.idsInfo);
    //name = data.details.mNickname
    //imageURI = data.details.mAvatar.mData;
  });
  //return m('.profile-detail', [
    //m('img[src=data:image/png;base64,' + imageURI + ']'),
  //  name//,
  //]);
    return 'name';
}

module.exports = {
  getInfo
};

