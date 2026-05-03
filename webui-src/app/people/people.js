const m = require('mithril');
const rs = require('rswebui');

const peopleUtil = require('people/people_util');

const AllContacts = () => {
  const list = peopleUtil.sortUsers(rs.userList.users);
  let visibleCount = 30;
  const pageSize = 30;

  const loadMore = () => {
    visibleCount = Math.min(visibleCount + pageSize, list.length);
    m.redraw();
  };

  return {
    view: () => {
      return m('.widget', [
        m('.widget__heading', [
          m('h3', 'Contacts', m('span.counter', list.length)),
          m(peopleUtil.SearchBar),
        ]),
        m('.widget__body', [
          list.slice(0, visibleCount).map((id) => m(peopleUtil.regularcontactInfo, { id })),
          visibleCount < list.length &&
            m('button', { onclick: () => loadMore(), style: { marginTop: '1rem' } }, 'Load More (' + (list.length - visibleCount) + ' remaining)'),
        ]),
      ]);
    },
  };
};

module.exports = {
  view: () => {
    return m(AllContacts);
  },
};