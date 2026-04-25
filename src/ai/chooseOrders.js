import { ORDER_TYPES } from "../game/constants.js";
import { resolveTurn } from "../game/resolveTurn.js";
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

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function coordinationScore(state, unitId, order, orders) {
  if (!order.target) {
    return 0;
  }

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
  }

  return score;
}

function getOpponentTeam(state, team) {
  return state.units.find((unit) => unit.team !== team)?.team ?? team;
}
