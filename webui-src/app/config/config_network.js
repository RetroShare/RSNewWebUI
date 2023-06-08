const m = require('mithril');
const rs = require('rswebui');

const util = require('config/config_util'); // for future use

/* eslint-disable no-unused-vars */

const SetNwMode = () => {
  const networkModes = [
    'Public: DHT & Discovery',
    'Private: Discovery only',
    'Inverted: DHT only',
    'Dark Net: None',
  ];

  let vsDisc = 0;
  let vsDht = 0;
  let selectedMode;

  return {
    view: ({ attrs: { sslId, details } }) => {
      if (details) {
        if (details.vs_dht === util.RS_VS_DHT_FULL && details.vs_disc === util.RS_VS_DISC_FULL) {
          selectedMode = networkModes[0];
        } else if (
          details.vs_dht === util.RS_VS_DHT_OFF &&
          details.vs_disc === util.RS_VS_DISC_FULL
        ) {
          selectedMode = networkModes[1];
        } else if (
          details.vs_dht === util.RS_VS_DHT_FULL &&
          details.vs_disc === util.RS_VS_DISC_OFF
        ) {
          selectedMode = networkModes[2];
        } else if (
          details.vs_dht === util.RS_VS_DHT_OFF &&
          details.vs_disc === util.RS_VS_DISC_OFF
        ) {
          selectedMode = networkModes[3];
        }
      }
      return [
        m('p', 'Network mode:'),
        m(
          'select',
          {
            value: selectedMode,
            onchange: (e) => {
              selectedMode = networkModes[e.target.selectedIndex];
              if (e.target.selectedIndex === 0) {
                // Public: DHT & Discovery
                vsDisc = util.RS_VS_DISC_FULL;
                vsDht = util.RS_VS_DHT_FULL;
              } else if (e.target.selectedIndex === 1) {
                // Private: Discovery only
                vsDisc = util.RS_VS_DISC_FULL;
                vsDht = util.RS_VS_DHT_OFF;
              } else if (e.target.selectedIndex === 2) {
                // Inverted: DHT only
                vsDisc = util.RS_VS_DISC_OFF;
                vsDht = util.RS_VS_DHT_FULL;
              } else if (e.target.selectedIndex === 3) {
                // Dark Net: None
                vsDisc = util.RS_VS_DISC_OFF;
                vsDht = util.RS_VS_DHT_OFF;
              }
              if (
                details &&
                (vsDht !== details.vs_dht || vsDisc !== details.vs_disc) &&
                sslId !== undefined
              ) {
                rs.rsJsonApiRequest('/rsPeers/setVisState', {
                  sslId,
                  vsDisc,
                  vsDht,
                });
              }
            },
          },
          [networkModes.map((o) => m('option', { value: o }, o))]
        ),
      ];
    },
  };
};

const NATmodes = ['Automatic (UPnP)', 'FireWalled', 'Manually Forwarded Port'];
const SetNAT = () => {
  let sslId;
  let selectedMode = NATmodes[0];

  return {
    oninit: async () => {
      const res = await rs.rsJsonApiRequest('/rsIdentity/GetOwnSignedIds');
      if (res.body.retval) {
        sslId = res.body.ids[0];
      }
    },
    view: () => [
      m('p', 'NAT:'),
      m(
        'select',
        {
          value: selectedMode,
          onchange: (e) => {
            selectedMode = NATmodes[e.target.selectedIndex];
            // console.log(selectedMode, e.target.selectedIndex);
            if (e.target.selectedIndex === 0) {
              // Automatic (UPnP)
            } else if (e.target.selectedIndex === 1) {
              // FireWalled
            } else if (e.target.selectedIndex === 2) {
              // Manually Forwarded Port
            }
          },
        },
        [NATmodes.map((o) => m('option', { value: o }, o))]
      ),
    ],
  };
};

const SetLimits = () => {
  let dlim = undefined;
  let ulim = undefined;
  const setMaxRates = () =>
    rs.rsJsonApiRequest('/rsConfig/SetMaxDataRates', {
      downKb: dlim,
      upKb: ulim,
    });
  return {
    oninit: () =>
      rs.rsJsonApiRequest('/rsConfig/GetMaxDataRates', {}, (data) => {
        dlim = data.inKb;
        ulim = data.outKb;
      }),
    view: () => [
      m(
        'p',
        util.tooltip(
          'The download limit covers the whole application. ' +
            'However, in some situations, such as when transfering ' +
            'many files at once, the estimated bandwidth becomes ' +
            'unreliable and the total value reported by Retroshare ' +
            'might exceed that limit.'
        ),
        'Download limit(KB/s):'
      ),
      m('input[type=number][name=download]', {
        value: dlim,
        oninput: (e) => (dlim = Number(e.target.value)),
        onchange: setMaxRates,
      }),
      m(
        'p',
        util.tooltip(
          'The upload limit covers the entire software. ' +
            'Too small an upload limit may eventually block ' +
            'low priority services(forums, channels). ' +
            'A minimum recommended value is 50KB/s.'
        ),
        'Upload limit(KB/s):'
      ),
      m('input[type=number][name=upload]', {
        value: ulim,
        oninput: (e) => (ulim = Number(e.target.value)),
        onchange: setMaxRates,
      }),
    ],
  };
};

