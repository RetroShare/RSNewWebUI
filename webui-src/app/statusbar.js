const m = require('mithril');
const rs = require('rswebui');

// RS_HIDDEN_TYPE constants (from config_util.js / retroshare/rspeers.h)
const RS_HIDDEN_TYPE_NONE    = 0;
const RS_HIDDEN_TYPE_TOR     = 2;
const RS_HIDDEN_TYPE_I2P     = 4;

const State = {
  friendCount: 0,
  onlineCount: 0,
  dhtActive: false,
  dhtOk: false,
  dhtRsNetSize: 0,
  dhtNetSize: 0,
  natState: 1, // BAD_UNKNOWN
  firewalled: true,
  forwardPort: false,
  stunOk: false,
  extAddressOk: false,

  // Hidden-mode / Tor+I2P state  (mirrors TorStatus widget in Qt)
  hiddenType: RS_HIDDEN_TYPE_NONE, // 0=none, 2=Tor, 4=I2P
  torProxyOk: null,   // null=unchecked, true=ok, false=fail
  torChecking: false,

  // Bandwidth rate status (mirrors RatesStatus widget in Qt)
  rateIn: 0.0,
  totalIn: 0,
  rateOut: 0.0,
  totalOut: 0,
};

function parse64Num(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  if (typeof val === 'object') {
    if (val.xuint64 !== undefined) return parseFloat(val.xuint64) || 0;
    if (val.xint64 !== undefined) return parseFloat(val.xint64) || 0;
    if (val.xstr64 !== undefined) return parseFloat(val.xstr64) || 0;
  }
  return 0;
}

function formatUnit(val) {
  const num = parse64Num(val);
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}

function formatBytes(rawBytes) {
  const bytes = parse64Num(rawBytes);
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeI = Math.max(0, Math.min(i, sizes.length - 1));
  return parseFloat((bytes / Math.pow(k, safeI)).toFixed(1)) + ' ' + sizes[safeI];
}

/**
 * Fetch the own peer's hidden type and proxy status using /rsTor API.
 * Mirrors Qt's TorStatus::getTorStatus().
 */
