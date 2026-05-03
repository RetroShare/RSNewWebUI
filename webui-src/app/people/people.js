const m = require('mithril');
const rs = require('rswebui');

const peopleUtil = require('people/people_util');

const AllContacts = () => {
  let viewMode = localStorage.getItem('peopleViewMode') || 'list';
  const list = peopleUtil.sortUsers(rs.userList.users);
  return {
    view: () => {
      return m('.widget', [
        m('.widget__heading', [
          m('h3', 'Contacts', m('span.counter', list.length)),
          m(peopleUtil.SearchBar),
          m('.view-toggle', [
            m('button', {
              class: viewMode === 'list' ? 'active' : '',
              onclick: () => {
                viewMode = 'list';
                localStorage.setItem('peopleViewMode', 'list');
                m.redraw();
              },
            }, m('i.fas.fa-list')),
            m('button', {
              class: viewMode === 'grid' ? 'active' : '',
              onclick: () => {
                viewMode = 'grid';
                localStorage.setItem('peopleViewMode', 'grid');
                m.redraw();
              },
            }, m('i.fas.fa-th-large')),
          ]),
        ]),
        m('.widget__body', {
          class: viewMode === 'grid' ? 'grid-view' : 'list-view',
        }, [list.map((id) => m(peopleUtil.regularcontactInfo, { id, viewMode }))]),
      ]);
    },
  };
};

module.exports = {
  view: () => {
    return m(AllContacts);
  },
};
