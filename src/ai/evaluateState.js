import { ORDER_TYPES } from "../game/constants.js";
import { DIRECTIONS, addCoord, coordKey, isAdjacent } from "../game/hex.js";
import { aliveUnits, getOrder, unitCoord } from "../game/state.js";

export function evaluateState(state, team, baselineState = null) {
  const alive = aliveUnits(state);
  const allies = alive.filter((unit) => unit.team === team);
  const enemies = alive.filter((unit) => unit.team !== team);
  const baseline = baselineState ? baselineCounts(baselineState, team) : null;

  let score = 0;

  if (baseline) {
    score += (baseline.enemiesAlive - enemies.length) * 120;
    score -= (baseline.alliesAlive - allies.length) * 140;
  }

  score += enemies.filter((unit) => unit.exposed).length * 36;
  score -= allies.filter((unit) => unit.exposed).length * 32;
  score += countAttacksOnExposedEnemies(state, team) * 12;
  score += countCoveredThreatenedAllies(state, team) * 10;
  score += supportScore(allies) * 4;
  score += engagementScore(allies, enemies) * 3;

  return score;
}

export function scoreOrderLocally(state, unit, order, team = unit.team) {
  const allies = aliveUnits(state).filter((candidate) => candidate.team === team);
  const enemies = aliveUnits(state).filter((candidate) => candidate.team !== team);
  const targetEnemy = order.target ? enemies.find((enemy) => sameHex(enemy, order.target)) : null;
  const targetAlly = order.target ? allies.find((ally) => sameHex(ally, order.target)) : null;

  let score = 0;

  if (order.type === ORDER_TYPES.RECOVER) {
    score += unit.exposed ? 45 : -10;
  }

  if (order.type === ORDER_TYPES.ATTACK) {
    score += targetEnemy ? 28 : -8;
    score += targetEnemy?.exposed ? 42 : 0;
  }

  if (order.type === ORDER_TYPES.COVER) {
    score += targetAlly?.exposed ? 20 : 7;
    score += enemies.some((enemy) => order.target && isAdjacent(unitCoord(enemy), order.target)) ? 12 : 0;
  }

  if (order.type === ORDER_TYPES.MOVE && order.target) {
    score += moveTowardEnemyScore(order.target, enemies);
    score -= allies.some((ally) => ally.id !== unit.id && sameHex(ally, order.target)) ? 14 : 0;
    score -= unit.exposed && enemies.some((enemy) => isAdjacent(unitCoord(enemy), order.target)) ? 18 : 0;
  }

  if (order.type === ORDER_TYPES.HOLD) {
    score -= unit.exposed ? 16 : 2;
  }

  return score;
}

function baselineCounts(state, team) {
  const alive = aliveUnits(state);

  return {
    alliesAlive: alive.filter((unit) => unit.team === team).length,
    enemiesAlive: alive.filter((unit) => unit.team !== team).length,
  };
}

function countAttacksOnExposedEnemies(state, team) {
  const exposedEnemySpaces = new Set(
    aliveUnits(state)
      .filter((unit) => unit.team !== team && unit.exposed)
      .map((unit) => coordKey(unitCoord(unit))),
  );

  return aliveUnits(state)
    .filter((unit) => unit.team === team)
    .filter((unit) => {
      const order = getOrder(state, unit.id);
      return order.type === ORDER_TYPES.ATTACK && order.target && exposedEnemySpaces.has(coordKey(order.target));
    }).length;
}

function countCoveredThreatenedAllies(state, team) {
  const enemies = aliveUnits(state).filter((unit) => unit.team !== team);
  const threatenedAllySpaces = new Set(
    aliveUnits(state)
      .filter((unit) => unit.team === team)
      .filter((ally) => enemies.some((enemy) => isAdjacent(unitCoord(enemy), unitCoord(ally))))
      .map((ally) => coordKey(unitCoord(ally))),
  );

  return aliveUnits(state)
    .filter((unit) => unit.team === team)
    .filter((unit) => {
      const order = getOrder(state, unit.id);
      return order.type === ORDER_TYPES.COVER && order.target && threatenedAllySpaces.has(coordKey(order.target));
    }).length;
}

function supportScore(allies) {
  let score = 0;

  for (const ally of allies) {
    score += adjacentCoords(unitCoord(ally)).filter((coord) =>
      allies.some((candidate) => candidate.id !== ally.id && sameHex(candidate, coord)),
    ).length;
  }

  return score;
}

function engagementScore(allies, enemies) {
  if (allies.length === 0 || enemies.length === 0) {
    return 0;
  }

  return allies.reduce((sum, ally) => {
    const nearest = Math.min(...enemies.map((enemy) => hexDistance(unitCoord(ally), unitCoord(enemy))));
    return sum + Math.max(0, 5 - nearest);
  }, 0);
}

function moveTowardEnemyScore(target, enemies) {
  if (enemies.length === 0) {
    return 0;
  }

  const nearest = Math.min(...enemies.map((enemy) => hexDistance(target, unitCoord(enemy))));
  return Math.max(0, 6 - nearest) * 4;
}

function adjacentCoords(coord) {
  return DIRECTIONS.map((direction) => addCoord(coord, direction));
}

function hexDistance(a, b) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

function sameHex(unit, coord) {
  return unit.q === coord.q && unit.r === coord.r;
}
