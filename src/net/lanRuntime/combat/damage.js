import { getNetPlayerId } from "../../../app/session.js";
import { showFloatingTextOverEntity } from "../../../features/combat/runtime/floatingText.js";
import { rebuildTurnOrderKeepCurrent } from "../../../features/combat/runtime/state.js";
import { endCombat } from "../../../core/combat.js";
import { addChatMessage } from "../../../chat/chat.js";
import { spells } from "../../../config/spells.js";
import { unblockTile } from "../../../collision/collisionGrid.js";

export function createCombatDamageHandlers(ctx, helpers) {
  const { scene, player } = ctx;
  const { getEntityTile, shouldApplyCombatEvent } = helpers;
  const debugLog = (...args) => {
    if (
      typeof window === "undefined" ||
      (window.LAN_COMBAT_DEBUG !== true && window.LAN_COMBAT_DEBUG !== "1")
    ) {
      return;
    }
    // eslint-disable-next-line no-console
    console.log("[LAN][Combat]", ...args);
  };

  const handleCombatDamageApplied = (msg) => {
    if (!msg || !player) return;
    if (!shouldApplyCombatEvent(msg.combatId, msg.eventId, msg.combatSeq)) return;
    debugLog("EvDamageApplied recv", {
      combatId: msg.combatId ?? null,
      source: msg.source ?? null,
      casterId: msg.casterId ?? null,
      spellId: msg.spellId ?? null,
      targetX: msg.targetX ?? null,
      targetY: msg.targetY ?? null,
      targetKind: msg.targetKind ?? null,
      targetId: msg.targetId ?? null,
      targetIndex: msg.targetIndex ?? null,
      damage: msg.damage ?? null,
      clientSeq: msg.clientSeq ?? null,
    });
    if (
      msg.source === "player" &&
      Number.isInteger(msg.clientSeq) &&
      msg.casterId === getNetPlayerId() &&
      msg.clientSeq === scene.__lanLastDamageSeq
    ) {
      debugLog("EvDamageApplied skip: local echo", {
        clientSeq: msg.clientSeq,
        casterId: msg.casterId,
      });
      return;
    }
    const state = scene.combatState;
    if (!state || !state.enCours) return;
    if (Number.isInteger(msg.combatId) && scene.__lanCombatId) {
      if (msg.combatId !== scene.__lanCombatId) return;
    }
    const damage = Number.isFinite(msg.damage) ? Math.max(0, msg.damage) : 0;
    if (damage <= 0) return;
    const tileX = Number.isInteger(msg.targetX) ? msg.targetX : null;
    const tileY = Number.isInteger(msg.targetY) ? msg.targetY : null;
    const targetKind = typeof msg.targetKind === "string" ? msg.targetKind : null;
    const targetId = Number.isInteger(msg.targetId) ? msg.targetId : null;
    const targetIndex = Number.isInteger(msg.targetIndex) ? msg.targetIndex : null;

    const getTargetName = (entity, isPlayerTarget) => {
      if (isPlayerTarget) return "Vous";
      if (entity?.isCombatAlly) {
        return entity.displayName || entity.label || entity.monsterId || "Allie";
      }
      if (entity?.isSummon) return "Invocation";
      return entity?.displayName || entity?.label || entity?.monsterId || "Monstre";
    };

    let target = null;
    if (targetKind === "monster" && Number.isInteger(targetId)) {
      target =
        Array.isArray(scene.combatMonsters)
          ? scene.combatMonsters.find((m) => m && m.entityId === targetId) || null
          : null;
    } else if (targetKind === "monster" && targetIndex !== null) {
      target =
        Array.isArray(scene.combatMonsters) ? scene.combatMonsters[targetIndex] || null : null;
    } else if (targetKind === "player" && Number.isInteger(targetId)) {
      if (Number.isInteger(state.joueur?.netId) && state.joueur.netId === targetId) {
        target = state.joueur;
      } else if (Array.isArray(scene.combatAllies)) {
        target =
          scene.combatAllies.find(
            (ally) => ally?.isPlayerAlly && Number(ally.netId) === targetId
          ) || null;
      }
    } else if (targetKind === "summon" && Number.isInteger(targetId)) {
      target =
        Array.isArray(scene.combatSummons)
          ? scene.combatSummons.find((summon) => summon && summon.id === targetId) || null
          : null;
    }

    if (!target && (tileX === null || tileY === null)) {
      debugLog("EvDamageApplied drop: no target info", {
        targetKind,
        targetId,
        targetIndex,
      });
      return;
    }
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
    if (!target || !target.stats) {
      debugLog("EvDamageApplied drop: target not found", {
        targetKind,
        targetId,
        targetIndex,
        tileX,
        tileY,
        combatMonsters: Array.isArray(scene.combatMonsters)
          ? scene.combatMonsters.length
          : null,
      });
      return;
    }

    const currentHp =
      typeof target.stats.hp === "number"
        ? target.stats.hp
        : target.stats.hpMax ?? 0;
    const newHp = Math.max(0, currentHp - damage);
    target.stats.hp = newHp;
    debugLog("EvDamageApplied apply", {
      targetKind,
      targetId,
      targetIndex,
      monsterId: target.monsterId ?? null,
      entityId: target.entityId ?? null,
      combatIndex: target.combatIndex ?? null,
      hpBefore: currentHp,
      hpAfter: newHp,
      damage,
    });

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
        if (!scene.__lanCombatId) {
          state.issue = "defaite";
          endCombat(scene);
        }
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
      if (!scene.__lanCombatId) {
        rebuildTurnOrderKeepCurrent(scene);
        if (remaining <= 0) {
          state.issue = "victoire";
          endCombat(scene);
          return;
        }
      }
    }

    if (typeof scene.updateCombatUi === "function") {
      scene.updateCombatUi();
    }
  };

  return { handleCombatDamageApplied };
}
