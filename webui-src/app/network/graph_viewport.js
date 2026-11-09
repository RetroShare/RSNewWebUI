const { WIDTH, HEIGHT } = require('./graph_physics');

function createViewport(camera = {}) {
  let width = 1;
  let height = 1;
  let insets = { left: 0, top: 0, right: 0, bottom: 0 };
  if (!camera.ready) Object.assign(camera, { x: WIDTH / 2, y: HEIGHT / 2, width: WIDTH, height: HEIGHT });

  const area = () => ({
    x: insets.left, y: insets.top,
    width: Math.max(1, width - insets.left - insets.right),
    height: Math.max(1, height - insets.top - insets.bottom),
  });
  const toScreen = (point, zoom = 1) => {
    const rect = area();
    return {
      x: rect.x + rect.width / 2 + (point.x - camera.x) * rect.width / camera.width * zoom,
      y: rect.y + rect.height / 2 + (point.y - camera.y) * rect.height / camera.height * zoom,
    };
  };
  const toWorld = (point, zoom = 1) => {
    const rect = area();
    return {
      x: camera.x + (point.x - rect.x - rect.width / 2) * camera.width / rect.width / zoom,
      y: camera.y + (point.y - rect.y - rect.height / 2) * camera.height / rect.height / zoom,
    };
  };

  function fit(points, padding, zoom = 1) {
    if (!points.length) return;
    const rect = area();
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    camera.x = (left + right) / 2;
    camera.y = (top + bottom) / 2;
    camera.width = Math.max(right - left, WIDTH / 4) * zoom / Math.max(0.2, 1 - padding * 2 / rect.width);
    camera.height = Math.max(bottom - top, HEIGHT / 4) * zoom / Math.max(0.2, 1 - padding * 2 / rect.height);
    camera.ready = true;
  }

  function worldBounds(padding, zoom = 1) {
    const rect = area();
    const px = Math.min(padding, rect.width / 3);
    const py = Math.min(padding, rect.height / 3);
    const first = toWorld({ x: rect.x + px, y: rect.y + py }, zoom);
    const last = toWorld({ x: rect.x + rect.width - px, y: rect.y + rect.height - py }, zoom);
    return { minX: first.x, minY: first.y, maxX: last.x, maxY: last.y };
  }

  return {
    resize: (nextWidth, nextHeight) => { width = Math.max(1, nextWidth); height = Math.max(1, nextHeight); },
    setInsets: (value) => { insets = { ...insets, ...value }; },
    area,
    worldBounds,
    toScreen,
    toWorld,
    fit,
  };
}

module.exports = { createViewport };
