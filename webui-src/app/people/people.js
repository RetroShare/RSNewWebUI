let m = require('mithril');
let rs = require('rswebui');

let OwnIds = require('people/people_ownids');

const AllContacts = {
  oninit: () => {
  },
  view: () => {
    let list = [...rs.userList.users];
    list.sort((a,b) => a.mGroupName.localeCompare(b.mGroupName));
    return m('.widget', [
      m('h3', 'Contacts'), m('hr'),
      list.map((id) => m('.id', {
        key: id.mGroupId
      }, id.mGroupName))
    ]);
  },
};

const Layout = {
  view: vnode => m('.tab-page', [
    m(OwnIds),
    m(AllContacts),
  ])
};

module.exports = {
  view: (vnode) => {
    return m(Layout);
  },
};

