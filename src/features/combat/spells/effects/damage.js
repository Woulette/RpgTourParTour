import { addChatMessage } from "../../../../chat/chat.js";
import { unblockTile } from "../../../../collision/collisionGrid.js";
import { endCombat } from "../../runtime/runtime.js";
import { flashCombatCrit, showFloatingTextOverEntity } from "../../runtime/floatingText.js";
import { applyShieldToDamage, addShieldAbsorbChat, showShieldAbsorbText } from "../cast/castBuffs.js";
import { computeDamageForSpell } from "../cast/castEryon.js";
import { applyFixedResistanceToDamage } from "../utils/damage.js";
import { playMonsterDeathAnimation } from "../../../monsters/runtime/animations.js";
import { getNetClient, getNetIsHost, getNetPlayerId } from "../../../../app/session.js";

function resolveDamageSpell(spell, effect) {
  if (!spell || !effect) return spell;
  const hasMin = typeof effect.min === "number";
  const hasMax = typeof effect.max === "number";
  const hasElement = typeof effect.element === "string";
  if (!hasMin && !hasMax && !hasElement) return spell;
  return {
    ...spell,
    damageMin: hasMin ? effect.min : spell.damageMin,
    damageMax: hasMax ? effect.max : spell.damageMax,
    element: hasElement ? effect.element : spell.element,
  };
}

function getTargetName(target, isPlayerTarget) {
  if (isPlayerTarget) return "Vous";
  if (target?.isCombatAlly) {
    return target.displayName || target.label || target.monsterId || "Allie";
  }
  if (target?.isSummon) return "Invocation";
  return target?.displayName || target?.label || target?.monsterId || "Monstre";
}

function getEntityTile(entity) {
  if (!entity) return null;
  const tx =
    typeof entity.currentTileX === "number"
      ? entity.currentTileX
      : typeof entity.tileX === "number"
        ? entity.tileX
        : null;
  const ty =
    typeof entity.currentTileY === "number"
      ? entity.currentTileY
      : typeof entity.tileY === "number"
        ? entity.tileY
        : null;
  if (tx === null || ty === null) return null;
  return { x: tx, y: ty };
}

function buildDamageTargetPayload(scene, target) {
  if (!target) return {};
  if (target === scene?.combatState?.joueur || target?.isPlayerAlly) {
    const id = Number.isInteger(target.netId)
      ? target.netId
      : Number.isInteger(target.id)
        ? target.id
        : null;
    if (Number.isInteger(id)) {
      return { targetKind: "player", targetId: id };
    }
    return {};
  }
  if (Number.isInteger(target.entityId)) {
    return { targetKind: "monster", targetId: target.entityId };
  }
  if (Number.isInteger(target.combatIndex)) {
    return { targetKind: "monster", targetIndex: target.combatIndex };
  }
  if (Number.isInteger(target.id)) {
    return { targetKind: "summon", targetId: target.id };
  }
  return {};
}

function removeDeadEntity(scene, target) {
  if (!scene || !target) return;
  if (target.isSummon) {
    if (scene.combatSummons && Array.isArray(scene.combatSummons)) {
      scene.combatSummons = scene.combatSummons.filter((s) => s && s !== target);
    }
  } else if (target.isCombatAlly) {
    if (scene.combatAllies && Array.isArray(scene.combatAllies)) {
      scene.combatAllies = scene.combatAllies.filter((s) => s && s !== target);
    }
  } else {
    if (scene.monsters) {
      scene.monsters = scene.monsters.filter((m) => m !== target);
    }
    if (scene.combatMonsters && Array.isArray(scene.combatMonsters)) {
      scene.combatMonsters = scene.combatMonsters.filter((m) => m && m !== target);
    }
  }
}

