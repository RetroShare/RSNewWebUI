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
      const hideLabel = vnode.attrs && vnode.attrs.hideLabel;
      const modes = isHiddenMode ? hiddenModes : networkModes;

      return [
        !hideLabel && m('p', isHiddenMode ? 'Discovery:' : 'Network mode:'),
        m(
          'select',
          {
            style: 'flex: 1; max-width: 320px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 4px;',
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
      m('.nw-config-row', { style: 'display: grid; grid-template-columns: 200px 1fr; gap: 1rem; align-items: center; margin-bottom: 0.75rem;' }, [
        m('p', { style: 'font-weight: 600; color: #475569;' }, [
          util.tooltip(
            'The download limit covers the whole application. ' +
              'However, in some situations, such as when transfering ' +
              'many files at once, the estimated bandwidth becomes ' +
              'unreliable and the total value reported by Retroshare ' +
              'might exceed that limit.'
          ),
          'Download limit(KB/s):'
        ]),
        m('input[type=number][name=download]', {
          style: 'padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 4px; max-width: 320px; width: 100%;',
          value: dlim,
          oninput: (e) => (dlim = Number(e.target.value)),
          onchange: setMaxRates,
        }),
      ]),
      m('.nw-config-row', { style: 'display: grid; grid-template-columns: 200px 1fr; gap: 1rem; align-items: center; margin-bottom: 0.75rem;' }, [
        m('p', { style: 'font-weight: 600; color: #475569;' }, [
          util.tooltip(
            'The upload limit covers the entire software. ' +
              'Too small an upload limit may eventually block ' +
              'low priority services(forums, channels). ' +
              'A minimum recommended value is 50KB/s.'
          ),
          'Upload limit(KB/s):'
        ]),
        m('input[type=number][name=upload]', {
          style: 'padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 4px; max-width: 320px; width: 100%;',
          value: ulim,
          oninput: (e) => (ulim = Number(e.target.value)),
          onchange: setMaxRates,
        }),
      ]),
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
      m('.nw-config-row', { style: 'display: grid; grid-template-columns: 200px 1fr; gap: 1rem; align-items: center; margin-bottom: 0.75rem;' }, [
        m('p', { style: 'font-weight: 600; color: #475569;' }, [
          'Operating mode: ',
          util.tooltip(
            `No Anon D/L: Switches off file forwarding\n
            Gaming Mode: 25% standard traffic and TODO: Reduced popups\n
            Low traffic: 10% standard traffic and TODO: pause all file transfers\n`
          )
        ]),
        m(
          'select',
          {
            style: 'padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 4px; max-width: 320px; width: 100%;',
            oninput: (e) => (opmode = e.target.value),
            value: opmode,
            onchange: setmode,
          },
          ['Normal', 'No Anon D/L', 'Gaming', 'Low traffic'].map((val, i) =>
            m(`option[value=${i + 1}]`, val)
          )
        ),
      ]),
    ],
  };
};

const displayIPAddresses = () => {
  return {
    view: ({ attrs: { details } }) =>
      details && m('.nw-config-row', { style: 'display: grid; grid-template-columns: 200px 1fr; gap: 1rem; align-items: flex-start; margin-bottom: 0.75rem;' }, [
        m('p', { style: 'font-weight: 600; color: #475569;' }, 'External Address: '),
        m(
          'ul.external-address',
          details.ipAddressList.map((ip) => m('li', ip))
        ),
      ]),
  };
};

