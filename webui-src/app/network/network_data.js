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
                    avatar,
                  };

                  if (details[gpgId] === undefined) {
                    details[gpgId] = {
                      name: data.name,
                      isSearched: true,
                      isOnline,
                      locations: [loc],
                      customState,
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
