const m = require('mithril');
const rs = require('rswebui');

const peopleOwnIds = require('people/people_ownids');
const peopleUtil = require('people/people_util');

const AllContacts = {
  oninit: () => {},
  view: () => {
    const list = peopleUtil.sortUsers(rs.userList.users);
    return m('.widget', [
      m('h3', 'Contacts', m('span.counter', list.length)),
      m('hr'),
      list.map((id) =>
        m(
          '.id',
          {
            key: id.mGroupId,
            title: 'ID: ' + id.mGroupId,
          },
          id.mGroupName,
          m('i.chatInit.fa.fa-comment-medical', {
            title: 'start distant chat with ' + id.mGroupName + ' (' + id.mGroupId + ')',
            onclick: () => {
              m.route.set('/chat/:userid/createdistantchat', { userid: id.mGroupId });
            },
          })
        )
      ),
    ]);
  },
};

const Layout = {
  view: (vnode) => m('.tab-page', [m(peopleOwnIds), m(AllContacts)]),
};

module.exports = {
  view: (vnode) => {
    return m(Layout);
  },
};
