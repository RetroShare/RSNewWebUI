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
  const hiddenModes = [
    'Discovery On (recommended)',
    'Discovery Off',
  ];

  let vsDisc = 0;
  let vsDht = 0;
  let selectedMode;
  let sslId = '';
  let details = {};

  const updateSelectedMode = (isHiddenMode) => {
    if (!details || details.vs_dht === undefined) return;
    if (isHiddenMode) {
      if (details.vs_disc === util.RS_VS_DISC_OFF) {
        selectedMode = hiddenModes[1];
      } else {
        selectedMode = hiddenModes[0];
      }
    } else {
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
  };

  return {
    oninit: (vnode) => {
      rs.rsJsonApiRequest('/rsAccounts/getCurrentAccountId').then((res) => {
        if (res.body.retval) {
          sslId = res.body.id;
          rs.rsJsonApiRequest('/rsPeers/getPeerDetails', {
            sslId,
          }).then((res) => {
            if (res.body.retval) {
              details = res.body.det;
              updateSelectedMode(vnode.attrs && vnode.attrs.isHiddenMode);
              m.redraw();
            }
          });
        }
      });
    },
    onupdate: (vnode) => {
      updateSelectedMode(vnode.attrs && vnode.attrs.isHiddenMode);
    },
    view: (vnode) => {
      const isHiddenMode = vnode.attrs && vnode.attrs.isHiddenMode;
      const modes = isHiddenMode ? hiddenModes : networkModes;

      return [
        m('p', isHiddenMode ? 'Discovery:' : 'Network mode:'),
        m(
          'select',
          {
            value: selectedMode,
            onchange: (e) => {
              const idx = e.target.selectedIndex;
              selectedMode = modes[idx];
              if (isHiddenMode) {
                if (idx === 0) {
                  vsDisc = util.RS_VS_DISC_FULL;
                  vsDht = util.RS_VS_DHT_OFF;
                } else if (idx === 1) {
                  vsDisc = util.RS_VS_DISC_OFF;
                  vsDht = util.RS_VS_DHT_OFF;
                }
              } else {
                if (idx === 0) {
                  vsDisc = util.RS_VS_DISC_FULL;
                  vsDht = util.RS_VS_DHT_FULL;
                } else if (idx === 1) {
                  vsDisc = util.RS_VS_DISC_FULL;
                  vsDht = util.RS_VS_DHT_OFF;
                } else if (idx === 2) {
                  vsDisc = util.RS_VS_DISC_OFF;
                  vsDht = util.RS_VS_DHT_FULL;
                } else if (idx === 3) {
                  vsDisc = util.RS_VS_DISC_OFF;
                  vsDht = util.RS_VS_DHT_OFF;
                }
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
          [modes.map((o) => m('option', { value: o }, o))]
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
    view: ({ attrs: { details, isHiddenMode } }) =>
      details && [m('p', 'External Address: '), m('p', isHiddenMode ? 'Hidden - See Config' : details.extAddr)],
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

const checkPortReachable = (addr, port, timeoutMs = 800) => {
  if (!addr || !port) return Promise.resolve(false);

  return new Promise((resolve) => {
    let resolved = false;
    const start = Date.now();
    const controller = new AbortController();

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        controller.abort();
        // Timeout expired without server connection -> Port is closed / not enabled!
        resolve(false);
      }
    }, timeoutMs);

    fetch(`http://${addr}:${port}`, {
      mode: 'no-cors',
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(() => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(true);
        }
      })
      .catch((err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          if (err && err.name === 'AbortError') {
            resolve(true);
          } else {
            // Tor SOCKS port returns HTTP 501 ("Tor is not an HTTP Proxy").
            // Connection refused fails in < 15ms. If Tor server responded (501 / > 20ms), port is OPEN!
            const duration = Date.now() - start;
            if (duration > 20 || (err && err.message && err.message.includes('501'))) {
              resolve(true);
            } else {
              resolve(false);
            }
          }
        }
      });
  });
};

const SetSocksProxy = () => {
  const socksProxyObj = {
    tor: {},
    i2p: {},
  };
  const fetchOutgoing = () => {
    Object.keys(socksProxyObj).forEach((proxyItem) => {
      const item = socksProxyObj[proxyItem];
      if (item.retval && item.addr && item.port) {
        checkPortReachable(item.addr, item.port).then((isReachable) => {
          item.outgoing = isReachable;
          m.redraw();
        });
      } else {
        item.outgoing = false;
        m.redraw();
      }
    });
  };
  const handleProxyChange = (proxyItem) => {
    rs.rsJsonApiRequest('/rsPeers/setProxyServer', {
      type: util[`RS_HIDDEN_TYPE_${proxyItem.toUpperCase()}`],
      addr: socksProxyObj[proxyItem].addr,
      port: socksProxyObj[proxyItem].port,
    }).then((res) => {
      if (res && res.body) {
        socksProxyObj[proxyItem] = res.body;
      }
      fetchOutgoing();
    });
  };
  return {
    oninit: () => {
      Object.keys(socksProxyObj).forEach((proxyItem) => {
        rs.rsJsonApiRequest('/rsPeers/getProxyServer', {
          type: util[`RS_HIDDEN_TYPE_${proxyItem.toUpperCase()}`],
        })
          .then((res) => {
            if (res && res.body) {
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
        m('.proxy-rows-container', 
          Object.keys(socksProxyObj).map((proxyItem) => {
            const isTor = proxyItem === 'tor';
            const labelText = isTor ? 'TOR Socks Proxy:' : 'I2P Socks Proxy:';
            const outgoingText = isTor ? 'TOR outgoing' : 'I2P outgoing';
            const notEnabledText = isTor ? 'Tor proxy is not enabled' : 'I2P proxy is not enabled';
            const isOutgoing = socksProxyObj[proxyItem].outgoing;
            return m('.proxy-row', [
              m('label.proxy-label', labelText),
              m('input[type=text].proxy-addr-input', {
                value: socksProxyObj[proxyItem].addr,
                oninput: (e) => (socksProxyObj[proxyItem].addr = e.target.value),
                onchange: () => handleProxyChange(proxyItem),
              }),
              m('input[type=number].proxy-port-input', {
                value: socksProxyObj[proxyItem].port,
                oninput: (e) => (socksProxyObj[proxyItem].port = parseInt(e.target.value)),
                onchange: () => handleProxyChange(proxyItem),
              }),
              socksProxyObj[proxyItem].outgoing !== undefined &&
                m('.proxy-status-container', [
                  m('.proxy-status-bullet', {
                    style: {
                      backgroundColor: isOutgoing ? '#22c55e' : '#808080',
                    },
                    title: isOutgoing ? 'Proxy seems to work.' : notEnabledText,
                  }),
                  m(
                    'span.proxy-status-text',
                    `${outgoingText} ${isOutgoing ? 'on' : 'off'}`
                  ),
                ]),
            ]);
          })
        ),
      ]),
  };
};

const displayHiddenServiceInfo = () => {
  return {
    view: ({ attrs: { details } }) =>
      details && details.hiddenNodeAddress &&
        m('.proxy-server', [
          m('p.proxy-description', details.hiddenType === 4
            ? 'I2P has been automatically configured by Retroshare. You shouldn\'t need to change anything here.'
            : 'Tor has been automatically configured by Retroshare. You shouldn\'t need to change anything here.'
          ),
          m('hr'),
          m('.proxy-row', [
            m('label.proxy-label', 'Local Address:'),
            m('span', details.localAddr || '127.0.0.1'),
          ]),
          m('.proxy-row', [
            m('label.proxy-label', details.hiddenType === 4 ? 'I2P Address:' : 'Onion Address:'),
            m('span', details.hiddenNodeAddress),
          ]),
          details.hiddenNodePort && m('.proxy-row', [
            m('label.proxy-label', 'Service Port:'),
            m('span', String(details.hiddenNodePort)),
          ]),
          m('.proxy-row', [
            m('label.proxy-label', 'Local Port:'),
            m('span', String(details.localPort)),
          ]),
        ]),
  };
};

const Component = () => {
  let details;
  let isHiddenMode = false;

  return {
    oninit: () => {
      rs.rsJsonApiRequest('/rsAccounts/getCurrentAccountId').then((res) => {
        if (res.body.retval) {
          rs.rsJsonApiRequest('/rsPeers/getPeerDetails', {
            sslId: res.body.id,
          }).then((res) => {
            if (res.body.retval) {
              details = res.body.det;
              isHiddenMode = Boolean(
                details && (
                  details.hiddenType === util.RS_HIDDEN_TYPE_TOR ||
                  details.hiddenType === util.RS_HIDDEN_TYPE_I2P ||
                  details.extAddr === 'Hidden'
                )
              );
              m.redraw();
            }
          });
        }
      });
    },
    view: () =>
      m('.config-network', { style: 'display:flex; flex-direction:column; gap:0.5rem;' }, [
        m('.widget', [
          m('.widget__heading', m('h3', 'Network Configuration')),
          m('.widget__body', [
            m('.grid-2col', [
              m(SetNwMode, { isHiddenMode }),
              !isHiddenMode && m(SetNAT),
              m(displayLocalIPAddress, { details }),
              m(displayExternalIPAddress, { details, isHiddenMode }),
              !isHiddenMode && m(SetDynamicDNS),
              m(SetLimits),
              !isHiddenMode && m(SetOpMode),
              !isHiddenMode && m(displayIPAddresses, { details }),
            ]),
          ]),
        ]),
        m('.widget', [
          m('.widget__heading', m('h3', 'Hidden Service Configuration')),
          m('.widget__body', [
            m(SetSocksProxy),
          ]),
        ]),
        isHiddenMode &&
          m('.widget', [
            m('.widget__heading', m('h3', details && details.hiddenType === 4 ? 'Incoming I2P' : 'Incoming Tor')),
            m('.widget__body', [
              m(displayHiddenServiceInfo, { details }),
            ]),
          ]),
      ]),
  };
};

module.exports = Component;
