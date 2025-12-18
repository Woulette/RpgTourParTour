import { spells } from "../../../config/spells.js";
import { emit as emitStoreEvent } from "../../../state/store.js";

// ---------- Gestion du sort actif (joueur) ----------

export function setActiveSpell(caster, spellId) {
  if (!caster) return;
  if (!spellId || !spells[spellId]) {
    caster.activeSpellId = null;
    emitStoreEvent("spell:activeSpellChanged", { caster, spellId: null });
    return;
  }
  caster.activeSpellId = spellId;
  emitStoreEvent("spell:activeSpellChanged", { caster, spellId });
}

export function getActiveSpell(caster) {
  if (!caster || !caster.activeSpellId) return null;
  return spells[caster.activeSpellId] || null;
}

export function clearActiveSpell(caster) {
  if (!caster) return;
  caster.activeSpellId = null;
  emitStoreEvent("spell:activeSpellChanged", { caster, spellId: null });
}
