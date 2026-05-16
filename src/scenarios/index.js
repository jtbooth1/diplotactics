import basicElimination from "./basic-elimination.json";
import compactHexElimination from "./compact-hex-elimination.json";
import fortressAttack from "./fortress-attack.json";
import hunter from "./hunter.json";
import kingOfTheHill from "./king-of-the-hill.json";
import tinyScrumElimination from "./tiny-scrum-elimination.json";

export const scenarios = [
  basicElimination,
  compactHexElimination,
  tinyScrumElimination,
  kingOfTheHill,
  fortressAttack,
  hunter,
];

export const defaultScenario = scenarios[0];
