const m = require('mithril');
const rs = require('rswebui');

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
      const core = coreVersion
        ? `${coreVersion.major}.${coreVersion.minor}.${coreVersion.mini}${coreVersion.extra || ''} (${coreVersion.human || ''})`
        : 'unknown';

      return m('.debug-page', [
        m('h2', 'Debug'),

        m('.debug-section', [
          m('h3', 'Build'),
          m('.debug-grid', [
            m('span', 'Web UI'), m('strong', version),
            m('span', 'Core'), m('strong', core),
            m('span', 'Core round trip'), m('strong', coreVersion ? coreVersionAt + ' ms' : '-'),
            m('span', 'Page loaded'), m('strong', ago(s.startedAt)),
            m('span', 'Viewport'), m('strong', `${window.innerWidth} x ${window.innerHeight} px`),
          ]),
          m('.debug-actions', [
            //  The page keeps the code it loaded until reloaded, and a phone
            //  browser hides that action away: a new build shows only after this.
            m('button', { onclick: () => window.location.reload(true) }, [m('i.fas.fa-sync-alt'), ' Reload the web UI']),
            m('button', { onclick: loadCoreVersion }, [m('i.fas.fa-stopwatch'), ' Ping the core']),
          ]),
        ]),

        m('.debug-section', [
          m('h3', 'API from this browser'),
          m('.debug-grid', [
            m('span', 'Requests in flight'), m('strong', s.pending),
            m('span', 'Requests since load'), m('strong', s.total),
            m('span', 'Last sendChat'), m('strong', s.lastSend ? `${s.lastSend.ms} ms, ${ago(s.lastSend.at)}` : 'none yet'),
          ]),
          m('h4', 'Slowest requests'),
          s.slowest.length === 0
            ? m('p.debug-empty', 'Nothing yet.')
            : m('table.debug-table', [
                m('thead', m('tr', [m('th', 'Request'), m('th', 'Time'), m('th', 'When')])),
                m('tbody', s.slowest.map((e) => m('tr', [
                  m('td', short(e.path)),
                  m('td', e.ms + ' ms'),
                  m('td', ago(e.at)),
                ]))),
              ]),
          m('h4', 'Last requests'),
          s.recent.length === 0
            ? m('p.debug-empty', 'Nothing yet.')
            : m('table.debug-table', [
                m('thead', m('tr', [m('th', 'Request'), m('th', 'Time'), m('th', 'When')])),
                m('tbody', s.recent.map((e) => m('tr', [
                  m('td', short(e.path)),
                  m('td', e.ms + ' ms'),
                  m('td', ago(e.at)),
                ]))),
              ]),
          m('.debug-actions', [
            m('button', { onclick: () => rs.resetApiStats() }, [m('i.fas.fa-eraser'), ' Reset counters']),
          ]),
        ]),

        m('.debug-section', [
          m('h3', 'Event stream'),
          m('.debug-grid', [
            m('span', 'Received'), m('strong', rs.formatBytes(s.eventsBytes)),
            m('span', 'Last event'), m('strong', ago(s.lastEventAt)),
            m('span', 'Reconnections'), m('strong', s.eventsRestarts),
          ]),
          m('p.debug-hint', 'The stream carries every event of the core over one long request; it holds one of the six connections a browser keeps to a host, the others queue the requests above.'),
        ]),
      ]);
    },
  };
};

module.exports = Debug;
