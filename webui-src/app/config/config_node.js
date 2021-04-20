const m = require('mithril');
const rs = require('rswebui');

const Node = () => {
  const nodeInfo = {
    setData(data) {
      Object.assign(nodeInfo, data.status);
    },
  };
  return {
    oninit() {
      rs.rsJsonApiRequest('/rsConfig/getConfigNetStatus', {}, nodeInfo.setData);
    },
    view() {
      return [
        m('.widget.widget-half', [
          m('h3', 'Public Information'),
          m('hr'),
          m('ul', [
            m('li', 'Name: ' + nodeInfo.ownName),
            m('li', 'Location ID: ' + nodeInfo.ownId),
            m('li', 'Firewall: ' + nodeInfo.firewalled),
            m('li', 'Port Forwarding: ' + nodeInfo.forwardPort),
            m('li', 'DHT: ' + nodeInfo.DHTActive),
            m('li', 'uPnP: ' + nodeInfo.uPnPActive),
            m('li', 'Local Address: ' + nodeInfo.localAddr + '  Port: ' + nodeInfo.localPort),
          ]),
        ]),
      ];
    },
  };
};

module.exports = Node;
