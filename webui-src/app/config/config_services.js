let m = require('mithril');
let rs = require('rswebui');

let servicesInfo = {
  list: [],
  setData: function(data) {
    servicesInfo.list = data.info.mServiceList;
  },
};

let Services = {
  oninit: function() {
    rs.rsJsonApiRequest('/rsServiceControl/getOwnServices', {},
      servicesInfo.setData);
  },
  view: function() {
    return [
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
              m('td', service.value.mVersionMajor +
                '.' +
                service.value.mVersionMinor),
            ]);
          }),
        ]),
      ]),
    ];
  },
};

module.exports = Services;
