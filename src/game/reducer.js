import { ORDER_TYPES } from "./constants.js";
import { resolveTurn } from "./resolveTurn.js";
import { createInitialAppState, getUnit } from "./state.js";

export const ACTIONS = {
  SELECT_UNIT: "SELECT_UNIT",
  OPEN_ACTION_WHEEL: "OPEN_ACTION_WHEEL",
  CLOSE_ACTION_WHEEL: "CLOSE_ACTION_WHEEL",
  BEGIN_TARGETING: "BEGIN_TARGETING",
  SET_ORDER: "SET_ORDER",
  SET_TEAM_ORDERS: "SET_TEAM_ORDERS",
  CLEAR_ORDER: "CLEAR_ORDER",
  COMMIT_TURN: "COMMIT_TURN",
  JUMP_TO_HISTORY: "JUMP_TO_HISTORY",
  RESET_GAME: "RESET_GAME",
};

export function appReducer(appState, action) {
  switch (action.type) {
    case ACTIONS.SELECT_UNIT:
      return withPresent(appState, {
        ...appState.present,
        selectedUnitId: action.unitId,
        actionWheel: null,
        targetingOrder: null,
      });

    case ACTIONS.OPEN_ACTION_WHEEL:
      return withPresent(appState, {
        ...appState.present,
        selectedUnitId: action.unitId,
        actionWheel: {
          unitId: action.unitId,
          x: action.x,
          y: action.y,
        },
        targetingOrder: null,
      });

    case ACTIONS.CLOSE_ACTION_WHEEL:
      return withPresent(appState, {
        ...appState.present,
        actionWheel: null,
      });

    case ACTIONS.BEGIN_TARGETING:
      return withPresent(appState, {
        ...appState.present,
        selectedUnitId: action.unitId,
        actionWheel: null,
        targetingOrder: {
          unitId: action.unitId,
          orderType: action.orderType,
        },
      });

    case ACTIONS.SET_ORDER:
      return setOrder(appState, action);

    case ACTIONS.SET_TEAM_ORDERS:
      return setTeamOrders(appState, action);

    case ACTIONS.CLEAR_ORDER:
      return withPresent(appState, {
        ...appState.present,
        orders: omitKey(appState.present.orders, action.unitId),
      });

    case ACTIONS.COMMIT_TURN:
      return commitTurn(appState);

    case ACTIONS.JUMP_TO_HISTORY:
      return jumpToHistory(appState, action.index);

    case ACTIONS.RESET_GAME:
      return createInitialAppState();

    default:
      return appState;
  }
}

function withPresent(appState, present) {
  return {
    ...appState,
    present,
  };
}

function setOrder(appState, action) {
  const unit = getUnit(appState.present, action.unitId);
  if (!unit || !unit.alive) {
    return appState;
  }

  const order = {
    type: action.orderType,
    target: action.target ?? null,
  };

  if (order.type === ORDER_TYPES.RECOVER || order.type === ORDER_TYPES.HOLD) {
    order.target = null;
  }

  return withPresent(appState, {
    ...appState.present,
    actionWheel: null,
    targetingOrder: null,
    orders: {
      ...appState.present.orders,
      [action.unitId]: order,
    },
  });
}

function setTeamOrders(appState, action) {
  return withPresent(appState, {
    ...appState.present,
    actionWheel: null,
    targetingOrder: null,
    orders: {
      ...appState.present.orders,
      ...action.orders,
    },
    log: [`AI issued ${Object.keys(action.orders).length} order${Object.keys(action.orders).length === 1 ? "" : "s"} for ${action.team}.`],
  });
}

function commitTurn(appState) {
  const nextPresent = resolveTurn(appState.present);

  return {
    past: [...appState.past, stripUiState(appState.present)],
    present: nextPresent,
    future: [],
  };
}

function jumpToHistory(appState, index) {
  const timeline = [...appState.past, stripUiState(appState.present), ...appState.future];
  const target = timeline[index];

  if (!target) {
    return appState;
  }

  return {
    past: timeline.slice(0, index),
    present: {
      ...target,
      selectedUnitId: target.units.find((unit) => unit.alive)?.id ?? null,
      actionWheel: null,
      targetingOrder: null,
    },
    future: timeline.slice(index + 1),
  };
}

function stripUiState(state) {
  return {
    ...state,
    selectedUnitId: null,
    actionWheel: null,
    targetingOrder: null,
  };
}

function omitKey(record, key) {
  const next = { ...record };
  delete next[key];
  return next;
}
