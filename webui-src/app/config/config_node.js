let m = require('mithril');
let rs = require('rswebui');

nodeInfo = {
  setData: function(data) {
    Object.assign(nodeInfo, data.status);
  },
};

let Node = {
  oninit: function() {
    rs.rsJsonApiRequest('/rsConfig/getConfigNetStatus', {}, nodeInfo
      .setData);
  },
  view: function() {
    return [
      m('.widget.widget-half', [
        m('h3', 'Public Information'),
        m('hr'),
        m('ul', [
          m('li', 'Name: ' + nodeInfo['ownName']),
          m('li', 'Location ID: ' + nodeInfo['ownId']),
          m('li', 'Firewall: ' + nodeInfo['firewalled']),
          m('li', 'Port Forwarding: ' + nodeInfo[
            'forwardPort']),
          m('li', 'DHT: ' + nodeInfo['DHTActive']),
          m('li', 'uPnP: ' + nodeInfo['uPnPActive']),
        ]),
      ]),
    ];
  },
};

module.exports = Node;
