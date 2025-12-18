export { setActiveSpell, getActiveSpell, clearActiveSpell } from "./activeSpell.js";
export {
  canCastSpell,
  canCastSpellAtTile,
  canCastSpellOnTile,
  isSpellInRangeFromPosition,
} from "./canCast.js";
export { computeSpellDamage, getSpellDamageRange } from "./damage.js";
export { clearSpellRangePreview, updateSpellRangePreview } from "./preview.js";
export { castSpellAtTile, tryCastActiveSpellAtTile } from "./cast.js";

