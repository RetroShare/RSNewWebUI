const m = require('mithril');
const rs = require('rswebui');

const servicesInfo = {
  list: [],

  setData(data) {
    servicesInfo.list = data.info.mServiceList;
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
              checked: defaultAllowed,
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
    return m('.widget', [
      m('h3', 'My Services'),
      m('hr'),
      m('table', [
        m('tr', [m('th', 'Name'), m('th', 'ID'), m('th', 'Version'), m('th', 'Allow by default')]),
        servicesInfo.list.map((data) =>
          m(Service, {
            data,
          })
        ),
      ]),
    ]);
  },
};

const Layout = () => {
  return {
    view: (vnode) => [m(MyServices)],
  };
};

module.exports = {
  view: (vnode) => {
    return m(Layout);
  },
};
