import { ORDER_TYPES } from "../game/constants.js";
import { isAdjacent } from "../game/hex.js";
import { aliveUnits, unitCoord } from "../game/state.js";
import { scoreOrderLocally } from "./evaluateState.js";
import { generateLegalOrdersForTeam } from "./legalOrders.js";

export function sampleOpponentOrderBundles(state, team, options = {}) {
  const sampleCount = options.sampleCount ?? 36;
  const perUnitLimit = options.perUnitLimit ?? 4;
  const unitsWithOrders = generateLegalOrdersForTeam(state, team);
  const samples = [];

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const bundle = {};

    for (const { unit, orders } of unitsWithOrders) {
      const weightedOrders = orders
        .map((order) => ({
          order,
          weight: opponentWeight(state, unit, order) + Math.max(0, scoreOrderLocally(state, unit, order, team)),
        }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, perUnitLimit);

      const choice = weightedOrders[sampleIndex % weightedOrders.length] ?? weightedOrders[0];
      bundle[unit.id] = choice?.order ?? { type: ORDER_TYPES.HOLD };
    }

    samples.push(bundle);
  }

  return samples;
}

function opponentWeight(state, unit, order) {
  const enemies = aliveUnits(state).filter((candidate) => candidate.team !== unit.team);
  const allies = aliveUnits(state).filter((candidate) => candidate.team === unit.team);
  const targetEnemy = order.target ? enemies.find((enemy) => enemy.q === order.target.q && enemy.r === order.target.r) : null;
  const targetAlly = order.target ? allies.find((ally) => ally.q === order.target.q && ally.r === order.target.r) : null;

  if (unit.exposed && order.type === ORDER_TYPES.RECOVER) {
    return 70;
  }

  if (order.type === ORDER_TYPES.ATTACK && targetEnemy) {
    return targetEnemy.exposed ? 85 : 48;
  }

  if (order.type === ORDER_TYPES.COVER && targetAlly) {
    return enemies.some((enemy) => isAdjacent(unitCoord(enemy), order.target)) ? 38 : 18;
  }

  if (order.type === ORDER_TYPES.MOVE && order.target) {
    return enemies.some((enemy) => isAdjacent(unitCoord(enemy), order.target)) ? 34 : 18;
  }

  return order.type === ORDER_TYPES.HOLD ? 8 : 12;
}
