import {
  isTileTargetableForSpell,
  isTileInRange,
  getCasterOriginTile,
  hasLineOfSight,
} from "../utils/util.js";
import { isTileOccupiedByMonster } from "../../../../features/monsters/ai/aiUtils.js";

// ---------- Conditions de lancement ----------

// Vérifie si un lanceur (joueur ou monstre) peut lancer ce sort
// dans l'état actuel du combat.
export function canCastSpell(scene, caster, spell) {
  if (!scene || !caster || !spell) return false;

  const state = scene.combatState;
  if (!state || !state.enCours) return false;

  const isPlayer = caster === state.joueur;
  const expectedTour = isPlayer ? "joueur" : "monstre";
  if (state.tour !== expectedTour) return false;

  // Cooldown (joueur ou monstre)
  const cooldowns = caster.spellCooldowns || {};
  const cd = cooldowns[spell.id] || 0;
  if (cd > 0) return false;

  // limite de lancers par tour (joueur ou monstre)
  const maxCasts = spell.maxCastsPerTurn ?? null;
  if (maxCasts) {
    state.castsThisTurn = state.castsThisTurn || {};
    const used = state.castsThisTurn[spell.id] || 0;
    if (used >= maxCasts) return false;
  }

  const paCost = spell.paCost ?? 0;
  if (state.paRestants < paCost) return false;

  return true;
}

// Vérifie toutes les conditions pour lancer un sort sur une tuile donnée.
export function canCastSpellAtTile(scene, caster, spell, tileX, tileY, map) {
  if (!canCastSpell(scene, caster, spell)) return false;
  const { x: originX, y: originY } = getCasterOriginTile(caster);
  const isSelf = tileX === originX && tileY === originY;
  if (!isSelf && !isTileTargetableForSpell(scene, map, tileX, tileY)) {
    if (!isTileOccupiedByMonster(scene, tileX, tileY, null)) return false;
  }

  // Lancer "en ligne" : uniquement sur la même ligne/colonne (4 directions).
  if (spell.lineOfSight) {
    if (!hasLineOfSight(scene, originX, originY, tileX, tileY)) return false;
  }

  if (spell.castPattern === "line4") {
    if (!(tileX === originX || tileY === originY)) {
      return false;
    }
  }

  if (!isTileInRange(spell, originX, originY, tileX, tileY)) {
    return false;
  }

  // Ligne de vue : à gérer plus tard.
  return true;
}

// Helpers génériques de portée / conditions de sort, utilisables
// aussi bien par le joueur que par les IA de monstres.
export function isSpellInRangeFromPosition(spell, fromX, fromY, toX, toY) {
  return isTileInRange(spell, fromX, fromY, toX, toY);
}

export function canCastSpellOnTile(scene, caster, spell, tileX, tileY, map) {
  return canCastSpellAtTile(scene, caster, spell, tileX, tileY, map);
}

// ---------- Conditions de prévisualisation ----------
// Identique à la logique de portée/LDV/ciblage, mais sans contraintes de tour, PA, cooldown...
export function canPreviewSpellAtTile(scene, caster, spell, tileX, tileY, map) {
  if (!scene || !caster || !spell || !map) return false;

  const state = scene.combatState;
  if (!state || !state.enCours) return false;

  if (!isTileTargetableForSpell(scene, map, tileX, tileY)) return false;

  const { x: originX, y: originY } = getCasterOriginTile(caster);

  if (spell.lineOfSight) {
    if (!hasLineOfSight(scene, originX, originY, tileX, tileY)) return false;
  }

  if (spell.castPattern === "line4") {
    if (!(tileX === originX || tileY === originY)) {
      return false;
    }
  }

  if (!isTileInRange(spell, originX, originY, tileX, tileY)) {
    return false;
  }

  return true;
}
