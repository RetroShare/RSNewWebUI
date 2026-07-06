const rs = require('rswebui');
const m = require('mithril');
const jdenticon = require('jdenticon');

function checksudo(id) {
  return id === '0000000000000000';
}

function getAvatarColor(seed) {
  let hash = 0;
  if (seed) {
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 60%)`;
}

const UserAvatar = () => ({
  view: (v) => {
    const imageURI = v.attrs.avatar;
    const identityId = v.attrs.identityId || v.attrs.id;
    const rawSize = v.attrs.size || 48;
    const sizeStr = typeof rawSize === 'number' ? `${rawSize}px` : rawSize;
    const pxSize = typeof rawSize === 'number' ? rawSize : parseInt(rawSize) || 48;
    const isSquare = !!v.attrs.isSquare;

    if (imageURI && imageURI.mData && imageURI.mData.base64 !== '') {
      return m('img.avatar', {
        src: 'data:image/png;base64,' + imageURI.mData.base64,
        style: {
          width: sizeStr,
          height: sizeStr,
          borderRadius: isSquare ? '0' : '',
        }
      });
    }

    if (identityId && identityId !== '0000000000000000') {
      const svgString = jdenticon.toSvg(identityId, pxSize);
      return m('div.jdenticon-avatar', {
        style: {
          display: 'inline-block',
          width: sizeStr,
          height: sizeStr,
          borderRadius: isSquare ? '0' : '50%',
          overflow: 'hidden',
          verticalAlign: 'middle',
          marginRight: '0.3em',
        },
        oncreate: (vnode) => {
          const svg = vnode.dom.querySelector('svg');
          if (svg) {
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.display = 'block';
          }
        }
      }, m.trust(svgString));
    }

    const seed = v.attrs.seed || v.attrs.firstLetter || '';
    const backgroundColor = getAvatarColor(seed);

    return m(
      'div.defaultAvatar',
      {
        style: {
          width: sizeStr,
          height: sizeStr,
          borderRadius: isSquare ? '0' : '50%',
          backgroundColor: backgroundColor,
        }
      },
      m('p', {
        style: {
          color: '#ffffff',
          fontWeight: '900',
          margin: '0',
          fontSize: `calc(${sizeStr} * 0.55)`,
        }
      }, v.attrs.firstLetter || '?')
    );
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
            identityId: details.mId || v.attrs.id.mGroupId,
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
