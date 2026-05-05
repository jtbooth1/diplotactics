import { ORDER_TYPES } from "./constants.js";
import { coordKey, isAdjacent, isOnBoard, isSelfOrAdjacent, sameCoord } from "./hex.js";
import { aliveUnits, getOrder, unitCoord } from "./state.js";

export function resolveTurn(state) {
  if (state.status.phase === "complete") {
    return state;
  }

  const liveUnits = aliveUnits(state);
  const unitsById = new Map(liveUnits.map((unit) => [unit.id, unit]));
  const startOccupancy = new Map(liveUnits.map((unit) => [coordKey(unitCoord(unit)), unit.id]));
  const normalizedOrders = normalizeOrders(state, liveUnits);
  const movement = resolveMovement(liveUnits, normalizedOrders, startOccupancy, unitsById, state.scenario.map);
  const movedUnits = applyMovement(state.units, movement.successes, normalizedOrders);
  const combat = resolveCombat(movedUnits, normalizedOrders);

  const nextUnits = movedUnits
    .map((unit) => applyCombat(unit, combat))
    .filter((unit) => unit.alive);
  const status = evaluateVictory(state, nextUnits);
  const log = buildTurnLog(state.turn, movement, combat, status);

  return {
    ...state,
    turn: state.turn + 1,
    orders: {},
    selectedUnitId: nextUnits.find((unit) => unit.alive)?.id ?? null,
    actionWheel: null,
    targetingOrder: null,
    units: nextUnits,
    status,
    log,
  };
}

function normalizeOrders(state, units) {
  const orders = {};

  for (const unit of units) {
    const order = getOrder(state, unit.id);

    if (unit.exposed && (order.type === ORDER_TYPES.ATTACK || order.type === ORDER_TYPES.COVER)) {
      orders[unit.id] = { type: ORDER_TYPES.HOLD };
      continue;
    }

    orders[unit.id] = order;
  }

  return orders;
}

function resolveMovement(units, orders, startOccupancy, unitsById, mapSpec) {
  const candidateMoves = new Map();
  const failures = new Map();

  for (const unit of units) {
    const order = orders[unit.id];

    if (order.type !== ORDER_TYPES.MOVE) {
      continue;
    }

    if (!order.target || !isAdjacent(unitCoord(unit), order.target) || !isOnBoard(order.target, mapSpec)) {
      failures.set(unit.id, "invalid move");
      continue;
    }

    candidateMoves.set(unit.id, {
      unitId: unit.id,
      from: unitCoord(unit),
      to: order.target,
    });
  }

  const byDestination = groupMovesByDestination(candidateMoves);
  for (const moves of byDestination.values()) {
    if (moves.length > 1) {
      for (const move of moves) {
        failures.set(move.unitId, "destination conflict");
      }
    }
  }

  for (const move of candidateMoves.values()) {
    const occupantId = startOccupancy.get(coordKey(move.to));
    if (!occupantId || occupantId === move.unitId) {
      continue;
    }

    const occupantMove = candidateMoves.get(occupantId);
    if (!occupantMove) {
      failures.set(move.unitId, "blocked");
      continue;
    }

    if (sameCoord(occupantMove.to, move.from)) {
      const unit = unitsById.get(move.unitId);
      const occupant = unitsById.get(occupantId);

      if (unit.team !== occupant.team) {
        failures.set(move.unitId, "opposing swap blocked");
      }
    }
  }

  let changed = true;
  while (changed) {
    changed = false;

    for (const move of candidateMoves.values()) {
      if (failures.has(move.unitId)) {
        continue;
      }

      const occupantId = startOccupancy.get(coordKey(move.to));
      if (!occupantId || occupantId === move.unitId) {
        continue;
      }

      if (failures.has(occupantId)) {
        failures.set(move.unitId, "blocked by failed move");
        changed = true;
      }
    }
  }

  const successes = new Set();
  for (const move of candidateMoves.values()) {
    if (!failures.has(move.unitId)) {
      successes.add(move.unitId);
    }
  }

  return { candidateMoves, successes, failures };
}

function groupMovesByDestination(candidateMoves) {
  const groups = new Map();

  for (const move of candidateMoves.values()) {
    const key = coordKey(move.to);
    const group = groups.get(key) ?? [];
    group.push(move);
    groups.set(key, group);
  }

  return groups;
}

