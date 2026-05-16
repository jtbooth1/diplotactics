import { ORDER_TYPES } from "../game/constants.js";
import { createBoard, coordKey, getBoardBounds, getHexCenter, getHexPoints, sameCoord } from "../game/hex.js";
import { getOrder, unitAt, unitCoord } from "../game/state.js";
import { getUnitType } from "../game/unitTypes.js";
import { renderIcon } from "./icons.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const HEX_RENDER_SCALE = 0.94;

const ICON_BY_ORDER = {
  [ORDER_TYPES.MOVE]: "Footprints",
  [ORDER_TYPES.ATTACK]: "Swords",
  [ORDER_TYPES.COVER]: "Shield",
  [ORDER_TYPES.RECOVER]: "RotateCcw",
};

export function renderBoard(container, state, handlers) {
  container.replaceChildren();

  const board = createBoard(state.scenario.map);
  const bounds = getBoardBounds(board, 128);
  const svg = svgEl("svg", {
    class: "board-svg",
    viewBox: `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`,
    role: "img",
    "aria-label": "Hex board",
  });
  svg.addEventListener("click", () => handlers.onBackgroundClick?.());

  svg.append(createDefs());

  const cellFillLayer = svgEl("g", { class: "cell-fill-layer" });
  const objectiveLayer = svgEl("g", { class: "objective-layer" });
  const arrowsLayer = svgEl("g", { class: "arrows-layer" });
  const unitsLayer = svgEl("g", { class: "units-layer" });
  const hitLayer = svgEl("g", { class: "hit-layer" });
  const hoverTargetsByCoord = new Map();

  for (const hex of board) {
    const coord = { q: hex.q, r: hex.r };
    const key = coordKey(coord);
    const unit = unitAt(state, coord);
    const isSelected = unit?.id === state.selectedUnitId;
    const points = pointsToString(getInsetHexPoints(hex));
    const hoverTargets = [];
    const fill = svgEl("polygon", {
      points,
      class: "hex-fill",
      "data-coord": key,
    });
    cellFillLayer.append(fill);
    hoverTargets.push(fill);

    const objectiveType = getObjectiveType(state.scenario.rules, coord);
    if (objectiveType) {
      const objective = svgEl("polygon", {
        points,
        class: `objective-marker ${objectiveType}`,
      });
      objectiveLayer.append(objective);
      hoverTargets.push(objective);
    }

    if (unit) {
      const unitElement = renderUnit(unit, getOrder(state, unit.id), isSelected, hex);
      unitsLayer.append(unitElement);
      hoverTargets.push(unitElement);
    }

    hoverTargetsByCoord.set(key, { hex, targets: hoverTargets });

    const hitTarget = svgEl("polygon", {
      points,
      class: "hex-hit",
      "data-coord": key,
      role: "button",
      tabindex: "0",
      "aria-label": unit ? `${unit.name} at ${key}` : `Empty hex ${key}`,
    });

    hitTarget.addEventListener("click", (event) => {
      event.stopPropagation();
      handlers.onHexClick(coord, event);
    });
    hitTarget.addEventListener("mouseenter", () => setHexHover(hoverTargetsByCoord.get(key), true));
    hitTarget.addEventListener("mouseleave", () => setHexHover(hoverTargetsByCoord.get(key), false));
    hitTarget.addEventListener("focus", () => setHexHover(hoverTargetsByCoord.get(key), true));
    hitTarget.addEventListener("blur", () => setHexHover(hoverTargetsByCoord.get(key), false));
    hitLayer.append(hitTarget);
  }

  for (const unit of state.units.filter((candidate) => candidate.alive)) {
    const order = getOrder(state, unit.id);
    if (!order.target || sameCoord(unitCoord(unit), order.target)) {
      continue;
    }

    arrowsLayer.append(renderOrderArrow(unitCoord(unit), order.target, unit.team, board));
  }

  svg.append(cellFillLayer, objectiveLayer, unitsLayer, arrowsLayer, hitLayer);
  container.append(svg);
}

function createDefs() {
  return svgEl("defs");
}

