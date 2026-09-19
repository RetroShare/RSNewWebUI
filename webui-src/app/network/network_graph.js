const m = require('mithril');
const rs = require('rswebui');
const Data = require('network/network_data');
const icon = require('icon');
const { State } = require('network/network_state');
const widget = require('widgets');

const WIDTH = 1000;
const HEIGHT = 650;
const NODE_LIMIT = 200;

function friendIdsFrom(response) {
  const body = (response && response.body) || {};
  const values = body.gpg_friends || body.gpgFriends || body.friends ||
    (Array.isArray(body.retval) ? body.retval : []);
  return Array.isArray(values) ? values.map(String).filter(Boolean) : [];
}

function uniqueEdgeKey(a, b) {
  return [a, b].sort().join('|');
}

function initialPosition(index, count, level) {
  if (level === 0) return { x: WIDTH / 2, y: HEIGHT / 2 };
  const angle = (index / Math.max(count, 1)) * Math.PI * 2;
  const radius = level === 1 ? 190 : 285;
  return {
    x: WIDTH / 2 + Math.cos(angle) * radius,
    y: HEIGHT / 2 + Math.sin(angle) * radius,
  };
}

function* layoutGraphSteps(nodes, edges, edgeLength) {
  const positions = {};
  const byLevel = [0, 1, 2].map((level) => nodes.filter((node) => node.level === level));
  byLevel.forEach((levelNodes, level) => {
    levelNodes.forEach((node, index) => {
      positions[node.id] = initialPosition(index, levelNodes.length, level);
    });
  });

  const own = nodes.find((node) => node.level === 0);
  let work = 0;
  for (let iteration = 0; iteration < 140; iteration++) {
    const force = Object.fromEntries(nodes.map((node) => [node.id, { x: 0, y: 0 }]));

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions[nodes[i].id];
        const b = positions[nodes[j].id];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const distanceSq = Math.max(dx * dx + dy * dy, 100);
        const distance = Math.sqrt(distanceSq);
        const strength = 2400 / distanceSq;
        dx /= distance;
        dy /= distance;
        force[nodes[i].id].x += dx * strength;
        force[nodes[i].id].y += dy * strength;
        force[nodes[j].id].x -= dx * strength;
        force[nodes[j].id].y -= dy * strength;
        if (++work % 256 === 0) yield;
      }
    }

    for (const edge of edges) {
      if (++work % 256 === 0) yield;
      const a = positions[edge.source];
      const b = positions[edge.target];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const strength = (distance - edgeLength) * 0.012;
      force[edge.source].x += (dx / distance) * strength;
      force[edge.source].y += (dy / distance) * strength;
      force[edge.target].x -= (dx / distance) * strength;
      force[edge.target].y -= (dy / distance) * strength;
    }

    nodes.forEach((node) => {
      if (own && node.id === own.id) return;
      const position = positions[node.id];
      position.x = Math.max(35, Math.min(WIDTH - 35, position.x + force[node.id].x));
      position.y = Math.max(35, Math.min(HEIGHT - 35, position.y + force[node.id].y));
    });
  }
  return positions;
}

async function layoutGraph(nodes, edges, edgeLength, isCurrent) {
  const steps = layoutGraphSteps(nodes, edges, edgeLength);
  while (isCurrent()) {
    // Yield to input and painting between short batches, including within
    // a single iteration of the quadratic repulsion calculation.
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (!isCurrent()) return null;
    const started = performance.now();
    do {
      const step = steps.next();
      if (step.done) return step.value;
    } while (performance.now() - started < 4);
  }
  return null;
}

//  Module level, not fields of the component: the graph tab is mounted only
//  while it is the active tab, so leaving it and coming back rebuilds the
//  component. Kept here, a return to the tab shows the graph that was already
//  computed -- instead of replaying the discovery requests and a layout that
//  costs up to 729 ms -- and the zoom, the search and the level are still what
//  the user left them at.
let nodes = [];
let edges = [];
let positions = {};
let loading = true;
let error = '';
let friendshipLevel = 1;
let edgeLength = 105;
let zoom = 1;
let search = '';
let loadedAt = 0;
//  A newer load makes an older one drop its results instead of writing them
//  over the fresh ones: changing the friendship level while a load is running
//  starts a second one, and they do not necessarily finish in order.
let loadToken = 0;
let layoutToken = 0;
const GRAPH_CACHE_MS = 60000;

