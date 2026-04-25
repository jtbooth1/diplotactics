import { chooseOrders } from "../ai/chooseOrders.js";
import { ACTIONS } from "../game/reducer.js";
import { ACTION_LABELS, ORDER_TYPES, TEAMS } from "../game/constants.js";
import { isAdjacent, isSelfOrAdjacent } from "../game/hex.js";
import { aliveUnits, getOrder, getUnit, unitAt, unitCoord } from "../game/state.js";

const TARGETED_ACTIONS = new Set([ORDER_TYPES.MOVE, ORDER_TYPES.ATTACK, ORDER_TYPES.COVER]);

export function createBoardHandlers(state, dispatch) {
  return {
    onHexClick(coord, event) {
      const targetingOrder = state.targetingOrder;
      if (targetingOrder) {
        const actingUnit = getUnit(state, targetingOrder.unitId);
        if (actingUnit && isLegalTarget(actingUnit, targetingOrder.orderType, coord)) {
          dispatch({
            type: ACTIONS.SET_ORDER,
            unitId: actingUnit.id,
            orderType: targetingOrder.orderType,
            target: coord,
          });
        }
        return;
      }

      const clickedUnit = unitAt(state, coord);
      if (clickedUnit) {
        dispatch({
          type: ACTIONS.OPEN_ACTION_WHEEL,
          unitId: clickedUnit.id,
          x: event.clientX,
          y: event.clientY,
        });
        return;
      }

      dispatch({ type: ACTIONS.CLOSE_ACTION_WHEEL });
    },
  };
}

export function renderControls(container, appState, dispatch) {
  const state = appState.present;
  const selectedUnit = getUnit(state, state.selectedUnitId);
  const timelineLength = appState.past.length + 1 + appState.future.length;
  const currentIndex = appState.past.length;

  container.replaceChildren();
  container.append(
    renderTurnPanel(state, dispatch),
    renderRoster(state, selectedUnit, dispatch),
    renderReplayPanel(timelineLength, currentIndex, dispatch),
    renderLog(state),
  );
}

export function renderActionWheel(container, state, dispatch) {
  container.replaceChildren();

  if (!state.actionWheel) {
    return;
  }

  const unit = getUnit(state, state.actionWheel.unitId);
  if (!unit || !unit.alive) {
    return;
  }

  const wheel = el("div", {
    className: "action-wheel",
  });
  wheel.style.left = `${state.actionWheel.x}px`;
  wheel.style.top = `${state.actionWheel.y}px`;

  for (const [index, actionType] of Object.values(ORDER_TYPES).entries()) {
    const disabled = unit.exposed && (actionType === ORDER_TYPES.ATTACK || actionType === ORDER_TYPES.COVER);
    const button = el("button", {
      className: "wheel-action",
      textContent: ACTION_LABELS[actionType],
      disabled,
      onclick: (event) => {
        event.stopPropagation();

        if (TARGETED_ACTIONS.has(actionType)) {
          dispatch({
            type: ACTIONS.BEGIN_TARGETING,
            unitId: unit.id,
            orderType: actionType,
          });
          return;
        }

        dispatch({
          type: ACTIONS.SET_ORDER,
          unitId: unit.id,
          orderType: actionType,
        });
      },
    });

    const angle = -90 + index * 72;
    button.style.setProperty("--angle", `${angle}deg`);
    wheel.append(button);
  }

  const label = el("div", {
    className: `wheel-center ${unit.team}`,
    textContent: unit.name,
  });
  wheel.append(label);
  container.append(wheel);
}

