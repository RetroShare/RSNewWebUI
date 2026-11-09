const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSimulation, WIDTH, HEIGHT } = require('../app/network/graph_physics');
const { createViewport } = require('../app/network/graph_viewport');

const nodes = [
  { id: 'own', level: 0, name: 'You' },
  { id: 'friend', level: 1, name: 'Friend' },
  { id: 'other', level: 1, name: 'Other' },
];
const edges = [{ source: 'own', target: 'friend' }, { source: 'friend', target: 'other' }];

test('dragging the main node pulls its neighbors without moving its anchor', () => {
  const positions = {};
  const engine = createSimulation(nodes, edges, positions);
  for (let i = 0; i < 200; i++) engine.step(null);
  const before = { ...positions.friend };
  engine.move('own', 350, 400);
  for (let i = 0; i < 60; i++) engine.step('own');
  assert.deepEqual(positions.own, { x: 350, y: 400 });
  assert.ok(Math.hypot(positions.friend.x - before.x, positions.friend.y - before.y) > 10);
});

test('a dragged peer stays pinned while connected peers can move', () => {
  const positions = {};
  const engine = createSimulation(nodes, edges, positions);
  engine.move('friend', 200, 200);
  for (let i = 0; i < 30; i++) engine.step('friend');
  assert.deepEqual(positions.friend, { x: 200, y: 200 });
});

test('coincident nodes and invalid links never produce non-finite positions', () => {
  const positions = Object.fromEntries(nodes.map((node) => [node.id, { x: 500, y: 325 }]));
  const engine = createSimulation(nodes, [...edges, { source: 'missing', target: 'own' }], positions);
  assert.equal(engine.links.length, edges.length);
  for (let i = 0; i < 240; i++) engine.step(null);
  for (const point of Object.values(positions)) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
    assert.ok(point.x >= 0 && point.x <= WIDTH && point.y >= 0 && point.y <= HEIGHT);
  }
});

test('spatial buckets skip distant pairs on a 200-node graph', () => {
  const peers = Array.from({ length: 200 }, (_, index) => ({ id: String(index), level: index ? 1 : 0 }));
  const positions = Object.fromEntries(peers.map((node, index) => [node.id, {
    x: 30 + (index % 20) * 48, y: 30 + Math.floor(index / 20) * 60,
  }]));
  const engine = createSimulation(peers, [], positions);
  engine.step(null);
  assert.ok(engine.comparisons < 200 * 199 / 4);
});

test('cached positions are reused and invalid pointer values are ignored', () => {
  const positions = { own: { x: 420, y: 260 } };
  const engine = createSimulation(nodes, edges, positions);
  assert.equal(engine.bodies[0].position, positions.own);
  engine.move('own', NaN, Infinity);
  assert.deepEqual(positions.own, { x: 420, y: 260 });
  engine.move('own', -100, HEIGHT * 2);
  assert.ok(positions.own.x > 0 && positions.own.y < HEIGHT);
});

test('large static graphs start spaced apart without needing motion', () => {
  const peers = Array.from({ length: 200 }, (_, index) => ({ id: String(index), level: index ? 1 : 0 }));
  const positions = {};
  createSimulation(peers, [], positions);
  const points = Object.values(positions);
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    assert.ok(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) > 18);
  }
});

test('wide viewports use both horizontal edges instead of a centered square', () => {
  const viewport = createViewport();
  viewport.resize(1600, 500);
  assert.ok(viewport.toScreen({ x: 28, y: 325 }).x < 50);
  assert.ok(viewport.toScreen({ x: 972, y: 325 }).x > 1550);
});

test('picking is the inverse of drawing on wide and tall canvases at every zoom', () => {
  for (const [width, height] of [[1600, 500], [320, 700]]) {
    const viewport = createViewport();
    viewport.resize(width, height);
    for (const zoom of [0.5, 1, 2.5]) {
      for (const point of [{ x: 28, y: 28 }, { x: 500, y: 325 }, { x: 972, y: 622 }]) {
        const result = viewport.toWorld(viewport.toScreen(point, zoom), zoom);
        assert.ok(Math.abs(result.x - point.x) < 1e-8);
        assert.ok(Math.abs(result.y - point.y) < 1e-8);
      }
    }
  }
});