function updateTorStatus() {
  if (!rs.loginKey.isVerified) return;

  rs.rsJsonApiRequest('/rsAccounts/getCurrentAccountId').then((res) => {
    if (!res || !res.body || !res.body.retval) return;
    const sslId = res.body.id;

    rs.rsJsonApiRequest('/rsPeers/getPeerDetails', { sslId }).then((pres) => {
      if (!pres || !pres.body || !pres.body.retval) return;
      const details = pres.body.det;

      const isHiddenNode = Boolean(
        details && (
          details.hiddenType === RS_HIDDEN_TYPE_TOR ||
          details.hiddenType === RS_HIDDEN_TYPE_I2P ||
          details.extAddr === 'Hidden'
        )
      );

      if (!isHiddenNode) {
        State.hiddenType = RS_HIDDEN_TYPE_NONE;
        State.torProxyOk = null;
        State.torChecking = false;
        m.redraw();
        return;
      }

      const targetType = details.hiddenType || RS_HIDDEN_TYPE_TOR;
      State.hiddenType = targetType;

      // Check if node uses automated Tor management via /rsAccounts/isTorAuto (same as Qt)
      rs.rsJsonApiRequest('/rsAccounts/isTorAuto', {}).then((autoRes) => {
        const isAuto = autoRes && (autoRes.retval || (autoRes.body && autoRes.body.retval));
        if (isAuto) {
          Promise.all([
            rs.rsJsonApiRequest('/rsTor/torStatus', {}),
            rs.rsJsonApiRequest('/rsTor/torConnectivityStatus', {}),
          ]).then(([torRes, connRes]) => {
            const torStatus        = torRes  && torRes.body  ? torRes.body.retval  : (torRes  && torRes.retval !== undefined ? torRes.retval  : 0);
            const connStatus       = connRes && connRes.body ? connRes.body.retval : (connRes && connRes.retval !== undefined ? connRes.retval : 0);
            const torControlOk     = connStatus === 6; // HIDDEN_SERVICE_READY
            const torReady         = torStatus === 2;   // READY

            if (torReady && torControlOk) {
              State.torProxyOk     = true;
              State.torChecking    = false;
            } else if (torStatus === 1 || connStatus === 0 || connStatus === 1) {
              // OFFLINE, ERROR, or NOT_CONNECTED
              State.torProxyOk     = false;
              State.torChecking    = false;
            } else if (connStatus >= 2 && connStatus <= 5) {
              // CONNECTING, SOCKET_CONNECTED, AUTHENTICATING, AUTHENTICATED
              State.torProxyOk     = null;
              State.torChecking    = true;
            } else {
              // UNKNOWN / default
              State.torProxyOk     = null;
              State.torChecking    = false;
            }
            m.redraw();
          }).catch(() => {
            State.torProxyOk     = true;
            State.torChecking    = false;
            m.redraw();
          });
        } else {
          // Manual Tor / I2P proxy node
          State.torProxyOk     = true;
          State.torChecking    = false;
          m.redraw();
        }
      }).catch(() => {
        // Fallback for uncompiled backend: query /rsTor endpoints directly or assume active
        Promise.all([
          rs.rsJsonApiRequest('/rsTor/torStatus', {}),
          rs.rsJsonApiRequest('/rsTor/torConnectivityStatus', {}),
        ]).then(([torRes, connRes]) => {
          const torStatus        = torRes  && torRes.body  ? torRes.body.retval  : (torRes  && torRes.retval !== undefined ? torRes.retval  : 0);
          const connStatus       = connRes && connRes.body ? connRes.body.retval : (connRes && connRes.retval !== undefined ? connRes.retval : 0);
          const torControlOk     = connStatus === 6; // HIDDEN_SERVICE_READY
          const torReady         = torStatus === 2;   // READY

          if (torReady && torControlOk) {
            State.torProxyOk     = true;
            State.torChecking    = false;
          } else if (torStatus === 1 || connStatus === 0 || connStatus === 1) {
            State.torProxyOk     = false;
            State.torChecking    = false;
          } else if (connStatus >= 2 && connStatus <= 5) {
            State.torProxyOk     = null;
            State.torChecking    = true;
          } else {
            State.torProxyOk     = null;
            State.torChecking    = false;
          }
          m.redraw();
        }).catch(() => {
          State.torProxyOk     = true;
          State.torChecking    = false;
          m.redraw();
        });
      });
    });
  }).catch(() => {
    State.hiddenType = RS_HIDDEN_TYPE_NONE;
    State.torProxyOk = null;
  });
}

function updateStatus() {
  if (!rs.loginKey.isVerified) return;

  // 1. Friends count
  rs.rsJsonApiRequest('/rsPeers/getFriendList', {}, (data) => {
    if (data && data.sslIds) {
      State.friendCount = data.sslIds.length;
    }
  });
  rs.rsJsonApiRequest('/rsPeers/getOnlineList', {}, (data) => {
    if (data && data.sslIds) {
      State.onlineCount = data.sslIds.length;
    }
  });

  // 2. Net / DHT config status & NAT state
  rs.rsJsonApiRequest('/rsConfig/getConfigNetStatus', {}, (data) => {
    if (data && data.status) {
      State.dhtActive = data.status.DHTActive;
      State.dhtOk = data.status.netDhtOk;
      State.dhtRsNetSize = data.status.netDhtRsNetSize;
      State.dhtNetSize = data.status.netDhtNetSize;
      State.firewalled = data.status.firewalled;
      State.forwardPort = data.status.forwardPort;
      State.stunOk = data.status.netStunOk;
      State.extAddressOk = data.status.netExtAddressOk;

      // Compute NAT state directly from RsConfigNetStatus
      if (!data.status.netLocalOk && !data.status.netExtAddressOk) {
        State.natState = 2; // BAD_OFFLINE
      } else if (data.status.firewalled && !data.status.forwardPort && !data.status.netUpnpOk) {
        State.natState = 6; // WARNING_NATTED
      } else if (data.status.forwardPort || data.status.netUpnpOk) {
        State.natState = 9; // ADV_FORWARD
      } else {
        State.natState = 8; // GOOD
      }
    }
  });

  // 3. NAT netState from /rsConfig/getNetState
  rs.rsJsonApiRequest('/rsConfig/getNetState', {}, (data) => {
    if (data && data.retval !== undefined) {
      State.natState = data.retval;
      m.redraw();
    } else if (data && data.body && data.body.retval !== undefined) {
      State.natState = data.body.retval;
      m.redraw();
    }
  });

  // 4. Tor/I2P hidden-mode status (same as Qt TorStatus widget)
  updateTorStatus();

  // 5. Bandwidth rates (same as Qt RatesStatus widget)
  rs.rsJsonApiRequest('/rsConfig/getTotalBandwidthRates', {}, (data) => {
    const rates = (data && data.rates) || (data && data.body && data.body.rates);
    if (rates) {
      State.rateIn   = rates.mRateIn   !== undefined ? rates.mRateIn   : (rates.rateIn   || 0.0);
      State.totalIn  = rates.mTotalIn  !== undefined ? rates.mTotalIn  : (rates.totalIn  || 0);
      State.rateOut  = rates.mRateOut  !== undefined ? rates.mRateOut  : (rates.rateOut  || 0.0);
      State.totalOut = rates.mTotalOut !== undefined ? rates.mTotalOut : (rates.totalOut || 0);
      m.redraw();
    }
  });
}