function renderUnit(unit, order, isSelected, hex) {
  const center = { x: hex.x, y: hex.y };
  const group = svgEl("g", {
    class: `unit-token ${unit.team}${unit.exposed ? " exposed" : ""}${isSelected ? " selected" : ""}`,
  });

  group.append(
    svgEl("polygon", {
      points: pointsToString(getInsetHexPoints(hex)),
      class: "unit-border",
    }),
  );
  group.append(renderUnitNameplate(hex, unit));
  group.append(svgEl("circle", { cx: center.x, cy: center.y, r: "21", class: "unit-fill" }));

  const icon = renderIcon(ICON_BY_ORDER[order.type] ?? ICON_BY_ORDER[ORDER_TYPES.MOVE]);
  icon.setAttribute("x", String(center.x - 12));
  icon.setAttribute("y", String(center.y - 12));
  icon.setAttribute("width", "24");
  icon.setAttribute("height", "24");
  icon.setAttribute("class", "order-icon");
  group.append(icon);

  return group;
}

function renderUnitNameplate(hex, unit) {
  const points = getBottomSlicePoints(hex);
  const textPosition = getPolygonCentroid(points);
  const group = svgEl("g", { class: `unit-nameplate ${unit.team}` });

  group.append(
    svgEl("polygon", {
      points: pointsToString(points),
      class: "unit-nameplate-fill",
    }),
  );
  group.append(
    svgEl("text", {
      x: String(textPosition.x),
      y: String(textPosition.y),
      class: "unit-nameplate-text",
      "text-anchor": "middle",
      "dominant-baseline": "middle",
    }),
  );
  group.querySelector("text").textContent = getUnitType(unit).label;

  return group;
}

function renderOrderArrow(from, to, team, board) {
  const start = getHexCenter(from, board);
  const end = getHexCenter(to, board);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const startInset = 30;
  const endInset = 18;
  const unitX = dx / length;
  const unitY = dy / length;
  const perpendicularX = -unitY;
  const perpendicularY = unitX;
  const startPoint = {
    x: start.x + unitX * startInset,
    y: start.y + unitY * startInset,
  };
  const endPoint = {
    x: end.x - unitX * endInset,
    y: end.y - unitY * endInset,
  };
  const arrowLength = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
  const halfBaseWidth = arrowLength / 8;
  const points = [
    {
      x: startPoint.x + perpendicularX * halfBaseWidth,
      y: startPoint.y + perpendicularY * halfBaseWidth,
    },
    endPoint,
    {
      x: startPoint.x - perpendicularX * halfBaseWidth,
      y: startPoint.y - perpendicularY * halfBaseWidth,
    },
  ];

  return svgEl("polygon", {
    points: pointsToString(points),
    class: `order-arrow ${team}`,
  });
}

function getInsetHexPoints(hex) {
  return getHexPoints(hex).map((point) => ({
    x: hex.x + (point.x - hex.x) * HEX_RENDER_SCALE,
    y: hex.y + (point.y - hex.y) * HEX_RENDER_SCALE,
  }));
}

function getBottomSlicePoints(hex) {
  const points = getInsetHexPoints(hex);
  const bottomIndex = points.reduce(
    (bottom, point, index) => (point.y > points[bottom].y ? index : bottom),
    0,
  );
  const leftIndex = (bottomIndex - 1 + points.length) % points.length;
  const rightIndex = (bottomIndex + 1) % points.length;

  return [points[leftIndex], points[bottomIndex], points[rightIndex]];
}

function getPolygonCentroid(points) {
  return points.reduce(
    (center, point) => ({
      x: center.x + point.x / points.length,
      y: center.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
}

function pointsToString(points) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function getObjectiveType(rules, coord) {
  if (rules.type === "king-of-the-hill" && sameCoord(rules.coord, coord)) {
    return "hill";
  }

  if (rules.type === "fortress-attack" && sameCoord(rules.flag, coord)) {
    return "flag";
  }

  return null;
}

function setHexHover(entry, active) {
  if (!entry) {
    return;
  }

  const transform = active ? getInsetTransform(entry.hex, 0.96) : null;
  for (const target of entry.targets) {
    if (transform) {
      target.setAttribute("transform", transform);
    } else {
      target.removeAttribute("transform");
    }
  }
}

function getInsetTransform(hex, scale) {
  return `translate(${hex.x} ${hex.y}) scale(${scale}) translate(${-hex.x} ${-hex.y})`;
}

function svgEl(tagName, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tagName);

  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }

  return element;
}
