const m = require('mithril');
const rs = require('rswebui');
const NetworkData = require('network/network_data');
const icon = require('icon');
const widget = require('widgets');

function idString(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return rs.idToHex(value);
}

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

function resolvePeer(val, friendNames) {
  if (!val) return 'Unknown peer';
  const str = typeof val === 'string' ? val : idString(val);
  if (friendNames[str]) return friendNames[str];
  if (/^[0-9a-fA-F]{16,64}$/.test(str)) {
    return `Peer ${str.slice(0, 8)}…`;
  }
  return str;
}

function number64(value) {
  if (!value) return 0;
  if (typeof value === 'object') return Number(value.xstr64 || value.xint64) || 0;
  return Number(value) || 0;
}

function formatSpeed(bytesPerSec) {
  const bps = Number(bytesPerSec) || 0;
  if (bps <= 0) return '0 B/s';
  return `${rs.formatBytes(bps)}/s`;
}

function formatHexId(id) {
  if (id === undefined || id === null) return '0x00000000';
  if (typeof id === 'string') {
    return id.startsWith('0x') ? id : `0x${id}`;
  }
  return `0x${(Number(id) >>> 0).toString(16).padStart(8, '0')}`;
}

function formatAge(ageSec) {
  const sec = Math.max(0, Math.floor(Number(ageSec) || 0));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return `${min}m ${remSec}s ago`;
  const hours = Math.floor(min / 60);
  return `${hours}h ${min % 60}m ago`;
}

