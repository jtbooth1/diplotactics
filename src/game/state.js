import { ORDER_TYPES, TEAMS } from "./constants.js";

export function createInitialGameState() {
  return {
    turn: 1,
    selectedUnitId: "b1",
    actionWheel: null,
    targetingOrder: null,
    orders: {},
    log: ["Issue orders for both sides, then resolve the turn."],
    units: [
      createUnit("b1", "Blue 1", TEAMS.BLUE, -3, 1),
      createUnit("b2", "Blue 2", TEAMS.BLUE, -2, 0),
      createUnit("b3", "Blue 3", TEAMS.BLUE, -2, 2),
      createUnit("b4", "Blue 4", TEAMS.BLUE, -1, -1),
      createUnit("b5", "Blue 5", TEAMS.BLUE, -1, 1),
      createUnit("r1", "Red 1", TEAMS.RED, 3, -1),
      createUnit("r2", "Red 2", TEAMS.RED, 2, 0),
      createUnit("r3", "Red 3", TEAMS.RED, 2, -2),
      createUnit("r4", "Red 4", TEAMS.RED, 1, 1),
      createUnit("r5", "Red 5", TEAMS.RED, 1, -1),
    ],
  };
}

export function createInitialAppState() {
  const present = createInitialGameState();

  return {
    past: [],
    present,
    future: [],
  };
}

export function createUnit(id, name, team, q, r) {
  return {
    id,
    name,
    team,
    q,
    r,
    exposed: false,
    alive: true,
  };
}

export function unitCoord(unit) {
  return { q: unit.q, r: unit.r };
}

export function aliveUnits(state) {
  return state.units.filter((unit) => unit.alive);
}

export function unitAt(state, coord) {
  return aliveUnits(state).find((unit) => unit.q === coord.q && unit.r === coord.r) ?? null;
}

export function getUnit(state, unitId) {
  return state.units.find((unit) => unit.id === unitId) ?? null;
}

export function getOrder(state, unitId) {
  return state.orders[unitId] ?? { type: ORDER_TYPES.HOLD };
}
