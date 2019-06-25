let m = require('mithril');
let rs = require('rswebui');

// Stores and resolves all sub-panels in tab
Panels = {
  current: '',
  setCurrent: function(panelName) {
    this.current = panelName;
  },
  currentPanel: function() {
    return m(Panels[this.current]);
  },
};

Panels['general'] = {
  view: function() {
    return m('.node-panel');
  },
};

nodeInfo = {
  setData: function(data) {
    Object.assign(nodeInfo, data.status);
  },
};

Panels['node'] = {
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
};

let sidebar = function() {
  return m('.sidebar', [
    m('a.sidebar-link', {
      onclick: function() {
        Panels.setCurrent('general');
      },
    }, 'General'),
    m('a.sidebar-link', {
      onclick: function() {
        Panels.setCurrent('node');
      },
    }, 'Node'),
  ]);
};

let component = {
  view: function() {
    return m('.tab', [
      sidebar(),
      Panels.currentPanel(),
    ]);
  },
};

module.exports = {
  component,
};

