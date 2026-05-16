import { ACTIONS } from "../game/reducer.js";
import { ACTION_LABELS, ORDER_TYPES } from "../game/constants.js";
import { createBoard, getHexCenter, isAdjacent, isSelfOrAdjacent } from "../game/hex.js";
import { aliveUnits, getOrder, getUnit, unitAt, unitCoord } from "../game/state.js";
import { getAvailableOrderTypes, getUnitType } from "../game/unitTypes.js";
import { createRadialMenu } from "./radialMenu.js";

const TARGETED_ACTIONS = new Set([ORDER_TYPES.MOVE, ORDER_TYPES.ATTACK, ORDER_TYPES.COVER]);
const ICON_BY_ORDER = {
  [ORDER_TYPES.MOVE]: "Footprints",
  [ORDER_TYPES.ATTACK]: "Swords",
  [ORDER_TYPES.COVER]: "Shield",
  [ORDER_TYPES.RECOVER]: "RotateCcw",
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
        const position = getHexPanelPosition(state, coord, event);
        dispatch({
          type: ACTIONS.OPEN_ACTION_WHEEL,
          unitId: clickedUnit.id,
          selectable: isPlayerControlled(state, clickedUnit),
          x: position.x,
          y: position.y,
        });
        return;
      }

      dispatch({ type: ACTIONS.CLOSE_ACTION_WHEEL });
    },
    onBackgroundClick() {
      dispatch({ type: ACTIONS.CLOSE_ACTION_WHEEL });
    },
  };
}

function getHexPanelPosition(state, coord, event) {
  const board = createBoard(state.scenario.map);
  const center = getHexCenter(coord, board);
  const svg = event.currentTarget.ownerSVGElement;
  const boardPanel = event.currentTarget.closest(".board-panel");
  const screenMatrix = svg?.getScreenCTM();

  if (!center || !boardPanel || !screenMatrix) {
    return { x: event.clientX, y: event.clientY };
  }

  const panelRect = boardPanel.getBoundingClientRect();
  const screenPoint = new DOMPoint(center.x, center.y).matrixTransform(screenMatrix);

  return {
    x: screenPoint.x - panelRect.left,
    y: screenPoint.y - panelRect.top,
  };
}

export function renderControls(container, appState, dispatch, scenarioOptions = {}) {
  const state = appState.present;
  const timelineLength = appState.past.length + 1 + appState.future.length;
  const currentIndex = appState.past.length;

  container.replaceChildren();
  container.append(
    renderScenarioPanel(state.scenario.id, scenarioOptions),
    renderTurnPanel(state, dispatch),
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

  const canIssueOrders = isPlayerControlled(state, unit);
  const wheel = el("div", {
    className: "action-wheel",
  });
  const position = clampActionWheelPosition(state.actionWheel.x, state.actionWheel.y, container);
  wheel.style.left = `${position.x}px`;
  wheel.style.top = `${position.y}px`;

  const menu = createRadialMenu({
    className: `action-radial ${unit.team}`,
    label: `Actions for ${unit.name}`,
    size: ACTION_MENU_SIZE,
    items: getAvailableOrderTypes(unit).map((actionType) => ({
      id: actionType,
      icon: ICON_BY_ORDER[actionType],
      label: ACTION_LABELS[actionType],
      disabled: !canIssueOrders || (unit.exposed && (actionType === ORDER_TYPES.ATTACK || actionType === ORDER_TYPES.COVER)),
    })),
    onSelect: (item) => {
      if (!canIssueOrders) {
        return;
      }

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

function isPlayerControlled(state, unit) {
  return state.scenario.controllers?.[unit.team]?.type === "player";
}

function clampActionWheelPosition(x, y, container) {
  const radius = ACTION_MENU_SIZE / 2;
  const bounds = container.getBoundingClientRect();

  return {
    x: clampToBounds(x, radius, bounds.width),
    y: clampToBounds(y, radius, bounds.height),
  };
}

function clampToBounds(value, radius, size) {
  const min = radius + ACTION_MENU_MARGIN;
  const max = size - radius - ACTION_MENU_MARGIN;

  if (max < min) {
    return size / 2;
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
  const hintVisible = state.targetingOrder || gameOver || state.scenario.rules.type !== "elimination";
  panel.append(
    el("p", {
      className: hintVisible ? "targeting-hint" : "targeting-hint hidden",
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
    return state.status.winner === "draw"
      ? "Draw."
      : `${capitalize(state.status.winner)} wins ${formatReason(state.status.reason)}.`;
  }

  if (state.targetingOrder) {
    return `Choose ${ACTION_LABELS[state.targetingOrder.orderType].toLowerCase()} target for ${targetingUnit?.name ?? "unit"}.`;
  }

  return getRuleHintText(state);
}

function capitalize(value) {
  return value[0].toUpperCase() + value.slice(1);
}

function getRuleHintText(state) {
  const rules = state.scenario.rules;

  if (rules.type === "king-of-the-hill") {
    const hill = state.status.ruleState.hill;
    return hill?.team ? `${capitalize(hill.team)} holds the hill: ${hill.turns}/${rules.requiredTurns ?? 2}.` : "Hold the hill for 2 turns.";
  }

  if (rules.type === "fortress-attack") {
    return `${capitalize(rules.attackerTeam)} wins by occupying the flag.`;
  }

  if (rules.type === "hunter") {
    return `${capitalize(rules.huntedTeam)} survives after turn ${rules.maxTurns}; ${capitalize(rules.hunterTeam)} wins by elimination.`;
  }

  return "No target selection active.";
}

function formatReason(reason) {
  if (reason === "king-of-the-hill") {
    return "by holding the hill";
  }

  if (reason === "fortress-attack") {
    return "by taking the flag";
  }

  if (reason === "hunter-elimination") {
    return "by eliminating the hunted";
  }

  if (reason === "hunter-timeout") {
    return "by surviving the hunt";
  }

  return "by elimination";
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
        textContent: `${getUnitType(unit).label} · ${getUnitStateLabel(unit)} · ${ACTION_LABELS[order.type]}`,
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

  if (actionType === ORDER_TYPES.MOVE) {
    return isSelfOrAdjacent(from, target);
  }

  if (actionType === ORDER_TYPES.ATTACK) {
    return isAdjacent(from, target);
  }

  return false;
}

function getUnitStateLabel(unit) {
  if (unit.fatigued) {
    return "Fatigued";
  }

  return unit.exposed ? "Exposed" : "Ready";
}

function el(tagName, props = {}) {
  const element = document.createElement(tagName);

  for (const [key, value] of Object.entries(props)) {
    element[key] = value;
  }

  return element;
}
