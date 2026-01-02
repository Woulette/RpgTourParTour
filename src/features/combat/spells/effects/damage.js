import { addChatMessage } from "../../../../chat/chat.js";
import { unblockTile } from "../../../../collision/collisionGrid.js";
import { endCombat } from "../../runtime/runtime.js";
import { showFloatingTextOverEntity } from "../../runtime/floatingText.js";
import { applyShieldToDamage, addShieldAbsorbChat, showShieldAbsorbText } from "../cast/castBuffs.js";
import { computeDamageForSpell } from "../cast/castEryon.js";
import { playMonsterDeathAnimation } from "../../../monsters/runtime/animations.js";

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
  const { damage } = fixedDamage === null ? computeDamageForSpell(caster, damageSpell) : { damage: fixedDamage };

  const shielded = applyShieldToDamage(target, damage);
  const finalDamage = Math.max(0, shielded.damage);
  showShieldAbsorbText(scene, target, shielded.absorbed);
  ctx.lastDamage = { raw: damage, final: finalDamage };

  const currentHp =
    typeof target.stats.hp === "number" ? target.stats.hp : target.stats.hpMax ?? 0;
  const newHp = Math.max(0, currentHp - finalDamage);
  target.stats.hp = newHp;

  const isPlayerTarget = target === state?.joueur;
  if (isPlayerTarget && typeof target.updateHudHp === "function") {
    const hpMax = target.stats.hpMax ?? newHp;
    target.updateHudHp(newHp, hpMax);
  }
  if (scene && typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }

  if (state?.enCours && state.joueur) {
    const spellLabel = spell?.label || spell?.id || "Sort";
    const targetName = getTargetName(target, isPlayerTarget);
    if (finalDamage > 0) {
      addChatMessage(
        {
          kind: "combat",
          channel: "global",
          author: "Combat",
          text: `${spellLabel} : ${targetName} -${finalDamage} PV`,
          element: damageSpell?.element ?? null,
        },
        { player: state.joueur }
      );
    }
    addShieldAbsorbChat(scene, state, spellLabel, targetName, shielded.absorbed);
  }

  if (finalDamage > 0) {
    const delayMs = ctx.impactDelayMs ?? 0;
    if (delayMs > 0 && scene?.time?.delayedCall) {
      scene.time.delayedCall(delayMs, () => {
        showFloatingTextOverEntity(scene, target, `-${finalDamage}`, {
          color: "#ff4444",
        });
      });
    } else {
      showFloatingTextOverEntity(scene, target, `-${finalDamage}`, { color: "#ff4444" });
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
