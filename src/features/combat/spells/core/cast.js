import { findMonsterAtTile } from "../../../../features/monsters/runtime/index.js";
import { unblockTile } from "../../../../collision/collisionGrid.js";
import { endCombat } from "../../runtime/runtime.js";
import { addChatMessage } from "../../../../chat/chat.js";
import { flashCombatCrit, showFloatingTextOverEntity } from "../../runtime/floatingText.js";
import { maybeSpawnRiftWaveOnClear } from "../../systems/waves.js";

import { getActiveSpell, clearActiveSpell } from "./activeSpell.js";
import {
  canCastSpellAtTile,
  resolveSpellTargetAtTile,
  getSpellTargetKey,
} from "./canCast.js";
import {
  computeSpellDamageWithCrit,
  applyFixedResistanceToDamage,
} from "../utils/damage.js";
import { clearSpellRangePreview } from "./preview.js";
import { getCasterOriginTile } from "../utils/util.js";
import {
  playSpellAnimation,
  playEryonPrecastAnimation,
  getSpellAnimationDuration,
} from "../cast/castAnimations.js";
import { registerDefaultEffects } from "../effects/index.js";
import { executeSpellEffectsAtTile } from "../effects/execute.js";
import {
  applyAreaBuffToAllies,
  applyAreaBuffToMonsters,
  applyShieldToDamage,
  showShieldAbsorbText,
  addShieldAbsorbChat,
} from "../cast/castBuffs.js";
import { applyCasterFacing, getEntityTile } from "../cast/castPosition.js";
import { tryPullEntity, tryPushEntity } from "../cast/castMovement.js";
import { applyEryonAfterCast } from "../cast/castEryon.js";
import { canApplyCapture } from "../../summons/capture.js";
import {
  playMonsterSpellAnimation,
  getMonsterSpellAnimationDuration,
} from "../../../monsters/runtime/animations.js";
import {
  getAliveSummon,
  findSummonSpawnTile,
  findAliveCombatAllyAtTile,
  findAliveSummonAtTile,
} from "../../summons/summon.js";
import { registerNoCastMeleeViolation } from "../../../challenges/runtime/index.js";
import { getNetClient, getNetPlayerId } from "../../../../app/session.js";

registerDefaultEffects();