function renderTurnPanel(state, dispatch) {
  const panel = el("section", { className: "panel" });
  panel.append(el("h2", { textContent: `Turn ${state.turn}` }));

  const orderedCount = aliveUnits(state).filter((unit) => state.orders[unit.id]).length;
  panel.append(
    el("p", {
      className: "muted",
      textContent: `${orderedCount}/${aliveUnits(state).length} living units have orders.`,
    }),
  );

  if (state.targetingOrder) {
    const unit = getUnit(state, state.targetingOrder.unitId);
    panel.append(
      el("p", {
        className: "targeting-hint",
        textContent: `Choose ${ACTION_LABELS[state.targetingOrder.orderType].toLowerCase()} target for ${unit?.name ?? "unit"}.`,
      }),
    );
  }

  const resolveButton = el("button", {
    className: "primary-button",
    textContent: "Resolve Turn",
    onclick: () => dispatch({ type: ACTIONS.COMMIT_TURN }),
  });

  const resetButton = el("button", {
    className: "ghost-button",
    textContent: "Reset",
    onclick: () => dispatch({ type: ACTIONS.RESET_GAME }),
  });

  const aiButton = el("button", {
    className: "ghost-button",
    textContent: "AI Orders for Red",
    onclick: () =>
      dispatch({
        type: ACTIONS.SET_TEAM_ORDERS,
        team: TEAMS.RED,
        orders: chooseOrders(state, TEAMS.RED),
      }),
  });

  const row = el("div", { className: "button-row" });
  row.append(resolveButton, resetButton);
  panel.append(row, aiButton);
  return panel;
}

function renderRoster(state, selectedUnit, dispatch) {
  const panel = el("section", { className: "panel roster-panel" });
  panel.append(el("h2", { textContent: "Units" }));

  const list = el("div", { className: "unit-list" });
  for (const unit of aliveUnits(state)) {
    const order = getOrder(state, unit.id);
    const button = el("button", {
      className: unit.id === selectedUnit?.id ? `unit-row selected ${unit.team}` : `unit-row ${unit.team}`,
      onclick: () => dispatch({ type: ACTIONS.SELECT_UNIT, unitId: unit.id }),
    });

    button.append(
      el("span", { className: "unit-name", textContent: unit.name }),
      el("span", {
        className: "unit-status",
        textContent: `${unit.exposed ? "Exposed" : "Steady"} · ${ACTION_LABELS[order.type]}`,
      }),
    );
    list.append(button);
  }

  panel.append(list);
  return panel;
}

function renderReplayPanel(timelineLength, currentIndex, dispatch) {
  const panel = el("section", { className: "panel" });
  panel.append(el("h2", { textContent: "Replay" }));

  const row = el("div", { className: "button-row" });
  row.append(
    el("button", {
      className: "ghost-button",
      textContent: "Prev",
      disabled: currentIndex === 0,
      onclick: () => dispatch({ type: ACTIONS.JUMP_TO_HISTORY, index: currentIndex - 1 }),
    }),
    el("span", {
      className: "timeline-position",
      textContent: `${currentIndex + 1}/${timelineLength}`,
    }),
    el("button", {
      className: "ghost-button",
      textContent: "Next",
      disabled: currentIndex === timelineLength - 1,
      onclick: () => dispatch({ type: ACTIONS.JUMP_TO_HISTORY, index: currentIndex + 1 }),
    }),
  );

  panel.append(row);
  return panel;
}

function renderLog(state) {
  const panel = el("section", { className: "panel" });
  panel.append(el("h2", { textContent: "Log" }));

  const list = el("ul", { className: "log-list" });
  for (const entry of state.log) {
    list.append(el("li", { textContent: entry }));
  }

  panel.append(list);
  return panel;
}

function isLegalTarget(unit, actionType, target) {
  const from = unitCoord(unit);

  if (actionType === ORDER_TYPES.COVER) {
    return isSelfOrAdjacent(from, target);
  }

  if (actionType === ORDER_TYPES.MOVE || actionType === ORDER_TYPES.ATTACK) {
    return isAdjacent(from, target);
  }

  return false;
}

function el(tagName, props = {}) {
  const element = document.createElement(tagName);

  for (const [key, value] of Object.entries(props)) {
    element[key] = value;
  }

  return element;
}
