const m = require('mithril');
const select = require('select');
const rs = require('rswebui');
const Data = require('network/network_data');
const icon = require('icon');
const { State } = require('network/network_state');
const widget = require('widgets');
const GraphCanvas = require('network/graph_canvas');

const NODE_LIMIT = 200;
const GRAPH_CACHE_MS = 60000;
const SPACING_RANGE = { min: 60, max: 180, step: 5 };
let nodes = [];
let edges = [];
let positions = {};
let loading = false;
let error = '';
let friendshipLevel = 1;
let edgeLength = 105;
let zoom = 1;
let search = '';
let selectedId = '';
let showNames = true;
let loadedAt = 0;
let loadToken = 0;
let truncated = false;
const camera = {};
let fitVersion = 0;

function friendIdsFrom(response) {
  const body = response?.body || {};
  const values = body.gpg_friends || body.gpgFriends || body.friends ||
    (Array.isArray(body.retval) ? body.retval : []);
  return Array.isArray(values) ? values.map(String).filter(Boolean) : [];
}

const NetworkGraph = () => {
  const setZoom = (value) => {
    zoom = Math.max(0.5, Math.min(2.5, Number(value)));
    m.redraw();
  };

  async function discoverInBatches(ids, token) {
    const relations = [];
    const batchSize = 6;
    for (let index = 0; index < ids.length && token === loadToken; index += batchSize) {
      const batch = await Promise.all(ids.slice(index, index + batchSize).map(async (id) => {
        try {
          return [id, friendIdsFrom(await rs.rsJsonApiRequest('/rsGossipDiscovery/getDiscPgpFriends', { pgpid: id }))];
        } catch {
          return [id, []];
        }
      }));
      relations.push(...batch);
    }
    return relations;
  }

  async function loadGraph() {
    const token = ++loadToken;
    const level = friendshipLevel;
    loading = true;
    error = '';
    m.redraw();
    try {
      await Data.refreshGpgDetails();
      if (token !== loadToken) return;
      const ownId = State.ownProfile.gpg_id;
      if (!ownId) throw new Error('Your network identity is still loading. Try again in a moment.');
      const allDirectIds = Object.keys(Data.gpgDetails || {}).filter((id) => id && id !== ownId);
      const directIds = allDirectIds.slice(0, NODE_LIMIT - 1);
      truncated = directIds.length < allDirectIds.length;
      const levels = new Map([[ownId, 0], ...directIds.map((id) => [id, 1])]);
      const adjacency = new Map([[ownId, directIds]]);
      const directRelations = await discoverInBatches(directIds, token);
      if (token !== loadToken) return;
      directRelations.forEach(([id, friends]) => {
        adjacency.set(id, friends);
        if (level > 1) friends.forEach((friendId) => {
          if (levels.has(friendId)) return;
          if (levels.size < NODE_LIMIT) levels.set(friendId, 2);
          else truncated = true;
        });
      });
      if (level > 1) {
        const ids = Array.from(levels).filter(([, depth]) => depth === 2).map(([id]) => id);
        const relations = await discoverInBatches(ids, token);
        if (token !== loadToken) return;
        relations.forEach(([id, friends]) => adjacency.set(id, friends));
      }
      nodes = Array.from(levels, ([id, depth]) => ({
        id,
        level: depth,
        name: depth === 0 ? State.ownProfile.name || 'You' : Data.gpgDetails[id]?.name || `${id.slice(0, 10)}…`,
        online: depth === 0 || Boolean(Data.gpgDetails[id]?.isOnline),
      }));
      const keys = new Set();
      edges = [];
      adjacency.forEach((friends, source) => friends.forEach((target) => {
        if (!levels.has(target) || source === target) return;
        const key = [source, target].sort().join('|');
        if (keys.has(key)) return;
        keys.add(key);
        edges.push({ source, target });
      }));
      if (!nodes.some((node) => node.id === selectedId)) selectedId = ownId;
      loadedAt = Date.now();
    } catch (cause) {
      if (token === loadToken) error = cause?.message || 'Could not load the network graph.';
    } finally {
      if (token === loadToken) { loading = false; m.redraw(); }
    }
  }

  const resetLayout = () => {
    positions = {};
    nodes = [...nodes];
    zoom = 1;
    camera.ready = false;
  };
  const fitView = () => { fitVersion++; zoom = 1; };

  return {
    oninit: () => {
      if (!nodes.length || Date.now() - loadedAt > GRAPH_CACHE_MS) loadGraph();
    },
    onremove: () => {
      ++loadToken;
      if (loading) loadedAt = 0;
      loading = false;
    },
    view: () => m('.network-graph', [
      m(widget.PageHead, {
        title: 'Network graph',
        lead: nodes.length
          ? `${nodes.length} peers · ${edges.length} connections${truncated ? ' · limited to 200 peers' : ''}`
          : 'Discovering connections…',
        actions: [
          select('select.network-graph__connections', {
            'aria-label': 'Friendship level',
            value: friendshipLevel,
            disabled: loading,
            onchange: (event) => { friendshipLevel = Number(event.target.value); loadGraph(); },
          }, [m('option[value=1]', 'Direct friends'), m('option[value=2]', 'Friends of friends')]),
          m(widget.SearchField, {
            id: 'graph-peer-search', class: 'network-graph__search', label: 'Find peer', placeholder: 'Find peer', value: search,
            oninput: (event) => { search = event.target.value; }, onclear: () => { search = ''; },
          }),
          m('button.network-graph__redraw[type=button][aria-label=Refresh network]', { onclick: loadGraph, disabled: loading }, [
            icon('sync-alt', { spin: loading }), m('span', 'Refresh'),
          ]),
        ],
      }),
      error && m(widget.ListError, { message: error, onretry: loadGraph }),
      m('.network-graph__stage', [
        nodes.length > 0 && m(GraphCanvas, {
          nodes, edges, positions, zoom, search, edgeLength, selectedId, camera, fitVersion, showNames,
          onselect: (id) => { selectedId = id; m.redraw(); }, onzoom: setZoom,
        }),
        loading && m('.network-graph__loading', m(widget.Loading, { label: 'Loading network graph…' })),
        !loading && !error && !nodes.length && m('.network-graph__message', 'No peers to display.'),
        m('.network-graph__top-controls', { 'data-graph-overlay': 'top' }, [
          m('label.network-graph__edge-control', [
            m('span', ['Spacing', m('output[aria-hidden=true]', edgeLength)]),
            m('input[type=range]', {
              ...SPACING_RANGE,
              'aria-label': 'Connection spacing', value: edgeLength,
              style: { '--range-progress': `${(edgeLength - SPACING_RANGE.min) / (SPACING_RANGE.max - SPACING_RANGE.min) * 100}%` },
              oninput: (event) => { edgeLength = Number(event.target.value); },
            }),
          ]),
          m('.network-graph__zoom-control[role=group][aria-label=Graph view]', [
            m('button.is-icon[type=button][aria-label=Zoom out][title=Zoom out]', { onclick: () => setZoom(zoom - 0.1) }, icon('minus')),
            m('button.network-graph__zoom-value[type=button][title=Reset zoom]', { onclick: () => setZoom(1) }, `${Math.round(zoom * 100)}%`),
            m('button.is-icon[type=button][aria-label=Zoom in][title=Zoom in]', { onclick: () => setZoom(zoom + 0.1) }, icon('plus')),
            m('button.is-icon[type=button][aria-label=Fit view][title=Fit view]', { onclick: fitView, disabled: !nodes.length }, icon('expand')),
            m('button.is-icon[type=button][aria-label=Reset layout][title=Reset layout]', { onclick: resetLayout, disabled: !nodes.length }, icon('sync-alt')),
            m('button.is-icon[type=button][aria-label=Peer names]', {
              title: showNames ? 'Hide peer names' : 'Show peer names',
              'aria-pressed': String(showNames),
              onclick: () => { showNames = !showNames; },
            }, icon('eye')),
          ]),
        ]),
        m('.network-graph__bottom-overlay', { 'data-graph-overlay': 'bottom' }, [
          m('.network-graph__legend', [
            m('span', [m('i.network-graph__key.network-graph__key--own'), ' You']),
            m('span', [m('i.network-graph__key.network-graph__key--online'), ' Online']),
            m('span', [m('i.network-graph__key.network-graph__key--offline'), ' Offline / discovered']),
          ]),
          m('p#network-graph-help.network-graph__help', 'Drag peers · Scroll to zoom'),
        ]),
      ]),
    ]),
  };
};

module.exports = NetworkGraph;
