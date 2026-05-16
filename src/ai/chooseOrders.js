import { ORDER_TYPES } from "../game/constants.js";
import { coordKey, isAdjacent } from "../game/hex.js";
import { resolveTurn } from "../game/resolveTurn.js";
import { aliveUnits, getUnit, unitCoord } from "../game/state.js";
import { evaluateState, scoreOrderLocally } from "./evaluateState.js";
import { generateLegalOrdersForTeam } from "./legalOrders.js";
import { sampleOpponentOrderBundles } from "./opponentModel.js";

export function chooseOrders(state, team, options = {}) {
  const perUnitLimit = options.perUnitLimit ?? 4;
  const beamWidth = options.beamWidth ?? 60;
  const opponentSampleCount = options.opponentSampleCount ?? 36;
  const opponentTeam = getOpponentTeam(state, team);

  const candidateBundles = buildCandidateBundles(state, team, { perUnitLimit, beamWidth });
  const opponentSamples = sampleOpponentOrderBundles(state, opponentTeam, {
    sampleCount: opponentSampleCount,
    perUnitLimit,
  });

  let best = candidateBundles[0] ?? {};
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidateBundles) {
    const score = averageScoreAgainstSamples(state, team, candidate.orders, opponentSamples);

    if (score > bestScore) {
      bestScore = score;
      best = candidate.orders;
    }
  }

  return best;
}

function buildCandidateBundles(state, team, options) {
  const unitsWithOrders = generateLegalOrdersForTeam(state, team).map(({ unit, orders }) => ({
    unit,
    orders: orders
      .map((order) => ({
        order,
        score: scoreOrderLocally(state, unit, order, team),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, options.perUnitLimit),
  }));

  let beam = [{ orders: {}, score: 0 }];

  for (const { unit, orders } of unitsWithOrders) {
    const nextBeam = [];

    for (const partial of beam) {
      for (const { order, score } of orders) {
        const nextOrders = {
          ...partial.orders,
          [unit.id]: order,
        };

        nextBeam.push({
          orders: nextOrders,
          score: partial.score + score + coordinationScore(state, unit.id, order, nextOrders),
        });
      }
    }

    beam = nextBeam.sort((a, b) => b.score - a.score).slice(0, options.beamWidth);
  }

  return beam.length ? beam : [{ orders: {}, score: 0 }];
}

function averageScoreAgainstSamples(state, team, candidateOrders, opponentSamples) {
  const samples = opponentSamples.length ? opponentSamples : [{}];
  const scores = samples.map((opponentOrders) => {
    const simulatedState = {
      ...state,
      orders: {
        ...state.orders,
        ...candidateOrders,
        ...opponentOrders,
      },
    };

    const result = resolveTurn(simulatedState);
    return evaluateState(result, team, state);
  });

  return scores.reduce((sum, score) => sum + score, 0) / scores.length + coverPlanScore(state, team, candidateOrders);
}

function coordinationScore(state, unitId, order, orders) {
  if (!order.target) {
    return 0;
  }

  const unit = getUnit(state, unitId);
  const otherOrders = Object.entries(orders).filter(([otherUnitId]) => otherUnitId !== unitId);
  let score = 0;

  for (const [, otherOrder] of otherOrders) {
    if (!otherOrder.target) {
      continue;
    }

    const sameTarget = otherOrder.target.q === order.target.q && otherOrder.target.r === order.target.r;
    if (!sameTarget) {
      continue;
    }

    if (order.type === ORDER_TYPES.MOVE && otherOrder.type === ORDER_TYPES.MOVE) {
      score -= 24;
    }

    if (order.type === ORDER_TYPES.ATTACK && otherOrder.type === ORDER_TYPES.ATTACK) {
      score += 16;
    }

    if (order.type === ORDER_TYPES.COVER && otherOrder.type === ORDER_TYPES.COVER) {
      score -= 6;
    }

    if (isCoverMovePair(order, otherOrder)) {
      score += isThreatenedSpace(state, order.target, unit.team) ? 24 : 10;
    }
  }

  return score;
}

function isCoverMovePair(order, otherOrder) {
  return (
    (order.type === ORDER_TYPES.COVER && otherOrder.type === ORDER_TYPES.MOVE) ||
    (order.type === ORDER_TYPES.MOVE && otherOrder.type === ORDER_TYPES.COVER)
  );
}

function coverPlanScore(state, team, orders) {
  const allies = aliveUnits(state).filter((unit) => unit.team === team);
  const occupiedAllySpaces = new Set(allies.map((unit) => coordKey(unitCoord(unit))));
  const plannedAllyDestinations = new Set(
    allies
      .map((unit) => orders[unit.id])
      .filter((order) => order?.type === ORDER_TYPES.MOVE && order.target)
      .map((order) => coordKey(order.target)),
  );

  return allies.reduce((score, unit) => {
    const order = orders[unit.id];
    if (order?.type !== ORDER_TYPES.COVER || !order.target) {
      return score;
    }

    const targetKey = coordKey(order.target);
    if (occupiedAllySpaces.has(targetKey) || plannedAllyDestinations.has(targetKey)) {
      return score + 2;
    }

    return score - 6;
  }, 0);
}

function isThreatenedSpace(state, coord, team) {
  return aliveUnits(state).some((candidate) => {
    if (candidate.team === team) {
      return false;
    }

    return isAdjacent(unitCoord(candidate), coord);
  });
}

function getOpponentTeam(state, team) {
  return state.units.find((unit) => unit.team !== team)?.team ?? team;
}
