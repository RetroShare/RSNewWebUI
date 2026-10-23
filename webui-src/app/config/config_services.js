const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');

const servicesInfo = {
  list: [],
  loaded: false,

  setData(data) {
    servicesInfo.list = data.info.mServiceList;
    servicesInfo.loaded = true;
  },
};

const Service = () => {
  let defaultAllowed = undefined;
  return {
    oninit: (v) =>
      rs.rsJsonApiRequest(
        '/rsServiceControl/getServicePermissions',
        {
          serviceId: v.attrs.data.key,
        },
        (retval) => (defaultAllowed = retval.permissions.mDefaultAllowed)
      ),
    view: (v) =>
      m(
        'tr',
        {
          key: v.attrs.data.key,
        },
        [
          m('td', v.attrs.data.value.mServiceName),
          m('td', v.attrs.data.value.mServiceType),
          m('td', v.attrs.data.value.mVersionMajor + '.' + v.attrs.data.value.mVersionMinor),
          m(
            'td',
            m('input[type=checkbox]', {
              'aria-label': `Allow ${v.attrs.data.value.mServiceName} by default`,
              checked: defaultAllowed,
              disabled: defaultAllowed === undefined,
              oninput: (e) => {
                defaultAllowed = e.target.checked;
                rs.rsJsonApiRequest('/rsServiceControl/updateServicePermissions', {
                  serviceId: v.attrs.data.key,
                  permissions: {
                    mDefaultAllowed: defaultAllowed,
                  },
                });
              },
            })
          ),
        ]
      ),
  };
};

const MyServices = {
  oninit() {
    rs.rsJsonApiRequest('/rsServiceControl/getOwnServices', {}, servicesInfo.setData);
  },
  view() {
    return m('.panel', [
      m('.panel__head', m('h3', 'Available services')),
      m('.panel__body', [
        !servicesInfo.loaded ? m(widget.Loading, { label: 'Loading services…' })
        : m('.settings-table-scroll', m('table.settings-services', [
          m('thead', m('tr', [
            m('th[scope=col]', 'Service'),
            m('th[scope=col]', 'ID'),
            m('th[scope=col]', 'Version'),
            m('th[scope=col]', 'Allowed'),
          ])),
          m('tbody', servicesInfo.list.map((data) =>
            m(Service, {
              key: data.key,
              data,
            })
          )),
        ])),
      ]),
    ]);
  },
};

module.exports = {
  view: () => {
    return m(MyServices);
  },
};
