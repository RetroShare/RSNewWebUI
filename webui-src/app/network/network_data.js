const m = require('mithril');
const rs = require('rswebui');

async function refreshIds() {
  let sslIds = [];
  await rs.rsJsonApiRequest('/rsPeers/getFriendList', {}, (data) => (sslIds = data.sslIds));
  return sslIds;
}

//  The friend list is read one location at a time -- there is no bulk
//  getPeerDetails -- and a node can have two thousand of them. Fired all at
//  once they fill the browser's six sockets for minutes on a slow link, and
//  every interactive request (opening a chat, the status poll) queues behind.
//  So: a few at a time, the list filling as answers land, and the result kept
//  for a while, since every page mount used to redo the whole sweep.
const SWEEP_CONCURRENCY = 3;
const GPG_DETAILS_TTL_MS = 5 * 60 * 1000;
let refreshInFlight = null;
let refreshedAt = 0;

function runQueued(tasks, concurrency) {
  return new Promise((resolve) => {
    let next = 0;
    let finished = 0;
    if (tasks.length === 0) {
      resolve();
      return;
    }
    const startNext = () => {
      if (next >= tasks.length) return;
      const task = tasks[next++];
      Promise.resolve()
        .then(task)
        .catch(() => {})
        .then(() => {
          finished += 1;
          if (finished >= tasks.length) resolve();
          else startNext();
        });
    };
    for (let i = 0; i < concurrency && i < tasks.length; i++) startNext();
  });
}

async function loadOnlineIds() {
  let ids = [];
  await rs.rsJsonApiRequest('/rsPeers/getOnlineList', {}, (data) => {
    if (data && data.sslIds) ids = data.sslIds;
  });
  return new Set(ids);
}

const Data = {
  gpgDetails: {},
};

//  A remembered friend is a placeholder shown while the core catches up with an
//  addSslOnlyFriend / loadCertificateFromString that has just returned. That is
//  a matter of seconds; anything older means the add did not stick, or the peer
//  has since been removed, and the placeholder has to go rather than be
//  re-injected into the friend list on every refresh, browser restarts included.
const PENDING_FRIEND_TTL_MS = 5 * 60 * 1000;

//  Keyed per node: several RetroShare profiles can be reached from the same
//  browser, and their friend lists have nothing to do with each other. Read
//  lazily, since the login is not known when this module is first imported.
let pendingFriends = null;
let pendingFriendsKey = null;

function storageKey() {
  const login = rs.loginKey || {};
  return 'rs-webui-pending-friends:' + (login.url || '') + '|' + (login.username || '');
}

function loadPendingFriends() {
  const key = storageKey();
  if (pendingFriends !== null && pendingFriendsKey === key) return pendingFriends;
  pendingFriendsKey = key;
  try {
    pendingFriends = JSON.parse(localStorage.getItem(key) || '{}');
  } catch (_) {
    pendingFriends = {};
  }
  return pendingFriends;
}

function savePendingFriends() {
  try {
    localStorage.setItem(pendingFriendsKey || storageKey(), JSON.stringify(pendingFriends || {}));
  } catch (_) {
    // The in-memory entry still works when private browsing blocks storage.
  }
}

Data.forgetPendingFriend = function (gpgId) {
  const pending = loadPendingFriends();
  const key = String(gpgId || '').toLowerCase();
  if (!key || !pending[key]) return;
  delete pending[key];
  delete Data.gpgDetails[key];
  savePendingFriends();
};

function hasValidatedFingerprint(value) {
  const fingerprint = String(value || '').replace(/\s/g, '');
  return /[1-9a-f]/i.test(fingerprint);
}

Data.rememberPendingFriend = function (peerDetails) {
  const pending = loadPendingFriends();
  const data = peerDetails || {};
  const gpgId = String(data.gpg_id || data.pgpId || '').toLowerCase();
  const sslId = String(data.id || data.sslId || '');
  if (!gpgId || !sslId) return;
  const pendingValidation = !hasValidatedFingerprint(data.fpr || data.fingerprint);

  pending[gpgId] = {
    rememberedAt: Date.now(),
    name: data.name || (pendingValidation
      ? `Profile ID ${gpgId.toUpperCase()} (Not yet validated)`
      : `Profile ID ${gpgId.toUpperCase()}`),
    fingerprint: data.fpr || '',
    isSearched: false,
    isOnline: false,
    pendingValidation,
    locations: [{
      name: data.location || 'Unknown location',
      id: sslId,
      lastSeen: data.lastConnect || 0,
      isOnline: false,
      gpg_id: gpgId,
      customState: '',
      statusValue: 0,
      statusTimestamp: 0,
      avatar: '',
      peerDetails: data,
    }],
    customState: '',
    statusValue: 0,
    statusTimestamp: 0,
    avatar: '',
  };
  Data.gpgDetails[gpgId] = pending[gpgId];
  savePendingFriends();
};

function normalizeStatusValue(value, fallback) {
  if (value && typeof value === 'object') value = value.value ?? value.status ?? value.xint32;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const names = { OFFLINE: 0, AWAY: 1, BUSY: 2, ONLINE: 3, INACTIVE: 4 };
    const match = Object.keys(names).find((name) => value.toUpperCase().includes(name));
    if (match) return names[match];
  }
  return fallback;
}

Data.getStatusPresentation = function (statusValue, isOnline = false) {
  const value = normalizeStatusValue(statusValue, isOnline ? 3 : 0);
  return {
    value,
    label: ['Offline', 'Away', 'Busy', 'Online', 'Inactive'][value] || (isOnline ? 'Online' : 'Offline'),
    color: ['#94a3b8', '#eab308', '#ef4444', '#10b981', '#f59e0b'][value] || '#94a3b8',
  };
};