const NetworkConfigForm = () => {
  let sslId = '';
  let details = {};
  let netStatus = {};
  let localAddr = '';
  let localPort = 0;
  let extAddr = '';
  let extPort = 0;
  let dyndns = '';
  let netMode = util.RS_NETMODE_EXT;

  const loadData = () => {
    rs.rsJsonApiRequest('/rsAccounts/getCurrentAccountId').then((res) => {
      if (res.body.retval) {
        sslId = res.body.id;
        rs.rsJsonApiRequest('/rsPeers/getPeerDetails', { sslId }).then((pRes) => {
          if (pRes.body.retval) {
            details = pRes.body.det;
            localAddr = details.localAddr || '';
            localPort = details.localPort || 0;
            extAddr = details.extAddr || '';
            extPort = details.extPort || 0;
            dyndns = details.dyndns || '';
            netMode = details.netMode || util.RS_NETMODE_EXT;
            m.redraw();
          }
        });
        rs.rsJsonApiRequest('/rsConfig/getConfigNetStatus', {}).then((nRes) => {
          if (nRes.body) {
            netStatus = nRes.body;
            if (netStatus.localPort) localPort = netStatus.localPort;
            if (netStatus.extPort) extPort = netStatus.extPort;
            m.redraw();
          }
        });
      }
    });
  };

  const saveLocalAddress = () => {
    if (!sslId) return;
    rs.rsJsonApiRequest('/rsPeers/setLocalAddress', {
      sslId,
      addr: localAddr,
      port: parseInt(localPort) || 0,
    }).then(() => loadData());
  };

  const saveExtAddress = () => {
    if (!sslId) return;
    rs.rsJsonApiRequest('/rsPeers/setExtAddress', {
      sslId,
      addr: extAddr,
      port: parseInt(extPort) || 0,
    }).then(() => loadData());
  };

  const saveDynDNS = () => {
    if (!sslId) return;
    rs.rsJsonApiRequest('/rsPeers/setDynDNS', {
      sslId,
      addr: dyndns,
    });
  };

  const saveNetMode = (newMode) => {
    if (!sslId) return;
    netMode = newMode;
    rs.rsJsonApiRequest('/rsPeers/setNetworkMode', {
      sslId,
      netMode: parseInt(newMode),
    }).then(() => loadData());
  };

  return {
    oninit: () => {
      loadData();
    },
    view: ({ attrs: { isHiddenMode } }) => {
      const isUpnpOk = Boolean(netStatus.netUpnpOk || netStatus.uPnPActive);
      const isLocalOk = Boolean(netStatus.netLocalOk !== false);
      const isExtOk = Boolean(netStatus.netExtAddressOk);

      return m('.network-config-form', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          width: '100%',
        }
      }, [
        // Network Mode row
        m('.nw-config-row', { style: 'display: grid; grid-template-columns: 200px 1fr; gap: 1rem; align-items: center;' }, [
          m('label', { style: 'font-weight: 600; color: #475569;' }, 'Network Mode'),
          m('.nw-mode-group', { style: 'display: flex; align-items: center; gap: 1rem;' }, [
            m(SetNwMode, { isHiddenMode, hideLabel: true }),
            isHiddenMode && m('.status-indicator', { style: 'display: flex; align-items: center; gap: 0.4rem;' }, [
              m('.bullet', {
                style: 'width: 10px; height: 10px; border-radius: 50%; background-color: #22c55e;'
              }),
              m('span', { style: 'font-size: 0.85rem; font-weight: 700; color: #000000;' }, '[Hidden mode]'),
            ]),
          ]),
        ]),

        // NAT row + UPnP status bullet
        !isHiddenMode && m('.nw-config-row', { style: 'display: grid; grid-template-columns: 200px 1fr; gap: 1rem; align-items: center;' }, [
          m('label', { style: 'font-weight: 600; color: #475569;' }, 'NAT'),
          m('.nat-control-group', { style: 'display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;' }, [
            m('select', {
              style: 'flex: 1; max-width: 320px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 4px;',
              value: netMode,
              onchange: (e) => saveNetMode(e.target.value),
            }, [
              m('option', { value: util.RS_NETMODE_UPNP }, 'Automatic (UPnP)'),
              m('option', { value: util.RS_NETMODE_UDP }, 'FireWalled'),
              m('option', { value: util.RS_NETMODE_EXT }, 'Manually Forwarded Port'),
            ]),
            m('.status-indicator', { style: 'display: flex; align-items: center; gap: 0.4rem;' }, [
              m('.bullet', {
                style: `width: 10px; height: 10px; border-radius: 50%; background-color: ${isUpnpOk ? '#22c55e' : '#475569'};`
              }),
              m('span', { style: 'font-size: 0.85rem; font-weight: 600; color: #334155;' }, 'UPnP'),
            ]),
          ]),
        ]),

        // Local Address + Port + Local network status bullet
        m('.nw-config-row', { style: 'display: grid; grid-template-columns: 200px 1fr; gap: 1rem; align-items: center;' }, [
          m('label', { style: 'font-weight: 600; color: #475569;' }, 'Local Address'),
          m('.addr-control-group', { style: 'display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;' }, [
            m('input[type=text]', {
              style: 'flex: 1; max-width: 320px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 4px;',
              value: localAddr,
              oninput: (e) => (localAddr = e.target.value),
              onchange: saveLocalAddress,
            }),
            m('.port-group', { style: 'display: flex; align-items: center; gap: 0.4rem;' }, [
              m('span', { style: 'font-size: 0.85rem; font-weight: 600; color: #475569;' }, 'Port:'),
              m('input[type=number]', {
                style: 'width: 90px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 4px;',
                value: localPort,
                oninput: (e) => (localPort = parseInt(e.target.value) || 0),
                onchange: saveLocalAddress,
              }),
            ]),
            !isHiddenMode && m('.status-indicator', { style: 'display: flex; align-items: center; gap: 0.4rem; margin-left: 0.5rem;' }, [
              m('.bullet', {
                style: `width: 10px; height: 10px; border-radius: 50%; background-color: ${isLocalOk ? '#22c55e' : '#ef4444'};`
              }),
              m('span', { style: 'font-size: 0.85rem; font-weight: 600; color: #334155;' }, 'Local network'),
            ]),
          ]),
        ]),

        // External Address + Port + External ip address finder status bullet
        m('.nw-config-row', { style: 'display: grid; grid-template-columns: 200px 1fr; gap: 1rem; align-items: center;' }, [
          m('label', { style: 'font-weight: 600; color: #475569;' }, 'External Address'),
          m('.addr-control-group', { style: 'display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;' }, [
            m('input[type=text]', {
              style: 'flex: 1; max-width: 320px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 4px;',
              value: isHiddenMode ? 'Hidden' : extAddr,
              disabled: isHiddenMode,
              oninput: (e) => (extAddr = e.target.value),
              onchange: saveExtAddress,
            }),
            !isHiddenMode && m('.port-group', { style: 'display: flex; align-items: center; gap: 0.4rem;' }, [
              m('span', { style: 'font-size: 0.85rem; font-weight: 600; color: #475569;' }, 'Port:'),
              m('input[type=number]', {
                style: 'width: 90px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 4px;',
                value: extPort,
                oninput: (e) => (extPort = parseInt(e.target.value) || 0),
                onchange: saveExtAddress,
              }),
            ]),
            !isHiddenMode && m('.status-indicator', { style: 'display: flex; align-items: center; gap: 0.4rem; margin-left: 0.5rem;' }, [
              m('.bullet', {
                style: `width: 10px; height: 10px; border-radius: 50%; background-color: ${isExtOk ? '#22c55e' : '#808080'};`
              }),
              m('span', { style: 'font-size: 0.85rem; font-weight: 600; color: #334155;' }, 'External ip address finder'),
            ]),
          ]),
        ]),

        // Dynamic DNS row
        !isHiddenMode && m('.nw-config-row', { style: 'display: grid; grid-template-columns: 200px 1fr; gap: 1rem; align-items: center;' }, [
          m('label', { style: 'font-weight: 600; color: #475569;' }, 'Dynamic DNS'),
          m('input[type=text]', {
            style: 'flex: 1; max-width: 320px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 4px;',
            value: dyndns,
            oninput: (e) => (dyndns = e.target.value),
            onchange: saveDynDNS,
          }),
        ]),
      ]);
    }
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
      m('.proxy-server-form', { style: 'display: flex; flex-direction: column; gap: 0.75rem; width: 100%;' }, [
        m('p.proxy-description', { style: 'margin-bottom: 0.5rem; color: #475569;' },
          'Configure your TOR and I2P SOCKS proxy here. It will allow you to also connect to hidden nodes.'
        ),
        Object.keys(socksProxyObj).map((proxyItem) => {
          const isTor = proxyItem === 'tor';
          const labelText = isTor ? 'TOR Socks Proxy:' : 'I2P Socks Proxy:';
          const outgoingText = isTor ? 'TOR outgoing' : 'I2P outgoing';
          const notEnabledText = isTor ? 'Tor proxy is not enabled' : 'I2P proxy is not enabled';
          const isOutgoing = socksProxyObj[proxyItem].outgoing;

          return m('.nw-config-row', { style: 'display: grid; grid-template-columns: 200px 1fr; gap: 1rem; align-items: center;' }, [
            m('label', { style: 'font-weight: 600; color: #475569;' }, labelText),
            m('.proxy-control-group', { style: 'display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;' }, [
              m('input[type=text]', {
                style: 'flex: 1; max-width: 480px; min-width: 320px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 4px;',
                value: socksProxyObj[proxyItem].addr || '',
                oninput: (e) => (socksProxyObj[proxyItem].addr = e.target.value),
                onchange: () => handleProxyChange(proxyItem),
              }),
              m('input[type=number]', {
                style: 'width: 90px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 4px;',
                value: socksProxyObj[proxyItem].port || 0,
                oninput: (e) => (socksProxyObj[proxyItem].port = parseInt(e.target.value) || 0),
                onchange: () => handleProxyChange(proxyItem),
              }),
              socksProxyObj[proxyItem].outgoing !== undefined &&
                m('.status-indicator', { style: 'display: flex; align-items: center; gap: 0.4rem; margin-left: 0.5rem;' }, [
                  m('.bullet', {
                    style: `width: 10px; height: 10px; border-radius: 50%; background-color: ${isOutgoing ? '#22c55e' : '#808080'};`,
                    title: isOutgoing ? 'Proxy seems to work.' : notEnabledText,
                  }),
                  m('span', { style: 'font-size: 0.85rem; font-weight: 600; color: #334155;' },
                    `${outgoingText} ${isOutgoing ? 'on' : 'off'}`
                  ),
                ]),
            ]),
          ]);
        }),
      ]),
  };
};

