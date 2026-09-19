const m = require('mithril');
const rs = require('rswebui');
const icon = require('icon');
const widget = require('widgets');

//  A page for what is otherwise invisible from a phone: which build this is,
//  what the core answers, and what the API is doing from this browser --
//  requests in flight, the round trip of the last chat message, the slowest
//  calls, the health of the event stream. Numbers, not a console.

const Debug = () => {
  let timer = null;
  let coreVersion = null;
  let coreVersionAt = 0;

  const ago = (t) => (t ? Math.round((Date.now() - t) / 1000) + ' s ago' : 'never');
  const short = (p) => String(p || '').replace(/^\/rs/, '');

  const loadCoreVersion = () => {
    const startedAt = performance.now();
    rs.rsJsonApiRequest('/rsJsonApi/version', {}, (data, success) => {
      coreVersionAt = Math.round(performance.now() - startedAt);
      coreVersion = success && data ? data : null;
      m.redraw();
    });
  };

  const latencyClass = (ms) => {
    if (ms < 50) return 'debug-latency--fast';
    if (ms < 200) return 'debug-latency--moderate';
    return 'debug-latency--slow';
  };

  return {
    oninit: () => {
      loadCoreVersion();
      //  The counters move on their own; redraw once a second while here.
      timer = setInterval(() => m.redraw(), 1000);
    },
    onremove: () => {
      if (timer) clearInterval(timer);
    },
    view: (vnode) => {
      const s = rs.apiStats;
      const version = vnode.attrs.version || '';
      const isConnected = rs.connectionState.status;
      const core = coreVersion
        ? `${coreVersion.major}.${coreVersion.minor}.${coreVersion.mini}${coreVersion.extra || ''}`
        : 'Unknown';
      const coreHuman = coreVersion && coreVersion.human ? coreVersion.human : '';

      return m('.debug-page', [
        // Page Header
        m(widget.PageHead, {
          mark: 'bug',
          title: 'Debug & Diagnostics',
          lead: 'Real-time build information, API performance metrics, and connection health.',
          actions: [
            m('button.debug-btn[type=button]', {
              onclick: () => window.location.reload(true),
              title: 'Force reload the Web UI bundle',
            }, [icon('sync-alt'), m('span', ['Reload', m('span.debug-btn__suffix', ' Web UI')])]),
            m('button.debug-btn[type=button]', {
              onclick: loadCoreVersion,
              title: 'Ping the RetroShare core for version & latency',
            }, [icon('stopwatch'), m('span', ['Ping', m('span.debug-btn__suffix', ' Core')])]),
            m('button.debug-btn.debug-btn--danger[type=button]', {
              onclick: () => rs.resetApiStats(),
              title: 'Reset API counters and latency tracking',
            }, [icon('eraser'), m('span', ['Reset', m('span.debug-btn__suffix', ' Stats')])]),
          ],
        }),

        // KPI Summary Cards
        m('.debug-kpi-grid', [
          m('.debug-kpi-card', [
            m('.debug-kpi-card__icon.debug-kpi-card__icon--blue', icon('server')),
            m('.debug-kpi-card__body', [
              m('.debug-kpi-card__label', 'Core Latency'),
              m('.debug-kpi-card__value', coreVersion ? `${coreVersionAt} ms` : '-'),
              m('.debug-kpi-card__subtext', [
                m(`span.debug-status-dot.${isConnected ? 'online' : 'offline'}`),
                isConnected ? 'Connected' : 'Offline',
              ]),
            ]),
          ]),
          m('.debug-kpi-card', [
            m('.debug-kpi-card__icon.debug-kpi-card__icon--purple', icon('network-wired')),
            m('.debug-kpi-card__body', [
              m('.debug-kpi-card__label', 'Active Requests'),
              m('.debug-kpi-card__value', s.pending),
              m('.debug-kpi-card__subtext', `${s.total.toLocaleString()} total calls`),
            ]),
          ]),
          m('.debug-kpi-card', [
            m('.debug-kpi-card__icon.debug-kpi-card__icon--green', icon('comment-dots')),
            m('.debug-kpi-card__body', [
              m('.debug-kpi-card__label', 'Last sendChat'),
              m('.debug-kpi-card__value', s.lastSend ? `${s.lastSend.ms} ms` : 'None yet'),
              m('.debug-kpi-card__subtext', s.lastSend ? ago(s.lastSend.at) : 'No chat sent'),
            ]),
          ]),
          m('.debug-kpi-card', [
            m('.debug-kpi-card__icon.debug-kpi-card__icon--amber', icon('satellite-dish')),
            m('.debug-kpi-card__body', [
              m('.debug-kpi-card__label', 'Event Stream'),
              m('.debug-kpi-card__value', rs.formatBytes(s.eventsBytes)),
              m('.debug-kpi-card__subtext', `${s.eventsRestarts} reconnects • ${ago(s.lastEventAt)}`),
            ]),
          ]),
        ]),

        // Detail Sections Grid (Build info + Event stream info)
        m('.debug-grid-2col', [
          m('.debug-section', [
            m('.debug-section__header', [
              icon('cube'),
              m('h3', 'Build & Environment'),
            ]),
            m('.debug-info-list', [
              m('.debug-info-row', [
                m('span.debug-info-label', 'Web UI Version'),
                m('span.debug-info-value', m('span.debug-badge.debug-badge--blue', version || 'dev')),
              ]),
              m('.debug-info-row', [
                m('span.debug-info-label', 'Core Version'),
                m('span.debug-info-value', [
                  m('span.debug-badge.debug-badge--slate', core),
                  coreHuman && m('small.debug-sublabel', coreHuman),
                ]),
              ]),
              m('.debug-info-row', [
                m('span.debug-info-label', 'Core Round Trip'),
                m('span.debug-info-value', coreVersion ? `${coreVersionAt} ms` : '-'),
              ]),
              m('.debug-info-row', [
                m('span.debug-info-label', 'Page Loaded'),
                m('span.debug-info-value', ago(s.startedAt)),
              ]),
              m('.debug-info-row', [
                m('span.debug-info-label', 'Browser Viewport'),
                m('span.debug-info-value', `${window.innerWidth} × ${window.innerHeight} px`),
              ]),
              m('.debug-info-row', [
                m('span.debug-info-label', 'Core Connection'),
                m('span.debug-info-value', [
                  m(`span.debug-status-dot.${isConnected ? 'online' : 'offline'}`),
                  isConnected ? 'Online' : 'Disconnected',
                ]),
              ]),
            ]),
          ]),

          m('.debug-section', [
            m('.debug-section__header', [
              icon('stream'),
              m('h3', 'Event Stream & Connection'),
            ]),
            m('.debug-info-list', [
              m('.debug-info-row', [
                m('span.debug-info-label', 'Data Received'),
                m('span.debug-info-value', rs.formatBytes(s.eventsBytes)),
              ]),
              m('.debug-info-row', [
                m('span.debug-info-label', 'Last Event Time'),
                m('span.debug-info-value', ago(s.lastEventAt)),
              ]),
              m('.debug-info-row', [
                m('span.debug-info-label', 'Reconnections'),
                m('span.debug-info-value', String(s.eventsRestarts)),
              ]),
              m('.debug-info-row', [
                m('span.debug-info-label', 'Connection Mode'),
                m('span.debug-info-value', m('span.debug-badge.debug-badge--green', 'Active Long-Poll / SSE')),
              ]),
            ]),
            m('.debug-callout', [
              icon('info-circle'),
              m('p', 'The event stream carries every real-time event from the core over a single persistent HTTP channel. Browsers typically keep up to 6 simultaneous connections per host, allowing the remaining 5 to handle concurrent API requests.'),
            ]),
          ]),
        ]),

        // API Performance Section
        m('.debug-section', [
          m('.debug-section__header', [
            icon('tachometer-alt'),
            m('h3', 'API Performance & Request History'),
          ]),

          m('.debug-tables-grid', [
            m('.debug-table-panel', [
              m('.debug-table-panel__header', [
                m('h4', 'Slowest Requests'),
                m('span.debug-count-badge', `${s.slowest.length} recorded`),
              ]),
              s.slowest.length === 0
                ? m('.debug-empty', [
                    icon('check-circle'),
                    m('p', 'No slow requests recorded yet.'),
                  ])
                : m('.debug-table-wrap', [
                    m('table.debug-table', [
                      m('thead', m('tr', [
                        m('th', 'Endpoint'),
                        m('th', 'Latency'),
                        m('th', 'When'),
                      ])),
                      m('tbody', s.slowest.map((e) => m('tr', [
                        m('td.debug-table__endpoint', m('code', short(e.path))),
                        m('td.debug-table__latency', m(`span.debug-latency-badge.${latencyClass(e.ms)}`, `${e.ms} ms`)),
                        m('td.debug-table__when', ago(e.at)),
                      ]))),
                    ]),
                  ]),
            ]),

            m('.debug-table-panel', [
              m('.debug-table-panel__header', [
                m('h4', 'Recent Requests'),
                m('span.debug-count-badge', `${s.recent.length} recent`),
              ]),
              s.recent.length === 0
                ? m('.debug-empty', [
                    icon('inbox'),
                    m('p', 'No requests recorded yet.'),
                  ])
                : m('.debug-table-wrap', [
                    m('table.debug-table', [
                      m('thead', m('tr', [
                        m('th', 'Endpoint'),
                        m('th', 'Latency'),
                        m('th', 'When'),
                      ])),
                      m('tbody', s.recent.map((e) => m('tr', [
                        m('td.debug-table__endpoint', m('code', short(e.path))),
                        m('td.debug-table__latency', m(`span.debug-latency-badge.${latencyClass(e.ms)}`, `${e.ms} ms`)),
                        m('td.debug-table__when', ago(e.at)),
                      ]))),
                    ]),
                  ]),
            ]),
          ]),
        ]),
      ]);
    },
  };
};

module.exports = Debug;
