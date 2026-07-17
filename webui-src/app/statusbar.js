const m = require('mithril');
const rs = require('rswebui');

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
};

function formatUnit(val) {
  if (!val) return '0';
  if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
  if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
  return val.toString();
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
    // DHT Status color & tooltip
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

    // NAT Status color & tooltip
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

    return m('.statusbar', [
      m('.statusbar-left', { style: 'display: flex; align-items: center; gap: 0.75rem;' }, [
        m('.statusbar-item', [
          m('i.fas.fa-users', { style: 'margin-right: 0.5rem; color: #94a3b8;' }),
          m('span', `Friends: ${State.onlineCount}/${State.friendCount}`),
        ]),
        m('.statusbar-divider'),
        m('.statusbar-item', { title: natTooltip, style: 'cursor: help;' }, [
          m('span', { style: 'margin-right: 0.5rem;' }, 'NAT:'),
          m('.status-bullet', { style: { backgroundColor: natColor } }),
        ]),
        m('.statusbar-divider'),
        m('.statusbar-item', { title: dhtTooltip, style: 'cursor: help;' }, [
          m('span', { style: 'margin-right: 0.5rem;' }, 'DHT:'),
          m('.status-bullet', { style: { backgroundColor: dhtColor } }),
          State.dhtActive && State.dhtOk && m('span', { style: 'margin-left: 0.5rem;' }, `${formatUnit(State.dhtRsNetSize)} (${formatUnit(State.dhtNetSize)})`),
        ]),
      ]),
      m('.statusbar-right'),
    ]);
  },
};

module.exports = StatusBar;
