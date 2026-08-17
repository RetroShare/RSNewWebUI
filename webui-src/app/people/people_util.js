const rs = require('rswebui');
const m = require('mithril');
const jdenticon = require('jdenticon');

function checksudo(id) {
  return id === '0000000000000000';
}

//  Distant chat history is not stored under the peer's GXS id but under the
//  *tunnel* id, and the core builds that one as
//  RsGxsTunnelId(sha1(sorted(own_id || peer_id))) truncated to 16 bytes
//  (p3GxsTunnelService::makeGxsTunnelId). Asking `/rsHistory/getMessages` for a
//  GXS id therefore always answers an empty list. There is no API to derive it
//  remotely and no crypto.subtle outside a secure context -- the web UI is
//  served over plain HTTP on the LAN -- so the digest is computed here.
function sha1Hex(bytes) {
  const ml = bytes.length;
  const withPad = bytes.slice();
  withPad.push(0x80);
  while (withPad.length % 64 !== 56) withPad.push(0);
  const bits = ml * 8;
  //  Ids are 32 bytes at most, so the high word of the length is always zero.
  withPad.push(0, 0, 0, 0);
  withPad.push((bits >>> 24) & 0xff, (bits >>> 16) & 0xff, (bits >>> 8) & 0xff, bits & 0xff);

  let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
  const w = new Array(80);
  const rotl = (v, n) => ((v << n) | (v >>> (32 - n))) >>> 0;

  for (let i = 0; i < withPad.length; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] = ((withPad[i + 4 * j] << 24) | (withPad[i + 4 * j + 1] << 16)
        | (withPad[i + 4 * j + 2] << 8) | withPad[i + 4 * j + 3]) >>> 0;
    }
    for (let j = 16; j < 80; j++) w[j] = rotl(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);

    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let j = 0; j < 80; j++) {
      let f, k;
      if (j < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
      else if (j < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
      else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
      else { f = b ^ c ^ d; k = 0xCA62C1D6; }
      const t = (rotl(a, 5) + f + e + k + w[j]) >>> 0;
      e = d; d = c; c = rotl(b, 30); b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }

  return [h0, h1, h2, h3, h4].map((v) => ('0000000' + v.toString(16)).slice(-8)).join('');
}

function hexToBytes(hex) {
  const out = [];
  for (let i = 0; i + 1 < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
  return out;
}

//  Both ids are sorted first, so the two ends of a conversation compute the
//  same tunnel. The core sorts the raw bytes; on equal length lowercase hex,
//  a plain string comparison gives the same order.
function distantChatPid(ownGxsId, peerGxsId) {
  const own = String(ownGxsId || '').toLowerCase();
  const peer = String(peerGxsId || '').toLowerCase();
  if (own.length !== 32 || peer.length !== 32) return null;
  const joined = own < peer ? own + peer : peer + own;
  return sha1Hex(hexToBytes(joined)).slice(0, 32);
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
  distantChatPid,
};
