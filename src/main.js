import "./styles.css";
import { createInitialAppState } from "./game/state.js";
import { ACTIONS, appReducer } from "./game/reducer.js";
import { renderBoard } from "./ui/renderBoard.js";
import { createBoardHandlers, renderActionWheel, renderControls } from "./ui/input.js";
import { renderRadialMenuDemo } from "./ui/radialMenuDemo.js";
import { scenarios } from "./scenarios/index.js";

let appState = createInitialAppState(scenarios[0]);

const app = document.querySelector("#app");
let scenarioTitle;
let boardContainer;
let actionWheelLayer;
let controls;

function dispatch(action) {
  appState = appReducer(appState, action);
  renderGameState();
}

function handleKeydown(event) {
  if (event.key !== "Escape") {
    return;
  }

  dispatch({ type: ACTIONS.CANCEL_INTERACTION });
}

function selectScenario(scenarioId) {
  const scenario = scenarios.find((candidate) => candidate.id === scenarioId);
  if (!scenario || scenario.id === appState.present.scenario.id) {
    return;
  }

  appState = createInitialAppState(scenario);
  renderGameState();
}

function renderRoute() {
  if (window.location.hash === "#radial-demo") {
    renderRadialMenuDemo(app);
    return;
  }

  renderGame();
}

function renderGame() {
  const shell = document.createElement("main");
  shell.className = "app-shell";

  const header = document.createElement("header");
  header.className = "hero";
  header.innerHTML = `
    <p class="eyebrow">Diplotactics Prototype</p>
    <h1>Simultaneous Hex Skirmish</h1>
    <p class="scenario-title"></p>
    <p>Issue simple orders to every soldier, then resolve movement, cover, attacks, and recovery together.</p>
    <a class="demo-link" href="#radial-demo">Radial menu test page</a>
  `;
  scenarioTitle = header.querySelector(".scenario-title");

  const boardPanel = document.createElement("section");
  boardPanel.className = "board-panel";
  boardContainer = document.createElement("div");
  boardContainer.className = "board-container";
  actionWheelLayer = document.createElement("div");
  actionWheelLayer.className = "action-wheel-layer";
  boardPanel.append(boardContainer, actionWheelLayer);

  controls = document.createElement("aside");
  controls.className = "controls";

  shell.append(header, boardPanel, controls);
  app.replaceChildren(shell);
  renderGameState();
}

function renderGameState() {
  if (!boardContainer || !actionWheelLayer || !controls) {
    return;
  }

  renderBoard(boardContainer, appState.present, createBoardHandlers(appState.present, dispatch));
  renderActionWheel(actionWheelLayer, appState.present, dispatch);
  renderControls(controls, appState, dispatch, {
    scenarios,
    onScenarioSelect: selectScenario,
  });
  scenarioTitle.textContent = `Scenario: ${appState.present.scenario.name}`;
}

window.addEventListener("hashchange", renderRoute);
window.addEventListener("keydown", handleKeydown);
renderRoute();
