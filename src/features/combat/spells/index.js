export { setActiveSpell, getActiveSpell, clearActiveSpell } from "./core/activeSpell.js";
export {
  canCastSpell,
  canCastSpellAtTile,
  canCastSpellOnTile,
  canPreviewSpellAtTile,
  isSpellInRangeFromPosition,
} from "./core/canCast.js";
export { computeSpellDamage, getSpellDamageRange } from "./utils/damage.js";
export { clearSpellRangePreview, updateSpellRangePreview } from "./core/preview.js";
export { castSpellAtTile, tryCastActiveSpellAtTile } from "./core/cast.js";
