import { getNetPlayerId } from "../../../app/session.js";
import { castSpellAtTile } from "../../../features/combat/spells/index.js";
import { spells } from "../../../config/spells.js";

export function createCombatSpellHandlers(ctx) {
  const { scene, player } = ctx;

  const handleCombatSpellCast = (msg) => {
    if (!msg || !player) return;
    const localId = getNetPlayerId();
    if (!localId || msg.casterId !== localId) return;
    const state = scene.combatState;
    if (!state || !state.enCours) return;
    if (Number.isInteger(msg.combatId) && scene.__lanCombatId) {
      if (msg.combatId !== scene.__lanCombatId) return;
    }
    const spell = msg.spellId ? spells[msg.spellId] : null;
    if (!spell) return;
    const tileX = Number.isInteger(msg.targetX) ? msg.targetX : null;
    const tileY = Number.isInteger(msg.targetY) ? msg.targetY : null;
    if (tileX === null || tileY === null) return;
    const mapForCast = scene.combatMap || scene.map;
    const layerForCast = scene.combatGroundLayer || scene.groundLayer;
    if (!mapForCast || !layerForCast) return;
    const authoritative = msg.authoritative === true;
    const spellForCast = authoritative
      ? {
          ...spell,
          damageMin: 0,
          damageMax: 0,
          damageCritMin: 0,
          damageCritMax: 0,
          effects: [],
        }
      : spell;

    castSpellAtTile(
      scene,
      state.joueur,
      spellForCast,
      tileX,
      tileY,
      mapForCast,
      layerForCast
    );
  };

  return { handleCombatSpellCast };
}