function checkCombatVictory(scene, delayMs = 0) {
  if (!scene?.combatState) return;
  let remaining = 0;
  if (scene.combatMonsters && Array.isArray(scene.combatMonsters)) {
    remaining = scene.combatMonsters.filter((m) => {
      const stats = m?.stats || {};
      const hp = typeof stats.hp === "number" ? stats.hp : stats.hpMax ?? 0;
      return hp > 0;
    }).length;
  } else if (scene.monsters) {
    remaining = scene.monsters.length;
  }
  if (remaining <= 0) {
    scene.combatState.issue = "victoire";
    if (delayMs > 0 && scene?.time?.delayedCall) {
      if (scene.combatState.victoryScheduled) return;
      scene.combatState.victoryScheduled = true;
      scene.time.delayedCall(delayMs, () => endCombat(scene));
      return;
    }
    endCombat(scene);
  }
}

export function applyDamageEffect(ctx, effect) {
  const { scene, caster, spell, target, state } = ctx;
  if (!scene || !caster || !spell || !target || !target.stats) return false;

  if (
    target === caster &&
    (spell.id === "recharge_flux" || spell.id === "stabilisation_flux")
  ) {
    return true;
  }

  const damageSpell = resolveDamageSpell(spell, effect);
  const fixedDamage = typeof effect?.fixedDamage === "number" ? effect.fixedDamage : null;
  const damageResult =
    fixedDamage === null
      ? computeDamageForSpell(caster, damageSpell, { forceCrit: ctx.forceCrit })
      : { damage: fixedDamage, isCrit: ctx.forceCrit === true };
  const damage = damageResult.damage ?? 0;

  const reducedDamage = applyFixedResistanceToDamage(
    damage,
    target,
    damageSpell?.element ?? null
  );
  const shielded = applyShieldToDamage(target, reducedDamage);
  const finalDamage = Math.max(0, shielded.damage);
  showShieldAbsorbText(scene, target, shielded.absorbed);
  ctx.lastDamage = { raw: damage, final: finalDamage, isCrit: damageResult.isCrit === true };

  const currentHp =
    typeof target.stats.hp === "number" ? target.stats.hp : target.stats.hpMax ?? 0;
  const newHp = Math.max(0, currentHp - finalDamage);
  target.stats.hp = newHp;

  if (
    finalDamage > 0 &&
    scene?.__lanCombatId &&
    getNetIsHost() &&
    caster !== state?.joueur
  ) {
    const client = getNetClient();
    const playerId = getNetPlayerId();
    const tile = getEntityTile(target);
    if (client && playerId && tile) {
      client.sendCmd("CmdCombatDamageApplied", {
        playerId,
        combatId: scene.__lanCombatId,
        casterId: caster?.entityId ?? null,
        spellId: spell?.id ?? null,
        targetX: tile.x,
        targetY: tile.y,
        damage: finalDamage,
        source: "monster",
      });
    }
  }

  if (
    finalDamage > 0 &&
    scene?.__lanCombatId &&
    caster === state?.joueur
  ) {
    const client = getNetClient();
    const playerId = getNetPlayerId();
    if (client && playerId) {
      const tile = getEntityTile(target);
      if (tile) {
        caster.__lanDamageSeq = (caster.__lanDamageSeq || 0) + 1;
        scene.__lanLastDamageSeq = caster.__lanDamageSeq;
        const payload = {
          playerId,
          combatId: scene.__lanCombatId,
          casterId: playerId,
          spellId: spell?.id ?? null,
          targetX: tile.x,
          targetY: tile.y,
          damage: finalDamage,
          source: "player",
          clientSeq: caster.__lanDamageSeq,
          ...buildDamageTargetPayload(scene, target),
        };
        client.sendCmd("CmdCombatDamageApplied", payload);
        if (
          typeof window !== "undefined" &&
          (window.LAN_COMBAT_DEBUG === true || window.LAN_COMBAT_DEBUG === "1")
        ) {
          // eslint-disable-next-line no-console
          console.log("[LAN][Combat]", "CmdCombatDamageApplied send", payload);
        }
      }
    }
  }

  const isPlayerTarget = target === state?.joueur;
  if (isPlayerTarget && typeof target.updateHudHp === "function") {
    const hpMax = target.stats.hpMax ?? newHp;
    target.updateHudHp(newHp, hpMax);
  }
  if (scene && typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }

  if (state?.enCours && state.joueur) {
    const targetName = getTargetName(target, isPlayerTarget);
    if (finalDamage > 0) {
      const critLabel = damageResult.isCrit ? "Crit ! " : "";
      addChatMessage(
        {
          kind: "combat",
          channel: "global",
          author: "Combat",
          text: `${targetName} ${critLabel}-${finalDamage} PV`,
          element: damageSpell?.element ?? null,
          isCrit: damageResult.isCrit === true,
        },
        { player: state.joueur }
      );
    }
    const spellLabel = spell?.label || spell?.id || "Sort";
    addShieldAbsorbChat(scene, state, spellLabel, targetName, shielded.absorbed);
  }

  if (finalDamage > 0) {
    const isCrit = damageResult.isCrit === true;
    const floatText = `-${finalDamage}`;
    const floatColor = isCrit ? "#ff1f2d" : "#fbbf24";
    const delayMs = ctx.impactDelayMs ?? 0;
    if (delayMs > 0 && scene?.time?.delayedCall) {
      scene.time.delayedCall(delayMs, () => {
        showFloatingTextOverEntity(scene, target, floatText, {
          color: floatColor,
          sequenceStepMs: 0,
        });
        if (isCrit) {
          flashCombatCrit(scene);
          showFloatingTextOverEntity(scene, target, "!", {
            color: floatColor,
            fontSize: 22,
            fontStyle: "bold",
            strokeThickness: 4,
            xOffset: 30,
            yOffset: 73,
            sequenceStepMs: 0,
          });
        }
      });
    } else {
      showFloatingTextOverEntity(scene, target, floatText, {
        color: floatColor,
        sequenceStepMs: 0,
      });
      if (isCrit) {
        flashCombatCrit(scene);
        showFloatingTextOverEntity(scene, target, "!", {
          color: floatColor,
          fontSize: 22,
          fontStyle: "bold",
          strokeThickness: 4,
          xOffset: 30,
          yOffset: 73,
          sequenceStepMs: 0,
        });
      }
    }
  }

  if (newHp > 0) return true;

  if (isPlayerTarget) {
    if (scene.combatState) {
      scene.combatState.issue = "defaite";
    }
    endCombat(scene);
    return true;
  }

  const impactDelayMs = ctx.impactDelayMs ?? 0;
  const endCombatDelayMs = ctx.isPlayerCaster ? 350 : 0;
  const finalizeDeath = () => {
    if (target._deathHandled) return;
    target._deathHandled = true;
    if (typeof target.onKilled === "function") {
      target.onKilled(scene, caster);
    }
    if (target.blocksMovement && target._blockedTile) {
      const prev = target._blockedTile;
      if (typeof prev.x === "number" && typeof prev.y === "number") {
        unblockTile(scene, prev.x, prev.y);
      }
      target._blockedTile = null;
    }
    if (typeof target.destroy === "function") {
      target.destroy();
    }
    removeDeadEntity(scene, target);
    checkCombatVictory(scene, endCombatDelayMs);
  };

  const shouldPlayDeathAnim =
    target && !target.isSummon && !target.isCombatAlly && target !== state?.joueur;

  if ((impactDelayMs > 0 || shouldPlayDeathAnim) && scene?.time?.delayedCall) {
    if (!target._deathScheduled) {
      target._deathScheduled = true;
      const startDeathSequence = () => {
        const deathAnimDelayMs = shouldPlayDeathAnim
          ? playMonsterDeathAnimation(scene, target)
          : 0;
        if (deathAnimDelayMs > 0) {
          scene.time.delayedCall(deathAnimDelayMs, finalizeDeath);
        } else {
          finalizeDeath();
        }
      };
      if (impactDelayMs > 0) {
        scene.time.delayedCall(impactDelayMs, startDeathSequence);
      } else {
        startDeathSequence();
      }
    }
    return true;
  }
  finalizeDeath();
  return true;
}