test('fit view fills the rectangle with equal screen-space insets', () => {
  const viewport = createViewport();
  viewport.resize(1400, 500);
  viewport.fit([{ x: 200, y: 100 }, { x: 800, y: 550 }], 32);
  const first = viewport.toScreen({ x: 200, y: 100 });
  const last = viewport.toScreen({ x: 800, y: 550 });
  assert.ok(Math.abs(first.x - 32) < 1e-8 && Math.abs(first.y - 32) < 1e-8);
  assert.ok(Math.abs(last.x - 1368) < 1e-8 && Math.abs(last.y - 468) < 1e-8);
});

test('single-peer and empty fits keep a valid, reusable camera', () => {
  const camera = {};
  const viewport = createViewport(camera);
  viewport.resize(900, 400);
  viewport.fit([], 32);
  viewport.fit([{ x: 600, y: 200 }], 32);
  assert.deepEqual(viewport.toScreen({ x: 600, y: 200 }), { x: 450, y: 200 });
  const restored = createViewport(camera);
  restored.resize(600, 500);
  assert.deepEqual(restored.toScreen({ x: 600, y: 200 }), { x: 300, y: 250 });
});

test('overlay insets are respected by fitting and pointer conversion', () => {
  const viewport = createViewport();
  viewport.resize(1200, 700);
  viewport.setInsets({ left: 8, right: 8, top: 80, bottom: 40 });
  viewport.fit([{ x: 200, y: 100 }, { x: 800, y: 550 }], 24);
  const first = viewport.toScreen({ x: 200, y: 100 });
  const last = viewport.toScreen({ x: 800, y: 550 });
  assert.ok(Math.abs(first.x - 32) < 1e-8 && Math.abs(first.y - 104) < 1e-8);
  assert.ok(Math.abs(last.x - 1168) < 1e-8 && Math.abs(last.y - 636) < 1e-8);
  const point = { x: 450, y: 350 };
  const result = viewport.toWorld(viewport.toScreen(point, 2.5), 2.5);
  assert.ok(Math.hypot(result.x - point.x, result.y - point.y) < 1e-8);
});

test('visible world bounds constrain dragging and springs at every zoom', () => {
  for (const zoom of [0.5, 1, 2.5]) {
    const viewport = createViewport();
    viewport.resize(1200, 700);
    viewport.setInsets({ left: 8, right: 8, top: 80, bottom: 40 });
    const positions = {};
    const engine = createSimulation(nodes, edges, positions);
    engine.setBounds(viewport.worldBounds(20, zoom));
    engine.move('own', -10000, 10000);
    for (let i = 0; i < 240; i++) engine.step(null);
    const area = viewport.area();
    for (const point of Object.values(positions)) {
      const screen = viewport.toScreen(point, zoom);
      assert.ok(screen.x >= area.x + 20 - 1e-8 && screen.x <= area.x + area.width - 20 + 1e-8);
      assert.ok(screen.y >= area.y + 20 - 1e-8 && screen.y <= area.y + area.height - 20 + 1e-8);
    }
  }
});

test('spacing makes a substantial difference to settled spring lengths', () => {
  const distances = [60, 180].map((length) => {
    const positions = {};
    const engine = createSimulation(nodes.slice(0, 2), edges.slice(0, 1), positions);
    for (let i = 0; i < 300; i++) engine.step(null, length);
    return Math.hypot(positions.friend.x - positions.own.x, positions.friend.y - positions.own.y);
  });
  assert.ok(distances[1] > distances[0] * 2.5, distances.join(', '));
});

test('animated spacing scales around the local node and respects walls', () => {
  const positions = {};
  const engine = createSimulation(nodes, edges, positions);
  const before = positions.friend.x - positions.own.x;
  engine.rescale(0.5);
  assert.equal(positions.friend.x - positions.own.x, before / 2);
  engine.setBounds({ minX: 400, maxX: 600, minY: 250, maxY: 400 });
  engine.rescale(10);
  assert.deepEqual(positions.own, { x: 500, y: 325 });
  assert.ok(positions.friend.x <= 600 && positions.other.x >= 400);
});

test('fit remains stable at non-default zoom instead of shrinking on each frame', () => {
  for (const zoom of [0.5, 2.5]) {
    const camera = {};
    const viewport = createViewport(camera);
    viewport.resize(1200, 700);
    viewport.setInsets({ left: 8, right: 8, top: 80, bottom: 40 });
    const positions = {};
    const engine = createSimulation(nodes, edges, positions);
    const before = JSON.stringify(positions);
    for (let i = 0; i < 50; i++) {
      viewport.fit(Object.values(positions), 25, zoom);
      engine.setBounds(viewport.worldBounds(17, zoom));
    }
    assert.equal(JSON.stringify(positions), before);
  }
});