const SetOpMode = () => {
  let opmode = undefined;
  const setmode = () =>
    rs.rsJsonApiRequest(
      '/rsconfig/SetOperatingMode',
      {
        opMode: Number(opmode),
      },
      () => {}
    );
  return {
    oninit: () =>
      rs.rsJsonApiRequest('/rsConfig/getOperatingMode', {}, (data) => (opmode = data.retval)),
    view: () => [
      m(
        'p',
        'Operating mode:',
        util.tooltip(
          `No Anon D/L: Switches off file forwarding\n
          Gaming Mode: 25% standard traffic and TODO: Reduced popups\n
          Low traffic: 10% standard traffic and TODO: pause all file transfers\n`
        )
      ),
      m(
        'select',
        {
          oninput: (e) => (opmode = e.target.value),
          value: opmode,
          onchange: setmode,
        },
        ['Normal', 'No Anon D/L', 'Gaming', 'Low traffic'].map((val, i) =>
          m('option[value=' + (i + 1) + ']', val)
        )
      ),
    ],
  };
};

const displayLocalIPAddress = () => {
  return {
    view: ({ attrs: { details } }) =>
      details && [m('p', 'Local Address: '), m('p', details.localAddr)],
  };
};
const displayExternalIPAddress = () => {
  return {
    view: ({ attrs: { details } }) =>
      details && [m('p', 'External Address: '), m('p', details.extAddr)],
  };
};

const displayIPAddresses = () => {
  return {
    view: ({ attrs: { details } }) =>
      details && [
        m('p', 'External Address: '),
        m(
          'ul.external-address',
          details.ipAddressList.map((ip) => m('li', ip))
        ),
      ],
  };
};

const SetDynamicDNS = () => {
  return {
    view: ({ attrs: { sslId, details } }) => {
      let addr = details ? details.dyndns : '';
      return (
        sslId && [
          m('p', 'Set Dynamic DNS:'),
          m('input[type=text]', {
            value: addr,
            oninput: (e) => (addr = e.target.value),
            onchange: () => {
              rs.rsJsonApiRequest('/rsPeers/setDynDNS', {
                sslId,
                addr,
              });
            },
          }),
        ]
      );
    },
  };
};

const SetSocksProxy = () => {
  const socksProxyObj = {
    tor: {},
    i2p: {},
  };
  const handleProxyChange = (proxyItem) => {
    rs.rsJsonApiRequest('/rsPeers/setProxyServer', {
      type: util[`RS_HIDDEN_TYPE_${proxyItem.toUpperCase()}`],
      addr: socksProxyObj[proxyItem].addr,
      port: socksProxyObj[proxyItem].port,
    });
  };
  return {
    oninit: () => {
      Object.keys(socksProxyObj).forEach((proxyItem) => {
        rs.rsJsonApiRequest('/rsPeers/getProxyServer', {
          type: util[`RS_HIDDEN_TYPE_${proxyItem.toUpperCase()}`],
        }).then((res) => {
          if (res.body.retval) {
            socksProxyObj[proxyItem] = res.body;
          }
        });
      });
    },
    view: () =>
      m('.proxy-server', [
        m(
          'p',
          'Configure your TOR and I2P SOCKS proxy here. It will allow you to also connect to hidden nodes.'
        ),
        Object.keys(socksProxyObj).map((proxyItem) => {
          return m(`.proxy-server__${proxyItem}`, [
            m('h4', `${proxyItem.toUpperCase()} Socks Proxy: `),
            m('input[type=text]', {
              value: socksProxyObj[proxyItem].addr,
              oninput: (e) => (socksProxyObj[proxyItem].addr = e.target.value),
              onchange: () => handleProxyChange(proxyItem),
            }),
            m('input[type=number]', {
              value: socksProxyObj[proxyItem].port,
              oninput: (e) => (socksProxyObj[proxyItem].port = parseInt(e.target.value)),
              onchange: () => handleProxyChange(proxyItem),
            }),
          ]);
        }),
      ]),
  };
};

const Component = () => {
  let sslId;
  let details;
  return {
    oninit: () => {
      rs.rsJsonApiRequest('/rsAccounts/getCurrentAccountId')
        .then((res) => {
          if (res.body.retval) {
            sslId = res.body.id;
          }
        })
        .then(() => {
          if (sslId) {
            rs.rsJsonApiRequest('/rsPeers/getPeerDetails', {
              sslId,
            }).then((res) => {
              if (res.body.retval) {
                details = res.body.det;
              }
            });
          }
        });
    },
    view: () => [
      m('.widget.widget-half', [
        m('h3', 'Network Configuration'),
        m('hr'),
        m('.grid-2col', [
          m(SetNwMode, { sslId, details }),
          m(SetNAT),
          m(displayLocalIPAddress, { details }),
          m(displayExternalIPAddress, { details }),
          m(SetDynamicDNS, { sslId, details }),
          m(SetLimits),
          m(SetOpMode),
          m(displayIPAddresses, { details }),
        ]),
      ]),
      m('.widget.widget-half', [
        m('h3', 'Hidden Service Configuration'),
        m('hr'),
        m('.grid-2col', [m(SetSocksProxy)]),
      ]),
    ],
  };
};

module.exports = Component;
