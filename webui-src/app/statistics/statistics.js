const m = require('mithril');
const rs = require('rswebui');
const NetworkData = require('network/network_data');

const COLORS = ['#0788cb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#64748b', '#f97316'];
const SERVICE_NAMES = {
  0x0001: 'File index', 0x0011: 'Discovery', 0x0012: 'Chat', 0x0013: 'Messages',
  0x0014: 'Turtle routing', 0x0015: 'Tunnel', 0x0016: 'Heartbeat', 0x0017: 'File transfer',
  0x0018: 'Generic routing', 0x0019: 'File database', 0x0020: 'Service info',
  0x0021: 'Bandwidth control', 0x0022: 'Mail', 0x0023: 'Direct mail',
  0x0024: 'Distant mail', 0x0026: 'Service control', 0x0027: 'Distant chat',
  0x0028: 'GXS tunnel', 0x0101: 'Ban list', 0x0102: 'Status', 0x0103: 'Friend server',
  0x0200: 'Network exchange', 0x0211: 'Identities', 0x0215: 'Forums',
  0x0216: 'Boards', 0x0217: 'Channels', 0x0218: 'Circles', 0x0219: 'Reputation',
  0x0220: 'GXS recognition', 0x0230: 'GXS mail', 0x0240: 'JSON API',
};

function idString(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return rs.idToHex(value);
}

//  rs.formatBytes is the one every other page uses -- the statusbar, the chat,
//  the file lists. A second formatter here would print 1.5 MiB where the rest of
//  the interface prints 1.5 MB for the same number.
const formatBytes = rs.formatBytes;

//  network_data already fetches the friend list and each peer's details, and
//  keeps the result in NetworkData.gpgDetails for the whole session. Reading
//  that costs nothing, where a second collection of its own would mean one
//  getPeerDetails per friend, all at once, next to the traffic poll.
function friendNamesFromCache() {
  const names = {};
  Object.values(NetworkData.gpgDetails || {}).forEach((profile) => {
    (profile.locations || []).forEach((location) => {
      const id = idString(location.id);
      if (id) names[id] = profile.name || location.name || id;
    });
  });
  return names;
}

//  Friends do not appear every five seconds: the traffic figures are refreshed
//  on their own beat, the friend list on a much slower one.
const FRIENDS_REFRESH_MS = 60000;

// RetroShare wraps uint64_t values as { xint64, xstr64 } because JSON numbers
// cannot safely represent every 64-bit integer. Prefer the decimal string so a
// large cumulative byte count is not truncated before it reaches this page.
function number64(value) {
  if (!value) return 0;
  if (typeof value === 'object') return Number(value.xstr64 || value.xint64) || 0;
  return Number(value) || 0;
}

function cumulativeRows(entries, labelFor) {
  return (Array.isArray(entries) ? entries : []).map((entry) => {
    const stats = entry.value || {};
    const incoming = number64(stats.bytesIn);
    const outgoing = number64(stats.bytesOut);
    const key = typeof entry.key === 'number' ? String(entry.key) : idString(entry.key) || String(entry.key);
    return {
      key,
      label: labelFor(entry.key),
      incoming,
      outgoing,
      total: incoming + outgoing,
      count: (Number(stats.countIn) || 0) + (Number(stats.countOut) || 0),
      firstSeen: number64(stats.firstSeen),
      lastSeen: number64(stats.lastSeen),
    };
  }).sort((a, b) => b.total - a.total);
}

function aggregate(incoming, outgoing, keyFor, labelFor) {
  const rows = new Map();
  const add = (clue, direction) => {
    const key = keyFor(clue);
    const row = rows.get(key) || { key, label: labelFor(clue, key), incoming: 0, outgoing: 0, count: 0 };
    row[direction] += Number(clue.size) || 0;
    row.count += Number(clue.count) || 0;
    rows.set(key, row);
  };
  incoming.forEach((clue) => add(clue, 'incoming'));
  outgoing.forEach((clue) => add(clue, 'outgoing'));
  return Array.from(rows.values()).map((row) => ({ ...row, total: row.incoming + row.outgoing }))
    .sort((a, b) => b.total - a.total);
}

