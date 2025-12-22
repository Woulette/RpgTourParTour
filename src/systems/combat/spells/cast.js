import { findMonsterAtTile } from "../../../monsters/index.js";
import { isTileBlocked } from "../../../collision/collisionGrid.js";
import { isTileOccupiedByMonster } from "../../../monsters/aiUtils.js";
import { endCombat } from "../../../core/combat.js";
import { addChatMessage } from "../../../chat/chat.js";
import { showFloatingTextOverEntity } from "../../../core/combat/floatingText.js";

import { getActiveSpell, clearActiveSpell } from "./activeSpell.js";
import { canCastSpellAtTile } from "./canCast.js";
import { computeSpellDamage } from "./damage.js";
import { clearSpellRangePreview } from "./preview.js";
import { isTileAvailableForSpell, getCasterOriginTile } from "./util.js";
import { canApplyCapture, startCaptureAttempt } from "../summons/capture.js";
import { getAliveSummon, spawnSummonFromCaptured } from "../summons/summon.js";
import { registerNoCastMeleeViolation } from "../../../challenges/runtime.js";
import {
  applyEryonElementAfterCast,
  convertEryonChargesToPuissance,
  consumeEryonCharges,
  getEryonChargeState,
} from "../eryon/charges.js";

function playSpellAnimation(scene, spellId, fromX, fromY, toX, toY) {
  if (!scene || !spellId) return;

  if (spellId === "punch_furtif") {
    const atlasKey = "spell_punch_furtif_atlas";
    const animKey = "spell_punch_furtif_anim";
    if (!scene.textures?.exists?.(atlasKey) || !scene.anims?.exists?.(animKey)) return;

    const fx = scene.add.sprite(toX, toY, atlasKey);
    fx.setOrigin(0.5, 0.75);
    fx.setDepth(toY + 5);
    fx.play(animKey);
    fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
  }

  if (spellId === "recharge_flux") {
    const atlasKey = "spell_recharge_flux_atlas";
    const animKey = "spell_recharge_flux_anim";
    if (!scene.textures?.exists?.(atlasKey) || !scene.anims?.exists?.(animKey)) return;

    const fx = scene.add.sprite(fromX, fromY, atlasKey);
    fx.setOrigin(0.5, 0.5);
    fx.setDepth(Math.max(fromY, toY) + 5);
    fx.play(animKey);

    // Sur soi : pas de projectile, juste un flash.
    const dist = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
    if (dist < 6) {
      scene.time.delayedCall(260, () => {
        if (fx?.destroy) fx.destroy();
      });
      return;
    }

    const duration = Math.max(180, Math.min(650, Math.round(dist * 1.2)));

    scene.tweens.add({
      targets: fx,
      x: toX,
      y: toY,
      duration,
      ease: "Linear",
      onComplete: () => {
        if (fx?.destroy) fx.destroy();
      },
    });

    // Sécurité : si quelque chose empêche le tween/anim de se terminer.
    scene.time.delayedCall(2000, () => {
      if (fx && fx.active && fx.destroy) fx.destroy();
    });
  }
}

function isEryonCaster(caster) {
  const id = caster?.classId;
  return id === "eryon" || id === "assassin";
}

function applyEryonAfterCast(scene, caster, spell, { isSelfCast = false } = {}) {
  if (!scene || !caster || !spell) return null;
  if (!isEryonCaster(caster)) return null;
  if (!spell.eryonCharges) return null;

  // Si le sort est lancé sur soi : conversion des charges actuelles en Puissance.
  // Aucun dégât, aucune génération de charge du sort lancé.
  if (isSelfCast) {
    const res = convertEryonChargesToPuissance(caster);
    if (res?.bonusPuissance > 0 && scene.combatState?.joueur) {
      addChatMessage(
        {
          kind: "combat",
          channel: "global",
          author: "Eryon",
        text: `Conversion des charges : +${res.bonusPuissance} Puissance (3 tours).`,
      },
      { player: scene.combatState.joueur }
    );
      showFloatingTextOverEntity(scene, caster, `+${res.bonusPuissance} Puissance`, {
        color: "#fbbf24",
      });
    }
    if (scene && typeof scene.updateCombatUi === "function") {
      scene.updateCombatUi();
    }
    return res || null;
  }

  const gain = spell.eryonCharges.chargeGain ?? 1;
  const element = spell.eryonCharges.element ?? spell.element;
  const res = applyEryonElementAfterCast(caster, element, gain);

  if (scene && typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }

  return res || null;
}

function computeDamageForSpell(caster, spell) {
  if (!spell || !caster) return { damage: 0, consumedCharges: 0 };

  if (spell.id === "surcharge_instable" && isEryonCaster(caster)) {
    const before = getEryonChargeState(caster);
    const base = computeSpellDamage(caster, spell);

    let consumed = 0;
    if (before.element === "feu" && before.charges > 0) {
      consumed = consumeEryonCharges(caster, "feu", 5);
    }

    const mult = 1 + 0.1 * (consumed || 0);
    return { damage: Math.round(base * mult), consumedCharges: consumed };
  }

  return { damage: computeSpellDamage(caster, spell), consumedCharges: 0 };
}

