const WIDTH = 1000;
const HEIGHT = 650;
const MARGIN = 28;

function createSimulation(nodes, edges, positions = {}) {
  const counts = [0, 1, 2].map((level) => nodes.filter((node) => node.level === level).length);
  const offsets = [0, 0, 0];
  const bodies = nodes.map((node) => {
    const index = offsets[node.level]++;
    const count = Math.max(1, counts[node.level]);
    const packed = count > 24;
    const angle = packed ? index * Math.PI * (3 - Math.sqrt(5)) : index / count * Math.PI * 2;
    const radius = node.level === 0 ? 0 : packed
      ? (node.level === 1 ? 60 : 150) + Math.sqrt((index + 0.5) / count) * (node.level === 1 ? 220 : 135)
      : node.level === 1 ? 170 : 270;
    const position = positions[node.id] || {
      x: WIDTH / 2 + Math.cos(angle) * radius,
      y: HEIGHT / 2 + Math.sin(angle) * radius,
    };
    positions[node.id] = position;
    return { ...node, position, vx: 0, vy: 0, degree: 0 };
  });
  const byId = new Map(bodies.map((body, index) => [body.id, index]));
  const links = edges.filter((edge) => byId.has(edge.source) && byId.has(edge.target) && edge.source !== edge.target)
    .map((edge) => {
      const a = byId.get(edge.source);
      const b = byId.get(edge.target);
      bodies[a].degree++;
      bodies[b].degree++;
      return [a, b];
    });
  const fx = new Float64Array(bodies.length);
  const fy = new Float64Array(bodies.length);
  const own = bodies.find((body) => body.level === 0);
  let comparisons = 0;
  let limits = { minX: MARGIN, maxX: WIDTH - MARGIN, minY: MARGIN, maxY: HEIGHT - MARGIN };

  function constrain(body) {
    const x = Math.max(limits.minX, Math.min(limits.maxX, body.position.x));
    const y = Math.max(limits.minY, Math.min(limits.maxY, body.position.y));
    if (x !== body.position.x) body.vx = 0;
    if (y !== body.position.y) body.vy = 0;
    body.position.x = x;
    body.position.y = y;
  }

  function setBounds(rect) {
    if (!Object.values(rect).every(Number.isFinite)) return;
    const next = {
      minX: Math.max(MARGIN, rect.minX), maxX: Math.min(WIDTH - MARGIN, rect.maxX),
      minY: Math.max(MARGIN, rect.minY), maxY: Math.min(HEIGHT - MARGIN, rect.maxY),
    };
    if (next.minX >= next.maxX || next.minY >= next.maxY) return;
    limits = next;
    bodies.forEach(constrain);
  }

  function rescale(ratio) {
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    const center = own?.position || { x: WIDTH / 2, y: HEIGHT / 2 };
    bodies.forEach((body) => {
      if (body === own) return;
      body.position.x = center.x + (body.position.x - center.x) * ratio;
      body.position.y = center.y + (body.position.y - center.y) * ratio;
      body.vx *= ratio;
      body.vy *= ratio;
      constrain(body);
    });
  }

  function move(id, x, y) {
    const body = bodies[byId.get(id)];
    if (!body || !Number.isFinite(x) || !Number.isFinite(y)) return;
    body.position.x = x;
    body.position.y = y;
    constrain(body);
    body.vx = body.vy = 0;
  }

  function step(pinnedId, length = 105) {
    fx.fill(0);
    fy.fill(0);
    comparisons = 0;
    const spacingScale = length / 105;
    const cellSize = Math.max(50 * spacingScale, length);
    const cells = new Map();
    bodies.forEach((body, index) => {
      const key = `${Math.floor(body.position.x / cellSize)},${Math.floor(body.position.y / cellSize)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(index);
    });

    // Only nearby cells repel each other. Far-away pairs need no work.
    bodies.forEach((body, i) => {
      const cx = Math.floor(body.position.x / cellSize);
      const cy = Math.floor(body.position.y / cellSize);
      for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) {
        for (const j of cells.get(`${x},${y}`) || []) {
          if (j <= i) continue;
          comparisons++;
          let dx = body.position.x - bodies[j].position.x;
          let dy = body.position.y - bodies[j].position.y;
          if (dx === 0 && dy === 0) { dx = (i % 2 ? 1 : -1) * 0.1; dy = 0.1; }
          const distance = Math.max(1, Math.hypot(dx, dy));
          const force = Math.min(4 * spacingScale, 900 * spacingScale ** 3 / (distance * distance) + Math.max(0, 28 * spacingScale - distance) * 0.08);
          fx[i] += dx / distance * force;
          fy[i] += dy / distance * force;
          fx[j] -= dx / distance * force;
          fy[j] -= dy / distance * force;
        }
      }
    });

    links.forEach(([a, b]) => {
      const dx = bodies[b].position.x - bodies[a].position.x;
      const dy = bodies[b].position.y - bodies[a].position.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const strength = (distance - length) * 0.025 / Math.sqrt(Math.max(bodies[a].degree, bodies[b].degree, 1));
      fx[a] += dx / distance * strength;
      fy[a] += dy / distance * strength;
      fx[b] -= dx / distance * strength;
      fy[b] -= dy / distance * strength;
    });

    let energy = 0;
    bodies.forEach((body, index) => {
      if (body.id === pinnedId || body === own) return;
      const center = own?.position || { x: WIDTH / 2, y: HEIGHT / 2 };
      body.vx = (body.vx + fx[index] + (center.x - body.position.x) * 0.0008) * 0.82;
      body.vy = (body.vy + fy[index] + (center.y - body.position.y) * 0.0008) * 0.82;
      body.vx = Math.max(-8 * spacingScale, Math.min(8 * spacingScale, body.vx));
      body.vy = Math.max(-8 * spacingScale, Math.min(8 * spacingScale, body.vy));
      body.position.x += body.vx;
      body.position.y += body.vy;
      constrain(body);
      energy += body.vx * body.vx + body.vy * body.vy;
    });
    return energy / Math.max(bodies.length, 1);
  }

  return { bodies, links, move, step, setBounds, rescale, get comparisons() { return comparisons; } };
}

module.exports = { WIDTH, HEIGHT, createSimulation };
