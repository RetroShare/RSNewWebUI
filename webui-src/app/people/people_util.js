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
          minWidth: sizeStr,
          minHeight: sizeStr,
          flexShrink: '0',
          aspectRatio: '1',
          objectFit: 'cover',
          borderRadius: isSquare ? '0' : '50%',
        }
      });
    }

    if (identityId && identityId !== '0000000000000000') {
      const svgString = jdenticon.toSvg(identityId, pxSize);
      return m('div.jdenticon-avatar', {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: sizeStr,
          height: sizeStr,
          minWidth: sizeStr,
          minHeight: sizeStr,
          flexShrink: '0',
          aspectRatio: '1',
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
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: sizeStr,
          height: sizeStr,
          minWidth: sizeStr,
          minHeight: sizeStr,
          flexShrink: '0',
          aspectRatio: '1',
          borderRadius: isSquare ? '0' : '50%',
          backgroundColor,
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

const identityDetailsCache = new Map();

function loadIdentityDetails(id) {
  if (!id || id === '0000000000000000') return Promise.resolve(null);
  const cached = identityDetailsCache.get(id);
  if (cached && Object.prototype.hasOwnProperty.call(cached, 'details')) {
    return Promise.resolve(cached.details);
  }
  if (cached && cached.promise) return cached.promise;

  const promise = rs.rsJsonApiRequest('/rsIdentity/getIdDetails', { id })
    .then((response) => {
      const details = response && response.body ? response.body.details : null;
      identityDetailsCache.set(id, { details });
      m.redraw();
      return details;
    })
    .catch(() => {
      identityDetailsCache.set(id, { details: null });
      return null;
    });

  identityDetailsCache.set(id, { promise });
  return promise;
}

const IdentityAvatar = () => ({
  oninit: (vnode) => loadIdentityDetails(vnode.attrs.identityId),
  onbeforeupdate: (vnode, old) => {
    if (vnode.attrs.identityId !== old.attrs.identityId) {
      loadIdentityDetails(vnode.attrs.identityId);
    }
  },
  view: (vnode) => {
    const id = vnode.attrs.identityId;
    const cached = identityDetailsCache.get(id);
    const details = cached && cached.details;
    const name = vnode.attrs.name || (details && details.mNickname) || '';

    return m(UserAvatar, {
      avatar: details && details.mAvatar,
      identityId: id,
      firstLetter: name.slice(0, 1).toUpperCase(),
      seed: id || name,
      size: vnode.attrs.size || 38,
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

    result.sort((a, b) => {
      const nameA = rs.userList.username(a) || String(a);
      const nameB = rs.userList.username(b) || String(b);
      return nameA.localeCompare(nameB);
    });
    return result;
  }
  return list;
}

const OWN_IDS_CACHE_MS = 30000;
const ownIdsCache = {
  all: { ids: null, loadedAt: 0, promise: null },
  signed: { ids: null, loadedAt: 0, promise: null },
};
const OWN_IDS_CHANGED_EVENT = 'rs-own-identities-changed';
const OWN_ID_REFRESH_DELAYS = [0, 200, 500, 1000, 2000, 4000];

function isUsableIdentityId(id) {
  const value = String(id || '');
  return value !== '' && !/^0+$/.test(value);
}

function normalizeOwnIds(ids) {
  return sortIds(Array.from(new Set((ids || []).filter(isUsableIdentityId))));
}

function invalidateOwnIds() {
  Object.values(ownIdsCache).forEach((cache) => {
    cache.ids = null;
    cache.loadedAt = 0;
  });
}

async function refreshOwnIds(previousIds = null) {
  const previous = new Set(normalizeOwnIds(previousIds || []));
  const waitForNewIdentity = previousIds !== null;
  let ids = [];

  for (const delay of OWN_ID_REFRESH_DELAYS) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    ids = normalizeOwnIds(await loadOwnIds(false));
    if (!waitForNewIdentity || ids.some((id) => !previous.has(id))) break;
  }

  ownIdsCache.all.ids = ids;
  ownIdsCache.all.loadedAt = Date.now();
  ownIdsCache.signed.ids = null;
  ownIdsCache.signed.loadedAt = 0;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OWN_IDS_CHANGED_EVENT, { detail: { ids } }));
  }
  return ids;
}

function watchOwnIds(consumer) {
  const listener = (event) => consumer([...(event.detail.ids || [])]);
  if (typeof window !== 'undefined') window.addEventListener(OWN_IDS_CHANGED_EVENT, listener);
  ownIds(consumer);
  return () => {
    if (typeof window !== 'undefined') window.removeEventListener(OWN_IDS_CHANGED_EVENT, listener);
  };
}

async function loadOwnIds(onlySigned) {
  if (onlySigned) {
    const response = await rs.rsJsonApiRequest('/rsIdentity/getOwnSignedIds', {});
    return (response && response.body && response.body.ids) || [];
  }

  // The complete list is these two calls put together. /rsIdentity/getOwnIds
  // is not an alternative to them: it is the deprecated one, it carries no
  // @jsonapi annotation, and the core answers 404.
  const [signedResponse, pseudonymousResponse] = await Promise.all([
    rs.rsJsonApiRequest('/rsIdentity/getOwnSignedIds', {}),
    rs.rsJsonApiRequest('/rsIdentity/getOwnPseudonimousIds', {}),
  ]);
  const signedIds = (signedResponse && signedResponse.body && signedResponse.body.ids) || [];
  const pseudonymousIds = (pseudonymousResponse && pseudonymousResponse.body && pseudonymousResponse.body.ids) || [];
  return pseudonymousIds.concat(signedIds);
}

async function ownIds(consumer = () => { }, onlySigned = false) {
  const cache = onlySigned ? ownIdsCache.signed : ownIdsCache.all;
  try {
    if (cache.ids && Date.now() - cache.loadedAt < OWN_IDS_CACHE_MS) {
      const cachedIds = [...cache.ids];
      consumer(cachedIds);
      return cachedIds;
    }

    if (!cache.promise) {
      cache.promise = loadOwnIds(onlySigned)
        .then((ids) => {
          cache.ids = normalizeOwnIds(ids);
          cache.loadedAt = Date.now();
          return cache.ids;
        })
        .finally(() => { cache.promise = null; });
    }

    const ids = [...await cache.promise];
    consumer(ids);
    return ids;
  } catch (error) {
    console.warn('Unable to load own identities', error);
    consumer([]);
    return [];
  }
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
  invalidateOwnIds,
  refreshOwnIds,
  watchOwnIds,
  checksudo,
  UserAvatar,
  IdentityAvatar,
  contactlist,
  SearchBar,
  regularcontactInfo,
  isUsableIdentityId,
};