const NetworkGraph = () => {
  let draggedId = null;

  async function discoveredFriends(id) {
    try {
      return friendIdsFrom(
        await rs.rsJsonApiRequest('/rsGossipDiscovery/getDiscPgpFriends', { pgpid: id })
      );
    } catch (_) {
      return [];
    }
  }

  //  A browser opens about six connections per host: asking for two hundred
  //  discoveries at once does not make them arrive sooner, it just queues them
  //  all in the tab and, past a certain point, starts failing them outright --
  //  the request storm that made the channel list unusable. Six at a time.
  async function discoverInBatches(ids, size = 6) {
    const relations = [];
    for (let i = 0; i < ids.length; i += size) {
      const slice = ids.slice(i, i + size);
      relations.push(...await Promise.all(
        slice.map(async (id) => [id, await discoveredFriends(id)])
      ));
    }
    return relations;
  }

  async function loadGraph() {
    const token = ++loadToken;
    ++layoutToken;
    loading = true;
    error = '';

    // The mobile Graph shortcut can be opened before NetworkLayout's initial
    // friend refresh finishes. Wait for fresh peer data so we do not cache a
    // graph containing only the local node.
    await Data.refreshGpgDetails();
    if (token !== loadToken) return;

    const ownId = State.ownProfile.gpg_id;
    if (!ownId) {
      loading = false;
      error = 'Your network identity is still loading. Try redraw in a moment.';
      m.redraw();
      return;
    }

    const directIds = Object.keys(Data.gpgDetails || {}).filter(Boolean);
    const levels = new Map([[ownId, 0]]);
    directIds.forEach((id) => levels.set(id, 1));
    const adjacency = new Map([[ownId, directIds]]);

    const directRelations = await discoverInBatches(directIds);
    if (token !== loadToken) return;
    directRelations.forEach(([id, friends]) => {
      adjacency.set(id, friends);
      if (friendshipLevel > 1) {
        friends.forEach((friendId) => {
          if (!levels.has(friendId) && levels.size < NODE_LIMIT) levels.set(friendId, 2);
        });
      }
    });

    if (friendshipLevel > 1) {
      const secondLevelIds = Array.from(levels).filter(([, level]) => level === 2).map(([id]) => id);
      const secondRelations = await discoverInBatches(secondLevelIds);
      if (token !== loadToken) return;
      secondRelations.forEach(([id, friends]) => adjacency.set(id, friends));
    }

    nodes = Array.from(levels, ([id, level]) => {
      const friend = Data.gpgDetails[id];
      return {
        id,
        level,
        name: level === 0
          ? State.ownProfile.name || 'You'
          : (friend && friend.name) || `${id.slice(0, 10)}…`,
        online: level === 0 || Boolean(friend && friend.isOnline),
      };
    });

    const edgeKeys = new Set();
    edges = [];
    adjacency.forEach((friends, source) => {
      friends.forEach((target) => {
        if (!levels.has(source) || !levels.has(target) || source === target) return;
        const key = uniqueEdgeKey(source, target);
        if (edgeKeys.has(key)) return;
        edgeKeys.add(key);
        edges.push({ source, target });
      });
    });

    const layout = ++layoutToken;
    const result = await layoutGraph(nodes, edges, edgeLength,
      () => token === loadToken && layout === layoutToken);
    if (!result || token !== loadToken || layout !== layoutToken) return;
    positions = result;
    loadedAt = Date.now();
    loading = false;
    m.redraw();
  }

  async function redrawLayout() {
    if (loading) return;
    const token = ++layoutToken;
    const result = await layoutGraph(nodes, edges, edgeLength, () => token === layoutToken);
    if (!result || token !== layoutToken) return;
    positions = result;
    m.redraw();
  }

  function setZoom(value) {
    zoom = Math.max(0.5, Math.min(2.5, Number(value)));
  }

  function pointerPosition(event) {
    const svg = event.currentTarget.ownerSVGElement || event.currentTarget;
    const bounds = svg.getBoundingClientRect();
    const rawX = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
    const rawY = ((event.clientY - bounds.top) / bounds.height) * HEIGHT;
    return {
      x: WIDTH / 2 + (rawX - WIDTH / 2) / zoom,
      y: HEIGHT / 2 + (rawY - HEIGHT / 2) / zoom,
    };
  }

  return {
    oninit: () => {
      if (nodes.length === 0 || Date.now() - loadedAt > GRAPH_CACHE_MS) loadGraph();
    },
    onremove: () => {
      ++loadToken;
      ++layoutToken;
      if (loading) loadedAt = 0;
      loading = false;
    },
    view: () => m('.network-graph', [
      m('.network-graph__toolbar', [
        m('button.network-graph__redraw[type=button][title=Redraw graph][aria-label=Redraw graph]', { onclick: loadGraph, disabled: loading }, [
          icon('sync-alt', { spin: loading }),
          m('span', 'Redraw'),
        ]),
        m('label', [
          'Friendship level',
          m('select', {
            value: friendshipLevel,
            onchange: (event) => {
              friendshipLevel = Number(event.target.value);
              loadGraph();
            },
          }, [m('option[value=1]', '1'), m('option[value=2]', '2')]),
        ]),
        m('label.network-graph__edge-control', [
          `Edge length ${edgeLength}`,
          m('input[type=range][min=60][max=180][step=5]', {
            value: edgeLength,
            // Update the label while dragging; start the batched layout on release.
            oninput: (event) => {
              edgeLength = Number(event.target.value);
            },
            onchange: redrawLayout,
          }),
        ]),
        m('.network-graph__zoom-control', [
          m('button.is-icon[type=button][title=Zoom out][aria-label=Zoom out]', {
            onclick: () => setZoom(zoom - 0.1),
          }, icon('minus')),
          m('label', [
            `Zoom ${Math.round(zoom * 100)}%`,
            m('input[type=range][min=0.5][max=2.5][step=0.1]', {
              value: zoom,
              oninput: (event) => setZoom(event.target.value),
            }),
          ]),
          m('button.is-icon[type=button][title=Zoom in][aria-label=Zoom in]', {
            onclick: () => setZoom(zoom + 0.1),
          }, icon('plus')),
          m('button[type=button][title=Reset zoom]', {
            onclick: () => setZoom(1),
          }, '100%'),
        ]),
        m(widget.SearchField, {
          class: 'network-graph__search',
          placeholder: 'Find a peer',
          value: search,
          oninput: (event) => (search = event.target.value),
          onclear: () => (search = ''),
        }),
      ]),
      loading
        ? m('.network-graph__message', [icon('spinner', { spin: true }), ' Loading network graph…'])
        : error
          ? m('.network-graph__message.network-graph__message--error', error)
          : m('svg.network-graph__canvas', {
              viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
              role: 'img',
              'aria-label': `Network graph with ${nodes.length} peers and ${edges.length} connections`,
              onwheel: (event) => {
                event.preventDefault();
                setZoom(zoom + (event.deltaY < 0 ? 0.1 : -0.1));
              },
              onpointermove: (event) => {
                if (!draggedId) return;
                positions[draggedId] = pointerPosition(event);
              },
              onpointerup: () => (draggedId = null),
              onpointerleave: () => (draggedId = null),
            }, m('g.network-graph__zoom-layer', {
              transform: `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${zoom}) translate(${-WIDTH / 2} ${-HEIGHT / 2})`,
            }, [
              m('g.network-graph__edges', edges.map((edge) => {
                const source = positions[edge.source];
                const target = positions[edge.target];
                return source && target && m('line', {
                  x1: source.x, y1: source.y, x2: target.x, y2: target.y,
                });
              })),
              m('g.network-graph__nodes', nodes.map((node) => {
                const position = positions[node.id];
                const matches = search && node.name.toLowerCase().includes(search.toLowerCase());
                //  The fill lives in CSS so the node and its legend key cannot
                //  drift apart.
                const kind = node.level === 0 ? 'own' : node.online ? 'online' : 'offline';
                return m('g.network-graph__node', {
                  class: `network-graph__node--${kind}${matches ? ' is-match' : ''}`,
                  transform: `translate(${position.x} ${position.y})`,
                  onpointerdown: (event) => {
                    draggedId = node.id;
                    event.currentTarget.setPointerCapture(event.pointerId);
                  },
                }, [
                  m('title', `${node.name}\n${node.id}`),
                  m('circle', { r: node.level === 0 ? 12 : 9 }),
                  m('text', { x: 14, y: 4 }, node.name),
                ]);
              })),
            ])),
      !loading && !error && m('.network-graph__legend', [
        m('span', [m('i.network-graph__key.network-graph__key--own'), ' You']),
        m('span', [m('i.network-graph__key.network-graph__key--online'), ' Online']),
        m('span', [m('i.network-graph__key.network-graph__key--offline'), ' Offline / discovered']),
        m('span', `${nodes.length} peers · ${edges.length} connections`),
      ]),
    ]),
  };
};

module.exports = NetworkGraph;