function PieChart() {
  return {
    view(vnode) {
      const rows = vnode.attrs.rows.filter((row) => row.total > 0);
      const total = rows.reduce((sum, row) => sum + row.total, 0);
      let offset = 0;
      return m('.traffic-pie', [
        m('svg[viewBox="0 0 120 120"][role=img]', { 'aria-label': vnode.attrs.label }, [
          m('circle[cx=60][cy=60][r=44].traffic-pie__track'),
          //  A dash offset of zero starts at three o'clock; the group turns the
          //  segments back to twelve, where a pie chart is read from. Only the
          //  segments: the totals in the middle stay upright.
          m('g[transform="rotate(-90 60 60)"]', rows.map((row, index) => {
            const length = total ? (row.total / total) * 276.46 : 0;
            const segment = m('circle[cx=60][cy=60][r=44].traffic-pie__segment', {
              stroke: COLORS[index % COLORS.length],
              'stroke-dasharray': `${length} ${276.46 - length}`,
              'stroke-dashoffset': -offset,
            }, m('title', `${row.label}: ${formatBytes(row.total)}`));
            offset += length;
            return segment;
          })),
          m('text[x=60][y=57][text-anchor=middle].traffic-pie__value', formatBytes(total)),
          m('text[x=60][y=70][text-anchor=middle].traffic-pie__caption', 'total traffic'),
        ]),
        m('.traffic-legend', rows.map((row, index) =>
          m('.traffic-legend__item', [
            m('span.traffic-legend__swatch', { style: { backgroundColor: COLORS[index % COLORS.length] } }),
            m('span.traffic-legend__name', row.label),
            m('strong', `${total ? ((row.total / total) * 100).toFixed(1) : 0}%`),
          ])
        )),
      ]);
    },
  };
}

function TrafficPanel() {
  return {
    view(vnode) {
      const rows = vnode.attrs.rows;
      return m('section.traffic-panel', [
        m('.traffic-panel__heading', [m('div', [m('h2', vnode.attrs.title), m('p', vnode.attrs.description)])]),
        rows.length
          ? [m(PieChart, { rows, label: `${vnode.attrs.title} traffic distribution` }),
            m('.traffic-table-wrap', m('table.traffic-table', [
              m('thead', m('tr', [m('th', vnode.attrs.column), m('th', 'Incoming'), m('th', 'Outgoing'), m('th', 'Total'), m('th', 'Packets')])),
              m('tbody', rows.map((row) => m('tr', [
                m('td', row.label), m('td', formatBytes(row.incoming)), m('td', formatBytes(row.outgoing)),
                m('td', m('strong', formatBytes(row.total))), m('td', row.count.toLocaleString()),
              ]))),
            ]))]
          : m('.traffic-empty', [m('i.fas.fa-chart-pie'), m('p', 'No traffic has been recorded in the current tracking window.')]),
      ]);
    },
  };
}

