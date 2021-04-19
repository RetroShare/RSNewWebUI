const m = require('mithril');
const rs = require('rswebui');
const peopleUtil = require('people/people_util');

const contactInfo = () => {
  let details = {};

  let avatarURI = {
    view: () => [],
  };

  return {
    oninit: (v) =>
      rs.rsJsonApiRequest(
        '/rsIdentity/getIdDetails',
        {
          id: v.attrs.id.mGroupId,
        },
        (data) => {
          details = data.details;
          // Creating URI during fetch because `details` is uninitialized
          // during view run, due to request being async.
          avatarURI = peopleUtil.createAvatarURI(data.details.mAvatar);
        }
      ),
    view: (v) =>
      m(
        '.identity',
        {
          key: details.mId,
          style: 'display:' + (v.attrs.id.isSearched ? 'block' : 'none'),
        },
        [
          m('h4', details.mNickname),
          m(avatarURI),
          m('.details', [
            m('p', 'ID:'),
            m('p', details.mId),
            m('p', 'Type:'),
            m('p', details.mFlags === 14 ? 'Signed ID' : 'Anonymous ID'),
            m('p', 'Owner node ID:'),
            m('p', details.mPgpId),
            m('p', 'Created on:'),
            m(
              'p',
              typeof details.mPublishTS === 'object'
                ? new Date(details.mPublishTS.xint64 * 1000).toLocaleString()
                : 'undefiend'
            ),
            m('p', 'Last used:'),
            m(
              'p',
              typeof details.mLastUsageTS === 'object'
                ? new Date(details.mLastUsageTS.xint64 * 1000).toLocaleDateString()
                : 'undefiend'
            ),
          ]),
          m(
            'button',
            {
              onclick: () =>
                m.route.set('/chat/:userid/createdistantchat', {
                  userid: v.attrs.id.mGroupId,
                }),
            },
            'Chat'
          ),
          m('button.red', {}, 'Mail'),
        ]
      ),
  };
};

const AllContacts = () => {
  let list;
  return {
    oninit: () => {
      list = peopleUtil.contactlist(rs.userList.users);
    },
    view: () => {
      return m('.widget', [
        m('h3', 'Contacts', m('span.counter', list.length)),
        m('hr'),
        list.map((id) => m(contactInfo, { id })),
      ]);
    },
  };
};
const SearchBar = () => {
  let searchString = '';

  return {
    view: () =>
      m('input.searchbar', {
        type: 'text',
        placeholder: 'search',
        value: searchString,
        oninput: (e) => {
          searchString = e.target.value.toLowerCase();

          rs.userList.users.map((id) => {
            if (id.mGroupName.toLowerCase().indexOf(searchString) > -1) {
              id.isSearched = true;
            } else {
              id.isSearched = false;
            }
          });
        },
      }),
  };
};

const Layout = {
  view: (vnode) => m('.tab-page', [m(SearchBar), m(AllContacts)]),
};

module.exports = {
  view: (vnode) => {
    return m(Layout);
  },
};
