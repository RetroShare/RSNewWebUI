let m = require('mithril');
let rs = require('rswebui');

function sidebar(links) {
  return m('.sidebar',
    Object.keys(links)
    .map(function(panelName) {
      return m('a.sidebar-link' + (Panel.active === panelName ?
          '#selected-sidebar-link' : ''), {
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

function setMaxRates() {
  let download = document.getElementById('download-limit')
    .value;
  let upload = document.getElementById('upload-limit')
    .value;
  if(isNaN(download) || isNaN(upload)) {
    // TODO display error on setting non-numeric value
    return;
  }
  rs.rsJsonApiRequest('/rsConfig/SetMaxDataRates', {
      downKb: Number(download),
      upKb: Number(upload),
    },
    //TODO display success animation(fontawesome)
    () => {},
  );
};
new Panel('Network', {
  oninit: function() {
    rs.rsJsonApiRequest('/rsConfig/GetMaxDataRates', {}, function(data) {
      document.getElementById('download-limit')
        .value = data.inKb;
      document.getElementById('upload-limit')
        .value = data.outKb;
    });
  },
  // TODO show info from UI hover message
  view: function() {
    return m('.node-panel', [
      m('.widget.widget-half', [
        m('h3', 'Network Configuration'),
        m('hr'),
        m('ul', [
          m('li', ['Download limit(KB/s):', m(
            'input#download-limit[type=number][name=download]', {
              onblur: setMaxRates,
            })]),
          m('li', ['Upload limit(KB/s):', m(
            'input#upload-limit[type=number][name=upload]', {
              onblur: setMaxRates,
            })]),
        ])
      ]),
    ]);
  },
});
Panel.active = 'Network';

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
      m('.widget.widget-half', [
        m('h3', 'Public Information'),
        m('hr'),
        m('ul', [
          m('li', 'Name: ' + nodeInfo['ownName']),
          m('li', 'Location ID: ' + nodeInfo['ownId']),
          m('li', 'Firewall: ' + nodeInfo['firewalled']),
          m('li', 'Port Forwarding: ' + nodeInfo['forwardPort']),
          m('li', 'DHT: ' + nodeInfo['DHTActive']),
          m('li', 'uPnP: ' + nodeInfo['uPnPActive']),
        ]),
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
    rs.rsJsonApiRequest('/rsServiceControl/getOwnServices', {},
      servicesInfo.setData);
  },
  view: function() {
    return m('.node-panel', [
      m('.widget', [
        m('h3', 'My Services'),
        m('hr'),
        m('table', [
          m('tr', [
            m('th', 'Name'),
            m('th', 'ID'),
            m('th', 'Version'),
          ]),
          servicesInfo.list.map(function(service) {
            return m('tr', {
              key: service.key,
            }, [
              m('td', service.value.mServiceName),
              m('td', service.value.mServiceType),
              m('td', service.value.mVersionMajor + '.' +
                service.value.mVersionMinor),
            ]);
          }),
        ]),
      ]),
    ]);
  },
});


let component = {
  view: function() {
    return m('.tab-page.fadein', [
      sidebar(Panel.list),
      Panel.component(),
    ]);
  },
};

new rs.Tab('config', component);
module.exports = {
  component,
};