const Turtle = {
  trafficInfo: null,
  hashesInfo: [],
  tunnelsInfo: [],
  searchReqsInfo: [],
  tunnelReqsInfo: [],
  loading: false,
  error: '',
  timer: null,
  activeTab: 'tunnels',
  filterQuery: '',
  selectedHash: '',

  // Accumulated volume in bytes since the session started
  sessionVolumes: {
    transitBytes: 0,
    dataDnBytes: 0,
    dataUpBytes: 0,
    trDnBytes: 0,
    trUpBytes: 0,
    totalDnBytes: 0,
    totalUpBytes: 0,
    lastTimestamp: 0,
  },

  // Lifetime cumulative volume from RetroShare Core (services 0x0014 and 0x0015)
  coreCumulative: {
    routingIn: 0,
    routingOut: 0,
    tunnelIn: 0,
    tunnelOut: 0,
    available: false,
  },

  async load() {
    if (Turtle.loading) return;
    Turtle.loading = true;
    try {
      const [trafficRes, infoRes, serviceRes] = await Promise.all([
        rs.rsJsonApiRequest('/rsTurtle/getTrafficStatistics'),
        rs.rsJsonApiRequest('/rsTurtle/getInfo'),
        rs.rsJsonApiRequest('/rsConfig/getCumulativeTrafficByService').catch(() => null),
      ]);

      const trafficBody = trafficRes.body || trafficRes || {};
      const infoBody = infoRes.body || infoRes || {};
      const serviceBody = (serviceRes && (serviceRes.body || serviceRes)) || {};

      let hasSuccess = false;

      if (trafficRes.status === 200 && trafficBody.retval !== false) {
        const rawInfo = trafficBody.info || trafficBody;
        Turtle.trafficInfo = {
          unknownUpdnBps: Number(rawInfo.unknown_updn_Bps ?? rawInfo.unknownUpdnBps) || 0,
          dataUpBps: Number(rawInfo.data_up_Bps ?? rawInfo.dataUpBps) || 0,
          dataDnBps: Number(rawInfo.data_dn_Bps ?? rawInfo.dataDnBps) || 0,
          trUpBps: Number(rawInfo.tr_up_Bps ?? rawInfo.trUpBps) || 0,
          trDnBps: Number(rawInfo.tr_dn_Bps ?? rawInfo.trDnBps) || 0,
          totalUpBps: Number(rawInfo.total_up_Bps ?? rawInfo.totalUpBps) || 0,
          totalDnBps: Number(rawInfo.total_dn_Bps ?? rawInfo.totalDnBps) || 0,
          forwardProbabilities: Array.isArray(rawInfo.forward_probabilities || rawInfo.forwardProbabilities)
            ? (rawInfo.forward_probabilities || rawInfo.forwardProbabilities).map(Number)
            : [],
        };

        // Accumulate session bytes based on elapsed time
        const now = Date.now();
        if (Turtle.sessionVolumes.lastTimestamp > 0) {
          const dt = (now - Turtle.sessionVolumes.lastTimestamp) / 1000;
          if (dt > 0 && dt < 60) {
            Turtle.sessionVolumes.transitBytes += Turtle.trafficInfo.unknownUpdnBps * dt;
            Turtle.sessionVolumes.dataDnBytes += Turtle.trafficInfo.dataDnBps * dt;
            Turtle.sessionVolumes.dataUpBytes += Turtle.trafficInfo.dataUpBps * dt;
            Turtle.sessionVolumes.trDnBytes += Turtle.trafficInfo.trDnBps * dt;
            Turtle.sessionVolumes.trUpBytes += Turtle.trafficInfo.trUpBps * dt;
            Turtle.sessionVolumes.totalDnBytes += Turtle.trafficInfo.totalDnBps * dt;
            Turtle.sessionVolumes.totalUpBytes += Turtle.trafficInfo.totalUpBps * dt;
          }
        }
        Turtle.sessionVolumes.lastTimestamp = now;
        hasSuccess = true;
      }

      if (infoRes.status === 200 && infoBody.retval !== false) {
        Turtle.hashesInfo = Array.isArray(infoBody.hashes_info || infoBody.hashesInfo)
          ? (infoBody.hashes_info || infoBody.hashesInfo)
          : [];
        Turtle.tunnelsInfo = Array.isArray(infoBody.tunnels_info || infoBody.tunnelsInfo)
          ? (infoBody.tunnels_info || infoBody.tunnelsInfo)
          : [];
        Turtle.searchReqsInfo = Array.isArray(infoBody.search_reqs_info || infoBody.searchReqsInfo)
          ? (infoBody.search_reqs_info || infoBody.searchReqsInfo)
          : [];
        Turtle.tunnelReqsInfo = Array.isArray(infoBody.tunnel_reqs_info || infoBody.tunnelReqsInfo)
          ? (infoBody.tunnel_reqs_info || infoBody.tunnelReqsInfo)
          : [];
        hasSuccess = true;
      }

      // Lifetime cumulative stats for Turtle (0x0014) and Tunnel (0x0015)
      if (serviceRes && serviceRes.status === 200 && Array.isArray(serviceBody.stats)) {
        let found = false;
        serviceBody.stats.forEach((entry) => {
          const key = Number(entry.key);
          const val = entry.value || {};
          if (key === 0x0014) {
            Turtle.coreCumulative.routingIn = number64(val.bytesIn);
            Turtle.coreCumulative.routingOut = number64(val.bytesOut);
            found = true;
          } else if (key === 0x0015) {
            Turtle.coreCumulative.tunnelIn = number64(val.bytesIn);
            Turtle.coreCumulative.tunnelOut = number64(val.bytesOut);
            found = true;
          }
        });
        Turtle.coreCumulative.available = found;
      }

      if (hasSuccess) {
        Turtle.error = '';
      } else {
        Turtle.error = 'Turtle router statistics are not available from this RetroShare Core.';
      }
    } catch {
      Turtle.error = 'Failed to load turtle router information from RetroShare Core.';
    } finally {
      Turtle.loading = false;
      m.redraw();
    }
  },

  oninit() {
    Turtle.trafficInfo = null;
    Turtle.hashesInfo = [];
    Turtle.tunnelsInfo = [];
    Turtle.searchReqsInfo = [];
    Turtle.tunnelReqsInfo = [];
    Turtle.error = '';
    Turtle.sessionVolumes.lastTimestamp = 0;
    Turtle.load();
    Turtle.timer = setInterval(() => Turtle.load(), 5000);
  },

  onremove() {
    if (Turtle.timer) {
      clearInterval(Turtle.timer);
      Turtle.timer = null;
    }
  },

  view() {
    const friendNames = friendNamesFromCache();
    const traffic = Turtle.trafficInfo;
    const query = Turtle.filterQuery.trim().toLowerCase();
    const sv = Turtle.sessionVolumes;

    let filteredTunnels = Turtle.tunnelsInfo;
    if (Turtle.selectedHash) {
      filteredTunnels = filteredTunnels.filter((t) => String(t[3]) === Turtle.selectedHash);
    }
    if (query) {
      filteredTunnels = filteredTunnels.filter((t) => {
        const id = String(t[0] || '').toLowerCase();
        const toPeer = resolvePeer(t[1], friendNames).toLowerCase();
        const fromPeer = resolvePeer(t[2], friendNames).toLowerCase();
        const hash = String(t[3] || '').toLowerCase();
        return id.includes(query) || toPeer.includes(query) || fromPeer.includes(query) || hash.includes(query);
      });
    }

    let filteredSearches = Turtle.searchReqsInfo;
    if (query) {
      filteredSearches = filteredSearches.filter((s) => {
        const id = formatHexId(s.request_id).toLowerCase();
        const peer = resolvePeer(s.source_peer_id, friendNames).toLowerCase();
        const kw = String(s.keywords || '').toLowerCase();
        return id.includes(query) || peer.includes(query) || kw.includes(query);
      });
    }

    let filteredRequests = Turtle.tunnelReqsInfo;
    if (query) {
      filteredRequests = filteredRequests.filter((r) => {
        const id = formatHexId(r.request_id).toLowerCase();
        const peer = resolvePeer(r.source_peer_id, friendNames).toLowerCase();
        return id.includes(query) || peer.includes(query);
      });
    }

    // Repartition of tunnel requests by relaying peer & hop depth
    const peerRepMap = new Map();
    const depthCounts = Array(8).fill(0);
    let totalTRs = 0;

    Turtle.tunnelReqsInfo.forEach((req) => {
      const peerId = idString(req.source_peer_id) || 'unknown';
      const peerName = resolvePeer(req.source_peer_id, friendNames);
      const entry = peerRepMap.get(peerId) || { id: peerId, name: peerName, count: 0, depths: Array(8).fill(0) };
      entry.count += 1;
      const d = Math.max(0, Math.min(7, Number(req.depth) || 0));
      entry.depths[d] += 1;
      depthCounts[d] += 1;
      peerRepMap.set(peerId, entry);
      totalTRs += 1;
    });
    const peerRepList = Array.from(peerRepMap.values()).sort((a, b) => b.count - a.count);

    return m('.turtle-view', [
      Turtle.error && m('.statistics-error', [icon('exclamation-triangle'), Turtle.error]),

      // ── Top Summary KPI Cards (Speed + Cumulative Volume) ──
      traffic && m('.bandwidth-summary-grid', [
        m('.bandwidth-stat-card', [
          m('.bandwidth-stat-card__icon.bandwidth-stat-card__icon--queue', icon('sort')),
          m('.bandwidth-stat-card__body', [
            m('.bandwidth-stat-card__value', formatSpeed(traffic.unknownUpdnBps)),
            m('.bandwidth-stat-card__label', 'Forwarded Transit'),
            m('.turtle-vol-badge', `Vol: ${rs.formatBytes(sv.transitBytes)}`),
          ]),
        ]),
        m('.bandwidth-stat-card', [
          m('.bandwidth-stat-card__icon.bandwidth-stat-card__icon--in', icon('arrow-down')),
          m('.bandwidth-stat-card__body', [
            m('.bandwidth-stat-card__value', `↓ ${formatSpeed(traffic.dataDnBps)}`),
            m('.bandwidth-stat-card__label', `File Data (↑ ${formatSpeed(traffic.dataUpBps)})`),
            m('.turtle-vol-badge', `Vol: ↓ ${rs.formatBytes(sv.dataDnBytes)} / ↑ ${rs.formatBytes(sv.dataUpBytes)}`),
          ]),
        ]),
        m('.bandwidth-stat-card', [
          m('.bandwidth-stat-card__icon.bandwidth-stat-card__icon--out', icon('paper-plane')),
          m('.bandwidth-stat-card__body', [
            m('.bandwidth-stat-card__value', `↑ ${formatSpeed(traffic.trUpBps)}`),
            m('.bandwidth-stat-card__label', `TR Overhead (↓ ${formatSpeed(traffic.trDnBps)})`),
            m('.turtle-vol-badge', `Vol: ↑ ${rs.formatBytes(sv.trUpBytes)} / ↓ ${rs.formatBytes(sv.trDnBytes)}`),
          ]),
        ]),
        m('.bandwidth-stat-card', [
          m('.bandwidth-stat-card__icon.bandwidth-stat-card__icon--session', icon('shield-alt')),
          m('.bandwidth-stat-card__body', [
            m('.bandwidth-stat-card__value', `↑ ${formatSpeed(traffic.totalUpBps)}`),
            m('.bandwidth-stat-card__label', `Total Turtle (↓ ${formatSpeed(traffic.totalDnBps)})`),
            m('.turtle-vol-badge', Turtle.coreCumulative.available
              ? `Core: ${rs.formatBytes(Turtle.coreCumulative.routingIn + Turtle.coreCumulative.routingOut + Turtle.coreCumulative.tunnelIn + Turtle.coreCumulative.tunnelOut)}`
              : `Vol: ${rs.formatBytes(sv.totalDnBytes + sv.totalUpBytes)}`),
          ]),
        ]),
      ]),

      // ── Lifetime Core Cumulative Stats Banner ──
      Turtle.coreCumulative.available && m('.turtle-core-summary', [
        m('.turtle-core-summary__item', [
          icon('shield-alt'),
          m('span.turtle-core-summary__title', 'Turtle Routing (0x0014):'),
          m('span', `In: ${rs.formatBytes(Turtle.coreCumulative.routingIn)}`),
          m('span', `Out: ${rs.formatBytes(Turtle.coreCumulative.routingOut)}`),
        ]),
        m('.turtle-core-summary__item', [
          icon('paper-plane'),
          m('span.turtle-core-summary__title', 'Tunnels (0x0015):'),
          m('span', `In: ${rs.formatBytes(Turtle.coreCumulative.tunnelIn)}`),
          m('span', `Out: ${rs.formatBytes(Turtle.coreCumulative.tunnelOut)}`),
        ]),
      ]),

      // ── Forward Probabilities by Depth ──
      traffic && traffic.forwardProbabilities.length > 0 && m('.turtle-panel.turtle-prob-panel', [
        m('.turtle-panel__heading', [
          icon('project-diagram'),
          m('div', [
            m('h3', 'TR Forward Probabilities by Depth'),
            m('p', 'Probability of forwarding a tunnel request based on search hop depth (0–6), throttled dynamically as traffic increases.'),
          ]),
        ]),
        m('.turtle-prob-grid', traffic.forwardProbabilities.map((prob, depth) => {
          const pct = Math.max(0, Math.min(100, prob * 100));
          return m('.turtle-prob-col', [
            m('.turtle-prob-col__label', `Depth ${depth}`),
            m('.turtle-prob-bar-track', [
              m('.turtle-prob-bar-fill', { style: { height: `${pct}%` } }),
            ]),
            m('.turtle-prob-col__value', `${pct.toFixed(1)}%`),
          ]);
        })),
      ]),

      // ── Main Data Card with Sub-tabs & Filter ──
      m('.turtle-panel.turtle-data-panel', [
        m('.turtle-controls-bar', [
          m(widget.Segmented, {
            variant: 'underline',
            ariaLabel: 'Turtle router tabs',
            value: Turtle.activeTab,
            options: [
              { id: 'tunnels', label: 'Active Tunnels', icon: 'network-wired', badge: Turtle.tunnelsInfo.length || null },
              { id: 'repartition', label: 'TR Repartition', icon: 'chart-pie', badge: totalTRs || null },
              { id: 'searches', label: 'Search Requests', icon: 'search', badge: Turtle.searchReqsInfo.length || null },
              { id: 'requests', label: 'Tunnel Requests', icon: 'paper-plane', badge: Turtle.tunnelReqsInfo.length || null },
            ],
            onSelect: (id) => { Turtle.activeTab = id; },
          }),

          m(widget.SearchField, {
            class: 'turtle-filter-field',
            placeholder: 'Filter by ID, peer or hash…',
            value: Turtle.filterQuery,
            oninput: (e) => { Turtle.filterQuery = e.target.value; },
            onclear: () => { Turtle.filterQuery = ''; },
          }),
        ]),

        // Optional hash filter chips when on Tunnels tab
        Turtle.activeTab === 'tunnels' && Turtle.hashesInfo.length > 0 && m('.turtle-hash-bar', [
          m('span.turtle-hash-bar__label', 'Filter by Hash:'),
          m('.turtle-hash-chips', [
            m('button.turtle-chip[type=button]', {
              class: Turtle.selectedHash === '' ? 'is-selected' : '',
              onclick: () => { Turtle.selectedHash = ''; },
            }, `All (${Turtle.tunnelsInfo.length})`),
            Turtle.hashesInfo.map((h) => {
              const hashStr = String(h[0] || '');
              const count = h[2] || '0';
              const shortHash = hashStr ? `${hashStr.slice(0, 10)}…` : 'Unknown hash';
              return m('button.turtle-chip[type=button]', {
                class: Turtle.selectedHash === hashStr ? 'is-selected' : '',
                onclick: () => {
                  Turtle.selectedHash = Turtle.selectedHash === hashStr ? '' : hashStr;
                },
                title: hashStr,
              }, `${shortHash} (${count})`);
            }),
          ]),
        ]),

        // ── Tab 1: Active Tunnels Table ──
        Turtle.activeTab === 'tunnels' && (
          filteredTunnels.length > 0
            ? m('.traffic-table-wrap', m('table.traffic-table.turtle-table', [
              m('thead', m('tr', [
                m('th', 'Tunnel ID'),
                m('th', 'From Peer'),
                m('th', 'To Peer'),
                m('th', 'File Hash'),
                m('th', 'Last Activity'),
                m('th', 'Speed'),
              ])),
              m('tbody', filteredTunnels.map((t) => {
                const tid = formatHexId(t[0]);
                const toPeer = resolvePeer(t[1], friendNames);
                const fromPeer = resolvePeer(t[2], friendNames);
                const hash = String(t[3] || '');
                const ageStr = t[4] || '–';
                const speedBps = Number(t[5]) || 0;
                return m('tr', [
                  m('td.turtle-cell--mono', tid),
                  m('td', m('span.bandwidth-peer-name', fromPeer)),
                  m('td', m('span.bandwidth-peer-name', toPeer)),
                  m('td.turtle-cell--mono', { title: hash }, hash ? `${hash.slice(0, 16)}…` : '–'),
                  m('td', ageStr),
                  m('td', speedBps > 0
                    ? m('strong.turtle-speed--active', formatSpeed(speedBps))
                    : m('span.turtle-speed--idle', '0 B/s')),
                ]);
              })),
            ]))
            : m('.traffic-empty', [
              icon('network-wired'),
              m('p', Turtle.tunnelsInfo.length === 0
                ? 'No active turtle tunnels at this moment.'
                : 'No tunnels match the current filter.'),
            ])
        ),

        // ── Tab 2: Tunnel Requests Repartition ──
        Turtle.activeTab === 'repartition' && (
          totalTRs > 0
            ? m('.turtle-repartition-view', [
              m('.turtle-repartition-grid', [
                m('.turtle-repartition-card', [
                  m('h4.turtle-repartition-title', [
                    icon('users'),
                    m('span', 'Tunnel Requests by Relaying Peer'),
                    m('span.turtle-badge', peerRepList.length),
                  ]),
                  m('.turtle-repartition-list', peerRepList.map((p) => {
                    const pct = totalTRs > 0 ? ((p.count / totalTRs) * 100).toFixed(1) : 0;
                    return m('.turtle-repartition-row', [
                      m('.turtle-repartition-row__info', [
                        m('span.turtle-repartition-row__name', p.name),
                        m('strong.turtle-repartition-row__count', `${p.count} (${pct}%)`),
                      ]),
                      m('.turtle-repartition-bar-track', [
                        m('.turtle-repartition-bar-fill', { style: { width: `${pct}%` } }),
                      ]),
                    ]);
                  })),
                  m('.turtle-repartition-total', [
                    m('span', 'Total Received TRs:'),
                    m('strong', totalTRs),
                  ]),
                ]),

                m('.turtle-repartition-card', [
                  m('h4.turtle-repartition-title', [
                    icon('layer-group'),
                    m('span', 'Requests by Hop Depth'),
                  ]),
                  m('.turtle-depth-grid', depthCounts.map((count, d) => {
                    const pct = totalTRs > 0 ? ((count / totalTRs) * 100).toFixed(1) : 0;
                    return m('.turtle-depth-col', [
                      m('.turtle-depth-col__label', `Depth ${d}`),
                      m('.turtle-depth-bar-track', [
                        m('.turtle-depth-bar-fill', { style: { height: `${pct}%` } }),
                      ]),
                      m('.turtle-depth-col__count', count),
                      m('.turtle-depth-col__pct', `${pct}%`),
                    ]);
                  })),
                ]),
              ]),
            ])
            : m('.traffic-empty', [
              icon('chart-pie'),
              m('p', 'No tunnel requests recorded yet to calculate repartition.'),
            ])
        ),

        // ── Tab 3: Search Requests Table ──
        Turtle.activeTab === 'searches' && (
          filteredSearches.length > 0
            ? m('.traffic-table-wrap', m('table.traffic-table.turtle-table', [
              m('thead', m('tr', [
                m('th', 'Request ID'),
                m('th', 'Relayed From'),
                m('th', 'Keywords'),
                m('th', 'Hits'),
                m('th', 'Depth'),
                m('th', 'Age'),
              ])),
              m('tbody', filteredSearches.map((s) => {
                const reqId = formatHexId(s.request_id);
                const peer = resolvePeer(s.source_peer_id, friendNames);
                const hits = Number(s.hits) || 0;
                return m('tr', [
                  m('td.turtle-cell--mono', reqId),
                  m('td', m('span.bandwidth-peer-name', peer)),
                  m('td.turtle-cell--keywords', s.keywords ? `"${s.keywords}"` : '–'),
                  m('td', m('span.turtle-badge', {
                    class: hits > 0 ? 'turtle-badge--hit' : '',
                  }, hits)),
                  m('td', m('span.turtle-depth-badge', s.depth !== undefined ? s.depth : '–')),
                  m('td', formatAge(s.age)),
                ]);
              })),
            ]))
            : m('.traffic-empty', [
              icon('search'),
              m('p', Turtle.searchReqsInfo.length === 0
                ? 'No search requests currently in routing queue.'
                : 'No search requests match the current filter.'),
            ])
        ),

        // ── Tab 4: Tunnel Requests Table ──
        Turtle.activeTab === 'requests' && (
          filteredRequests.length > 0
            ? m('.traffic-table-wrap', m('table.traffic-table.turtle-table', [
              m('thead', m('tr', [
                m('th', 'Request ID'),
                m('th', 'Source Peer'),
                m('th', 'Depth'),
                m('th', 'Age'),
              ])),
              m('tbody', filteredRequests.map((r) => {
                const reqId = formatHexId(r.request_id);
                const peer = resolvePeer(r.source_peer_id, friendNames);
                return m('tr', [
                  m('td.turtle-cell--mono', reqId),
                  m('td', m('span.bandwidth-peer-name', peer)),
                  m('td', m('span.turtle-depth-badge', r.depth !== undefined ? r.depth : '–')),
                  m('td', formatAge(r.age)),
                ]);
              })),
            ]))
            : m('.traffic-empty', [
              icon('paper-plane'),
              m('p', Turtle.tunnelReqsInfo.length === 0
                ? 'No tunnel requests currently in routing queue.'
                : 'No tunnel requests match the current filter.'),
            ])
        ),
      ]),

      m('p.statistics-note', 'Turtle Router traffic and active tunnels refresh every 5 seconds.'),
    ]);
  },
};

module.exports = Turtle;
