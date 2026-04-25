import "./styles.css";
import { createInitialAppState } from "./game/state.js";
import { appReducer } from "./game/reducer.js";
import { renderBoard } from "./ui/renderBoard.js";
import { createBoardHandlers, renderActionWheel, renderControls } from "./ui/input.js";

let appState = createInitialAppState();

const app = document.querySelector("#app");
const shell = document.createElement("main");
shell.className = "app-shell";

const header = document.createElement("header");
header.className = "hero";
header.innerHTML = `
  <p class="eyebrow">Diplotactics Prototype</p>
  <h1>Simultaneous Hex Skirmish</h1>
  <p>Issue simple orders to every soldier, then resolve movement, cover, attacks, and recovery together.</p>
`;

const boardPanel = document.createElement("section");
boardPanel.className = "board-panel";
const boardContainer = document.createElement("div");
boardContainer.className = "board-container";
const actionWheelLayer = document.createElement("div");
actionWheelLayer.className = "action-wheel-layer";
boardPanel.append(boardContainer, actionWheelLayer);

const controls = document.createElement("aside");
controls.className = "controls";

shell.append(header, boardPanel, controls);
app.append(shell);

function dispatch(action) {
  appState = appReducer(appState, action);
  render();
}

function render() {
  renderBoard(boardContainer, appState.present, createBoardHandlers(appState.present, dispatch));
  renderActionWheel(actionWheelLayer, appState.present, dispatch);
  renderControls(controls, appState, dispatch);
}

render();
