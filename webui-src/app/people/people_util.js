const rs = require('rswebui');
const m = require('mithril');

function checksudo(id) {
  return id === '0000000000000000';
}

const UserAvatar = () => ({
  view: (v) => {
    const imageURI = v.attrs.avatar;
    return imageURI === undefined || imageURI.mData.base64 === ''
      ? m(
        'div.defaultAvatar',
        {
          // image isn't getting loaded
          // ? m('img.defaultAvatar', {
          //   src: '../data/user.png'
          // })
        },
        m('p', v.attrs.firstLetter)
      )
      : m('img.avatar', {
        src: 'data:image/png;base64,' + imageURI.mData.base64,
      });
  },
});

function contactlist(list) {
  if (list === undefined) return [];
  return list.filter((id) => {
    id.isSearched = true;
    const entry = rs.userList.userMap[id.mGroupId];
    return entry && entry.isContact;
  });
}

function sortUsers(list) {
  if (list !== undefined) {
    const result = [];
    list.map((id) => {
      id.isSearched = true;
      result.push(id);
    });

    result.sort((a, b) => a.mGroupName.localeCompare(b.mGroupName));
    return result;
  }
  return list;
}

function sortIds(list) {
  if (list !== undefined) {
    const result = [...list];

    result.sort((a, b) => rs.userList.username(a).localeCompare(rs.userList.username(b)));
    return result;
  }
  return list;
}

async function ownIds(consumer = () => { }, onlySigned = false) {
  await rs.rsJsonApiRequest('/rsIdentity/getOwnSignedIds', {}, (owns) => {
    if (onlySigned) {
      consumer(sortIds(owns.ids));
    } else {
      rs.rsJsonApiRequest('/rsIdentity/getOwnPseudonimousIds', {}, (pseudo) => {
        if (pseudo.ids) consumer(sortIds(pseudo.ids.concat(owns.ids)));
      });
    }
  });
}
const SearchBar = () => {
  let searchString = '';

  return {
    view: () =>
      m('.searchbar-container', [
        m('input.searchbar', {
          type: 'text',
          placeholder: 'search',
          value: searchString,
          oninput: (e) => {
            searchString = e.target.value.toLowerCase();
            rs.userList.users.map((id) => {
              id.isSearched = searchString === '' || id.mGroupName.toLowerCase().indexOf(searchString) > -1;
            });
          },
        }),
        m('button.searchbar-clear', {
          title: 'Clear search',
          style: 'display: ' + (searchString ? 'inline-block' : 'none'),
          onclick: () => {
            searchString = '';
            rs.userList.users.map((id) => { id.isSearched = true; });
            m.redraw();
          },
        }, m('i.fas.fa-times')),
      ]),
  };
};

const regularcontactInfo = () => {
  let details = {};

  return {
    oninit: (v) =>
      rs.rsJsonApiRequest(
        '/rsIdentity/getIdDetails',
        {
          id: v.attrs.id.mGroupId,
        },
        (data) => {
          details = data.details;
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
          details.mNickname &&
          m(UserAvatar, {
            avatar: details.mAvatar,
            firstLetter: details.mNickname.slice(0, 1).toUpperCase(),
          }),
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
          m('.identity-actions', [
            m(
              'button',
              {
                onclick: () =>
                  m.route.set('/chat/:userid/createdistantchat', {
                    userid: v.attrs.id.mGroupId,
                  }),
              },
              m('i.fas.fa-comment')
            ),
            m('button.red', {}, m('i.fas.fa-envelope')),
          ]),
        ]
      ),
  };
};

module.exports = {
  sortUsers,
  sortIds,
  ownIds,
  checksudo,
  UserAvatar,
  contactlist,
  SearchBar,
  regularcontactInfo,
};
