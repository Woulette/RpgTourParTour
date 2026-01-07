import { getNetIsHost } from "../../../app/session.js";
import { showFloatingTextOverEntity } from "../../../features/combat/runtime/floatingText.js";
import { endCombat } from "../../../core/combat.js";
import { addChatMessage } from "../../../chat/chat.js";
import { spells } from "../../../config/spells.js";
import { unblockTile } from "../../../collision/collisionGrid.js";

export function createCombatDamageHandlers(ctx, helpers) {
  const { scene, player } = ctx;
  const { getEntityTile } = helpers;

  const handleCombatDamageApplied = (msg) => {
    if (!msg || !player) return;
    if (msg.source === "monster" && getNetIsHost()) return;
    const state = scene.combatState;
    if (!state || !state.enCours) return;
    if (Number.isInteger(msg.combatId) && scene.__lanCombatId) {
      if (msg.combatId !== scene.__lanCombatId) return;
    }
    const damage = Number.isFinite(msg.damage) ? Math.max(0, msg.damage) : 0;
    if (damage <= 0) return;
    const tileX = Number.isInteger(msg.targetX) ? msg.targetX : null;
    const tileY = Number.isInteger(msg.targetY) ? msg.targetY : null;
    if (tileX === null || tileY === null) return;

    const getTargetName = (entity, isPlayerTarget) => {
      if (isPlayerTarget) return "Vous";
      if (entity?.isCombatAlly) {
        return entity.displayName || entity.label || entity.monsterId || "Allie";
      }
      if (entity?.isSummon) return "Invocation";
      return entity?.displayName || entity?.label || entity?.monsterId || "Monstre";
    };

    let target = null;
    const playerTile = getEntityTile(state.joueur);
    if (playerTile && playerTile.x === tileX && playerTile.y === tileY) {
      target = state.joueur;
    }
    if (!target && Array.isArray(scene.combatAllies)) {
      target =
        scene.combatAllies.find((ally) => {
          const t = getEntityTile(ally);
          return t && t.x === tileX && t.y === tileY;
        }) || null;
    }
    if (!target && Array.isArray(scene.combatSummons)) {
      target =
        scene.combatSummons.find((summon) => {
          const t = getEntityTile(summon);
          return t && t.x === tileX && t.y === tileY;
        }) || null;
    }
    if (!target && Array.isArray(scene.combatMonsters)) {
      target =
        scene.combatMonsters.find((m) => {
          const t = getEntityTile(m);
          return t && t.x === tileX && t.y === tileY;
        }) || null;
    }
    if (!target || !target.stats) return;

    const currentHp =
      typeof target.stats.hp === "number"
        ? target.stats.hp
        : target.stats.hpMax ?? 0;
    const newHp = Math.max(0, currentHp - damage);
    target.stats.hp = newHp;

    const spell = msg.spellId ? spells[msg.spellId] : null;
    if (state?.enCours && state.joueur) {
      const targetName = getTargetName(target, target === state.joueur);
      addChatMessage(
        {
          kind: "combat",
          channel: "global",
          author: "Combat",
          text: `${targetName} -${damage} PV`,
          element: spell?.element ?? null,
          isCrit: false,
        },
        { player: state.joueur }
      );
    }

    showFloatingTextOverEntity(scene, target, `-${damage}`, {
      color: "#fbbf24",
      sequenceStepMs: 0,
    });

    if (target === state.joueur && typeof target.updateHudHp === "function") {
      const hpMax = target.stats.hpMax ?? newHp;
      target.updateHudHp(newHp, hpMax);
    }

    if (newHp <= 0) {
      if (target === state.joueur) {
        state.issue = "defaite";
        endCombat(scene);
        return;
      }

      if (!target._deathHandled) {
        target._deathHandled = true;
        if (typeof target.onKilled === "function") {
          target.onKilled(scene, state.joueur);
        }
        if (target.blocksMovement && target._blockedTile) {
          unblockTile(scene, target._blockedTile.x, target._blockedTile.y);
          target._blockedTile = null;
        }
        if (typeof target.destroy === "function") {
          target.destroy();
        }
      }

      if (target.isSummon && Array.isArray(scene.combatSummons)) {
        scene.combatSummons = scene.combatSummons.filter((s) => s && s !== target);
      } else if (target.isCombatAlly && Array.isArray(scene.combatAllies)) {
        scene.combatAllies = scene.combatAllies.filter((s) => s && s !== target);
      } else {
        if (Array.isArray(scene.combatMonsters)) {
          scene.combatMonsters = scene.combatMonsters.filter((m) => m && m !== target);
        }
        if (Array.isArray(scene.monsters)) {
          scene.monsters = scene.monsters.filter((m) => m && m !== target);
        }
      }
      const remaining = Array.isArray(scene.combatMonsters)
        ? scene.combatMonsters.filter((m) => {
            const hp =
              typeof m?.stats?.hp === "number" ? m.stats.hp : m?.stats?.hpMax ?? 0;
            return hp > 0;
          }).length
        : 0;
      if (remaining <= 0) {
        state.issue = "victoire";
        endCombat(scene);
        return;
      }
    }

    if (typeof scene.updateCombatUi === "function") {
      scene.updateCombatUi();
    }
  };

  return { handleCombatDamageApplied };
}
