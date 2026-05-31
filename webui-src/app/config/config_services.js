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
    view: (v) => {
      const search = window._serviceFilter || '';
      const name = v.attrs.data.value.mServiceName.toLowerCase();
      const type = v.attrs.data.value.mServiceType.toLowerCase();
      if (search && name.indexOf(search) < 0 && type.indexOf(search) < 0) {
        return null;
      }
      return m(
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
      m('.widget__heading', m('h3', 'My Services')),
      m('.widget__heading', [
        m('h3', 'My Services'),
        m('input.searchbar', {
          type: 'text',
          placeholder: 'search services...',
          oninput: (e) => {
            window._serviceFilter = e.target.value.toLowerCase();
            m.redraw();
          },
          style: 'margin-left:.5rem;padding:.25rem .5rem;border:1px solid #ccc;border-radius:4px;width:150px',
        }),
      ]),
      m('.widget__body', [
        m('table', [
          m('tr', [
            m('th', 'Name'),
            m('th', 'ID'),
            m('th', 'Version'),
            m('th', 'Allow by default'),
          ]),
          servicesInfo.list.map((data) =>
            m(Service, {
              data,
            })
          ),
        ]),
      ]),
    ]);
  },
};

module.exports = {
  view: () => {
    return m(MyServices);
  },
};
