import { findMonsterAtTile } from "../../../features/monsters/runtime/index.js";
import { isTileBlocked, unblockTile } from "../../../collision/collisionGrid.js";
import { isTileOccupiedByMonster } from "../../../features/monsters/ai/aiUtils.js";
import { endCombat } from "../runtime/runtime.js";
import { addChatMessage } from "../../../chat/chat.js";
import { showFloatingTextOverEntity } from "../runtime/floatingText.js";
import { maybeSpawnRiftWaveOnClear } from "../systems/waves.js";

import { getActiveSpell, clearActiveSpell } from "./activeSpell.js";
import { canCastSpellAtTile } from "./canCast.js";
import { computeSpellDamage } from "./damage.js";
import { clearSpellRangePreview } from "./preview.js";
import { isTileAvailableForSpell, getCasterOriginTile } from "./util.js";
import { playSpellAnimation } from "./cast/castAnimations.js";
import {
  applyAreaBuffToAllies,
  applyAreaBuffToMonsters,
  applyShieldToDamage,
  showShieldAbsorbText,
  addShieldAbsorbChat,
} from "./cast/castBuffs.js";
import { applyCasterFacing, getEntityTile } from "./cast/castPosition.js";
import { tryPullEntity, tryPushEntity } from "./cast/castMovement.js";
import { applyEryonAfterCast, computeDamageForSpell } from "./cast/castEryon.js";
import { canApplyCapture, startCaptureAttempt } from "../summons/capture.js";
import {
  getAliveSummon,
  spawnSummonFromCaptured,
  spawnSummonMonster,
  findSummonSpawnTile,
  findAliveCombatAllyAtTile,
  findAliveSummonAtTile,
} from "../summons/summon.js";
import { registerNoCastMeleeViolation } from "../../challenges/runtime/index.js";

