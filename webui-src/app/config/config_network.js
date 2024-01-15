const m = require('mithril');
const rs = require('rswebui');

const util = require('config/config_util');

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
  let sslId = '';
  let details = {};

  return {
    oninit: () => {
      rs.rsJsonApiRequest('/rsAccounts/getCurrentAccountId').then((res) => {
        if (res.body.retval) {
          sslId = res.body.id;
          rs.rsJsonApiRequest('/rsPeers/getPeerDetails', {
            sslId,
          }).then((res) => {
            if (res.body.retval) {
              details = res.body.det;
              if (
                details.vs_dht === util.RS_VS_DHT_FULL &&
                details.vs_disc === util.RS_VS_DISC_FULL
              ) {
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
          });
        }
      });
    },
    view: () => {
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

const SetNAT = () => {
  let sslId;
  let netMode;

  return {
    oninit: () => {
      rs.rsJsonApiRequest('/rsAccounts/getCurrentAccountId').then((res) => {
        if (res.body.retval) {
          sslId = res.body.id;
          rs.rsJsonApiRequest('/rsPeers/getPeerDetails', {
            sslId,
          }).then((res) => {
            if (res.body.retval) {
              netMode = res.body.det.netMode;
            }
          });
        }
      });
    },
    view: () => [
      m('p', 'NAT:'),
      m(
        'select',
        {
          value: netMode,
          onchange: (e) => {
            rs.rsJsonApiRequest('/rsPeers/setNetworkMode', {
              sslId,
              netMode,
            }).then((res) => {
              if (res.body.retval) {
                netMode = e.target.value;
              }
            });
          },
        },
        [
          m('option', { value: util.RS_NETMODE_UPNP }, 'Automatic (UPnP)'),
          m('option', { value: util.RS_NETMODE_UDP }, 'FireWalled'),
          m('option', { value: util.RS_NETMODE_EXT }, 'Manually Forwarded Port'),
        ]
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
    rs.rsJsonApiRequest('/rsconfig/SetOperatingMode', {
      opMode: Number(opmode),
    });
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
          m(`option[value=${i + 1}]`, val)
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
  let addr = '';
  let sslId = '';
  return {
    oninit: () => {
      rs.rsJsonApiRequest('/rsAccounts/getCurrentAccountId').then((res) => {
        if (res.body.retval) {
          sslId = res.body.id;
          rs.rsJsonApiRequest('/rsPeers/getPeerDetails', {
            sslId,
          }).then((res) => {
            if (res.body.retval) {
              addr = res.body.det.dyndns;
            }
          });
        }
      });
    },
    view: () => [
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
    ],
  };
};

const SetSocksProxy = () => {
  const socksProxyObj = {
    tor: {},
    i2p: {},
  };
  const fetchOutgoing = () => {
    Object.keys(socksProxyObj).forEach((proxyItem) => {
      fetch(`http://${socksProxyObj[proxyItem].addr}:${socksProxyObj[proxyItem].port}`)
        .then(() => {
          socksProxyObj[proxyItem].outgoing = true;
          m.redraw();
        })
        .catch(() => {
          socksProxyObj[proxyItem].outgoing = false;
        });
    });
  };
  const handleProxyChange = (proxyItem) => {
    rs.rsJsonApiRequest('/rsPeers/setProxyServer', {
      type: util[`RS_HIDDEN_TYPE_${proxyItem.toUpperCase()}`],
      addr: socksProxyObj[proxyItem].addr,
      port: socksProxyObj[proxyItem].port,
    }).then(fetchOutgoing);
  };
  return {
    oninit: () => {
      Object.keys(socksProxyObj).forEach((proxyItem) => {
        rs.rsJsonApiRequest('/rsPeers/getProxyServer', {
          type: util[`RS_HIDDEN_TYPE_${proxyItem.toUpperCase()}`],
        })
          .then((res) => {
            if (res.body.retval) {
              socksProxyObj[proxyItem] = res.body;
            }
          })
          .then(fetchOutgoing);
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
            m('h6', `${proxyItem.toUpperCase()} Socks Proxy: `),
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
            socksProxyObj[proxyItem].outgoing !== undefined &&
              m('.proxy-outgoing', [
                m('.proxy-outgoing__status', {
                  style: {
                    backgroundColor: socksProxyObj[proxyItem].outgoing ? '#00dd44' : '#808080',
                  },
                }),
                m(
                  'p',
                  `${proxyItem.toUpperCase()} outgoing ${
                    socksProxyObj[proxyItem].outgoing ? 'on' : 'off'
                  }`
                ),
              ]),
          ]);
        }),
      ]),
  };
};

const Component = () => {
  let details;
  return {
    oninit: () => {
      rs.rsJsonApiRequest('/rsAccounts/getCurrentAccountId').then((res) => {
        if (res.body.retval) {
          rs.rsJsonApiRequest('/rsPeers/getPeerDetails', {
            sslId: res.body.id,
          }).then((res) => {
            if (res.body.retval) {
              details = res.body.det;
            }
          });
        }
      });
    },
    view: () =>
      m('.widget', [
        m('.widget__heading', m('h3', 'Network Configuration')),
        m('.widget__body', [
          m('.grid-2col', [
            m(SetNwMode),
            m(SetNAT),
            m(displayLocalIPAddress, { details }),
            m(displayExternalIPAddress, { details }),
            m(SetDynamicDNS),
            m(SetLimits),
            m(SetOpMode),
            m(displayIPAddresses, { details }),
          ]),
          m('.widget__heading', m('h3', 'Hidden Service Configuration')),
          m('.widget__body', [m('.grid-2col', [m(SetSocksProxy)])]),
        ]),
      ]),
  };
};

module.exports = Component;
