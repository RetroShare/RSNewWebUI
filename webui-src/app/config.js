let m = require('mithril');
let rs = require('rswebui');

function sidebar(links) {
  return m('.sidebar',
    Object.keys(links)
    .map(function(panelName) {
      return m('a.sidebar-link' + (Panel.active === panelName ? '#selected' : ''), {
          onclick: function() {
            Panel.active = panelName;
          },
        },
        panelName);
    }),
  );
};

class Panel {
  static component() {
    return [
      sidebar(Panel.list),
      m(Panel.list[Panel.active]),
    ];
  }
  constructor(name, content) {
    Panel.list[name] = this;
    // Turning object itself to a component
    Object.assign(this, content);
  }
};
Panel.active = '';
Panel.list = {};

new Panel('General', {
  view: function() {
    return m('.node-panel');
  },
});
Panel.active = 'General';

nodeInfo = {
  setData: function(data) {
    Object.assign(nodeInfo, data.status);
  },
};

new Panel('Node', {
  oninit: function() {
    rs.rsJsonApiRequest('/rsConfig/getConfigNetStatus', {}, nodeInfo.setData);
  },
  view: function() {
    return m('.node-panel', [
      m('h3', 'Public Information'),
      m('ul', [
        m('li', 'Name: ' + nodeInfo['ownName']),
        m('li', 'Location ID: ' + nodeInfo['ownId']),
        m('li', 'Firewall: ' + nodeInfo['firewalled']),
        m('li', 'Port Forwarding: ' + nodeInfo['forwardPort']),
        m('li', 'DHT: ' + nodeInfo['DHTActive']),
        m('li', 'uPnP: ' + nodeInfo['uPnPActive']),
      ]),
    ]);
  },
});

let servicesInfo = {
  list: [],
  setData: function(data) {
    servicesInfo.list = data.info.mServiceList;
  },
};

new Panel('Services', {
  oninit: function() {
    rs.rsJsonApiRequest('/rsServiceControl/getOwnServices', {}, servicesInfo.setData);
  },
  view: function() {
    return m('.node-panel', [
      m('h3', 'My Services'),
      m('table', [
        m('tr', [
          m('th', 'Name'),
          m('th', 'Type'),
          m('th', 'Version'),
        ]),
        servicesInfo.list.map(function(service) {
          return m('tr', {
            key: service.key,
          }, [
            m('td', service.value.mServiceName),
            m('td', service.value.mServiceType),
            m('td', service.value.mVersionMajor + '.' + service.value.mVersionMinor),
          ]);
        }),
      ]),
    ]);
  },
});


let component = {
  view: function() {
    return m('.tab', [
      Panel.component(),
    ]);
  },
};

module.exports = {
  component,
};

