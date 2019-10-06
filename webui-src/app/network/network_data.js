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
          if (details[data.gpg_id] === undefined) {
            details[data.gpg_id] = {isSearched: true, locations: [data]};
            console.log(data);
          } else {
            details[data.gpg_id].locations.push(data);
          }
        });
        this.gpgDetails = details;
      });
  },
};
