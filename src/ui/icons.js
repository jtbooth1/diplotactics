import { Circle, Eye, Flag, Footprints, RotateCcw, Shield, Swords, Zap, createElement } from "lucide";

const ICONS = {
  Circle,
  Eye,
  Flag,
  Footprints,
  RotateCcw,
  Shield,
  Swords,
  Zap,
};

export function renderIcon(name) {
  return createElement(ICONS[name] ?? Circle);
}
