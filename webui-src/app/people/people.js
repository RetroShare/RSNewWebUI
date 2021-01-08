let m = require('mithril');
let rs = require('rswebui');

let OwnIds = require('people/people_ownids');
let people_util = require('people/people_util')

const AllContacts = {
  oninit: () => {
  },
  view: () => {
    let list = people_util.sort(rs.userList.users);
    return m('.widget', [
      m('h3', 'Contacts', m('span.counter',['(',list.length,')'])), m('hr'),
      list.map((id) => m('.id', {
        key: id.mGroupId,
        title: 'ID: ' + id.mGroupId,
      }, id.mGroupName, m('i.chatInit.fa.fa-comment-medical', {
        title: 'start distant chat with ' + id.mGroupName + ' (' + id.mGroupId + ')',
        onclick: () => {
          rs.navbar.switchTo('chat');
          m.route.set('/chat/:userid/createdistantchat',{userid:id.mGroupId});
        },
      })))
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

