import { ORDER_TYPES, TEAMS } from "./constants.js";
import { defaultScenario } from "../scenarios/index.js";

export function createInitialGameState(scenario = defaultScenario) {
  return {
    scenario,
    status: createInitialStatus(scenario),
    turn: 1,
    selectedUnitId: scenario.units.find((unit) => unit.team === TEAMS.BLUE)?.id ?? scenario.units[0]?.id ?? null,
    actionWheel: null,
    targetingOrder: null,
    orders: {},
    log: ["Issue orders for both sides, then resolve the turn."],
    units: scenario.units.map((unit) =>
      createUnit(unit.id, unit.name, unit.team, unit.q, unit.r, unit.type),
    ),
  };
}

export function createInitialAppState(scenario = defaultScenario) {
  const present = createInitialGameState(scenario);

  return {
    past: [],
    present,
    future: [],
  };
}

export function createUnit(id, name, team, q, r, type = "infantry") {
  return {
    id,
    name,
    team,
    type,
    q,
    r,
    exposed: false,
    alive: true,
  };
}

function createInitialStatus(scenario) {
  return {
    phase: "playing",
    winner: null,
    reason: null,
    scores: Object.fromEntries(Object.keys(scenario.controllers ?? {}).map((team) => [team, 0])),
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
