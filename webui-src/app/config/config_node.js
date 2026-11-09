const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');

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
        m('.panel', [
          m('.panel__head', m('h3', 'Node details')),
          m('.panel__body', [
            nodeInfo.ownName === undefined
              ? m(widget.Loading, { label: 'Loading node details…' })
              : m('dl.settings-facts', [
                ['Name', nodeInfo.ownName],
                ['Location ID', nodeInfo.ownId],
                ['Firewall', nodeInfo.firewalled ? 'Enabled' : 'Disabled'],
                ['Port forwarding', nodeInfo.forwardPort ? 'Enabled' : 'Disabled'],
                ['DHT', nodeInfo.DHTActive ? 'Active' : 'Inactive'],
                ['UPnP', nodeInfo.uPnPActive ? 'Active' : 'Inactive'],
                ['Local address', `${nodeInfo.localAddr || '—'}:${nodeInfo.localPort || '—'}`],
              ].map(([label, value]) => m('div', [m('dt', label), m('dd', value || '—')]))),
          ]),
        ]),
      ];
    },
  };
};

module.exports = Node;
