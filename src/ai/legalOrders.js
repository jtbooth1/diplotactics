import { ORDER_TYPES } from "../game/constants.js";
import { DIRECTIONS, addCoord, isOnBoard } from "../game/hex.js";
import { aliveUnits, unitCoord } from "../game/state.js";

export function generateLegalOrdersForUnit(state, unit) {
  if (!unit.alive) {
    return [];
  }

  const from = unitCoord(unit);
  const orders = [
    { type: ORDER_TYPES.HOLD },
    ...adjacentCoords(from).map((target) => ({ type: ORDER_TYPES.MOVE, target })),
  ];

  if (unit.exposed) {
    orders.push({ type: ORDER_TYPES.RECOVER });
    return dedupeOrders(orders);
  }

  orders.push(
    ...adjacentCoords(from).map((target) => ({ type: ORDER_TYPES.ATTACK, target })),
    { type: ORDER_TYPES.COVER, target: from },
    ...adjacentCoords(from).map((target) => ({ type: ORDER_TYPES.COVER, target })),
  );

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

function adjacentCoords(coord) {
  return DIRECTIONS.map((direction) => addCoord(coord, direction)).filter(isOnBoard);
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