function applyMovement(units, successfulMoves, orders) {
  return units.map((unit) => {
    const order = orders[unit.id];

    if (successfulMoves.has(unit.id) && order.type === ORDER_TYPES.MOVE) {
      return {
        ...unit,
        q: order.target.q,
        r: order.target.r,
      };
    }

    return unit;
  });
}

function resolveCombat(units, orders) {
  const aliveMovedUnits = units.filter((unit) => unit.alive);
  const postMoveOccupancy = new Map(aliveMovedUnits.map((unit) => [coordKey(unitCoord(unit)), unit.id]));
  const incomingAttacks = new Map();
  const covers = new Map();
  const recoveries = new Set();

  for (const unit of aliveMovedUnits) {
    const order = orders[unit.id];
    const from = unitCoord(unit);

    if (order.type === ORDER_TYPES.RECOVER && unit.exposed) {
      recoveries.add(unit.id);
      continue;
    }

    if (order.type === ORDER_TYPES.ATTACK && order.target && isAdjacent(from, order.target)) {
      addCount(incomingAttacks, coordKey(order.target), 1);
      continue;
    }

    if (order.type === ORDER_TYPES.COVER && order.target && isSelfOrAdjacent(from, order.target)) {
      addCount(covers, coordKey(order.target), 1);
    }
  }

  const wounds = new Map();
  const killed = new Set();

  for (const [targetKey, attackCount] of incomingAttacks.entries()) {
    const targetUnitId = postMoveOccupancy.get(targetKey);
    if (!targetUnitId) {
      continue;
    }

    const netHits = Math.max(0, attackCount - (covers.get(targetKey) ?? 0));
    const target = aliveMovedUnits.find((unit) => unit.id === targetUnitId);

    if (netHits === 0) {
      continue;
    }

    if (target.exposed || netHits >= 2) {
      killed.add(targetUnitId);
    } else {
      wounds.set(targetUnitId, true);
    }
  }

  return { wounds, killed, recoveries, incomingAttacks, covers };
}

function addCount(map, key, amount) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function applyCombat(unit, combat) {
  if (combat.killed.has(unit.id)) {
    return { ...unit, alive: false };
  }

  if (combat.wounds.has(unit.id)) {
    return { ...unit, exposed: true };
  }

  if (combat.recoveries.has(unit.id)) {
    return { ...unit, exposed: false };
  }

  return unit;
}

function evaluateVictory(state, units) {
  if (state.scenario.rules.type !== "elimination") {
    return state.status;
  }

  const startingTeams = [...new Set(state.scenario.units.map((unit) => unit.team))];
  const aliveTeams = new Set(units.map((unit) => unit.team));
  const survivingTeams = startingTeams.filter((team) => aliveTeams.has(team));

  if (survivingTeams.length === 1) {
    return {
      ...state.status,
      phase: "complete",
      winner: survivingTeams[0],
      reason: "elimination",
    };
  }

  if (survivingTeams.length === 0) {
    return {
      ...state.status,
      phase: "complete",
      winner: "draw",
      reason: "elimination",
    };
  }

  return state.status;
}

function buildTurnLog(turn, movement, combat, status) {
  const moved = [...movement.successes].length;
  const blocked = [...movement.failures.entries()].map(([unitId, reason]) => `${unitId}: ${reason}`);
  const exposed = [...combat.wounds.keys()];
  const killed = [...combat.killed];

  return [
    `Turn ${turn} resolved.`,
    `${moved} move${moved === 1 ? "" : "s"} succeeded.`,
    blocked.length ? `Blocked moves: ${blocked.join(", ")}.` : "No movement blocks.",
    exposed.length ? `Exposed: ${exposed.join(", ")}.` : "No new exposures.",
    killed.length ? `Killed: ${killed.join(", ")}.` : "No deaths.",
    status.phase === "complete" ? `${formatWinner(status.winner)} wins by elimination.` : null,
  ].filter(Boolean);
}

function formatWinner(winner) {
  if (winner === "draw") {
    return "Nobody";
  }

  return winner[0].toUpperCase() + winner.slice(1);
}