export function castSpellAtTile(
  scene,
  caster,
  spell,
  tileX,
  tileY,
  map,
  groundLayer,
  options = {}
) {
  const forceCast = options?.force === true;
  if (!forceCast && !canCastSpellAtTile(scene, caster, spell, tileX, tileY, map)) {
    return false;
  }

  const state = scene.combatState;
  if (!state) return false;

  const isPlayerCaster = state.joueur === caster;
  const isAllyCaster = caster?.isCombatAlly === true;
  const effects = Array.isArray(spell?.effects) ? spell.effects : [];
  const hasEffectType = (type) => effects.some((eff) => eff && eff.type === type);
  const hasPatternDamage = hasEffectType("patternDamage");
  const hasCapture = hasEffectType("capture");
  const hasSummonCaptured = hasEffectType("summonCaptured");
  const hasSummonMonster = hasEffectType("summonMonster");

  // Challenge : si le joueur caste alors qu'un ennemi est au corps-à-corps,
  // on laisse le sort partir mais le challenge est raté (pas de bonus).
  if (isPlayerCaster) {
    const v = registerNoCastMeleeViolation(scene, caster);
    if (v.violated) {
      if (v.firstTime && state.enCours && state.joueur) {
        addChatMessage(
          {
            kind: "combat",
            channel: "global",
            author: "Challenge",
            text: "Challenge raté : sort lancé au corps à corps.",
          },
          { player: state.joueur }
        );
      }
      showFloatingTextOverEntity(scene, caster, "Challenge raté", {
        color: "#f97316",
      });
      if (typeof scene.updateCombatChallengeUi === "function") {
        scene.updateCombatChallengeUi();
      }
    }
  }

  // Pré-checks pour sorts spéciaux (évite de consommer des PA si c'est impossible)
  if (isPlayerCaster && hasCapture) {
    const target = findMonsterAtTile(scene, tileX, tileY);
    const check = canApplyCapture(scene, caster, target);
    if (!check.ok) return false;
  }

  if (isPlayerCaster && hasSummonCaptured) {
    if (!caster?.capturedMonsterId) return false;
    const alive = getAliveSummon(scene, caster);
    if (alive) return false;
  }
  if (hasSummonMonster) {
    const spawnTile = findSummonSpawnTile(scene, map, caster, {
      x: tileX,
      y: tileY,
    });
    if (!spawnTile) return false;
  }

  const { x: originTileX, y: originTileY } = getCasterOriginTile(caster);
  const isSelfCast = tileX === originTileX && tileY === originTileY;

  if (!isPlayerCaster) {
    const requiresDirectTarget =
      !isSelfCast &&
      !hasPatternDamage &&
      !spell?.effectPattern &&
      !spell?.areaBuff &&
      !spell?.summon &&
      !hasSummonCaptured &&
      !hasSummonMonster &&
      !spell?.capture &&
      !hasCapture;

    if (requiresDirectTarget) {
      if (isAllyCaster) {
        const enemy = findMonsterAtTile(scene, tileX, tileY);
        if (!enemy) return false;
      } else {
        const player = state.joueur;
        const p = player ? getEntityTile(player, map, groundLayer) : null;
        const isPlayerTile =
          p && typeof p.x === "number" && typeof p.y === "number"
            ? p.x === tileX && p.y === tileY
            : false;
        const allyAt = findAliveCombatAllyAtTile(scene, tileX, tileY);
        const summonAt = findAliveSummonAtTile(scene, tileX, tileY);
        if (!isPlayerTile && !allyAt && !summonAt) return false;
      }
    }
  }

  const paCost = spell.paCost ?? 0;
  state.paRestants = Math.max(0, state.paRestants - paCost);

  if (typeof caster.updateHudApMp === "function") {
    caster.updateHudApMp(state.paRestants, state.pmRestants);
  }

  if (paCost > 0) {
    showFloatingTextOverEntity(scene, caster, `${paCost}`, {
      color: "#3b82f6",
    });
  }

  const cdTurns = spell.cooldownTurns ?? 0;
  if (cdTurns > 0) {
    caster.spellCooldowns = caster.spellCooldowns || {};
    caster.spellCooldowns[spell.id] = cdTurns;
  }

  if (isPlayerCaster) {
    const nowMs = scene?.time?.now ?? Date.now();
    const castDelayMs = spell.castDelayMs ?? 500;
    state.castLockUntil = Math.max(state.castLockUntil ?? 0, nowMs + castDelayMs);
  }

  const worldPos = map.tileToWorldXY(tileX, tileY, undefined, undefined, groundLayer);
  const cx = worldPos.x + map.tileWidth / 2;
  const cy = worldPos.y + map.tileHeight / 2;

  applyCasterFacing(
    scene,
    caster,
    { x: originTileX, y: originTileY },
    { x: tileX, y: tileY },
    isPlayerCaster || isAllyCaster,
    map,
    groundLayer
  );

  let monsterAttackDelayMs = 0;
  if (!isPlayerCaster && !isAllyCaster && caster?.monsterId) {
    monsterAttackDelayMs = playMonsterSpellAnimation(scene, caster, spell?.id);
  }

  // FX animation (si dispo)
  const fromX = caster?.x ?? cx;
  const fromY = (caster?.y ?? cy) - 10;
  const isEryonCaster = caster?.classId === "eryon";
  let spellFxDelayMs = 0;
  if (isEryonCaster) {
    const precastMs = playEryonPrecastAnimation(scene, caster, fromX, fromY, cy);
    const delayMs = Math.max(0, precastMs - 120);
    spellFxDelayMs = delayMs;
    if (scene.time && typeof scene.time.delayedCall === "function") {
      scene.time.delayedCall(delayMs, () => {
        playSpellAnimation(scene, spell?.id, fromX, fromY, cx, cy);
      });
    } else {
      playSpellAnimation(scene, spell?.id, fromX, fromY, cx, cy);
    }
  } else {
    playSpellAnimation(scene, spell?.id, fromX, fromY, cx, cy);
  }
  const spellAnimDurationMs = getSpellAnimationDuration(
    scene,
    spell?.id,
    fromX,
    fromY,
    cx,
    cy
  );
  const monsterAnimDurationMs = getMonsterSpellAnimationDuration(
    scene,
    caster,
    spell?.id
  );
  const impactDelayMs = Math.max(
    0,
    spellFxDelayMs + spellAnimDurationMs,
    monsterAttackDelayMs,
    monsterAnimDurationMs
  );

  const size = Math.min(map.tileWidth, map.tileHeight);
  const fx = scene.add.rectangle(cx, cy, size, size, 0xffdd55, 0.6);
  if (scene.hudCamera) {
    scene.hudCamera.ignore(fx);
  }
  scene.time.delayedCall(200, () => fx.destroy());

  if (state.enCours && state.joueur) {
    const spellLabel = spell?.label || spell?.id || "Sort";
    if (isPlayerCaster) {
      addChatMessage(
        { kind: "combat-cast", channel: "global", author: "Combat", text: `Vous lancez ${spellLabel}.` },
        { player: state.joueur }
      );
    } else {
      const casterName = caster?.displayName || caster?.label || caster?.monsterId || "Monstre";
      addChatMessage(
        { kind: "combat", channel: "global", author: "Combat", text: `${casterName} lance ${spellLabel}.` },
        { player: state.joueur }
      );
    }
  }

  state.castsThisTurn = state.castsThisTurn || {};
  const prev = state.castsThisTurn[spell.id] || 0;
  state.castsThisTurn[spell.id] = prev + 1;

  const maxPerTarget = spell.maxCastsPerTargetPerTurn ?? null;
  if (maxPerTarget) {
    const target = resolveSpellTargetAtTile(scene, tileX, tileY);
    const key = getSpellTargetKey(target);
    if (key) {
      state.castsThisTurnTargets = state.castsThisTurnTargets || {};
      const perSpell = state.castsThisTurnTargets[spell.id] || {};
      const used = perSpell[key] || 0;
      perSpell[key] = used + 1;
      state.castsThisTurnTargets[spell.id] = perSpell;
    }
  }

  if (Array.isArray(spell.effects) && spell.effects.length > 0) {
    const ok = executeSpellEffectsAtTile(
      scene,
      caster,
      spell,
      tileX,
      tileY,
      map,
      groundLayer,
      { impactDelayMs }
    );
    clearActiveSpell(caster);
    clearSpellRangePreview(scene);
    applyEryonAfterCast(scene, caster, spell, { isSelfCast });
    return ok;
  }

  if (isAllyCaster && spell?.areaBuff) {
    applyAreaBuffToAllies(scene, map, groundLayer, caster, spell.areaBuff);
    clearActiveSpell(caster);
    clearSpellRangePreview(scene);
    return true;
  }

  if (state.monstre === caster) {
    if (spell?.areaBuff) {
      applyAreaBuffToMonsters(scene, map, groundLayer, caster, spell.areaBuff);
      clearActiveSpell(caster);
      clearSpellRangePreview(scene);
      return true;
    }

    const player = state.joueur;

    if (player && player.stats) {
      let pTx = player.currentTileX;
      let pTy = player.currentTileY;
      if (
        (typeof pTx !== "number" || typeof pTy !== "number") &&
        map &&
        groundLayer &&
        typeof map.worldToTileXY === "function"
      ) {
        const t = map.worldToTileXY(player.x, player.y, true, undefined, undefined, groundLayer);
        if (t) {
          pTx = t.x;
          pTy = t.y;
        }
      }

      const allyAt = findAliveCombatAllyAtTile(scene, tileX, tileY);
      const summonAt = findAliveSummonAtTile(scene, tileX, tileY);
      const isPlayerTile = pTx === tileX && pTy === tileY;
      const victim = isPlayerTile ? player : allyAt || summonAt;

      if (victim && victim.stats) {
        const damageOnHit = spell.damageOnHit !== false;
        const damageResult = damageOnHit
          ? computeSpellDamageWithCrit(caster, spell)
          : { damage: 0, isCrit: false };
        const damage = damageResult.damage ?? 0;
        const reducedDamage = applyFixedResistanceToDamage(
          damage,
          victim,
          spell?.element ?? null
        );

        const shielded = applyShieldToDamage(victim, reducedDamage);
        const finalDamage = Math.max(0, shielded.damage);
        showShieldAbsorbText(scene, victim, shielded.absorbed);
        const currentHp = typeof victim.stats.hp === "number" ? victim.stats.hp : victim.stats.hpMax ?? 0;
        const newHp = Math.max(0, currentHp - Math.max(0, finalDamage));
        if (damageOnHit && finalDamage > 0) {
          victim.stats.hp = newHp;
        }
        if (scene && typeof scene.updateCombatUi === "function") {
          scene.updateCombatUi();
        }

        if (state.enCours && state.joueur) {
          const spellLabel = spell?.label || spell?.id || "Sort";
          const casterName = caster?.displayName || caster?.label || caster?.monsterId || "Monstre";
          const isAllyTarget = !isPlayerTile && victim?.isCombatAlly === true;
          const targetName = isPlayerTile
            ? "Vous"
            : isAllyTarget
              ? victim?.displayName || victim?.label || "Allie"
              : "Invocation";
          if (damageOnHit && finalDamage > 0) {
            addChatMessage(
              {
                kind: "combat",
                channel: "global",
                author: "Combat",
                text: `${spellLabel} : ${isPlayerTile ? "vous subissez" : isAllyTarget ? "l'allie subit" : "l'invocation subit"} -${finalDamage} PV (par ${casterName})`,
                element: spell?.element ?? null,
              },
              { player: state.joueur }
            );
          }
          if (damageOnHit) {
            addShieldAbsorbChat(scene, state, spellLabel, targetName, shielded.absorbed);
          }
        }

        const status = spell?.statusEffect;
        if (isPlayerTile && status && status.type === "poison") {
          const turns = typeof status.turns === "number" ? status.turns : status.turnsLeft ?? 0;
          const dmgMin = typeof status.damageMin === "number" ? status.damageMin : spell.damageMin ?? 0;
          const dmgMax = typeof status.damageMax === "number" ? status.damageMax : spell.damageMax ?? dmgMin;

          player.statusEffects = Array.isArray(player.statusEffects) ? player.statusEffects : [];

          const id = status.id || spell.id || "poison";
          const next = {
            id,
            type: "poison",
            label: status.label || spell.label || spell.id || "Poison",
            turnsLeft: Math.max(0, turns),
            damageMin: dmgMin,
            damageMax: dmgMax,
            sourceName: caster?.displayName || caster?.label || caster?.monsterId || "Monstre",
            element: spell?.element ?? null,
          };

          const idx = player.statusEffects.findIndex((e) => e && e.id === id);
          if (idx >= 0) player.statusEffects[idx] = next;
          else player.statusEffects.push(next);

          if (state.enCours && state.joueur) {
            const spellLabel = spell?.label || spell?.id || "Sort";
            addChatMessage(
              { kind: "combat", channel: "global", author: "Combat", text: `${spellLabel} : vous etes empoisonne (${next.turnsLeft} tours).` },
              { player: state.joueur }
            );
          }
        }

        if (isPlayerTile && damageOnHit && finalDamage > 0 && typeof player.updateHudHp === "function") {
          const hpMax = player.stats.hpMax ?? newHp;
          player.updateHudHp(newHp, hpMax);
        }

        if (damageOnHit && finalDamage > 0) {
          const isCrit = damageResult.isCrit === true;
          const floatText = `-${finalDamage}`;
          const floatColor = isCrit ? "#ff1f2d" : "#fbbf24";
          showFloatingTextOverEntity(scene, victim, floatText, {
            color: floatColor,
            sequenceStepMs: 0,
          });
          if (isCrit) {
            flashCombatCrit(scene);
            showFloatingTextOverEntity(scene, victim, "!", {
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

        if ((spell.pushbackDistance ?? 0) > 0 && newHp > 0) {
          tryPushEntity(scene, map, groundLayer, caster, victim, spell.pushbackDistance);
        }
        if (
          newHp > 0 &&
          ((spell.pullDistance ?? 0) > 0 || spell.pullTargetToMeleeOnHit)
        ) {
          tryPullEntity(
            scene,
            map,
            groundLayer,
            caster,
            victim,
            spell.pullDistance ?? 0,
            spell.pullTargetToMeleeOnHit === true
          );
        }

        if (damageOnHit && newHp <= 0) {
          if (isPlayerTile) {
            if (scene.combatState) {
              scene.combatState.issue = "defaite";
            }
            endCombat(scene);
          } else {
            // Mort de l'invocation : cooldown géré dans summon.onKilled
            if (typeof victim.onKilled === "function") {
              victim.onKilled(scene, caster);
            }
            if (typeof victim.destroy === "function") {
              victim.destroy();
            }
            if (scene.combatSummons && Array.isArray(scene.combatSummons)) {
              if (victim.blocksMovement && victim._blockedTile) {
                unblockTile(scene, victim._blockedTile.x, victim._blockedTile.y);
                victim._blockedTile = null;
              }
              scene.combatSummons = scene.combatSummons.filter((s) => s !== victim);
            }
          }
        }
      }
    }
  }

  clearActiveSpell(caster);
  clearSpellRangePreview(scene);

  applyEryonAfterCast(scene, caster, spell, { isSelfCast });

  return true;
}

export function tryCastActiveSpellAtTile(scene, player, tileX, tileY, map, groundLayer) {
  const spell = getActiveSpell(player);
  if (!spell) return false;
  const state = scene?.combatState;
  const debugEnabled =
    typeof window !== "undefined" &&
    (window.LAN_COMBAT_DEBUG === true || window.LAN_COMBAT_DEBUG === "1");
  const debugLog = (...args) => {
    if (!debugEnabled) return;
    // eslint-disable-next-line no-console
    console.log("[LAN][Combat]", ...args);
  };
  const resolveTargetPayload = (pending) => {
    if (!pending) return {};
    const target = resolveSpellTargetAtTile(scene, pending.tileX, pending.tileY);
    if (!target) return {};
    if (target === state?.joueur || target?.isPlayerAlly) {
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
    const combatIndex = Number.isInteger(target.combatIndex)
      ? target.combatIndex
      : -1;
    const payload = {};
    if (Number.isInteger(target.entityId)) {
      payload.targetKind = "monster";
      payload.targetId = target.entityId;
    }
    if (scene?.__lanCombatStateSeen && combatIndex >= 0) {
      payload.targetKind = "monster";
      payload.targetIndex = combatIndex;
    }
    if (payload.targetKind) {
      return payload;
    }
    if (Number.isInteger(target.id)) {
      return { targetKind: "summon", targetId: target.id };
    }
    return {};
  };
  const sendLanCastFor = (pending) => {
    if (!pending) return false;
    const netClient = getNetClient();
    const netPlayerId = getNetPlayerId();
    if (
      netClient &&
      netPlayerId &&
      state &&
      state.enCours &&
      player === state.joueur &&
      scene.__lanCombatId
    ) {
      if (
        !canCastSpellAtTile(
          scene,
          player,
          pending.spell,
          pending.tileX,
          pending.tileY,
          pending.map
        )
      ) {
        return false;
      }
      netClient.sendCmd("CmdCastSpell", {
        playerId: netPlayerId,
        combatId: scene.__lanCombatId,
        spellId: pending.spell.id,
        targetX: pending.tileX,
        targetY: pending.tileY,
        ...resolveTargetPayload(pending),
      });
      debugLog("CmdCastSpell send", {
        combatId: scene.__lanCombatId,
        spellId: pending.spell.id,
        targetX: pending.tileX,
        targetY: pending.tileY,
      });
      clearActiveSpell(player);
      clearSpellRangePreview(scene);
      return true;
    }
    return false;
  };
  if (state && player === state.joueur) {
    const nowMs = scene?.time?.now ?? Date.now();
    const lockUntil = state.castLockUntil ?? 0;
    if (nowMs < lockUntil) {
      state.pendingCasts = Array.isArray(state.pendingCasts)
        ? state.pendingCasts
        : [];
      state.pendingCasts.push({
        caster: player,
        spell,
        tileX,
        tileY,
        map,
        groundLayer,
      });
      while (state.pendingCasts.length > 2) {
        state.pendingCasts.shift();
      }

      const processPending = () => {
        const nextNow = scene?.time?.now ?? Date.now();
        const nextLock = state.castLockUntil ?? 0;
        if (nextNow < nextLock) {
          if (scene?.time?.delayedCall) {
            state.pendingCastTimer = scene.time.delayedCall(
              Math.max(0, nextLock - nextNow),
              processPending
            );
          } else {
            setTimeout(processPending, Math.max(0, nextLock - nextNow));
          }
          return;
        }

        const pending = Array.isArray(state.pendingCasts)
          ? state.pendingCasts.shift()
          : null;
        if (!pending) {
          state.pendingCastTimer = null;
          return;
        }

        if (!sendLanCastFor(pending)) {
          castSpellAtTile(
            scene,
            pending.caster,
            pending.spell,
            pending.tileX,
            pending.tileY,
            pending.map,
            pending.groundLayer
          );
        }

        state.pendingCastTimer = null;
        if (Array.isArray(state.pendingCasts) && state.pendingCasts.length > 0) {
          const waitMs = Math.max(
            0,
            (state.castLockUntil ?? 0) - (scene?.time?.now ?? Date.now())
          );
          if (scene?.time?.delayedCall) {
            state.pendingCastTimer = scene.time.delayedCall(waitMs, processPending);
          } else {
            setTimeout(processPending, waitMs);
          }
        }
      };

      if (!state.pendingCastTimer) {
        if (scene?.time?.delayedCall) {
          state.pendingCastTimer = scene.time.delayedCall(
            Math.max(0, lockUntil - nowMs),
            processPending
          );
        } else {
          setTimeout(processPending, Math.max(0, lockUntil - nowMs));
        }
      }
      return false;
    }
  }

  if (
    sendLanCastFor({
      caster: player,
      spell,
      tileX,
      tileY,
      map,
      groundLayer,
    })
  ) {
    return true;
  }

  return castSpellAtTile(scene, player, spell, tileX, tileY, map, groundLayer);
}

