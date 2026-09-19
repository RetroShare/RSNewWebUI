const m = require('mithril');
const rs = require('rswebui');
const NetworkData = require('network/network_data');
const icon = require('icon');

function idString(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return rs.idToHex(value);
}

const formatBytes = rs.formatBytes;

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

function number64(value) {
  if (!value) return 0;
  if (typeof value === 'object') return Number(value.xstr64 || value.xint64) || 0;
  return Number(value) || 0;
}

function parseRates(raw) {
  if (!raw) return {};
  return {
    rateIn: Number(raw.mRateIn !== undefined ? raw.mRateIn : raw.rateIn) || 0,
    rateMaxIn: Number(raw.mRateMaxIn !== undefined ? raw.mRateMaxIn : raw.rateMaxIn) || 0,
    allocIn: Number(raw.mAllocIn !== undefined ? raw.mAllocIn : raw.allocIn) || 0,
    rateOut: Number(raw.mRateOut !== undefined ? raw.mRateOut : raw.rateOut) || 0,
    rateMaxOut: Number(raw.mRateMaxOut !== undefined ? raw.mRateMaxOut : raw.rateMaxOut) || 0,
    allowedOut: Number(raw.mAllowedOut !== undefined ? raw.mAllowedOut : raw.allowedOut) || 0,
    queueIn: Number(raw.mQueueIn !== undefined ? raw.mQueueIn : raw.queueIn) || 0,
    queueOut: Number(raw.mQueueOut !== undefined ? raw.mQueueOut : raw.queueOut) || 0,
    queueOutBytes: number64(raw.mQueueOutBytes !== undefined ? raw.mQueueOutBytes : raw.queueOutBytes),
    totalIn: number64(raw.mTotalIn !== undefined ? raw.mTotalIn : raw.totalIn),
    totalOut: number64(raw.mTotalOut !== undefined ? raw.mTotalOut : raw.totalOut),
  };
}

function computeDrain(queueOutBytes, rateOut) {
  const effectiveSpeed = Math.max(rateOut, 1.0);
  return queueOutBytes / (effectiveSpeed * 1024.0);
}

function formatRate(rate) {
  if (!rate || rate <= 0) return '0.0';
  return rate.toFixed(1);
}

//  A categorical series palette: ten hues that have to stay apart from each
//  other, which is a different job from the product's semantic tokens. It is
//  data the charts read, so it lives here -- once, and exported, rather than
//  copied into every module that draws a series.
const COLORS = ['#0788cb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#64748b', '#f97316'];

function DonutChart() {
  return {
    view(vnode) {
      const rows = (vnode.attrs.rows || []).filter((r) => r.value > 0);
      const total = vnode.attrs.total !== undefined ? vnode.attrs.total : rows.reduce((s, r) => s + r.value, 0);
      const caption = vnode.attrs.caption || 'total';
      let offset = 0;

      if (!rows.length && !total) {
        return m('.traffic-empty', [
          icon('chart-pie'),
          m('p', 'No session data recorded yet.'),
        ]);
      }

      return m('.traffic-pie', [
        m('svg[viewBox="0 0 120 120"][role=img]', { 'aria-label': vnode.attrs.label }, [
          m('circle[cx=60][cy=60][r=44].traffic-pie__track'),
          m('g[transform="rotate(-90 60 60)"]', rows.map((row, index) => {
            const length = total ? (row.value / total) * 276.46 : 0;
            const segment = m('circle[cx=60][cy=60][r=44].traffic-pie__segment', {
              stroke: COLORS[index % COLORS.length],
              'stroke-dasharray': `${length} ${276.46 - length}`,
              'stroke-dashoffset': -offset,
            }, m('title', `${row.label}: ${formatBytes(row.value)}`));
            offset += length;
            return segment;
          })),
          m('text[x=60][y=57][text-anchor=middle].traffic-pie__value', formatBytes(total)),
          m('text[x=60][y=70][text-anchor=middle].traffic-pie__caption', caption),
        ]),
        m('.traffic-legend', rows.map((row, index) =>
          m('.traffic-legend__item', [
            m('span.traffic-legend__swatch', { style: { backgroundColor: COLORS[index % COLORS.length] } }),
            m('span.traffic-legend__name', row.label),
            m('strong', `${total ? ((row.value / total) * 100).toFixed(1) : 0}%`),
          ])
        )),
      ]);
    },
  };
}

