import { createElement, icons } from "lucide";
import { ORDER_TYPES } from "../game/constants.js";
import { board, coordKey, getBoardBounds, getHexCenter, getHexPoints, sameCoord } from "../game/hex.js";
import { getOrder, unitAt, unitCoord } from "../game/state.js";

const SVG_NS = "http://www.w3.org/2000/svg";

const ICON_BY_ORDER = {
  [ORDER_TYPES.MOVE]: "Footprints",
  [ORDER_TYPES.ATTACK]: "Swords",
  [ORDER_TYPES.COVER]: "Shield",
  [ORDER_TYPES.RECOVER]: "RotateCcw",
  [ORDER_TYPES.HOLD]: "Circle",
};

export function renderBoard(container, state, handlers) {
  container.replaceChildren();

  const bounds = getBoardBounds();
  const svg = svgEl("svg", {
    class: "board-svg",
    viewBox: `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`,
    role: "img",
    "aria-label": "Hex board",
  });

  svg.append(createDefs());

  const arrowsLayer = svgEl("g", { class: "arrows-layer" });
  const cellsLayer = svgEl("g", { class: "cells-layer" });
  const unitsLayer = svgEl("g", { class: "units-layer" });

  for (const hex of board) {
    const coord = { q: hex.q, r: hex.r };
    const unit = unitAt(state, coord);
    const isSelected = unit?.id === state.selectedUnitId;
    const points = getHexPoints(hex).map((point) => `${point.x},${point.y}`).join(" ");
    const polygon = svgEl("polygon", {
      points,
      class: getHexClass(unit, isSelected),
      "data-coord": coordKey(coord),
      role: "button",
      tabindex: "0",
      "aria-label": unit ? `${unit.name} at ${coordKey(coord)}` : `Empty hex ${coordKey(coord)}`,
    });

    polygon.addEventListener("click", (event) => handlers.onHexClick(coord, event));
    cellsLayer.append(polygon);

    if (unit) {
      unitsLayer.append(renderUnit(coord, unit, getOrder(state, unit.id), isSelected));
    }
  }

  for (const unit of state.units.filter((candidate) => candidate.alive)) {
    const order = getOrder(state, unit.id);
    if (!order.target || sameCoord(unitCoord(unit), order.target)) {
      continue;
    }

    arrowsLayer.append(renderOrderArrow(unitCoord(unit), order.target, unit.team));
  }

  svg.append(arrowsLayer, cellsLayer, unitsLayer);
  container.append(svg);
}

function createDefs() {
  const defs = svgEl("defs");
  defs.append(
    svgEl("marker", {
      id: "order-arrow",
      markerWidth: "9",
      markerHeight: "9",
      refX: "7",
      refY: "4.5",
      orient: "auto",
      markerUnits: "strokeWidth",
    }),
  );

  const marker = defs.querySelector("marker");
  marker.append(svgEl("path", { d: "M0,0 L9,4.5 L0,9 z", class: "arrow-head" }));
  return defs;
}

function renderUnit(coord, unit, order, isSelected) {
  const center = getHexCenter(coord);
  const group = svgEl("g", {
    class: `unit-token ${unit.team}${unit.exposed ? " exposed" : ""}${isSelected ? " selected" : ""}`,
  });

  group.append(svgEl("circle", { cx: center.x, cy: center.y, r: "21", class: "unit-fill" }));

  const icon = renderIcon(ICON_BY_ORDER[order.type] ?? ICON_BY_ORDER[ORDER_TYPES.HOLD]);
  icon.setAttribute("x", String(center.x - 12));
  icon.setAttribute("y", String(center.y - 12));
  icon.setAttribute("width", "24");
  icon.setAttribute("height", "24");
  icon.setAttribute("class", "order-icon");
  group.append(icon);

  return group;
}

function renderOrderArrow(from, to, team) {
  const start = getHexCenter(from);
  const end = getHexCenter(to);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const inset = 30;
  const startPoint = {
    x: start.x + (dx / length) * inset,
    y: start.y + (dy / length) * inset,
  };
  const endPoint = {
    x: end.x - (dx / length) * inset,
    y: end.y - (dy / length) * inset,
  };

  return svgEl("line", {
    x1: startPoint.x,
    y1: startPoint.y,
    x2: endPoint.x,
    y2: endPoint.y,
    class: `order-arrow ${team}`,
    "marker-end": "url(#order-arrow)",
  });
}

function renderIcon(name) {
  const iconNode = icons[name] ?? icons.Circle;
  return createElement(iconNode);
}

function getHexClass(unit, isSelected) {
  const classes = ["hex-cell"];

  if (unit) {
    classes.push("occupied", unit.team);
  }

  if (unit?.exposed) {
    classes.push("exposed");
  }

  if (isSelected) {
    classes.push("selected");
  }

  return classes.join(" ");
}

function svgEl(tagName, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tagName);

  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }

  return element;
}
