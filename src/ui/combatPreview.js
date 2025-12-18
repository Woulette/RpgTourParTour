import { getActiveSpell, getSpellDamageRange, canPreviewSpellAtTile } from "../core/spellSystem.js";

// Attache à la scène Phaser la logique d'affichage de la prévisualisation
// de dégâts au survol d'un monstre.
//
// La bulle est rendue par monsterTooltip (un seul bloc harmonieux),
// ici on ne fait que calculer/stocker la valeur.
export function attachCombatPreview(scene) {
  if (!scene) return;

  scene.damagePreview = null;

  scene.showDamagePreview = (monster) => {
    const state = scene.combatState;
    if (!state || !state.enCours) return;

    if (!monster || typeof monster.tileX !== "number" || typeof monster.tileY !== "number") {
      scene.clearDamagePreview();
      return;
    }

    const spell = getActiveSpell(scene.player);
    if (!spell) {
      scene.clearDamagePreview();
      return;
    }

    const mapForCombat = scene.combatMap || scene.map;
    if (!mapForCombat) {
      scene.clearDamagePreview();
      return;
    }

    const tileX = monster.tileX;
    const tileY = monster.tileY;

    if (!canPreviewSpellAtTile(scene, scene.player, spell, tileX, tileY, mapForCombat)) {
      scene.clearDamagePreview();
      return;
    }

    const { min, max } = getSpellDamageRange(scene.player, spell);
    scene.damagePreview = {
      monster,
      tileX,
      tileY,
      min,
      max,
      text: `${min} - ${max}`,
      spellId: spell.id,
    };
  };

  scene.clearDamagePreview = () => {
    scene.damagePreview = null;
  };
}
