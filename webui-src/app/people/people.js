const m = require('mithril');
const rs = require('rswebui');

const peopleUtil = require('people/people_util');

const AllContacts = () => {
  const list = peopleUtil.sortUsers(rs.userList.users);
  return {
    view: () => {
      return m('.widget', [
        m('h3', 'Contacts', m('span.counter', list.length)),
        m('hr'),
        list.map((id) => m(peopleUtil.regularcontactInfo, { id })),
      ]);
    },
  };
};

const Layout = {
  view: (vnode) => m('.tab-page', [m(peopleUtil.SearchBar), m(AllContacts)]),
};

module.exports = {
  view: (vnode) => {
    return m(Layout);
  },
};