let intervalId = null;

const StatusBar = {
  oninit() {
    updateStatus();
    intervalId = setInterval(updateStatus, 10000); // update every 10s
  },
  onremove() {
    if (intervalId) {
      clearInterval(intervalId);
    }
  },
  view() {
    const isHiddenMode = State.hiddenType === RS_HIDDEN_TYPE_TOR ||
                         State.hiddenType === RS_HIDDEN_TYPE_I2P;

    // ── DHT Status (hidden when in hidden/darknet mode) ────────────────────
    let dhtColor = '#94a3b8'; // grey (off)
    let dhtTooltip = 'DHT Off';
    if (State.dhtActive) {
      if (State.dhtOk) {
        if (State.dhtRsNetSize < 10) {
          dhtColor = '#eab308'; // yellow (searching)
          dhtTooltip = 'DHT Searching for RetroShare Peers';
        } else {
          dhtColor = '#22c55e'; // green (good)
          dhtTooltip = 'DHT Good';
        }
      } else {
        dhtColor = '#ef4444'; // red (error)
        dhtTooltip = 'No peer found in DHT';
      }
    }

    // ── NAT Status (hidden when in hidden/darknet mode) ────────────────────
    let natColor = '#94a3b8';
    let natTooltip = 'Offline';
    switch (State.natState) {
      case 1: // BAD_UNKNOWN
        natColor = '#eab308';
        natTooltip = 'Network Status Unknown';
        break;
      case 2: // BAD_OFFLINE
        natColor = '#94a3b8';
        natTooltip = 'Offline';
        break;
      case 3: // BAD_NATSYM
      case 4: // BAD_NODHT_NAT
        natColor = '#ef4444';
        natTooltip = State.natState === 4 ? 'DHT Disabled and Firewalled' : 'Nasty Firewall';
        break;
      case 5: // WARNING_RESTART
        natColor = '#eab308';
        natTooltip = 'Network Restarting';
        break;
      case 6: // WARNING_NATTED
        natColor = '#eab308';
        natTooltip = 'Behind Firewall';
        break;
      case 7: // WARNING_NODHT
        natColor = '#eab308';
        natTooltip = 'DHT Disabled';
        break;
      case 8: // GOOD
        natColor = '#22c55e';
        natTooltip = 'RetroShare Server';
        break;
      case 9: // ADV_FORWARD
        natColor = '#22c55e';
        natTooltip = 'Forwarded Port';
        break;
    }

    // ── Tor / I2P status indicator ─────────────────────────────────────────
    // Only shown when peer is in RS_NETMODE_HIDDEN with a proxy type set.
    // Mirrors Qt TorStatus widget label + icon logic.
    let torLabel, torColor, torIcon, torTooltip;
    if (isHiddenMode) {
      torLabel = State.hiddenType === RS_HIDDEN_TYPE_TOR ? 'Tor:' : 'I2P:';
      if (State.torChecking) {
        torColor = '#f59e0b';
        torIcon  = 'fas fa-spinner fa-spin';
        torTooltip = 'Checking proxy…';
      } else if (State.torProxyOk === null) {
        torColor = '#94a3b8';
        torIcon  = 'fas fa-shield-alt';
        torTooltip = State.hiddenType === RS_HIDDEN_TYPE_TOR
          ? 'No Tor configuration'
          : 'No I2P configuration';
      } else if (State.torProxyOk) {
        torColor = '#22c55e';
        torIcon  = 'fas fa-shield-alt';
        torTooltip = State.hiddenType === RS_HIDDEN_TYPE_TOR
          ? 'Tor proxy is OK'
          : 'I2P proxy is OK';
      } else {
        torColor = '#ef4444';
        torIcon  = 'fas fa-shield-alt';
        torTooltip = State.hiddenType === RS_HIDDEN_TYPE_TOR
          ? 'Tor proxy is not available'
          : 'I2P proxy is not available';
      }
    }

    return m('.statusbar', [
      m('.statusbar-left', [
        m('.statusbar-item', [
          m('i.fas.fa-users', { style: 'margin-right: 0.35rem; color: #94a3b8;' }),
          m('span.statusbar-label', 'Friends:\u00a0'),
          m('span.statusbar-value', `${State.onlineCount}/${State.friendCount}`),
        ]),

        // NAT — hidden when in hidden/darknet mode (same as Qt)
        !isHiddenMode && m('.statusbar-divider'),
        !isHiddenMode && m('.statusbar-item.statusbar-item--nat', {
          title: natTooltip,
          style: 'cursor: help; margin-left: 0.6rem;',
        }, [
          m('span.statusbar-label', { style: 'margin-right: 0.35rem;' }, 'NAT:'),
          m('.status-bullet', {
            style: { backgroundColor: natColor, marginLeft: '0.15rem', marginRight: '0.45rem' },
          }),
        ]),

        // DHT — hidden when in hidden/darknet mode (same as Qt)
        !isHiddenMode && m('.statusbar-divider'),
        !isHiddenMode && m('.statusbar-item.statusbar-item--dht', {
          title: dhtTooltip,
          style: 'cursor: help; margin-left: 0.6rem;',
        }, [
          m('span.statusbar-label', { style: 'margin-right: 0.35rem;' }, 'DHT:'),
          m('.status-bullet', {
            style: { backgroundColor: dhtColor, marginLeft: '0.15rem', marginRight: '0.35rem' },
          }),
          State.dhtActive && State.dhtOk && m('span.statusbar-extra-info', { style: 'margin-left: 0.35rem;' }, `${formatUnit(State.dhtRsNetSize)} (${formatUnit(State.dhtNetSize)})`),
        ]),

        // Tor / I2P — only shown when in hidden/darknet mode (same as Qt)
        isHiddenMode && m('.statusbar-divider'),
        isHiddenMode && m('.statusbar-item.statusbar-item--tor', {
          title: torTooltip,
          style: 'cursor: help;',
        }, [
          m('span.tor-label', { style: 'margin-right: 0.4rem; font-weight: 600;' }, torLabel),
          m('i.' + torIcon, { style: { color: torColor, fontSize: '1rem', transition: 'color 0.3s' } }),
        ]),
      ]),

      // RatesStatus — Bandwidth speeds & total cumulative transfer (Down | Up)
      m('.statusbar-right', [
        m('.statusbar-item', {
          title: `Downloaded: ${formatBytes(State.totalIn)}`,
          style: 'cursor: help;'
        }, [
          m('i.fas.fa-arrow-down', { style: 'color: #22c55e; margin-right: 0.25rem;' }),
          m('span.statusbar-label', 'Down:\u00a0'),
          m('span.statusbar-value', `${State.rateIn.toFixed(1)} kB/s`),
          m('span.statusbar-total-bytes', { style: 'color: #64748b; font-size: 0.8rem; margin-left: 0.25rem;' }, `(${formatBytes(State.totalIn)})`),
        ]),
        m('.statusbar-divider'),
        m('.statusbar-item', {
          title: `Uploaded: ${formatBytes(State.totalOut)}`,
          style: 'cursor: help;'
        }, [
          m('i.fas.fa-arrow-up', { style: 'color: #3b82f6; margin-right: 0.25rem;' }),
          m('span.statusbar-label', 'Up:\u00a0'),
          m('span.statusbar-value', `${State.rateOut.toFixed(1)} kB/s`),
          m('span.statusbar-total-bytes', { style: 'color: #64748b; font-size: 0.8rem; margin-left: 0.25rem;' }, `(${formatBytes(State.totalOut)})`),
        ]),
      ]),
    ]);
  },
};

module.exports = StatusBar;