export function castSpellAtTile(scene, caster, spell, tileX, tileY, map, groundLayer) {
  if (!canCastSpellAtTile(scene, caster, spell, tileX, tileY, map)) {
    return false;
  }

  const state = scene.combatState;
  if (!state) return false;

  const isPlayerCaster = state.joueur === caster;
  const isAllyCaster = caster?.isCombatAlly === true;

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
  if (isPlayerCaster && spell?.capture) {
    const target = findMonsterAtTile(scene, tileX, tileY);
    const check = canApplyCapture(scene, caster, target);
    if (!check.ok) return false;
  }

  if (isPlayerCaster && spell?.summon) {
    if (!caster?.capturedMonsterId) return false;
    const alive = getAliveSummon(scene, caster);
    if (alive) return false;
  }
  if (spell?.summonMonster) {
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
      !spell?.effectPattern &&
      !spell?.areaBuff &&
      !spell?.summon &&
      !spell?.summonMonster &&
      !spell?.capture;

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

  // FX animation (si dispo)
  const fromX = caster?.x ?? cx;
  const fromY = (caster?.y ?? cy) - 10;
  playSpellAnimation(scene, spell?.id, fromX, fromY, cx, cy);

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
        { kind: "combat", channel: "global", author: "Combat", text: `Vous lancez ${spellLabel}.` },
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

  if (spell?.summonMonster) {
    const summon = spawnSummonMonster(scene, caster, map, groundLayer, {
      monsterId: spell.summonMonster.monsterId,
      preferTile: { x: tileX, y: tileY },
    });
    if (!summon) return false;

    clearActiveSpell(caster);
    clearSpellRangePreview(scene);
    if (scene && typeof scene.updateCombatUi === "function") {
      scene.updateCombatUi();
    }
    return true;
  }

  if (isPlayerCaster) {
    // --- Capture (0 dégâts) ---
    if (spell?.capture) {
      const target = findMonsterAtTile(scene, tileX, tileY);
      if (!target) return false;
      startCaptureAttempt(scene, caster, target, {
        playerTurns: spell.capture.playerTurns ?? 2,
      });
      if (scene && typeof scene.updateCombatUi === "function") {
        scene.updateCombatUi();
      }
      clearActiveSpell(caster);
      clearSpellRangePreview(scene);
      applyEryonAfterCast(scene, caster, spell, { isSelfCast });
      return true;
    }

    // --- Invocation capturée ---
    if (spell?.summon) {
      const summon = spawnSummonFromCaptured(scene, caster, map, groundLayer, {
        preferTile: { x: tileX, y: tileY },
      });
      if (!summon) return false;

      // Cooldown 2 tours après sa mort
      summon.onKilled = (sceneArg) => {
        const owner = summon.owner;
        if (owner) {
          owner.hasAliveSummon = false;
          owner.spellCooldowns = owner.spellCooldowns || {};
          const cdTurns = spell.summon.cooldownAfterDeathTurns ?? 2;
          owner.spellCooldowns[spell.id] = Math.max(0, cdTurns | 0);
        }
        if (sceneArg?.combatSummons && Array.isArray(sceneArg.combatSummons)) {
          sceneArg.combatSummons = sceneArg.combatSummons.filter((s) => s !== summon);
        }
      };

      clearActiveSpell(caster);
      clearSpellRangePreview(scene);
      if (scene && typeof scene.updateCombatUi === "function") {
        scene.updateCombatUi();
      }
      return true;
    }

  }

  if (isPlayerCaster || isAllyCaster) {
    if (isAllyCaster && spell?.areaBuff) {
      applyAreaBuffToAllies(scene, map, groundLayer, caster, spell.areaBuff);
      clearActiveSpell(caster);
      clearSpellRangePreview(scene);
      return true;
    }

    if (spell.effectPattern === "line_forward") {
      const { x: originX, y: originY } = getCasterOriginTile(caster);
      const dx = tileX === originX ? 0 : Math.sign(tileX - originX);
      const dy = tileY === originY ? 0 : Math.sign(tileY - originY);
      const length = spell.effectLength ?? 4;
      const damage = computeSpellDamage(caster, spell);

      for (let i = 1; i <= length; i += 1) {
        const tx = originX + dx * i;
        const ty = originY + dy * i;
        if (!isTileAvailableForSpell(map, tx, ty)) break;

        const zoneWorld = map.tileToWorldXY(tx, ty, undefined, undefined, groundLayer);
        const zx = zoneWorld.x + map.tileWidth / 2;
        const zy = zoneWorld.y + map.tileHeight / 2;
        const size = Math.min(map.tileWidth, map.tileHeight);
        const fxZone = scene.add.rectangle(zx, zy, size, size, 0xff5533, 0.22);
        if (scene.hudCamera) {
          scene.hudCamera.ignore(fxZone);
        }
        scene.time.delayedCall(220, () => fxZone.destroy());

        const victim = findMonsterAtTile(scene, tx, ty);
        if (!victim || !victim.stats) continue;

        const shielded = applyShieldToDamage(victim, damage);
        const finalDamage = Math.max(0, shielded.damage);
        showShieldAbsorbText(scene, victim, shielded.absorbed);
        const currentHp =
          typeof victim.stats.hp === "number" ? victim.stats.hp : victim.stats.hpMax ?? 0;
        const newHp = Math.max(0, currentHp - finalDamage);
        victim.stats.hp = newHp;
        if (scene && typeof scene.updateCombatUi === "function") {
          scene.updateCombatUi();
        }

        if (state.enCours && state.joueur) {
          const spellLabel = spell?.label || spell?.id || "Sort";
          const targetName = victim.displayName || victim.label || victim.monsterId || "Monstre";
          addChatMessage(
            {
              kind: "combat",
              channel: "global",
              author: "Combat",
              text: `${spellLabel} : ${targetName} -${finalDamage} PV`,
              element: spell?.element ?? null,
            },
            { player: state.joueur }
          );
          addShieldAbsorbChat(scene, state, spellLabel, targetName, shielded.absorbed);
        }

        if (finalDamage > 0) {
          showFloatingTextOverEntity(scene, victim, `-${finalDamage}`, { color: "#ff4444" });
        }

        if (newHp <= 0) {
          if (typeof victim.onKilled === "function") {
            victim.onKilled(scene, caster);
          }
          victim.destroy();
          if (scene.monsters) {
            scene.monsters = scene.monsters.filter((m) => m !== victim);
          }

          let remaining = 0;
          if (scene.combatMonsters && Array.isArray(scene.combatMonsters)) {
            scene.combatMonsters = scene.combatMonsters.filter((m) => m && m !== victim);
            remaining = scene.combatMonsters.filter((m) => {
              const statsInner = m.stats || {};
              const hpInner = typeof statsInner.hp === "number" ? statsInner.hp : statsInner.hpMax ?? 0;
              return hpInner > 0;
            }).length;
          } else if (scene.monsters) {
            remaining = scene.monsters.length;
          }

          if (scene.combatState && remaining <= 0) {
            if (maybeSpawnRiftWaveOnClear(scene)) return;
            scene.combatState.issue = "victoire";
            endCombat(scene);
          }
        }
      }

      clearActiveSpell(caster);
      clearSpellRangePreview(scene);
      applyEryonAfterCast(scene, caster, spell, { isSelfCast });
      return true;
    }

    if (spell.effectPattern === "cross1") {
      const { damage } = computeDamageForSpell(caster, spell);
      const tiles = [
        { x: tileX, y: tileY },
        { x: tileX + 1, y: tileY },
        { x: tileX - 1, y: tileY },
        { x: tileX, y: tileY + 1 },
        { x: tileX, y: tileY - 1 },
      ];

      for (const t of tiles) {
        if (!isTileAvailableForSpell(map, t.x, t.y)) continue;

        const zoneWorld = map.tileToWorldXY(t.x, t.y, undefined, undefined, groundLayer);
        const zx = zoneWorld.x + map.tileWidth / 2;
        const zy = zoneWorld.y + map.tileHeight / 2;
        const size = Math.min(map.tileWidth, map.tileHeight);
        const fxZone = scene.add.rectangle(zx, zy, size, size, 0xff5533, 0.22);
        if (scene.hudCamera) {
          scene.hudCamera.ignore(fxZone);
        }
        scene.time.delayedCall(220, () => fxZone.destroy());

        const victim = findMonsterAtTile(scene, t.x, t.y);
        if (!victim || !victim.stats) continue;

        const shielded = applyShieldToDamage(victim, damage);
        const finalDamage = Math.max(0, shielded.damage);
        showShieldAbsorbText(scene, victim, shielded.absorbed);
        const currentHp =
          typeof victim.stats.hp === "number" ? victim.stats.hp : victim.stats.hpMax ?? 0;
        const newHp = Math.max(0, currentHp - finalDamage);
        victim.stats.hp = newHp;
        if (scene && typeof scene.updateCombatUi === "function") {
          scene.updateCombatUi();
        }

        if (state.enCours && state.joueur) {
          const spellLabel = spell?.label || spell?.id || "Sort";
          const targetName = victim.displayName || victim.label || victim.monsterId || "Monstre";
          addChatMessage(
            {
              kind: "combat",
              channel: "global",
              author: "Combat",
              text: `${spellLabel} : ${targetName} -${finalDamage} PV`,
              element: spell?.element ?? null,
            },
            { player: state.joueur }
          );
          addShieldAbsorbChat(scene, state, spellLabel, targetName, shielded.absorbed);
        }

        if (finalDamage > 0) {
          showFloatingTextOverEntity(scene, victim, `-${finalDamage}`, { color: "#ff4444" });
        }

        if (newHp <= 0) {
          if (typeof victim.onKilled === "function") {
            victim.onKilled(scene, caster);
          }
          victim.destroy();
          if (scene.monsters) {
            scene.monsters = scene.monsters.filter((m) => m !== victim);
          }

          let remaining = 0;
          if (scene.combatMonsters && Array.isArray(scene.combatMonsters)) {
            scene.combatMonsters = scene.combatMonsters.filter((m) => m && m !== victim);
            remaining = scene.combatMonsters.filter((m) => {
              const statsInner = m.stats || {};
              const hpInner = typeof statsInner.hp === "number" ? statsInner.hp : statsInner.hpMax ?? 0;
              return hpInner > 0;
            }).length;
          } else if (scene.monsters) {
            remaining = scene.monsters.length;
          }

          if (scene.combatState && remaining <= 0) {
            if (maybeSpawnRiftWaveOnClear(scene)) return;
            scene.combatState.issue = "victoire";
            endCombat(scene);
          }
        }
      }

      clearActiveSpell(caster);
      clearSpellRangePreview(scene);
      applyEryonAfterCast(scene, caster, spell, { isSelfCast });
      return true;
    }

    if (spell.effectPattern === "front_cross") {
      const { x: originX, y: originY } = getCasterOriginTile(caster);
      const dx = tileX === originX ? 0 : Math.sign(tileX - originX);
      const dy = tileY === originY ? 0 : Math.sign(tileY - originY);
      const perpX = dx !== 0 ? 0 : 1;
      const perpY = dx !== 0 ? 1 : 0;

      const damage = computeSpellDamage(caster, spell);

      const tiles = [
        { x: tileX, y: tileY },
        { x: tileX + dx, y: tileY + dy },
        { x: tileX + perpX, y: tileY + perpY },
        { x: tileX - perpX, y: tileY - perpY },
      ];

      for (const t of tiles) {
        if (!isTileAvailableForSpell(map, t.x, t.y)) continue;

        const zoneWorld = map.tileToWorldXY(t.x, t.y, undefined, undefined, groundLayer);
        const zx = zoneWorld.x + map.tileWidth / 2;
        const zy = zoneWorld.y + map.tileHeight / 2;
        const size = Math.min(map.tileWidth, map.tileHeight);
        const fxZone = scene.add.rectangle(zx, zy, size, size, 0xff5533, 0.22);
        if (scene.hudCamera) {
          scene.hudCamera.ignore(fxZone);
        }
        scene.time.delayedCall(220, () => fxZone.destroy());

        const victim = findMonsterAtTile(scene, t.x, t.y);
        if (!victim || !victim.stats) continue;

        const shielded = applyShieldToDamage(victim, damage);
        const finalDamage = Math.max(0, shielded.damage);
        showShieldAbsorbText(scene, victim, shielded.absorbed);
        const currentHp =
          typeof victim.stats.hp === "number" ? victim.stats.hp : victim.stats.hpMax ?? 0;
        const newHp = Math.max(0, currentHp - finalDamage);
        victim.stats.hp = newHp;
        if (scene && typeof scene.updateCombatUi === "function") {
          scene.updateCombatUi();
        }

        if (state.enCours && state.joueur) {
          const spellLabel = spell?.label || spell?.id || "Sort";
          const targetName = victim.displayName || victim.label || victim.monsterId || "Monstre";
          addChatMessage(
            {
              kind: "combat",
              channel: "global",
              author: "Combat",
              text: `${spellLabel} : ${targetName} -${finalDamage} PV`,
              element: spell?.element ?? null,
            },
            { player: state.joueur }
          );
          addShieldAbsorbChat(scene, state, spellLabel, targetName, shielded.absorbed);
        }

        if (finalDamage > 0) {
          showFloatingTextOverEntity(scene, victim, `-${finalDamage}`, { color: "#ff4444" });
        }

        if (newHp <= 0) {
          if (typeof victim.onKilled === "function") {
            victim.onKilled(scene, caster);
          }
          victim.destroy();
          if (scene.monsters) {
            scene.monsters = scene.monsters.filter((m) => m !== victim);
          }

          let remaining = 0;
          if (scene.combatMonsters && Array.isArray(scene.combatMonsters)) {
            scene.combatMonsters = scene.combatMonsters.filter((m) => m && m !== victim);
            remaining = scene.combatMonsters.filter((m) => {
              const statsInner = m.stats || {};
              const hpInner = typeof statsInner.hp === "number" ? statsInner.hp : statsInner.hpMax ?? 0;
              return hpInner > 0;
            }).length;
          } else if (scene.monsters) {
            remaining = scene.monsters.length;
          }

          if (scene.combatState && remaining <= 0) {
            if (maybeSpawnRiftWaveOnClear(scene)) return;
            scene.combatState.issue = "victoire";
            endCombat(scene);
          }
        }
      }

      clearActiveSpell(caster);
      clearSpellRangePreview(scene);
      return true;
    }

    const target = findMonsterAtTile(scene, tileX, tileY);
    if (target && target.stats) {
      const { damage } = computeDamageForSpell(caster, spell);

      const shielded = applyShieldToDamage(target, damage);
      const finalDamage = Math.max(0, shielded.damage);
      showShieldAbsorbText(scene, target, shielded.absorbed);
      const currentHp = typeof target.stats.hp === "number" ? target.stats.hp : target.stats.hpMax ?? 0;
      const newHp = Math.max(0, currentHp - finalDamage);
      target.stats.hp = newHp;
      if (scene && typeof scene.updateCombatUi === "function") {
        scene.updateCombatUi();
      }

      if (state.enCours && state.joueur) {
        const spellLabel = spell?.label || spell?.id || "Sort";
        const targetName = target.displayName || target.label || target.monsterId || "Monstre";
        addChatMessage(
          {
            kind: "combat",
            channel: "global",
            author: "Combat",
            text: `${spellLabel} : ${targetName} -${finalDamage} PV`,
            element: spell?.element ?? null,
          },
          { player: state.joueur }
        );
        addShieldAbsorbChat(scene, state, spellLabel, targetName, shielded.absorbed);
      }

      if (spell.pullCasterToMeleeOnHit && caster) {
        const casterTileX = typeof caster.currentTileX === "number" ? caster.currentTileX : typeof caster.tileX === "number" ? caster.tileX : null;
        const casterTileY = typeof caster.currentTileY === "number" ? caster.currentTileY : typeof caster.tileY === "number" ? caster.tileY : null;
        const targetTileX = target.tileX ?? tileX;
        const targetTileY = target.tileY ?? tileY;

        if (
          typeof casterTileX === "number" &&
          typeof casterTileY === "number" &&
          typeof targetTileX === "number" &&
          typeof targetTileY === "number"
        ) {
          const dx = targetTileX - casterTileX;
          const dy = targetTileY - casterTileY;
          const stepX = dx === 0 ? 0 : Math.sign(dx);
          const stepY = dy === 0 ? 0 : Math.sign(dy);

          const preferred = { x: targetTileX - stepX, y: targetTileY - stepY };
          const candidates = [
            preferred,
            { x: targetTileX + 1, y: targetTileY },
            { x: targetTileX - 1, y: targetTileY },
            { x: targetTileX, y: targetTileY + 1 },
            { x: targetTileX, y: targetTileY - 1 },
          ];

          const isFree = (tx, ty) => {
            if (!isTileAvailableForSpell(map, tx, ty)) return false;
            if (isTileBlocked(scene, tx, ty)) return false;
            if (isTileOccupiedByMonster(scene, tx, ty, null)) return false;
            if (tx === targetTileX && ty === targetTileY) return false;
            return true;
          };

          const chosen = candidates.find((c) => isFree(c.x, c.y));
          if (chosen) {
            const wp = map.tileToWorldXY(chosen.x, chosen.y, undefined, undefined, groundLayer);
            const cx = wp.x + map.tileWidth / 2;
            const cy = wp.y + map.tileHeight / 2;

            if (caster.currentMoveTween) {
              caster.currentMoveTween.stop();
              caster.currentMoveTween = null;
            }
            caster.isMoving = false;

            caster.x = cx;
            caster.y = cy;
            caster.currentTileX = chosen.x;
            caster.currentTileY = chosen.y;
            if (typeof caster.setDepth === "function") {
              caster.setDepth(caster.y);
            }
          }
        }
      }

      if (spell.lifeSteal && caster && caster.stats) {
        const casterHp = typeof caster.stats.hp === "number" ? caster.stats.hp : caster.stats.hpMax ?? 0;
        const casterHpMax = caster.stats.hpMax ?? casterHp;
        const heal = damage;
        const newCasterHp = Math.min(casterHpMax, casterHp + heal);
        caster.stats.hp = newCasterHp;

        if (typeof caster.updateHudHp === "function") {
          caster.updateHudHp(newCasterHp, casterHpMax);
        }
        if (scene && typeof scene.updateCombatUi === "function") {
          scene.updateCombatUi();
        }

        showFloatingTextOverEntity(scene, caster, `+${heal}`, { color: "#44ff44" });
      }

      showFloatingTextOverEntity(scene, target, `-${damage}`, { color: "#ff4444" });

      if ((spell.pushbackDistance ?? 0) > 0 && newHp > 0) {
        tryPushEntity(scene, map, groundLayer, caster, target, spell.pushbackDistance);
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
          target,
          spell.pullDistance ?? 0,
          spell.pullTargetToMeleeOnHit === true
        );
      }

      if (newHp <= 0) {
        if (typeof target.onKilled === "function") {
          target.onKilled(scene, caster);
        }

        target.destroy();
        if (scene.monsters) {
          scene.monsters = scene.monsters.filter((m) => m !== target);
        }

        let remaining = 0;
        if (scene.combatMonsters && Array.isArray(scene.combatMonsters)) {
          scene.combatMonsters = scene.combatMonsters.filter((m) => m && m !== target);
          remaining = scene.combatMonsters.filter((m) => {
            const statsInner = m.stats || {};
            const hpInner = typeof statsInner.hp === "number" ? statsInner.hp : statsInner.hpMax ?? 0;
            return hpInner > 0;
          }).length;
        } else if (scene.monsters) {
          remaining = scene.monsters.length;
        }

        if (scene.combatState && remaining <= 0) {
          if (maybeSpawnRiftWaveOnClear(scene)) return;
          scene.combatState.issue = "victoire";
          endCombat(scene);
        }
      }
    }
  } else if (state.monstre === caster) {
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
        const damage = damageOnHit ? computeSpellDamage(caster, spell) : 0;

        const shielded = applyShieldToDamage(victim, damage);
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
          showFloatingTextOverEntity(scene, victim, `-${finalDamage}`, { color: "#ff4444" });
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
  return castSpellAtTile(scene, player, spell, tileX, tileY, map, groundLayer);
}

