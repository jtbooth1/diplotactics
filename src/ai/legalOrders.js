import { ORDER_TYPES } from "../game/constants.js";
import { DIRECTIONS, addCoord, isOnBoard } from "../game/hex.js";
import { aliveUnits, unitCoord } from "../game/state.js";
import { getAvailableOrderTypes } from "../game/unitTypes.js";

export function generateLegalOrdersForUnit(state, unit) {
  if (!unit.alive) {
    return [];
  }

  const from = unitCoord(unit);
  const mapSpec = state.scenario.map;
  const selfAndAdjacent = [from, ...adjacentCoords(from, mapSpec)];
  const adjacent = adjacentCoords(from, mapSpec);
  const orders = [];

  for (const orderType of getAvailableOrderTypes(unit)) {
    if (orderType === ORDER_TYPES.MOVE) {
      orders.push(...selfAndAdjacent.map((target) => ({ type: ORDER_TYPES.MOVE, target })));
    }

    if (orderType === ORDER_TYPES.ATTACK && !unit.exposed) {
      orders.push(...adjacent.map((target) => ({ type: ORDER_TYPES.ATTACK, target })));
    }

    if (orderType === ORDER_TYPES.COVER && !unit.exposed) {
      orders.push(...selfAndAdjacent.map((target) => ({ type: ORDER_TYPES.COVER, target })));
    }

    if (orderType === ORDER_TYPES.RECOVER) {
      orders.push({ type: ORDER_TYPES.RECOVER });
    }
  }

  return dedupeOrders(orders);
}

export function generateLegalOrdersForTeam(state, team) {
  return aliveUnits(state)
    .filter((unit) => unit.team === team)
    .map((unit) => ({
      unit,
      orders: generateLegalOrdersForUnit(state, unit),
    }));
}

function adjacentCoords(coord, mapSpec) {
  return DIRECTIONS.map((direction) => addCoord(coord, direction)).filter((target) => isOnBoard(target, mapSpec));
}

function dedupeOrders(orders) {
  const seen = new Set();

  return orders.filter((order) => {
    const key = `${order.type}:${order.target ? `${order.target.q},${order.target.r}` : "self"}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
