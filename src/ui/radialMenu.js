import { renderIcon } from "./icons.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const MIN_ITEMS = 2;
const MAX_ITEMS = 8;

export function createRadialMenu({
  items,
  label = "Action menu",
  centerLabel = "",
  className = "",
  size = 192,
  innerRadius = 38,
  outerRadius = 96,
  onSelect,
} = {}) {
  if (!Array.isArray(items) || items.length < MIN_ITEMS || items.length > MAX_ITEMS) {
    throw new Error(`Radial menu requires ${MIN_ITEMS}-${MAX_ITEMS} items.`);
  }

  const root = document.createElement("div");
  root.className = ["radial-menu", className].filter(Boolean).join(" ");
  root.style.setProperty("--radial-menu-size", `${size}px`);

  const svg = svgEl("svg", {
    class: "radial-menu-svg",
    viewBox: `${-outerRadius} ${-outerRadius} ${outerRadius * 2} ${outerRadius * 2}`,
    role: "group",
    "aria-label": label,
  });

  const sliceAngle = 360 / items.length;

  for (const [index, item] of items.entries()) {
    const disabled = Boolean(item.disabled);
    const startAngle = -90 - sliceAngle / 2 + index * sliceAngle;
    const endAngle = startAngle + sliceAngle;
    const iconAngle = startAngle + (endAngle - startAngle) / 2;
    const iconRadius = innerRadius + (outerRadius - innerRadius) * 0.54;
    const iconPoint = polarToCartesian(iconRadius, iconAngle);

    const segment = svgEl("g", {
      class: `radial-menu-item${disabled ? " disabled" : ""}`,
      role: "button",
      tabindex: disabled ? "-1" : "0",
      "aria-label": item.label ?? item.id ?? `Option ${index + 1}`,
      "aria-disabled": String(disabled),
    });

    segment.append(
      svgEl("path", {
        class: "radial-menu-slice",
        d: annularSectorPath(innerRadius, outerRadius, startAngle, endAngle),
      }),
    );

    const iconPosition = svgEl("g", {
      class: "radial-menu-icon-position",
      transform: `translate(${iconPoint.x} ${iconPoint.y})`,
    });
    const iconScale = svgEl("g", { class: "radial-menu-icon-scale" });
    const icon = renderIcon(item.icon);
    icon.setAttribute("x", "-12");
    icon.setAttribute("y", "-12");
    icon.setAttribute("width", "24");
    icon.setAttribute("height", "24");
    icon.setAttribute("class", "radial-menu-icon");
    iconScale.append(icon);
    iconPosition.append(iconScale);
    segment.append(iconPosition);

    if (!disabled) {
      segment.addEventListener("click", (event) => {
        event.stopPropagation();
        item.onSelect?.(item, event);
        onSelect?.(item, event);
      });
      segment.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        item.onSelect?.(item, event);
        onSelect?.(item, event);
      });
    }

    svg.append(segment);
  }

  if (centerLabel) {
    const center = svgEl("g", { class: "radial-menu-center" });
    center.append(svgEl("circle", { r: String(innerRadius - 5), class: "radial-menu-center-fill" }));
    center.append(
      svgEl("text", {
        class: "radial-menu-center-text",
        "text-anchor": "middle",
        "dominant-baseline": "middle",
      }),
    );
    center.querySelector("text").textContent = centerLabel;
    svg.append(center);
  }

  root.append(svg);
  return root;
}

function annularSectorPath(innerRadius, outerRadius, startAngle, endAngle) {
  const outerStart = polarToCartesian(outerRadius, startAngle);
  const outerEnd = polarToCartesian(outerRadius, endAngle);
  const innerEnd = polarToCartesian(innerRadius, endAngle);
  const innerStart = polarToCartesian(innerRadius, startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function polarToCartesian(radius, angleInDegrees) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;
  return {
    x: round(Math.cos(angleInRadians) * radius),
    y: round(Math.sin(angleInRadians) * radius),
  };
}

function round(value) {
  return Number(value.toFixed(3));
}

function svgEl(tagName, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tagName);

  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }

  return element;
}
