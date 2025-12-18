import { spells } from "../../../config/spells.js";

// ---------- Gestion du sort actif (joueur) ----------

export function setActiveSpell(caster, spellId) {
  if (!caster) return;
  if (!spellId || !spells[spellId]) {
    caster.activeSpellId = null;
    return;
  }
  caster.activeSpellId = spellId;
}

export function getActiveSpell(caster) {
  if (!caster || !caster.activeSpellId) return null;
  return spells[caster.activeSpellId] || null;
}

export function clearActiveSpell(caster) {
  if (!caster) return;
  caster.activeSpellId = null;
}

