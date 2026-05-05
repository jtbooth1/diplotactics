import { ACTIONS } from "../game/reducer.js";
import { ACTION_LABELS, ORDER_TYPES } from "../game/constants.js";
import { isAdjacent, isSelfOrAdjacent } from "../game/hex.js";
import { aliveUnits, getOrder, getUnit, unitAt, unitCoord } from "../game/state.js";
import { createRadialMenu } from "./radialMenu.js";

const TARGETED_ACTIONS = new Set([ORDER_TYPES.MOVE, ORDER_TYPES.ATTACK, ORDER_TYPES.COVER]);
const ICON_BY_ORDER = {
  [ORDER_TYPES.MOVE]: "Footprints",
  [ORDER_TYPES.ATTACK]: "Swords",
  [ORDER_TYPES.COVER]: "Shield",
  [ORDER_TYPES.RECOVER]: "RotateCcw",
  [ORDER_TYPES.HOLD]: "Circle",
};
const ACTION_MENU_SIZE = 192;
const ACTION_MENU_MARGIN = 12;

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

export function renderControls(container, appState, dispatch, scenarioOptions = {}) {
  const state = appState.present;
  const selectedUnit = getUnit(state, state.selectedUnitId);
  const timelineLength = appState.past.length + 1 + appState.future.length;
  const currentIndex = appState.past.length;

  container.replaceChildren();
  container.append(
    renderScenarioPanel(state.scenario.id, scenarioOptions),
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
  const position = clampActionWheelPosition(state.actionWheel.x, state.actionWheel.y);
  wheel.style.left = `${position.x}px`;
  wheel.style.top = `${position.y}px`;

  const menu = createRadialMenu({
    className: `action-radial ${unit.team}`,
    label: `Actions for ${unit.name}`,
    centerLabel: unit.name,
    size: ACTION_MENU_SIZE,
    items: Object.values(ORDER_TYPES).map((actionType) => ({
      id: actionType,
      icon: ICON_BY_ORDER[actionType],
      label: ACTION_LABELS[actionType],
      disabled: unit.exposed && (actionType === ORDER_TYPES.ATTACK || actionType === ORDER_TYPES.COVER),
    })),
    onSelect: (item) => {
      if (TARGETED_ACTIONS.has(item.id)) {
        dispatch({
          type: ACTIONS.BEGIN_TARGETING,
          unitId: unit.id,
          orderType: item.id,
        });
        return;
      }

      dispatch({
        type: ACTIONS.SET_ORDER,
        unitId: unit.id,
        orderType: item.id,
      });
    },
  });

  wheel.append(menu);
  container.append(wheel);
}

function clampActionWheelPosition(x, y) {
  const radius = ACTION_MENU_SIZE / 2;
  return {
    x: clampToViewport(x, radius, window.innerWidth),
    y: clampToViewport(y, radius, window.innerHeight),
  };
}

function clampToViewport(value, radius, viewportSize) {
  const min = radius + ACTION_MENU_MARGIN;
  const max = viewportSize - radius - ACTION_MENU_MARGIN;

  if (max < min) {
    return viewportSize / 2;
  }

  return Math.min(Math.max(value, min), max);
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

  const targetingUnit = state.targetingOrder ? getUnit(state, state.targetingOrder.unitId) : null;
  const gameOver = state.status.phase === "complete";
  panel.append(
    el("p", {
      className: state.targetingOrder || gameOver ? "targeting-hint" : "targeting-hint hidden",
      textContent: getTurnHintText(state, targetingUnit),
    }),
  );

  const endTurnButton = el("button", {
    className: "primary-button",
    textContent: gameOver ? "Game Over" : "End Turn",
    disabled: gameOver,
    onclick: () => dispatch({ type: ACTIONS.COMMIT_TURN }),
  });

  const resetButton = el("button", {
    className: "ghost-button",
    textContent: "Reset",
    onclick: () => dispatch({ type: ACTIONS.RESET_GAME }),
  });

  const row = el("div", { className: "button-row" });
  row.append(endTurnButton, resetButton);
  panel.append(row);
  return panel;
}

function renderScenarioPanel(activeScenarioId, { scenarios = [], onScenarioSelect } = {}) {
  const panel = el("section", { className: "panel scenario-panel" });
  panel.append(el("h2", { textContent: "Scenarios" }));

  const list = el("div", { className: "scenario-list" });
  for (const scenario of scenarios) {
    list.append(
      el("button", {
        className: scenario.id === activeScenarioId ? "scenario-button selected" : "scenario-button",
        textContent: scenario.name,
        onclick: () => onScenarioSelect?.(scenario.id),
      }),
    );
  }

  panel.append(list);
  return panel;
}

function getTurnHintText(state, targetingUnit) {
  if (state.status.phase === "complete") {
    return state.status.winner === "draw" ? "Elimination draw." : `${capitalize(state.status.winner)} wins by elimination.`;
  }

  if (state.targetingOrder) {
    return `Choose ${ACTION_LABELS[state.targetingOrder.orderType].toLowerCase()} target for ${targetingUnit?.name ?? "unit"}.`;
  }

  return "No target selection active.";
}

function capitalize(value) {
  return value[0].toUpperCase() + value.slice(1);
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
