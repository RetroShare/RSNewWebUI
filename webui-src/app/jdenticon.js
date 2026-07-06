const CORNER_SPRITES = {
  0: [[0.5, 1.0], [1.0, 0.0], [1.0, 1.0]],
  1: [[0.5, 0.0], [1.0, 0.0], [0.5, 1.0], [0.0, 1.0]],
  2: [[0.5, 0], [1, 0], [1, 1], [0.5, 1], [1, 0.5]],
  3: [[0, 0.5], [0.5, 0], [1, 0.5], [0.5, 1], [0.5, 0.5]],
  4: [[0, 0.5], [1, 0], [1, 1], [0, 1], [1, 0.5]],
  5: [[1, 0], [1, 1], [0.5, 1], [1, 0.5], [0.5, 0.5]],
  6: [[0, 0], [1, 0], [1, 0.5], [0, 0], [0.5, 1], [0, 1]],
  7: [[0, 0], [0.5, 0], [1, 0.5], [0.5, 1], [0, 1], [0.5, 0.5]],
  8: [[0.5, 0], [0.5, 0.5], [1, 0.5], [1, 1], [0.5, 1], [0.5, 0.5], [0, 0.5]],
  9: [[0, 0], [1, 0], [0.5, 0.5], [1, 0.5], [0.5, 1], [0.5, 0.5], [0, 1]],
  10: [[0, 0.5], [0.5, 1], [1, 0.5], [0.5, 0], [1, 0], [1, 1], [0, 1]],
  11: [[0.5, 0], [1, 0], [1, 1], [0.5, 1], [1, 0.75], [0.5, 0.5], [1, 0.25]],
  12: [[0, 0.5], [0.5, 0], [0.5, 0.5], [1, 0], [1, 0.5], [0.5, 1], [0.5, 0.5], [0, 1]],
  13: [[0, 0], [1, 0], [1, 1], [0, 1], [1, 0.5], [0.5, 0.25], [0.5, 0.75], [0, 0.5], [0.5, 0.25]],
  14: [[0, 0.5], [0.5, 0.5], [0.5, 0], [1, 0], [0.5, 0.5], [1, 0.5], [0.5, 1], [0.5, 0.5], [0, 1]],
  15: [[0, 0], [1, 0], [0.5, 0.5], [0.5, 0], [0, 0.5], [1, 0.5], [0.5, 1], [0.5, 0.5], [0, 1]]
};

const CENTER_SPRITES = {
  0: [],
  1: [[0, 0], [1, 0], [1, 1], [0, 1]],
  2: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]],
  3: [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0.5], [0.5, 1], [1, 0.5], [0.5, 0], [0, 0.5]],
  4: [[0.25, 0], [0.75, 0], [0.5, 0.5], [1, 0.25], [1, 0.75], [0.5, 0.5], [0.75, 1], [0.25, 1], [0.5, 0.5], [0, 0.75], [0, 0.25], [0.5, 0.5]],
  5: [[0, 0], [0.5, 0.25], [1, 0], [0.75, 0.5], [1, 1], [0.5, 0.75], [0, 1], [0.25, 0.5]],
  6: [[0.33, 0.33], [0.67, 0.33], [0.67, 0.67], [0.33, 0.67]],
  7: [[0, 0], [0.33, 0], [0.33, 0.33], [0.66, 0.33], [0.67, 0], [1, 0], [1, 0.33], [0.67, 0.33], [0.67, 0.67], [1, 0.67], [1, 1], [0.67, 1], [0.67, 0.67], [0.33, 0.67], [0.33, 1], [0, 1], [0, 0.67], [0.33, 0.67], [0.33, 0.33], [0, 0.33]]
};

function getSpritePoints(shapePoints, size) {
  return shapePoints.map(([rx, ry]) => `${(rx - 0.5) * size},${(ry - 0.5) * size}`).join(' ');
}

function renderPolygon(shapePoints, x, y, angle, shapeAngle, size, color) {
  if (!shapePoints || shapePoints.length === 0) return '';
  const halfSize = size / 2;
  const pointsStr = getSpritePoints(shapePoints, size);
  return `<polygon points="${pointsStr}" fill="${color}" transform="translate(${x}, ${y}) rotate(${angle}) translate(${halfSize}, ${halfSize}) rotate(${shapeAngle})"/>`;
}

function toSvg(hash, width) {
  if (!hash || hash.length < 18) {
    hash = "00000000000000000000000000000000";
  }

  const csh = parseInt(hash.substr(0, 1), 16);
  const ssh = parseInt(hash.substr(1, 1), 16);
  const xsh = parseInt(hash.substr(2, 1), 16) & 7;

  // We rotate shape by default (rotate = true)
  const cro = 90 * (parseInt(hash.substr(3, 1), 16) & 3);
  const sro = 90 * (parseInt(hash.substr(4, 1), 16) & 3);
  const xbg = parseInt(hash.substr(5, 1), 16) % 2;

  const cfr = parseInt(hash.substr(6, 2), 16);
  const cfg = parseInt(hash.substr(8, 2), 16);
  const cfb = parseInt(hash.substr(10, 2), 16);

  const sfr = parseInt(hash.substr(12, 2), 16);
  const sfg = parseInt(hash.substr(14, 2), 16);
  const sfb = parseInt(hash.substr(16, 2), 16);

  const fillCorner = `rgb(${cfr}, ${cfg}, ${cfb})`;
  const fillSide = `rgb(${sfr}, ${sfg}, ${sfb})`;

  let fillCenter;
  if (xbg > 0 && (Math.abs(cfr - sfr) > 127 || Math.abs(cfg - sfg) > 127 || Math.abs(cfb - sfb) > 127)) {
    fillCenter = fillSide;
  } else {
    fillCenter = fillCorner;
  }

  const size = width / 3;
  const totalsize = width;

  let svgContent = `<rect width="${totalsize}" height="${totalsize}" fill="rgb(230,230,230)"/>`;

  // Draw corners
  const cornerPoints = CORNER_SPRITES[csh] || CORNER_SPRITES[15];
  svgContent += renderPolygon(cornerPoints, 0, 0, 0, cro, size, fillCorner);
  svgContent += renderPolygon(cornerPoints, totalsize, 0, 90, cro, size, fillCorner);
  svgContent += renderPolygon(cornerPoints, totalsize, totalsize, 180, cro, size, fillCorner);
  svgContent += renderPolygon(cornerPoints, 0, totalsize, 270, cro, size, fillCorner);

  // Draw sides
  const sidePoints = CORNER_SPRITES[ssh] || CORNER_SPRITES[15];
  svgContent += renderPolygon(sidePoints, 0, size, 0, sro, size, fillSide);
  svgContent += renderPolygon(sidePoints, 2 * size, 0, 90, sro, size, fillSide);
  svgContent += renderPolygon(sidePoints, 3 * size, 2 * size, 180, sro, size, fillSide);
  svgContent += renderPolygon(sidePoints, size, 3 * size, 270, sro, size, fillSide);

  // Draw center
  const centerPoints = CENTER_SPRITES[xsh] !== undefined ? CENTER_SPRITES[xsh] : CORNER_SPRITES[15];
  svgContent += renderPolygon(centerPoints, size, size, 0, 0, size, fillCenter);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalsize}" height="${totalsize}" viewBox="0 0 ${totalsize} ${totalsize}">${svgContent}</svg>`;
}

module.exports = {
  toSvg
};