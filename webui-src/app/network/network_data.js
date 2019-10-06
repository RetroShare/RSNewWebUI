let rs = require('rswebui');

module.exports = {
  sslIds: [],
  sslDetails: [],
  gpgDetails: {},

  refreshIds() {
    return rs.rsJsonApiRequest(
      '/rsPeers/getFriendList',
      {},
      data => (this.sslIds = data.sslIds),
    );
  },

  loadSslDetails() {
    this.sslDetails = [];

    return Promise.all(
      this.sslIds.map(sslId =>
        rs.rsJsonApiRequest('/rsPeers/getPeerDetails', {sslId}, data =>
          this.sslDetails.push(data.det),
        ),
      ),
    );
  },

  refreshGpgDetails() {
    let details = {};

    this.refreshIds()
      .then(() => this.loadSslDetails())
      .then(() => {
        this.sslDetails.map(data => {
          let isOnline = false;
          rs.rsJsonApiRequest(
            '/rsPeers/isOnline',
            {sslId: data.id},
            stat => (isOnline = stat.retval),
          ).then(() => {
            loc = {
              name: data.location,
              id: data.id,
              lastSeen: data.lastConnect,
              isOnline,
              gpg_id: data.gpg_id,
            };

            if (details[data.gpg_id] === undefined) {
              details[data.gpg_id] = {
                name: data.name,
                isSearched: true,
                isOnline,
                locations: [loc],
              };
            } else {
              details[data.gpg_id].locations.push(loc);
            }
            details[data.gpg_id].isOnline =
              details[data.gpg_id].isOnline || isOnline;

            this.gpgDetails = details;
          });
        });
      });
  },
};
