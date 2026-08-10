const rs = require('rswebui');

async function refreshIds() {
  let sslIds = [];
  await rs.rsJsonApiRequest('/rsPeers/getFriendList', {}, (data) => (sslIds = data.sslIds));
  return sslIds;
}

async function loadSslDetails() {
  const sslDetails = [];
  const sslIds = await refreshIds();
  await Promise.all(
    sslIds.map((sslId) =>
      rs.rsJsonApiRequest('/rsPeers/getPeerDetails', { sslId }, (data) => sslDetails.push(data.det))
    )
  );
  return sslDetails;
}

const Data = {
  gpgDetails: {},
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

Data.refreshGpgDetails = async function () {
  const details = {};
  const sslDetails = await loadSslDetails();
  await Promise.all(
    sslDetails.map((data) => {
      let isOnline = false;
      return rs
        .rsJsonApiRequest(
          '/rsPeers/isOnline',
          { sslId: data.id },
          (stat) => (isOnline = stat.retval)
        )
        .then(() => {
          let customState = '';
          let statusValue = isOnline ? 3 : 0;
          let statusTimestamp = 0;
          return rs
            .rsJsonApiRequest(
              '/rsChats/getCustomStateString',
              { peer_id: data.id },
              (statusData) => {
                if (statusData && statusData.retval) {
                  customState = statusData.retval;
                }
              }
            )
            .catch(() => {})
            .then(() => rs.rsJsonApiRequest(
              '/rsStatus/getStatus',
              { id: data.id },
              (statusData) => {
                if (statusData && statusData.retval && statusData.statusInfo) {
                  statusValue = normalizeStatusValue(statusData.statusInfo.status, statusValue);
                  statusTimestamp = statusData.statusInfo.time_stamp || 0;
                }
              }
            ).catch(() => {}))
            .then(() => {
              const avatar = '';
              return Promise.resolve()
                .then(() => {
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
                    avatar,
                  };

                  if (details[gpgId] === undefined) {
                    details[gpgId] = {
                      name: data.name,
                      isSearched: true,
                      isOnline,
                      locations: [loc],
                      customState,
                      statusValue,
                      statusTimestamp,
                      avatar: avatar || '',
                    };
                  } else {
                    details[gpgId].locations.push(loc);
                    if (avatar) {
                      details[gpgId].avatar = avatar;
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
                });
            });
        });
    })
  );

  Data.gpgDetails = details;
};
module.exports = Data;
