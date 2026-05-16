import { ORDER_TYPES } from "./constants.js";

export const UNIT_TYPES = {
  infantry: {
    label: "Infantry",
    stats: {
      fatigue: true,
    },
    orders: [ORDER_TYPES.MOVE, ORDER_TYPES.ATTACK, ORDER_TYPES.COVER, ORDER_TYPES.RECOVER],
  },
  conscript: {
    label: "Conscript",
    stats: {
      fatigue: true,
    },
    orders: [ORDER_TYPES.MOVE, ORDER_TYPES.ATTACK, ORDER_TYPES.RECOVER],
  },
};

export function getUnitType(unit) {
  return UNIT_TYPES[unit.type] ?? UNIT_TYPES.infantry;
}

export function getAvailableOrderTypes(unit) {
  return getUnitType(unit).orders.filter((orderType) => orderType !== ORDER_TYPES.RECOVER || unit.fatigued);
}