//  `force` redoes the sweep whatever its age: after adding or removing a
//  friend. Otherwise a fresh enough result is only touched up with the online
//  list, one request, and concurrent callers share the sweep in flight.
Data.refreshGpgDetails = function (options = {}) {
  const force = Boolean(options && options.force);
  if (refreshInFlight) return refreshInFlight;
  if (!force && refreshedAt && Date.now() - refreshedAt < GPG_DETAILS_TTL_MS) {
    return refreshOnlineFlags();
  }
  refreshInFlight = sweepGpgDetails()
    .then(() => { refreshedAt = Date.now(); })
    .finally(() => { refreshInFlight = null; });
  return refreshInFlight;
};

async function refreshOnlineFlags() {
  const online = await loadOnlineIds();
  Object.values(Data.gpgDetails || {}).forEach((friend) => {
    let anyOnline = false;
    (friend.locations || []).forEach((loc) => {
      loc.isOnline = online.has(loc.id);
      anyOnline = anyOnline || loc.isOnline;
    });
    friend.isOnline = anyOnline;
  });
}

async function sweepGpgDetails() {
  const details = {};
  const sslIds = await refreshIds();
  const online = await loadOnlineIds();

  //  A first load shows the list as it fills rather than nothing for the
  //  whole sweep; a refresh keeps the old list on screen until it is done.
  const firstLoad = Object.keys(Data.gpgDetails || {}).length === 0;
  if (firstLoad) Data.gpgDetails = details;
  let sinceRedraw = 0;

  const addLocation = (data, isOnline, customState, statusValue, statusTimestamp) => {
    const gpgId = (data.gpg_id || '').toLowerCase();
    const loc = {
      name: data.location,
      id: data.id,
      lastSeen: data.lastConnect,
      isOnline,
      gpg_id: gpgId,
      customState,
      statusValue,
      statusTimestamp,
      avatar: '',
      peerDetails: data,
    };

    if (details[gpgId] === undefined) {
      details[gpgId] = {
        name: data.name,
        fingerprint: data.fpr || '',
        isSearched: true,
        isOnline,
        locations: [loc],
        customState,
        statusValue,
        statusTimestamp,
        avatar: '',
      };
    } else {
      details[gpgId].locations.push(loc);
      if (!details[gpgId].fingerprint && data.fpr) {
        details[gpgId].fingerprint = data.fpr;
      }
      if (!details[gpgId].customState || (isOnline && customState)) {
        details[gpgId].customState = customState;
      }
      if (isOnline || !details[gpgId].isOnline) {
        details[gpgId].statusValue = statusValue;
        details[gpgId].statusTimestamp = statusTimestamp;
      }
    }
    details[gpgId].isOnline = details[gpgId].isOnline || isOnline;

    if (firstLoad && ++sinceRedraw >= 25) {
      sinceRedraw = 0;
      m.redraw();
    }
  };

  //  Status string and status value only mean something for a peer that is
  //  connected: two requests per online peer instead of two per location.
  const tasks = sslIds.map((sslId) => async () => {
    let data = null;
    await rs.rsJsonApiRequest('/rsPeers/getPeerDetails', { sslId }, (res) => {
      if (res && res.det) data = res.det;
    });
    if (!data) return;

    const isOnline = online.has(sslId);
    let customState = '';
    let statusValue = isOnline ? 3 : 0;
    let statusTimestamp = 0;
    if (isOnline) {
      await rs.rsJsonApiRequest('/rsChats/getCustomStateString', { peer_id: sslId }, (statusData) => {
        if (statusData && statusData.retval) customState = statusData.retval;
      });
      await rs.rsJsonApiRequest('/rsStatus/getStatus', { id: sslId }, (statusData) => {
        if (statusData && statusData.retval && statusData.statusInfo) {
          statusValue = normalizeStatusValue(statusData.statusInfo.status, statusValue);
          statusTimestamp = statusData.statusInfo.time_stamp || 0;
        }
      });
    }
    addLocation(data, isOnline, customState, statusValue, statusTimestamp);
  });
  await runQueued(tasks, SWEEP_CONCURRENCY);

  const remembered = loadPendingFriends();
  let rememberedChanged = false;
  Object.entries(remembered).forEach(([gpgId, pending]) => {
    if (details[gpgId]) {
      const nativeFriend = details[gpgId];
      const isValidated = hasValidatedFingerprint(nativeFriend.fingerprint || pending.fingerprint);

      // Unvalidated short-invite peers are returned with an empty profile
      // name and an all-zero fingerprint. Keep the name parsed from the
      // RetroShare ID until the core has validated the PGP profile.
      if (!nativeFriend.name) nativeFriend.name = pending.name;
      if (isValidated) {
        delete remembered[gpgId];
        rememberedChanged = true;
      } else {
        nativeFriend.pendingValidation = true;
      }
    } else if (Date.now() - (pending.rememberedAt || 0) < PENDING_FRIEND_TTL_MS) {
      //  The core does not know this profile yet: keep showing the placeholder,
      //  but only for as long as it can plausibly still be catching up.
      details[gpgId] = pending;
    } else {
      delete remembered[gpgId];
      rememberedChanged = true;
    }
  });
  if (rememberedChanged) savePendingFriends();
  Data.gpgDetails = details;
}
module.exports = Data;
