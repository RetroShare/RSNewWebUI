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
};

function formatUnit(val) {
  if (!val) return '0';
  if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
  if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
  return val.toString();
}

/**
 * TCP port-reachability probe using the fetch() AbortError trick.
 *
 *   PORT OPEN (Tor SOCKS on 9050):
 *     TCP connect succeeds → browser waits for HTTP headers that never come
 *     → AbortController fires after timeoutMs → AbortError → true ✓
 *
 *   PORT CLOSED (Tor not running):
 *     TCP connection refused instantly (loopback RST) → TypeError < 10 ms → false ✓
 */
function checkPortReachable(addr, port, timeoutMs = 600) {
  if (!addr || !port) return Promise.resolve(false);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(`http://${addr}:${port}`, {
    mode: 'no-cors',
    signal: controller.signal,
    cache: 'no-store',
  })
    .then(() => { clearTimeout(timer); return true; })
    .catch((err) => { clearTimeout(timer); return err.name === 'AbortError'; });
}

/**
 * Fetch the own peer's hidden type and proxy address, then TCP-check the proxy.
 * Mirrors Qt's TorStatus::getTorStatus() with both TorAuto and manual paths.
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

      rs.rsJsonApiRequest('/rsAccounts/isTorAuto', {}).then((torAutoRes) => {
        const isTorAuto = torAutoRes && torAutoRes.body && torAutoRes.body.retval;

        if (isTorAuto) {
          Promise.all([
            rs.rsJsonApiRequest('/rsTor/torStatus', {}),
            rs.rsJsonApiRequest('/rsTor/torConnectivityStatus', {}),
          ]).then(([torRes, connRes]) => {
            const torStatus        = torRes  && torRes.body  ? torRes.body.retval  : 0;
            const connStatus       = connRes && connRes.body ? connRes.body.retval : 0;
            const torControlOk     = connStatus === 6;
            const torReady         = torStatus === 2;

            State.hiddenType = RS_HIDDEN_TYPE_TOR;

            if (torReady && torControlOk) {
              State.torProxyOk     = true;
              State.torChecking    = false;
            } else if (torStatus === 1) {
              State.torProxyOk     = false;
              State.torChecking    = false;
            } else {
              State.torProxyOk     = null;
              State.torChecking    = true;
            }
            m.redraw();
          });
        } else {
          const targetType = details.hiddenType || RS_HIDDEN_TYPE_TOR;
          rs.rsJsonApiRequest('/rsPeers/getProxyServer', { type: targetType }).then((pr) => {
            if (pr && pr.body && pr.body.retval && pr.body.addr && pr.body.port) {
              State.hiddenType = targetType;
              State.torChecking = true;
              m.redraw();
              checkPortReachable(pr.body.addr, pr.body.port).then((ok) => {
                State.torProxyOk = ok;
                State.torChecking = false;
                m.redraw();
              });
            } else {
              State.hiddenType = targetType;
              State.torProxyOk = false;
              State.torChecking = false;
              m.redraw();
            }
          });
        }
      }).catch(() => {
        State.hiddenType = RS_HIDDEN_TYPE_NONE;
        State.torProxyOk = null;
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

  // 2. Net / DHT config status
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
    }
  });

  // 3. NAT netState
  rs.rsJsonApiRequest('/rsConfig/getNetState', {}, (data) => {
    if (data && data.retval !== undefined) {
      State.natState = data.retval;
    } else {
      // Fallback calculation based on getConfigNetStatus
      if (State.firewalled && !State.forwardPort) {
        State.natState = 6; // WARNING_NATTED
      } else {
        State.natState = 8; // GOOD
      }
    }
  });

  // 4. Tor/I2P hidden-mode status (same as Qt TorStatus widget)
  updateTorStatus();
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
      m('.statusbar-left', { style: 'display: flex; align-items: center; gap: 0.75rem;' }, [
        m('.statusbar-item', [
          m('i.fas.fa-users', { style: 'margin-right: 0.5rem; color: #94a3b8;' }),
          m('span', `Friends: ${State.onlineCount}/${State.friendCount}`),
        ]),

        // NAT — hidden when in hidden/darknet mode (same as Qt)
        !isHiddenMode && m('.statusbar-divider'),
        !isHiddenMode && m('.statusbar-item', { title: natTooltip, style: 'cursor: help;' }, [
          m('span', { style: 'margin-right: 0.5rem;' }, 'NAT:'),
          m('.status-bullet', { style: { backgroundColor: natColor } }),
        ]),

        // DHT — hidden when in hidden/darknet mode (same as Qt)
        !isHiddenMode && m('.statusbar-divider'),
        !isHiddenMode && m('.statusbar-item', { title: dhtTooltip, style: 'cursor: help;' }, [
          m('span', { style: 'margin-right: 0.5rem;' }, 'DHT:'),
          m('.status-bullet', { style: { backgroundColor: dhtColor } }),
          State.dhtActive && State.dhtOk && m('span', { style: 'margin-left: 0.5rem;' }, `${formatUnit(State.dhtRsNetSize)} (${formatUnit(State.dhtNetSize)})`),
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
      m('.statusbar-right'),
    ]);
  },
};

module.exports = StatusBar;