function DrainBadge(drainSec) {
  let badgeClass = 'bandwidth-drain-badge';
  if (drainSec >= 60) {
    badgeClass += ' bandwidth-drain-badge--critical';
  } else if (drainSec >= 30) {
    badgeClass += ' bandwidth-drain-badge--warning';
  }
  const display = Math.round(drainSec);
  return m('span', { class: badgeClass }, `${display} s`);
}

//  A named object, not an anonymous export: mithril mounts a POJO component
//  as Object.create(component) and runs hooks with `this` = that instance, so
//  state written through `this` shadowed the module object -- and the Stats
//  page's Refresh button, calling load() on the MODULE, updated state the
//  mounted instance never read. Every reference below goes through Bandwidth
//  so the instance, the timer and external callers share one state.
const Bandwidth = {
  totalRates: null,
  peerRates: [],
  loading: false,
  error: '',
  timer: null,

  async load() {
    if (Bandwidth.loading) return;
    Bandwidth.loading = true;
    try {
      const [totalRes, allRes] = await Promise.all([
        rs.rsJsonApiRequest('/rsConfig/getTotalBandwidthRates'),
        rs.rsJsonApiRequest('/rsConfig/getAllBandwidthRates'),
      ]);

      const totalBody = totalRes.body || totalRes || {};
      const allBody = allRes.body || allRes || {};

      if (totalRes.status === 200 && totalBody.retval) {
        const rawTotals = totalBody.rates || {};
        Bandwidth.totalRates = parseRates(rawTotals);
        Bandwidth.totalRates.drain = computeDrain(Bandwidth.totalRates.queueOutBytes, Bandwidth.totalRates.rateOut);
        Bandwidth.error = '';
      } else {
        Bandwidth.totalRates = null;
      }

      if (allRes.status === 200 && allBody.retval) {
        const friendNames = friendNamesFromCache();
        const rawMap = allBody.ratemap || {};
        const entries = Array.isArray(rawMap)
          ? rawMap
          : Object.entries(rawMap).map(([key, value]) => ({ key, value }));

        Bandwidth.peerRates = entries.map((entry) => {
          const id = idString(entry.key);
          const rates = parseRates(entry.value);
          const drain = computeDrain(rates.queueOutBytes, rates.rateOut);
          const name = friendNames[id] || (id ? `Peer ${id.slice(0, 8)}…` : 'Unknown peer');
          return {
            id,
            name,
            ...rates,
            drain,
          };
        }).sort((a, b) => b.rateIn + b.rateOut - (a.rateIn + a.rateOut));
      } else {
        Bandwidth.peerRates = [];
      }
    } catch (err) {
      Bandwidth.error = 'Failed to load bandwidth statistics from RetroShare Core.';
    } finally {
      Bandwidth.loading = false;
      m.redraw();
    }
  },

  oninit() {
    Bandwidth.totalRates = null;
    Bandwidth.peerRates = [];
    Bandwidth.error = '';
    Bandwidth.load();
    Bandwidth.timer = setInterval(() => Bandwidth.load(), 5000);
  },

  onremove() {
    if (Bandwidth.timer) {
      clearInterval(Bandwidth.timer);
      Bandwidth.timer = null;
    }
  },

  view() {
    const totals = Bandwidth.totalRates;
    const peers = Bandwidth.peerRates;

    return m('.bandwidth-view', [
      Bandwidth.error && m('.statistics-error', [icon('exclamation-triangle'), Bandwidth.error]),

      // ── Top summary cards ──
      totals && m('.bandwidth-summary-grid', [
        m('.bandwidth-stat-card', [
          m('.bandwidth-stat-card__icon.bandwidth-stat-card__icon--in', icon('arrow-down')),
          m('.bandwidth-stat-card__body', [
            m('.bandwidth-stat-card__value', formatBytes(totals.totalIn)),
            m('.bandwidth-stat-card__label', 'Session In'),
          ]),
        ]),
        m('.bandwidth-stat-card', [
          m('.bandwidth-stat-card__icon.bandwidth-stat-card__icon--out', icon('arrow-up')),
          m('.bandwidth-stat-card__body', [
            m('.bandwidth-stat-card__value', formatBytes(totals.totalOut)),
            m('.bandwidth-stat-card__label', 'Session Out'),
          ]),
        ]),
        m('.bandwidth-stat-card', [
          m('.bandwidth-stat-card__icon.bandwidth-stat-card__icon--queue', icon('layer-group')),
          m('.bandwidth-stat-card__body', [
            m('.bandwidth-stat-card__value', formatBytes(totals.queueOutBytes)),
            m('.bandwidth-stat-card__label', 'Queue Size'),
          ]),
        ]),
        m('.bandwidth-stat-card', [
          m('.bandwidth-stat-card__icon.bandwidth-stat-card__icon--drain', icon('stopwatch')),
          m('.bandwidth-stat-card__body', [
            m('.bandwidth-stat-card__value', `${totals.queueOut.toLocaleString()} ${totals.queueOut === 1 ? 'pkt' : 'pkts'} / ${Math.round(totals.drain)}s`),
            m('.bandwidth-stat-card__label', 'Queue Packets & Drain'),
          ]),
        ]),
      ]),

      // ── Session distribution charts by friends ──
      (() => {
        const inRows = peers
          .map((p) => ({ label: p.name, value: p.totalIn }))
          .filter((r) => r.value > 0)
          .sort((a, b) => b.value - a.value);

        const peerInSum = inRows.reduce((sum, r) => sum + r.value, 0);
        const pastIn = totals ? Math.max(0, totals.totalIn - peerInSum) : 0;
        if (pastIn > 0) {
          inRows.push({ label: 'Disconnected peers', value: pastIn });
        }

        const outRows = peers
          .map((p) => ({ label: p.name, value: p.totalOut }))
          .filter((r) => r.value > 0)
          .sort((a, b) => b.value - a.value);

        const peerOutSum = outRows.reduce((sum, r) => sum + r.value, 0);
        const pastOut = totals ? Math.max(0, totals.totalOut - peerOutSum) : 0;
        if (pastOut > 0) {
          outRows.push({ label: 'Disconnected peers', value: pastOut });
        }

        return m('.statistics-grid', [
          m('section.traffic-panel', [
            m('.traffic-panel__heading', [
              icon('arrow-down'),
              m('div', [
                m('h3', 'Session Received by friend'),
                m('p', 'Incoming data transferred per friend during this session.'),
              ]),
            ]),
            m(DonutChart, {
              rows: inRows,
              total: totals ? totals.totalIn : peerInSum,
              label: 'Session received distribution',
              caption: 'session in',
            }),
          ]),
          m('section.traffic-panel', [
            m('.traffic-panel__heading', [
              icon('arrow-up'),
              m('div', [
                m('h3', 'Session Sent by friend'),
                m('p', 'Outgoing data transferred per friend during this session.'),
              ]),
            ]),
            m(DonutChart, {
              rows: outRows,
              total: totals ? totals.totalOut : peerOutSum,
              label: 'Session sent distribution',
              caption: 'session out',
            }),
          ]),
        ]);
      })(),

      // ── Bandwidth detailed rates table ──
      m('section.traffic-panel.bandwidth-panel', [
        m('.traffic-panel__heading', [
          icon('tachometer-alt'),
          m('div', [
            m('h3', 'Bandwidth Control Rates'),
            m('p', 'Real-time throughput, allocation limits, output queues, and estimated drain time per peer.'),
          ]),
        ]),

        m('.traffic-table-wrap.bandwidth-table-wrap', [
          m('table.traffic-table.bandwidth-table', [
            m('thead', [
              m('tr', [
                m('th', 'Peer'),
                m('th', 'Peer ID'),
                m('th', { title: 'Current real-time download speed' }, 'In Rate (kB/s)'),
                m('th', { title: 'Total data received this session' }, 'Session In'),
                m('th', { title: 'Maximum download speed allocated to this peer' }, 'In Max (kB/s)'),
                m('th', { title: 'Incoming data packets waiting to be processed' }, 'In Queue'),
                m('th', { title: 'Current real-time upload speed' }, 'Out Rate (kB/s)'),
                m('th', { title: 'Total data sent this session' }, 'Session Out'),
                m('th', { title: 'Maximum upload speed allocated to this peer' }, 'Out Max (kB/s)'),
                m('th', { title: 'Upload limit requested by remote peer' }, 'Out Allowed (kB/s)'),
                m('th', { title: 'Outgoing data packets waiting to be sent' }, 'Out Queue'),
                m('th', { title: 'Total size buffered in output queue' }, 'Queue Size'),
                m('th', { title: 'Estimated time to empty output queue at current speed' }, 'Drain'),
              ]),
            ]),
            m('tbody', [
              // Pinned Totals row at top (same as Qt BwCtrlWindow)
              totals && m('tr.bandwidth-totals-row', [
                m('td', m('strong', 'Totals')),
                m('td.bandwidth-peerid-cell', '—'),
                m('td', m('strong', formatRate(totals.rateIn))),
                m('td', m('strong', formatBytes(totals.totalIn))),
                m('td', formatRate(totals.rateMaxIn)),
                m('td', totals.queueIn.toLocaleString()),
                m('td', m('strong', formatRate(totals.rateOut))),
                m('td', m('strong', formatBytes(totals.totalOut))),
                m('td', formatRate(totals.rateMaxOut)),
                m('td', '—'),
                m('td', totals.queueOut.toLocaleString()),
                m('td', formatBytes(totals.queueOutBytes)),
                m('td', DrainBadge(totals.drain)),
              ]),

              // Peer rows
              peers.length
                ? peers.map((p) =>
                  m('tr', [
                    m('td', { title: p.id }, m('span.bandwidth-peer-name', p.name)),
                    m('td.bandwidth-peerid-cell', { title: p.id }, `${p.id.slice(0, 8)}…`),
                    m('td', formatRate(p.rateIn)),
                    m('td', formatBytes(p.totalIn)),
                    m('td', p.rateMaxIn > 0 ? formatRate(p.rateMaxIn) : '—'),
                    m('td', p.queueIn.toLocaleString()),
                    m('td', formatRate(p.rateOut)),
                    m('td', formatBytes(p.totalOut)),
                    m('td', p.rateMaxOut > 0 ? formatRate(p.rateMaxOut) : '—'),
                    m('td', p.allowedOut > 0 ? formatRate(p.allowedOut) : '—'),
                    m('td', p.queueOut.toLocaleString()),
                    m('td', formatBytes(p.queueOutBytes)),
                    m('td', DrainBadge(p.drain)),
                  ])
                )
                : (!totals
                  ? m('tr', [m('td[colspan=13]', m('.traffic-empty', [icon('tachometer-alt'), m('p', 'No bandwidth data available.')]))])
                  : null),
            ]),
          ]),
        ]),
      ]),

      m('p.statistics-note', 'Bandwidth rates reflect current peer socket transfer states and refresh every 5 seconds.'),
    ]);
  },
};

Bandwidth.COLORS = COLORS;

module.exports = Bandwidth;
