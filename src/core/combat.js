// Facade du système de combat : ré-exporte les sous‑modules.

export {
  createCombatState,
  buildTurnOrder,
  passerTour,
} from "./combat/state.js";

export { startPrep, startCombatFromPrep } from "./combat/prep.js";

export { startCombat, endCombat } from "./combat/runtime.js";

export {
  limitPathForCombat,
  applyMoveCost,
  updateCombatPreview,
} from "./combat/movement.js";

