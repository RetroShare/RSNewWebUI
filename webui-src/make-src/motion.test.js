const assert = require('node:assert/strict');
const { test, afterEach } = require('node:test');
const motion = require('../app/motion');
const indicator = require('../app/selection_indicator');

afterEach(() => {
  delete global.window;
  delete global.ResizeObserver;
});

function element(animations = []) {
  const classes = new Set();
  return {
    classList: {
      add: (value) => classes.add(value),
      remove: (value) => classes.delete(value),
      contains: (value) => classes.has(value),
    },
    getAnimations: () => animations,
  };
}

function deferredAnimation(endTime = 160) {
  let finish;
  let cancel;
  const finished = new Promise((resolve, reject) => { finish = resolve; cancel = reject; });
  return {
    finished,
    finish,
    cancel,
    effect: { getComputedTiming: () => ({ endTime }) },
  };
}

test('exit waits for surfaces but not an infinite loading animation', async () => {
  const surface = deferredAnimation();
  const spinner = deferredAnimation(Infinity);
  const dom = element([surface, spinner]);
  let removed = false;
  const done = motion.exit({ dom }).then(() => { removed = true; });
  assert.equal(dom.classList.contains('is-leaving'), true);
  await Promise.resolve();
  assert.equal(removed, false);
  surface.finish();
  await done;
  assert.equal(removed, true);
});

test('cancelled animations still release the removed surface', async () => {
  const animation = deferredAnimation();
  const done = motion.leave(element([animation]));
  animation.cancel(new Error('Animation cancelled'));
  await done;
});

test('closing a sheet does not wait for its staggered entrance', async () => {
  const arrival = { ...deferredAnimation(), animationName: 'surface-in' };
  const exit = { ...deferredAnimation(), animationName: 'sheet-out' };
  const done = motion.leave(element([arrival, exit]));
  exit.finish();
  await done;
});

test('reduced motion never waits for an animation', async () => {
  global.window = { matchMedia: () => ({ matches: true }) };
  await motion.leave(element([deferredAnimation()]));
});

test('older browsers remove immediately without the animation API', async () => {
  const dom = element();
  delete dom.getAnimations;
  await motion.leave(dom);
});

test('duplicate close requests share a single exit', async () => {
  const animation = deferredAnimation();
  const dom = element([animation]);
  const done = motion.leave(dom);
  assert.equal(motion.leave(dom), done);
  animation.finish();
  await done;
});

test('details stays open until its panel finishes leaving', async () => {
  const animation = deferredAnimation();
  const panel = element([animation]);
  const details = { open: true, querySelector: () => panel };
  motion.closeDetails(details);
  assert.equal(details.open, true);
  assert.equal(panel.classList.contains('is-leaving'), true);
  const done = motion.leave(panel);
  animation.finish();
  await done;
  assert.equal(details.open, false);
  assert.equal(panel.classList.contains('is-leaving'), false);
});

test('reopening details cancels a stale close', async () => {
  const animation = deferredAnimation();
  const panel = element([animation]);
  const details = { open: true, querySelector: () => panel };
  motion.closeDetails(details);
  const done = motion.leave(panel);
  let prevented = false;
  motion.toggleDetails({
    currentTarget: { closest: () => details },
    preventDefault: () => { prevented = true; },
  });
  assert.equal(prevented, true);
  assert.equal(panel.classList.contains('is-leaving'), false);
  animation.finish();
  await done;
  assert.equal(details.open, true);
});

test('active indicator follows the selected button without changing tab order', () => {
  const properties = new Map();
  let selected = { offsetLeft: 3, offsetTop: 2, offsetWidth: 40, offsetHeight: 24 };
  const dom = {
    querySelector: () => selected,
    getClientRects: () => [{}],
    style: { setProperty: (name, value) => properties.set(name, value) },
    dataset: {},
  };
  indicator.onupdate({ dom });
  assert.equal(dom.dataset.indicator, 'true');
  assert.equal(properties.get('--segment-x'), '3px');
  selected = { offsetLeft: 45, offsetTop: 2, offsetWidth: 100, offsetHeight: 24 };
  indicator.onupdate({ dom });
  assert.equal(properties.get('--segment-x'), '45px');
  assert.equal(properties.get('--segment-width'), '100px');
  selected = null;
  indicator.onupdate({ dom });
  assert.equal(dom.dataset.indicator, undefined);
});

test('indicator observes layout changes and releases its observer on removal', () => {
  const observed = [];
  let disconnected = false;
  global.ResizeObserver = class {
    observe(element) { observed.push(element); }
    disconnect() { disconnected = true; }
  };
  const buttons = [{}, {}];
  const dom = {
    dataset: {},
    querySelector: () => null,
    querySelectorAll: () => buttons,
  };
  indicator.oncreate({ dom });
  assert.deepEqual(observed, [dom, ...buttons]);
  indicator.onremove({ dom });
  assert.equal(disconnected, true);
});
