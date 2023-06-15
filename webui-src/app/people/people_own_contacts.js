const m = require('mithril');
const rs = require('rswebui');
const peopleUtil = require('people/people_util');

const MyContacts = () => {
  const list = peopleUtil.contactlist(rs.userList.users);
  return {
    view: () => {
      return m('.widget', [
        m('.widget__heading', [
          m('h3', 'MyContacts', m('span.counter', list.length)),
          m(peopleUtil.SearchBar),
        ]),
        m('hr'),
        list.map((id) => m(peopleUtil.regularcontactInfo, { id })),
      ]);
    },
  };
};

module.exports = {
  view: () => {
    return m(MyContacts);
  },
};
