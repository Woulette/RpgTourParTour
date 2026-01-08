import { getNetPlayerId } from "../../../app/session.js";
import { castSpellAtTile } from "../../../features/combat/spells/index.js";
import { spells } from "../../../config/spells.js";

export function createCombatSpellHandlers(ctx, helpers) {
  const { scene, player } = ctx;
  const {
    shouldApplyCombatEvent,
    findCombatMonsterByEntityId,
    findCombatMonsterByIndex,
  } = helpers;

  const handleCombatSpellCast = (msg) => {
    if (!msg || !player) return;
    if (!shouldApplyCombatEvent(msg.combatId, msg.eventId, msg.combatSeq)) return;
    const localId = getNetPlayerId();
    const casterKind = msg.casterKind === "monster" ? "monster" : "player";
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

    let caster = null;
    if (casterKind === "monster") {
      caster = Number.isInteger(msg.casterId)
        ? findCombatMonsterByEntityId(msg.casterId)
        : Number.isInteger(msg.casterIndex)
          ? findCombatMonsterByIndex(msg.casterIndex)
          : null;
    } else if (Number.isInteger(msg.casterId)) {
      if (localId && msg.casterId === localId) {
        caster = state.joueur;
      } else if (Array.isArray(scene.combatAllies)) {
        caster =
          scene.combatAllies.find(
            (ally) => ally?.isPlayerAlly && Number(ally.netId) === msg.casterId
          ) || null;
      }
    }
    if (!caster) return;

    castSpellAtTile(
      scene,
      caster,
      spellForCast,
      tileX,
      tileY,
      mapForCast,
      layerForCast,
      { force: authoritative }
    );
  };

  return { handleCombatSpellCast };
}
