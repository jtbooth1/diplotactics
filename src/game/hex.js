import { Grid, Orientation, defineHex, rectangle } from "honeycomb-grid";

export const HexTile = defineHex({
  dimensions: 48,
  orientation: Orientation.POINTY,
  origin: "topLeft",
});

export const DIRECTIONS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function createBoard(mapSpec) {
  if (mapSpec.shape === "hex") {
    return new Grid(HexTile, hexagonCoordinates(mapSpec.radius ?? 3, mapSpec.center ?? { q: 0, r: 0 }));
  }

  return new Grid(
    HexTile,
    rectangle({
      start: mapSpec.start ?? { q: 0, r: 0 },
      width: mapSpec.width,
      height: mapSpec.height,
    }),
  );
}

export function coordKey(coord) {
  return `${coord.q},${coord.r}`;
}

export function parseCoordKey(key) {
  const [q, r] = key.split(",").map(Number);
  return { q, r };
}

export function sameCoord(a, b) {
  return a.q === b.q && a.r === b.r;
}

export function addCoord(a, b) {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function isAdjacent(a, b) {
  return DIRECTIONS.some((direction) => sameCoord(addCoord(a, direction), b));
}

export function isSelfOrAdjacent(a, b) {
  return sameCoord(a, b) || isAdjacent(a, b);
}

export function isOnBoard(coord, mapSpec) {
  const board = createBoard(mapSpec);
  return Boolean(board.getHex(coord));
}

export function getHexCenter(coord, board) {
  const hex = board.getHex(coord);
  if (!hex) {
    return null;
  }

  return { x: hex.x, y: hex.y };
}

export function getBoardBounds(board, padding = 64) {
  const points = board.toArray().flatMap((hex) => hex.corners);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs) - padding;
  const minY = Math.min(...ys) - padding;
  const maxX = Math.max(...xs) + padding;
  const maxY = Math.max(...ys) + padding;

  return {
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function getHexPoints(hex) {
  return hex.corners;
}

function hexagonCoordinates(radius, center) {
  const coords = [];

  for (let q = -radius; q <= radius; q += 1) {
    const minR = Math.max(-radius, -q - radius);
    const maxR = Math.min(radius, -q + radius);

    for (let r = minR; r <= maxR; r += 1) {
      coords.push({ q: q + center.q, r: r + center.r });
    }
  }

  return coords;
}
