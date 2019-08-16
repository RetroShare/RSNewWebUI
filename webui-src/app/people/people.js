let m = require('mithril');
let rs = require('rswebui');

let OwnIds = require('people_ownids');

const Contacts = {
  list: [],
  loadList() {
    rs.rsJsonApiRequest('/rsIdentity/getIdentitiesSummaries', {},
      (data) => Contacts.list = data.ids);
  },
};

const AllContacts = () => {
  let list = [];
  return {
    oninit: () => Contacts.loadList(),
    view: () => m('.widget', [
      m('h3', 'Contacts'),
      m('hr'),
      Contacts.list.map((id) => m('.id', {
        key: id.mGroupId
      }, id.mGroupName))
    ]),
  };
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

