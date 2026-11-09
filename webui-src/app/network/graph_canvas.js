const m = require('mithril');
const { createSimulation } = require('network/graph_physics');
const { createViewport } = require('network/graph_viewport');

const MAX_SETTLE_FRAMES = 240;
const MAX_SETTLE_MS = 3000;
const GraphCanvas = () => {
  let canvas;
  let context;
  let attrs;
  let simulation;
  let lastNodes;
  let frame = 0;
  let remaining = 0;
  let settleUntil = 0;
  let dragged = null;
  let hovered = null;
  let pointerId = null;
  let bounds;
  let palette;
  let resizeObserver;
  let themeObserver;
  let darkQuery;
  let reduceQuery;
  let lastView = '';
  let lastLength;
  let viewport;
  let lastFit;
  let pendingSettle = false;
  let autoFit = false;
  let lastZoom;
  let appliedSpacing;
  let removed = false;
  const labelCache = new Map();

  const readPalette = () => {
    const style = getComputedStyle(canvas);
    const token = (name) => style.getPropertyValue(name).trim();
    palette = {
      own: token('--brand'), online: token('--up-ink'), offline: token('--ink-dim'),
      text: token('--ink-body'), surface: token('--surface'), edge: token('--line'), ring: token('--brand-pale'),
      radius: parseFloat(token('--graph-node-radius')), ownRadius: parseFloat(token('--graph-own-radius')),
      fontSize: parseFloat(token('--t-label')), font: token('--font-sans'),
      touch: parseFloat(token('--touch')),
      padding: parseFloat(token('--graph-fit-padding')),
      gap: parseFloat(token('--s2')), labelGap: parseFloat(token('--s1')), stroke: parseFloat(token('--stroke')),
    };
    labelCache.clear();
  };

  function draw() {
    if (!bounds.width || !bounds.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);
    context.strokeStyle = palette.edge;
    context.lineWidth = 1;
    context.globalAlpha = simulation.links.length > 500 ? 0.3 : 0.65;
    context.beginPath();
    simulation.links.forEach(([a, b]) => {
      const source = viewport.toScreen(simulation.bodies[a].position, attrs.zoom);
      const target = viewport.toScreen(simulation.bodies[b].position, attrs.zoom);
      context.moveTo(source.x, source.y);
      context.lineTo(target.x, target.y);
    });
    context.stroke();
    context.globalAlpha = 1;
    const query = attrs.search.trim().toLocaleLowerCase();
    const labels = [];
    const occupied = [];
    const area = viewport.area();
    context.font = `${palette.fontSize}px ${palette.font}`;
    context.textBaseline = 'middle';
    const drawNode = (body, queueLabel = true) => {
      const { x, y } = viewport.toScreen(body.position, attrs.zoom);
      const match = query && body.name.toLocaleLowerCase().includes(query);
      const selected = body.id === attrs.selectedId || body.id === dragged || body.id === hovered;
      const radius = nodeRadius(body);
      context.fillStyle = body.level === 0 ? palette.own : body.online ? palette.online : palette.offline;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
      if (queueLabel) occupied.push({ x: x - radius - 2, y: y - radius - 2, width: radius * 2 + 4, height: radius * 2 + 4 });
      if (match || selected) {
        context.strokeStyle = palette.ring;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(x, y, radius + 4, 0, Math.PI * 2);
        context.stroke();
      }
      if (queueLabel && (attrs.showNames !== false || body.level === 0 || match || selected)) {
        labels.push({ body, radius });
      }
    };
    const foreground = [];
    simulation.bodies.forEach((body) => {
      if (body.level === 0 || body.id === attrs.selectedId || body.id === dragged || body.id === hovered) foreground.push(body);
      else drawNode(body);
    });
    foreground.forEach((body) => drawNode(body));
    const painted = [];
    labels.reverse().forEach(({ body, radius }) => {
      const { x, y } = viewport.toScreen(body.position, attrs.zoom);
      const label = labelFor(body);
      const gap = palette.labelGap;
      const width = Math.min(label.width, Math.max(1, area.width - gap * 2));
      const height = palette.fontSize + gap;
      const right = { x: x + radius + gap, y: y - height / 2 };
      const left = { x: x - radius - gap - width - gap, y: y - height / 2 };
      const candidates = [
        ...(x < area.x + area.width / 2 ? [left, right] : [right, left]),
        { x: x - (width + gap) / 2, y: y - radius - gap - height },
        { x: x - (width + gap) / 2, y: y + radius + gap },
      ];
      let best;
      let score = Infinity;
      for (const point of candidates) {
        const rect = {
          x: Math.max(area.x, Math.min(point.x, area.x + area.width - width - gap)),
          y: Math.max(area.y, Math.min(point.y, area.y + area.height - height)),
          width: width + gap, height,
        };
        let overlap = 0;
        for (const other of occupied) {
          overlap += Math.max(0, Math.min(rect.x + rect.width, other.x + other.width) - Math.max(rect.x, other.x)) *
            Math.max(0, Math.min(rect.y + rect.height, other.y + other.height) - Math.max(rect.y, other.y));
        }
        if (overlap < score) { score = overlap; best = rect; }
        if (!overlap) break;
      }
      occupied.push(best);
      painted.push({ rect: best, text: label.text, width });
    });
    painted.reverse().forEach(({ rect, text, width }) => {
      context.fillStyle = palette.surface;
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
      context.fillStyle = palette.text;
      context.fillText(text, rect.x + palette.labelGap / 2, rect.y + rect.height / 2, width);
    });
    foreground.forEach((body) => drawNode(body, false));
  }

  function labelFor(body) {
    const text = body.name.length > 32 ? `${body.name.slice(0, 31)}…` : body.name;
    const cached = labelCache.get(body.id);
    if (cached?.text === text) return cached;
    const label = { text, width: context.measureText(text).width };
    labelCache.set(body.id, label);
    return label;
  }

  function constrain() {
    if (!bounds.width || !bounds.height) return;
    const radius = Math.max(0, ...simulation.bodies.map(nodeRadius));
    simulation.setBounds(viewport.worldBounds(radius + palette.labelGap + palette.stroke, attrs.zoom));
  }

  function tick() {
    frame = 0;
    const settling = remaining > 0 && bounds.width > 0 && bounds.height > 0 && performance.now() < settleUntil && !reduceQuery.matches;
    constrain();
    if (Math.abs(attrs.edgeLength - appliedSpacing) > 0.01) {
      const next = reduceQuery.matches || Math.abs(attrs.edgeLength - appliedSpacing) < 0.1
        ? attrs.edgeLength : appliedSpacing + (attrs.edgeLength - appliedSpacing) * 0.22;
      simulation.rescale(next / appliedSpacing);
      appliedSpacing = next;
    }
    const energy = settling ? simulation.step(dragged, appliedSpacing) : 0;
    if (autoFit) { fit(); constrain(); }
    draw();
    remaining = Math.max(0, remaining - 1);
    const adjusting = Math.abs(attrs.edgeLength - appliedSpacing) > 0.01;
    if (settling && remaining && (energy > 0.002 || adjusting) && !document.hidden) frame = requestAnimationFrame(tick);
    else { remaining = 0; autoFit = false; }
  }

  function wake(physics = false) {
    if (!bounds?.width || !bounds?.height) { pendingSettle = pendingSettle || physics; return; }
    const settle = physics || pendingSettle;
    pendingSettle = false;
    if (settle && !reduceQuery.matches) {
      remaining = MAX_SETTLE_FRAMES;
      settleUntil = performance.now() + MAX_SETTLE_MS;
    }
    if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
  }

  const resize = () => {
    bounds = canvas.getBoundingClientRect();
    viewport.resize(bounds.width, bounds.height);
    const top = canvas.parentElement.querySelector('[data-graph-overlay="top"]')?.getBoundingClientRect();
    const bottom = canvas.parentElement.querySelector('[data-graph-overlay="bottom"]')?.getBoundingClientRect();
    viewport.setInsets({
      left: palette.gap, right: palette.gap,
      top: top ? Math.max(palette.gap, top.bottom - bounds.top + palette.gap) : palette.gap,
      bottom: bottom ? Math.max(palette.gap, bounds.bottom - bottom.top + palette.gap) : palette.gap,
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(bounds.width * dpr));
    canvas.height = Math.max(1, Math.round(bounds.height * dpr));
    if (!attrs.camera?.ready) fit();
    wake();
  };
  const theme = () => { readPalette(); wake(); };
  const reduced = () => { remaining = 0; wake(); };
  const visibility = () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; remaining = 0; }
    else wake();
  };
  const pointerPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };
  const down = (event) => {
    if (event.button !== 0 || dragged) return;
    const point = pointerPoint(event);
    const hit = nearestBody(point);
    if (!hit) return;
    event.preventDefault();
    autoFit = false;
    dragged = hit.id;
    pointerId = event.pointerId;
    canvas.setPointerCapture(pointerId);
    canvas.focus({ preventScroll: true });
    attrs.onselect(hit.id);
    wake(true);
  };
  const move = (event) => {
    if (!dragged) {
      const next = nearestBody(pointerPoint(event))?.id || null;
      if (next !== hovered) {
        hovered = next;
        const body = simulation.bodies.find((node) => node.id === next);
        canvas.title = body ? `${body.name}\n${body.id}` : '';
        wake();
      }
      return;
    }
    if (event.pointerId !== pointerId) return;
    const point = viewport.toWorld(pointerPoint(event), attrs.zoom);
    simulation.move(dragged, point.x, point.y);
    wake(true);
  };
  function nearestBody(point) {
    let hit;
    let nearest = Infinity;
    simulation.bodies.forEach((body) => {
      const screen = viewport.toScreen(body.position, attrs.zoom);
      const distance = Math.hypot(screen.x - point.x, screen.y - point.y);
      if (distance < Math.max(nodeRadius(body), palette.touch / 2) && distance < nearest) { hit = body; nearest = distance; }
    });
    return hit;
  }
  function nodeRadius(body) {
    const rect = viewport.area();
    const density = Math.sqrt(rect.width * rect.height / Math.max(1, simulation.bodies.length)) / (palette.radius * 4);
    return (body.level === 0 ? palette.ownRadius : palette.radius) * Math.max(0.55, Math.min(1, density)) * Math.sqrt(attrs.zoom);
  }
  const fit = () => {
    if (!bounds.width || !bounds.height) return;
    const radius = Math.max(0, ...simulation.bodies.map(nodeRadius));
    const padding = Math.max(palette.padding, radius + palette.labelGap + palette.stroke + palette.gap);
    viewport.fit(simulation.bodies.map((body) => body.position), padding, attrs.zoom);
  };
  const leave = () => { if (!dragged && hovered) { hovered = null; canvas.title = ''; wake(); } };
  const up = (event) => {
    if (!dragged || event.pointerId !== pointerId) return;
    dragged = null;
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    pointerId = null;
    wake(true);
  };
  const wheel = (event) => {
    event.preventDefault();
    autoFit = false;
    attrs.onzoom(attrs.zoom + (event.deltaY < 0 ? 0.1 : -0.1));
  };
  const key = (event) => {
    if (event.key === 'PageDown' || event.key === 'PageUp') {
      event.preventDefault();
      const index = simulation.bodies.findIndex((body) => body.id === attrs.selectedId);
      const next = (index + (event.key === 'PageDown' ? 1 : -1) + simulation.bodies.length) % simulation.bodies.length;
      if (simulation.bodies[next]) attrs.onselect(simulation.bodies[next].id);
      return;
    }
    const directions = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] };
    if (!directions[event.key]) return;
    event.preventDefault();
    autoFit = false;
    const body = simulation.bodies.find((node) => node.id === attrs.selectedId) || simulation.bodies[0];
    if (!body) return;
    const [dx, dy] = directions[event.key];
    const screen = viewport.toScreen(body.position, attrs.zoom);
    const point = viewport.toWorld({ x: screen.x + dx, y: screen.y + dy }, attrs.zoom);
    simulation.move(body.id, point.x, point.y);
    wake(true);
  };

  return {
    oncreate: ({ dom }) => {
      canvas = dom;
      context = canvas.getContext('2d', { alpha: true });
      autoFit = !attrs.camera?.ready;
      viewport = createViewport(attrs.camera);
      const cached = Object.keys(attrs.positions).length > 0;
      simulation = createSimulation(attrs.nodes, attrs.edges, attrs.positions);
      lastNodes = attrs.nodes;
      lastLength = attrs.edgeLength;
      appliedSpacing = attrs.edgeLength;
      lastFit = attrs.fitVersion;
      lastZoom = attrs.zoom;
      reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
      readPalette();
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
      canvas.parentElement.querySelectorAll('[data-graph-overlay]').forEach((overlay) => resizeObserver.observe(overlay));
      window.addEventListener('resize', resize);
      themeObserver = new MutationObserver(theme);
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-appearance'] });
      darkQuery.addEventListener('change', theme);
      reduceQuery.addEventListener('change', reduced);
      document.addEventListener('visibilitychange', visibility);
      canvas.addEventListener('pointerdown', down);
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerleave', leave);
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
      canvas.addEventListener('lostpointercapture', up);
      canvas.addEventListener('wheel', wheel, { passive: false });
      canvas.addEventListener('keydown', key);
      resize();
      if (!attrs.camera?.ready) fit();
      wake(!cached);
      document.fonts?.ready.then(() => { if (!removed) { labelCache.clear(); wake(); } });
    },
    onupdate: () => {
      if (lastNodes !== attrs.nodes) {
        simulation = createSimulation(attrs.nodes, attrs.edges, attrs.positions);
        lastNodes = attrs.nodes;
        appliedSpacing = attrs.edgeLength;
        labelCache.clear();
        autoFit = true;
        fit();
        wake(true);
      }
      if (lastZoom !== attrs.zoom) { lastZoom = attrs.zoom; autoFit = false; }
      if (lastFit !== attrs.fitVersion) { lastFit = attrs.fitVersion; autoFit = false; fit(); wake(); }
      if (lastLength !== attrs.edgeLength) { lastLength = attrs.edgeLength; autoFit = false; wake(true); }
      const next = `${attrs.zoom}|${attrs.search}|${attrs.selectedId}|${attrs.edgeLength}|${attrs.showNames}`;
      if (next !== lastView) { lastView = next; wake(); }
    },
    onremove: () => {
      removed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', resize);
      themeObserver.disconnect();
      darkQuery.removeEventListener('change', theme);
      reduceQuery.removeEventListener('change', reduced);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('lostpointercapture', up);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('keydown', key);
    },
    view: (vnode) => {
      attrs = vnode.attrs;
      const active = attrs.nodes.find((node) => node.id === attrs.selectedId)?.name || 'You';
      return m('canvas.network-graph__canvas[tabindex=0]', {
        role: 'img',
        'aria-label': `Network graph with ${attrs.nodes.length} peers and ${attrs.edges.length} connections. Active peer: ${active}. Page Up and Page Down choose a peer; arrow keys move it.`,
        'aria-describedby': 'network-graph-help',
      }, 'Click a peer or use Page Up and Page Down to choose it, then use the arrow keys to move it.');
    },
  };
};

module.exports = GraphCanvas;