module.exports = {
  oninit(vnode) {
    vnode.state.incoming = [];
    vnode.state.outgoing = [];
    vnode.state.error = '';
    vnode.state.cumulativeServices = null;
    vnode.state.cumulativePeers = null;
    vnode.state.load = async () => {
      //  Two requests per run, every five seconds, plus whatever the Refresh
      //  button adds. Without this the runs stack up as soon as one of them is
      //  slower than the interval -- and on a phone they are, each answer
      //  closing its connection.
      if (vnode.state.loading) return;
      vnode.state.loading = true;
      try {
        if (Date.now() - vnode.state.friendsRefreshedAt > FRIENDS_REFRESH_MS) {
          vnode.state.refreshFriends();
        }
        const [serviceResponse, peerResponse] = await Promise.all([
          rs.rsJsonApiRequest('/rsConfig/getCumulativeTrafficByService'),
          rs.rsJsonApiRequest('/rsConfig/getCumulativeTrafficByPeer'),
        ]);
        const serviceBody = serviceResponse.body || {};
        const peerBody = peerResponse.body || {};
        if (serviceResponse.status === 200 && peerResponse.status === 200 && serviceBody.retval && peerBody.retval) {
          vnode.state.cumulativeServices = serviceBody.stats || [];
          vnode.state.cumulativePeers = peerBody.stats || [];
          vnode.state.error = '';
        } else {
          // Older cores do not expose the cumulative API. Retain the live-window
          // view as a compatibility fallback instead of leaving the page empty.
          const response = await rs.rsJsonApiRequest('/rsConfig/getTrafficInfo');
          const body = response.body || {};
          if (response.status === 200 && body.retval) {
            vnode.state.incoming = Array.isArray(body.in_lst) ? body.in_lst : [];
            vnode.state.outgoing = Array.isArray(body.out_lst) ? body.out_lst : [];
            vnode.state.error = 'This Core only provides the current traffic window; cumulative totals require the newer traffic statistics API.';
          } else {
            vnode.state.error = 'Traffic statistics are not available from this RetroShare Core.';
          }
        }
      } finally {
        //  Whatever happened, the page must not stay locked on "loading": the
        //  guard above would then never let another run through.
        vnode.state.loading = false;
        m.redraw();
      }
    };
    vnode.state.refreshFriends = () => {
      vnode.state.friendsRefreshedAt = Date.now();
      NetworkData.refreshGpgDetails().then(() => m.redraw()).catch(() => {});
    };
    vnode.state.friendsRefreshedAt = 0;
    vnode.state.loading = false;
    vnode.state.load();
    vnode.state.timer = setInterval(vnode.state.load, 5000);
  },
  onremove(vnode) { clearInterval(vnode.state.timer); },
  view(vnode) {
    const serviceLabel = (value) => {
      const id = Number(value) || 0;
      return SERVICE_NAMES[id] || `Service 0x${id.toString(16).padStart(4, '0')}`;
    };
    const friendNames = friendNamesFromCache();
    const friendLabel = (value) => {
      const id = idString(value) || 'unknown';
      return friendNames[id] || (id === 'unknown' ? 'Unknown peer' : `Peer ${id.slice(0, 8)}…`);
    };
    const serviceRows = vnode.state.cumulativeServices
      ? cumulativeRows(vnode.state.cumulativeServices, serviceLabel)
      : aggregate(vnode.state.incoming, vnode.state.outgoing,
        (clue) => Number(clue.service_id) || 0, (_clue, id) => serviceLabel(id));
    const friendRows = vnode.state.cumulativePeers
      ? cumulativeRows(vnode.state.cumulativePeers, friendLabel)
      : aggregate(vnode.state.incoming, vnode.state.outgoing,
        (clue) => idString(clue.peer_id) || 'unknown', (_clue, id) => friendLabel(id));
    return m('.statistics-page', [
      m('.statistics-header', [
        m('div', [m('h1', [m('i.fas.fa-chart-pie'), ' Traffic statistics']), m('p', 'Live traffic distribution reported by RetroShare Core.')]),
        m('button[type=button]', { disabled: vnode.state.loading, onclick: vnode.state.load }, [m('i.fas.fa-sync-alt'), ' Refresh']),
      ]),
      vnode.state.error && m('.statistics-error', [m('i.fas.fa-exclamation-triangle'), vnode.state.error]),
      m('.statistics-grid', [
        m(TrafficPanel, { title: 'By service', description: 'Which RetroShare services use the most bandwidth.', column: 'Service', rows: serviceRows }),
        m(TrafficPanel, { title: 'By friend', description: 'Traffic exchanged with each friend location.', column: 'Friend', rows: friendRows }),
      ]),
      m('p.statistics-note', vnode.state.cumulativeServices
        ? 'Cumulative values are retained by the Core and refresh every 5 seconds.'
        : 'Values cover the current traffic window and refresh every 5 seconds.'),
    ]);
  },
};