const displayHiddenServiceInfo = () => {
  return {
    view: ({ attrs: { details } }) =>
      details && details.hiddenNodeAddress &&
        m('.hidden-service-info', { style: 'display: flex; flex-direction: column; gap: 0.75rem; width: 100%;' }, [
          m('p.proxy-description', { style: 'margin-bottom: 0.5rem; color: #475569;' }, details.hiddenType === 4
            ? 'I2P has been automatically configured by Retroshare. You shouldn\'t need to change anything here.'
            : 'Tor has been automatically configured by Retroshare. You shouldn\'t need to change anything here.'
          ),
          // Local Address + Local Port row
          m('.nw-config-row', { style: 'display: grid; grid-template-columns: 200px 1fr; gap: 1rem; align-items: center;' }, [
            m('label', { style: 'font-weight: 600; color: #475569;' }, 'Local Address:'),
            m('.addr-port-group', { style: 'display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;' }, [
              m('input[type=text]', {
                style: 'flex: 1; max-width: 480px; min-width: 320px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 4px; background-color: #f8fafc; color: #334155;',
                readOnly: true,
                value: details.localAddr || '127.0.0.1',
              }),
              m('input[type=number]', {
                style: 'width: 90px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 4px; background-color: #f8fafc; color: #334155;',
                readOnly: true,
                value: details.localPort || 0,
              }),
            ]),
          ]),
          // Onion / I2P Address + Service Port row
          m('.nw-config-row', { style: 'display: grid; grid-template-columns: 200px 1fr; gap: 1rem; align-items: center;' }, [
            m('label', { style: 'font-weight: 600; color: #475569;' }, details.hiddenType === 4 ? 'I2P Address:' : 'Onion Address:'),
            m('.addr-port-group', { style: 'display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;' }, [
              m('input[type=text]', {
                style: 'flex: 1; max-width: 480px; min-width: 320px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 4px; background-color: #f8fafc; color: #334155; font-family: monospace;',
                readOnly: true,
                value: details.hiddenNodeAddress,
              }),
              details.hiddenNodePort && m('input[type=number]', {
                style: 'width: 90px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 4px; background-color: #f8fafc; color: #334155;',
                readOnly: true,
                value: details.hiddenNodePort,
              }),
            ]),
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
      m('.config-network', { style: 'display:flex; flex-direction:column; gap:1rem;' }, [
        m('.widget', [
          m('.widget__heading', m('h3', 'Network Configuration')),
          m('.widget__body', [
            m(NetworkConfigForm, { isHiddenMode }),
            m('hr', { style: 'margin: 1rem 0; border: none; border-top: 1px solid #e2e8f0;' }),
            m(SetLimits),
            !isHiddenMode && m(SetOpMode),
            !isHiddenMode && m(displayIPAddresses, { details }),
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
