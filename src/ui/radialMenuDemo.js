import { createRadialMenu } from "./radialMenu.js";

const DEMO_ICONS = ["Footprints", "Swords", "Shield", "RotateCcw", "Circle", "Eye", "Zap", "Flag"];

export function renderRadialMenuDemo(container) {
  const shell = document.createElement("main");
  shell.className = "radial-demo-page";

  const header = document.createElement("header");
  header.className = "hero radial-demo-hero";
  header.innerHTML = `
    <p class="eyebrow">Component Test Page</p>
    <h1>Radial Action Menu</h1>
    <p>Flexible pie-slice icon menus from 2 to 8 options. Gray slices are disabled and ignore hover/click.</p>
    <a class="demo-link" href="#">Back to game</a>
  `;

  const status = document.createElement("p");
  status.className = "demo-status";
  status.textContent = "Hover or click any enabled slice.";

  const grid = document.createElement("section");
  grid.className = "radial-demo-grid";

  for (let count = 2; count <= 8; count += 1) {
    const card = document.createElement("article");
    card.className = "radial-demo-card";

    const title = document.createElement("h2");
    title.textContent = `${count} options`;

    const menu = createRadialMenu({
      className: "demo-radial",
      label: `${count} option radial menu`,
      centerLabel: String(count),
      size: count <= 3 ? 164 : 188,
      items: Array.from({ length: count }, (_, index) => ({
        id: `demo-${count}-${index + 1}`,
        label: `Option ${index + 1}`,
        icon: DEMO_ICONS[index],
        disabled: count > 3 && index === count - 1,
      })),
      onSelect: (item) => {
        status.textContent = `Selected ${item.label} in the ${count}-option menu.`;
      },
    });

    card.append(title, menu);
    grid.append(card);
  }

  shell.append(header, status, grid);
  container.replaceChildren(shell);
}