export function castSpellAtTile(scene, caster, spell, tileX, tileY, map, groundLayer) {
  if (!canCastSpellAtTile(scene, caster, spell, tileX, tileY, map)) {
    return false;
  }

  const state = scene.combatState;
  if (!state) return false;

  const isPlayerCaster = state.joueur === caster;

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

  const { x: originTileX, y: originTileY } = getCasterOriginTile(caster);
  const isSelfCast = tileX === originTileX && tileY === originTileY;

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

        const currentHp =
          typeof victim.stats.hp === "number" ? victim.stats.hp : victim.stats.hpMax ?? 0;
        const newHp = Math.max(0, currentHp - damage);
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
              text: `${spellLabel} : ${targetName} -${damage} PV`,
              element: spell?.element ?? null,
            },
            { player: state.joueur }
          );
        }

        showFloatingTextOverEntity(scene, victim, `-${damage}`, { color: "#ff4444" });

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

        const currentHp =
          typeof victim.stats.hp === "number" ? victim.stats.hp : victim.stats.hpMax ?? 0;
        const newHp = Math.max(0, currentHp - damage);
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
              text: `${spellLabel} : ${targetName} -${damage} PV`,
              element: spell?.element ?? null,
            },
            { player: state.joueur }
          );
        }

        showFloatingTextOverEntity(scene, victim, `-${damage}`, { color: "#ff4444" });

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

        const currentHp =
          typeof victim.stats.hp === "number" ? victim.stats.hp : victim.stats.hpMax ?? 0;
        const newHp = Math.max(0, currentHp - damage);
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
              text: `${spellLabel} : ${targetName} -${damage} PV`,
              element: spell?.element ?? null,
            },
            { player: state.joueur }
          );
        }

        showFloatingTextOverEntity(scene, victim, `-${damage}`, { color: "#ff4444" });

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

      const currentHp = typeof target.stats.hp === "number" ? target.stats.hp : target.stats.hpMax ?? 0;
      const newHp = Math.max(0, currentHp - damage);
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
            text: `${spellLabel} : ${targetName} -${damage} PV`,
            element: spell?.element ?? null,
          },
          { player: state.joueur }
        );
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
          scene.combatState.issue = "victoire";
          endCombat(scene);
        }
      }
    }
  } else if (state.monstre === caster) {
    const player = state.joueur;

    const findAliveSummonAtTile = (x, y) => {
      const list =
        scene?.combatSummons && Array.isArray(scene.combatSummons)
          ? scene.combatSummons
          : [];
      return (
        list.find((s) => {
          if (!s || !s.stats) return false;
          const hp = typeof s.stats.hp === "number" ? s.stats.hp : s.stats.hpMax ?? 0;
          return hp > 0 && s.tileX === x && s.tileY === y;
        }) || null
      );
    };

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

      const summonAt = findAliveSummonAtTile(tileX, tileY);
      const isPlayerTile = pTx === tileX && pTy === tileY;
      const victim = isPlayerTile ? player : summonAt;

      if (victim && victim.stats) {
        const damageOnHit = spell.damageOnHit !== false;
        const damage = damageOnHit ? computeSpellDamage(caster, spell) : 0;

        const currentHp = typeof victim.stats.hp === "number" ? victim.stats.hp : victim.stats.hpMax ?? 0;
        const newHp = Math.max(0, currentHp - Math.max(0, damage));
        if (damageOnHit && damage > 0) {
          victim.stats.hp = newHp;
        }
        if (scene && typeof scene.updateCombatUi === "function") {
          scene.updateCombatUi();
        }

        if (state.enCours && state.joueur) {
          const spellLabel = spell?.label || spell?.id || "Sort";
          const casterName = caster?.displayName || caster?.label || caster?.monsterId || "Monstre";
          if (damageOnHit && damage > 0) {
            addChatMessage(
              {
                kind: "combat",
                channel: "global",
                author: "Combat",
                text: `${spellLabel} : ${isPlayerTile ? "vous subissez" : "l'invocation subit"} -${damage} PV (par ${casterName})`,
                element: spell?.element ?? null,
              },
              { player: state.joueur }
            );
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

        if (isPlayerTile && damageOnHit && damage > 0 && typeof player.updateHudHp === "function") {
          const hpMax = player.stats.hpMax ?? newHp;
          player.updateHudHp(newHp, hpMax);
        }

        if (damageOnHit && damage > 0) {
          showFloatingTextOverEntity(scene, victim, `-${damage}`, { color: "#ff4444" });
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
