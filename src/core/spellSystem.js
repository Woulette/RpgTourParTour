// Gestion générique des sorts (logique de combat, sans HTML).
// - sélection d'un sort pour le joueur
// - vérification PA / portée / case disponible
// - lancement du sort et application des dégâts
// - prévisualisation de portée (cases bleues) côté joueur

import { spells } from "../config/spells.js";
import { findMonsterAtTile } from "../monsters/index.js";
import { isTileBlocked } from "../collision/collisionGrid.js";
import { isTileOccupiedByMonster } from "../monsters/aiUtils.js";
import { endCombat } from "./combat.js";

// ---------- Gestion du sort actif (joueur) ----------

export function setActiveSpell(caster, spellId) {
  if (!caster) return;
  if (!spellId || !spells[spellId]) {
    caster.activeSpellId = null;
    return;
  }
  caster.activeSpellId = spellId;
}

export function getActiveSpell(caster) {
  if (!caster || !caster.activeSpellId) return null;
  return spells[caster.activeSpellId] || null;
}

export function clearActiveSpell(caster) {
  if (!caster) return;
  caster.activeSpellId = null;
}

// ---------- Conditions de lancement ----------

// Vérifie si un lanceur (joueur ou monstre) peut lancer ce sort
// dans l'état actuel du combat.
export function canCastSpell(scene, caster, spell) {
  if (!scene || !caster || !spell) return false;

  const state = scene.combatState;
  if (!state || !state.enCours) return false;

  const isPlayer = caster === state.joueur;
  const expectedTour = isPlayer ? "joueur" : "monstre";
  if (state.tour !== expectedTour) return false;

  // limite de lancers par tour pour les sorts du joueur
  const maxCasts = spell.maxCastsPerTurn ?? null;
  if (maxCasts && isPlayer) {
    state.castsThisTurn = state.castsThisTurn || {};
    const used = state.castsThisTurn[spell.id] || 0;
    if (used >= maxCasts) {
      return false;
    }
  }

  const paCost = spell.paCost ?? 0;
  if (state.paRestants < paCost) return false;

  return true;
}

// Distance en "cases" (Manhattan) pour la portée.
function isTileInRange(spell, fromX, fromY, toX, toY) {
  const dx = Math.abs(toX - fromX);
  const dy = Math.abs(toY - fromY);
  const dist = dx + dy;

  const min = spell.rangeMin ?? 0;
  const max = spell.rangeMax ?? 0;

  return dist >= min && dist <= max;
}

// Une tuile est "disponible" si elle est dans la carte.
// Plus tard : layer de collision / obstacles / ligne de vue.
function isTileAvailableForSpell(map, tileX, tileY) {
  if (!map) return false;
  if (tileX < 0 || tileX >= map.width) return false;
  if (tileY < 0 || tileY >= map.height) return false;
  return true;
}

// Vérifie toutes les conditions pour lancer un sort sur une tuile donnée.
export function canCastSpellAtTile(scene, caster, spell, tileX, tileY, map) {
  if (!canCastSpell(scene, caster, spell)) return false;
  if (!isTileAvailableForSpell(map, tileX, tileY)) return false;

  const originX = caster.currentTileX ?? caster.tileX ?? 0;
  const originY = caster.currentTileY ?? caster.tileY ?? 0;

  // Lancer "en ligne" : uniquement sur la même ligne/colonne (4 directions).
  if (spell.castPattern === "line4") {
    if (!(tileX === originX || tileY === originY)) {
      return false;
    }
  }

  if (!isTileInRange(spell, originX, originY, tileX, tileY)) {
    return false;
  }

  // Ligne de vue : à gérer plus tard.
  return true;
}

// ---------- Calcul des dégâts en fonction des stats ----------

// Retourne la stat associée à l'élément du sort pour ce lanceur.
function getElementStat(caster, spell) {
  if (!caster || !caster.stats || !spell) return 0;

  const stats = caster.stats;
  const element = spell.element;

  // Deux conventions possibles :
  //  - element: "force" / "intelligence" / "agilite" / "chance"
  //  - element: "terre" / "feu" / "air" / "eau"
  switch (element) {
    case "force":
    case "terre":
      return stats.force ?? 0;
    case "intelligence":
    case "feu":
      return stats.intelligence ?? 0;
    case "agilite":
    case "air":
      return stats.agilite ?? 0;
    case "chance":
    case "eau":
      return stats.chance ?? 0;
    default:
      return 0;
  }
}

// Calcule les dégâts finaux d'un sort pour un lanceur donné,
// en appliquant un bonus de 2% par point de stat élémentaire.
function computeSpellDamage(caster, spell) {
  const dmgMin = spell.damageMin ?? 0;
  const dmgMax = spell.damageMax ?? dmgMin;
  const baseDamage = Phaser.Math.Between(dmgMin, dmgMax);

  const elemStat = getElementStat(caster, spell);
  const bonusPercent = elemStat * 0.02; // 2% par point
  const multiplier = 1 + bonusPercent;

  const finalDamage = Math.round(baseDamage * multiplier);
  return Math.max(0, finalDamage);
}

// Retourne la fourchette de dégâts (min, max) pour un sort
// en tenant compte des stats élémentaires du lanceur (sans aléatoire).
export function getSpellDamageRange(caster, spell) {
  if (!caster || !spell) {
    return { min: 0, max: 0 };
  }

  const dmgMin = spell.damageMin ?? 0;
  const dmgMax = spell.damageMax ?? dmgMin;

  const elemStat = getElementStat(caster, spell);
  const bonusPercent = elemStat * 0.02; // 2% par point
  const multiplier = 1 + bonusPercent;

  const finalMin = Math.round(dmgMin * multiplier);
  const finalMax = Math.round(dmgMax * multiplier);

  return {
    min: Math.max(0, finalMin),
    max: Math.max(0, finalMax),
  };
}

// ---------- Prévisualisation de portée (cases bleues) ----------

// Efface la prévisualisation de portée de sort (toutes les cases bleues).
export function clearSpellRangePreview(scene) {
  if (scene && scene.spellRangePreview) {
    scene.spellRangePreview.clear();
  }
}

// Dessine toutes les cases où le sort pourrait être lancé.
// Ne tient pas compte des PA restants, seulement de la portée et de la carte.
// Utilisée uniquement pour le joueur (HUD).
export function updateSpellRangePreview(
  scene,
  map,
  groundLayer,
  caster,
  spell,
  hoverTileX = null,
  hoverTileY = null
) {
  if (!scene) return;

  if (!scene.spellRangePreview) {
    const g = scene.add.graphics();
    if (scene.hudCamera) {
      scene.hudCamera.ignore(g);
    }
    g.setDepth(4);
    scene.spellRangePreview = g;
  }

  const g = scene.spellRangePreview;
  g.clear();

  const state = scene.combatState;
  if (!state || !state.enCours || state.tour !== "joueur") {
    // Pas de prévisu si ce n'est pas le tour du joueur
    return;
  }

  if (!caster || !spell || !map) {
    return;
  }

  const originX = caster.currentTileX ?? 0;
  const originY = caster.currentTileY ?? 0;

  const halfW = map.tileWidth / 2;
  const halfH = map.tileHeight / 2;

  g.lineStyle(1, 0x55ccff, 1);
  g.fillStyle(0x55ccff, 0.18);

  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      if (!isTileAvailableForSpell(map, tx, ty)) continue;
      if (spell.castPattern === "line4") {
        if (!(tx === originX || ty === originY)) continue;
      }
      if (!isTileInRange(spell, originX, originY, tx, ty)) continue;

      const worldPos = map.tileToWorldXY(
        tx,
        ty,
        undefined,
        undefined,
        groundLayer
      );
      const cx = worldPos.x + map.tileWidth / 2;
      const cy = worldPos.y + map.tileHeight / 2;

      const points = [
        new Phaser.Math.Vector2(cx, cy - halfH),
        new Phaser.Math.Vector2(cx + halfW, cy),
        new Phaser.Math.Vector2(cx, cy + halfH),
        new Phaser.Math.Vector2(cx - halfW, cy),
      ];

      g.fillPoints(points, true);
      g.strokePoints(points, true);
    }
  }

  // Preview de zone (ex: ligne 1..4) sur la tuile survolée.
  if (
    typeof hoverTileX === "number" &&
    typeof hoverTileY === "number" &&
    canCastSpellAtTile(scene, caster, spell, hoverTileX, hoverTileY, map)
  ) {
    const zoneTiles = [];
    const dx = hoverTileX === originX ? 0 : Math.sign(hoverTileX - originX);
    const dy = hoverTileY === originY ? 0 : Math.sign(hoverTileY - originY);
    const perpX = dx !== 0 ? 0 : 1;
    const perpY = dx !== 0 ? 1 : 0;

    if (spell.effectPattern === "line_forward") {
      const length = spell.effectLength ?? 4;
      for (let i = 1; i <= length; i += 1) {
        zoneTiles.push({ x: originX + dx * i, y: originY + dy * i });
      }
    } else if (spell.effectPattern === "front_cross") {
      // Zone en "T" centrée sur la case ciblée :
      // centre (case ciblée) + 1 case plus loin en face + gauche/droite du centre.
      if (dx !== 0 || dy !== 0) {
        zoneTiles.push({ x: hoverTileX, y: hoverTileY }); // centre
        zoneTiles.push({ x: hoverTileX + dx, y: hoverTileY + dy }); // plus loin
        zoneTiles.push({
          x: hoverTileX + perpX,
          y: hoverTileY + perpY,
        }); // droite
        zoneTiles.push({
          x: hoverTileX - perpX,
          y: hoverTileY - perpY,
        }); // gauche
      }
    }

    if (zoneTiles.length) {
      g.lineStyle(1, 0xff5533, 1);
      g.fillStyle(0xff5533, 0.22);

      for (const t of zoneTiles) {
        if (!isTileAvailableForSpell(map, t.x, t.y)) continue;

        const wp = map.tileToWorldXY(
          t.x,
          t.y,
          undefined,
          undefined,
          groundLayer
        );
        const cx = wp.x + map.tileWidth / 2;
        const cy = wp.y + map.tileHeight / 2;

        const pts = [
          new Phaser.Math.Vector2(cx, cy - halfH),
          new Phaser.Math.Vector2(cx + halfW, cy),
          new Phaser.Math.Vector2(cx, cy + halfH),
          new Phaser.Math.Vector2(cx - halfW, cy),
        ];

        g.fillPoints(pts, true);
        g.strokePoints(pts, true);
      }
    }
  }
}

// ---------- Lancement du sort ----------

// Lance réellement le sort sur une tuile.
// Retourne true si le sort est lancé, false sinon.
export function castSpellAtTile(
  scene,
  caster,
  spell,
  tileX,
  tileY,
  map,
  groundLayer
) {
  if (!canCastSpellAtTile(scene, caster, spell, tileX, tileY, map)) {
    return false;
  }

  const state = scene.combatState;
  if (!state) return false;

  const paCost = spell.paCost ?? 0;
  state.paRestants = Math.max(0, state.paRestants - paCost);

  // Met à jour l'affichage PA/PM si possible (joueur uniquement)
  if (typeof caster.updateHudApMp === "function") {
    caster.updateHudApMp(state.paRestants, state.pmRestants);
  }

  // Effet visuel simple sur la tuile ciblée
  const worldPos = map.tileToWorldXY(
    tileX,
    tileY,
    undefined,
    undefined,
    groundLayer
  );
  const cx = worldPos.x + map.tileWidth / 2;
  const cy = worldPos.y + map.tileHeight / 2;

  const size = Math.min(map.tileWidth, map.tileHeight);
  const fx = scene.add.rectangle(cx, cy, size, size, 0xffdd55, 0.6);
  if (scene.hudCamera) {
    scene.hudCamera.ignore(fx);
  }
  scene.time.delayedCall(200, () => fx.destroy());

  const isPlayerCaster = state.joueur === caster;

  // incremente le compteur de lancers pour les sorts du joueur
  if (isPlayerCaster) {
    state.castsThisTurn = state.castsThisTurn || {};
    const prev = state.castsThisTurn[spell.id] || 0;
    state.castsThisTurn[spell.id] = prev + 1;
  }

  if (isPlayerCaster) {
    // --- Dégâts du joueur vers un monstre ---
    if (spell.effectPattern === "line_forward") {
      const originX = caster.currentTileX ?? caster.tileX ?? 0;
      const originY = caster.currentTileY ?? caster.tileY ?? 0;
      const dx = tileX === originX ? 0 : Math.sign(tileX - originX);
      const dy = tileY === originY ? 0 : Math.sign(tileY - originY);
      const length = spell.effectLength ?? 4;
      const damage = computeSpellDamage(caster, spell);

      for (let i = 1; i <= length; i += 1) {
        const tx = originX + dx * i;
        const ty = originY + dy * i;
        if (!isTileAvailableForSpell(map, tx, ty)) break;

        // Effet visuel sur chaque case de la zone (même si vide).
        const zoneWorld = map.tileToWorldXY(
          tx,
          ty,
          undefined,
          undefined,
          groundLayer
        );
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

        const worldPos = map.tileToWorldXY(
          tx,
          ty,
          undefined,
          undefined,
          groundLayer
        );
        const hitX = worldPos.x + map.tileWidth / 2;
        const hitY = worldPos.y + map.tileHeight / 2;

        const currentHp =
          typeof victim.stats.hp === "number"
            ? victim.stats.hp
            : victim.stats.hpMax ?? 0;
        const newHp = Math.max(0, currentHp - damage);
        victim.stats.hp = newHp;
        if (scene && typeof scene.updateCombatUi === "function") {
          scene.updateCombatUi();
        }

        const dmgText = scene.add.text(
          hitX + 8,
          hitY - map.tileHeight / 2,
          `-${damage}`,
          {
            fontFamily: "Arial",
            fontSize: 16,
            color: "#ff4444",
            stroke: "#000000",
            strokeThickness: 2,
          }
        );
        if (scene.hudCamera) {
          scene.hudCamera.ignore(dmgText);
        }
        dmgText.setDepth(10);

        scene.tweens.add({
          targets: dmgText,
          y: dmgText.y - 20,
          duration: 1000,
          ease: "Cubic.easeOut",
          onComplete: () => dmgText.destroy(),
        });

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
            scene.combatMonsters = scene.combatMonsters.filter(
              (m) => m && m !== victim
            );

            remaining = scene.combatMonsters.filter((m) => {
              const statsInner = m.stats || {};
              const hpInner =
                typeof statsInner.hp === "number"
                  ? statsInner.hp
                  : statsInner.hpMax ?? 0;
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
      // Après un lancement réussi, on revient en mode déplacement :
      clearActiveSpell(caster);
      clearSpellRangePreview(scene);
      return true;
    }

    if (spell.effectPattern === "front_cross") {
      const originX = caster.currentTileX ?? caster.tileX ?? 0;
      const originY = caster.currentTileY ?? caster.tileY ?? 0;
      const dx = tileX === originX ? 0 : Math.sign(tileX - originX);
      const dy = tileY === originY ? 0 : Math.sign(tileY - originY);
      const perpX = dx !== 0 ? 0 : 1;
      const perpY = dx !== 0 ? 1 : 0;

      const damage = computeSpellDamage(caster, spell);

      // Zone centrée sur la case ciblée :
      // centre (case ciblée) + 1 case plus loin en face + gauche/droite du centre.
      const tiles = [
        { x: tileX, y: tileY },
        { x: tileX + dx, y: tileY + dy },
        { x: tileX + perpX, y: tileY + perpY },
        { x: tileX - perpX, y: tileY - perpY },
      ];

      for (const t of tiles) {
        if (!isTileAvailableForSpell(map, t.x, t.y)) continue;

        // Effet visuel sur chaque case de la zone (même si vide).
        const zoneWorld = map.tileToWorldXY(
          t.x,
          t.y,
          undefined,
          undefined,
          groundLayer
        );
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
          typeof victim.stats.hp === "number"
            ? victim.stats.hp
            : victim.stats.hpMax ?? 0;
        const newHp = Math.max(0, currentHp - damage);
        victim.stats.hp = newHp;
        if (scene && typeof scene.updateCombatUi === "function") {
          scene.updateCombatUi();
        }

        const dmgText = scene.add.text(
          zx + 8,
          zy - map.tileHeight / 2,
          `-${damage}`,
          {
            fontFamily: "Arial",
            fontSize: 16,
            color: "#ff4444",
            stroke: "#000000",
            strokeThickness: 2,
          }
        );
        if (scene.hudCamera) {
          scene.hudCamera.ignore(dmgText);
        }
        dmgText.setDepth(10);

        scene.tweens.add({
          targets: dmgText,
          y: dmgText.y - 20,
          duration: 1000,
          ease: "Cubic.easeOut",
          onComplete: () => dmgText.destroy(),
        });

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
            scene.combatMonsters = scene.combatMonsters.filter(
              (m) => m && m !== victim
            );

            remaining = scene.combatMonsters.filter((m) => {
              const statsInner = m.stats || {};
              const hpInner =
                typeof statsInner.hp === "number"
                  ? statsInner.hp
                  : statsInner.hpMax ?? 0;
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
      const damage = computeSpellDamage(caster, spell);

      const currentHp =
        typeof target.stats.hp === "number"
          ? target.stats.hp
          : target.stats.hpMax ?? 0;
      const newHp = Math.max(0, currentHp - damage);
      target.stats.hp = newHp;
      if (scene && typeof scene.updateCombatUi === "function") {
        scene.updateCombatUi();
      }

      // Effet: attire le lanceur au corps à corps (sur hit uniquement).
      if (spell.pullCasterToMeleeOnHit && caster) {
        const casterTileX = caster.currentTileX ?? caster.tileX ?? null;
        const casterTileY = caster.currentTileY ?? caster.tileY ?? null;
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
            const worldPos = map.tileToWorldXY(
              chosen.x,
              chosen.y,
              undefined,
              undefined,
              groundLayer
            );
            const cx = worldPos.x + map.tileWidth / 2;
            const cy = worldPos.y + map.tileHeight / 2;

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

      // life steal simple: le lanceur recupere les degats infliges
      if (spell.lifeSteal && caster && caster.stats) {
        const casterHp =
          typeof caster.stats.hp === "number"
            ? caster.stats.hp
            : caster.stats.hpMax ?? 0;
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

        // texte flottant de soin au-dessus du lanceur
        const healText = scene.add.text(
          caster.x + 8,
          caster.y - map.tileHeight / 2,
          `+${heal}`,
          {
            fontFamily: "Arial",
            fontSize: 16,
            color: "#44ff44",
            stroke: "#000000",
            strokeThickness: 2,
          }
        );
        if (scene.hudCamera) {
          scene.hudCamera.ignore(healText);
        }
        healText.setDepth(10);

        scene.tweens.add({
          targets: healText,
          y: healText.y - 20,
          duration: 1000,
          ease: "Cubic.easeOut",
          onComplete: () => healText.destroy(),
        });
      }

      console.log(
        `[SPELL] Dégâts infligés à ${target.monsterId}: ${damage}, hp restants = ${newHp}`
      );

      // Texte flottant de dégâts au-dessus du monstre
      const dmgText = scene.add.text(
        cx + 8,
        cy - map.tileHeight / 2,
        `-${damage}`,
        {
          fontFamily: "Arial",
          fontSize: 16,
          color: "#ff4444",
          stroke: "#000000",
          strokeThickness: 2,
        }
      );
      if (scene.hudCamera) {
        scene.hudCamera.ignore(dmgText);
      }
      dmgText.setDepth(10);

      scene.tweens.add({
        targets: dmgText,
        y: dmgText.y - 20,
        duration: 1000,
        ease: "Cubic.easeOut",
        onComplete: () => dmgText.destroy(),
      });

      if (newHp <= 0) {
        if (typeof target.onKilled === "function") {
          target.onKilled(scene, caster);
        }

        target.destroy();
        if (scene.monsters) {
          scene.monsters = scene.monsters.filter((m) => m !== target);
        }

        // Multi-monstres : on ne termine le combat
        // que lorsqu'il n'y a plus aucun ennemi en vie.
        let remaining = 0;

        if (scene.combatMonsters && Array.isArray(scene.combatMonsters)) {
          scene.combatMonsters = scene.combatMonsters.filter(
            (m) => m && m !== target
          );

          remaining = scene.combatMonsters.filter((m) => {
            const statsInner = m.stats || {};
            const hpInner =
              typeof statsInner.hp === "number"
                ? statsInner.hp
                : statsInner.hpMax ?? 0;
            return hpInner > 0;
          }).length;
        } else if (scene.monsters) {
          // Fallback 1v1 : on regarde s'il reste des monstres.
          remaining = scene.monsters.length;
        }

        if (scene.combatState && remaining <= 0) {
          scene.combatState.issue = "victoire";
          endCombat(scene);
        }
      }
    }
  } else if (state.monstre === caster) {
    // --- Dégâts d'un monstre vers le joueur ---
    const player = state.joueur;
    if (player && player.stats) {
      const pTx = player.currentTileX;
      const pTy = player.currentTileY;

      // On ne touche que si la tuile visée est celle du joueur
      if (pTx === tileX && pTy === tileY) {
        const damage = computeSpellDamage(caster, spell);

        const currentHp =
          typeof player.stats.hp === "number"
            ? player.stats.hp
            : player.stats.hpMax ?? 0;
        const newHp = Math.max(0, currentHp - damage);
        player.stats.hp = newHp;
        if (scene && typeof scene.updateCombatUi === "function") {
          scene.updateCombatUi();
        }

        console.log(
          `[SPELL] Dégâts infligés au joueur: ${damage}, hp restants = ${newHp}`
        );

        if (typeof player.updateHudHp === "function") {
          const hpMax = player.stats.hpMax ?? newHp;
          player.updateHudHp(newHp, hpMax);
        }

        // Texte flottant de dégâts au-dessus du joueur
        const dmgText = scene.add.text(
          cx + 8,
          cy - map.tileHeight / 2,
          `-${damage}`,
          {
            fontFamily: "Arial",
            fontSize: 16,
            color: "#ff4444",
            stroke: "#000000",
            strokeThickness: 2,
          }
        );
        if (scene.hudCamera) {
          scene.hudCamera.ignore(dmgText);
        }
        dmgText.setDepth(10);

        scene.tweens.add({
          targets: dmgText,
          y: dmgText.y - 20,
          duration: 1000,
          ease: "Cubic.easeOut",
          onComplete: () => dmgText.destroy(),
        });

        if (newHp <= 0) {
          console.log("[COMBAT] Le joueur est KO");
          if (scene.combatState) {
            scene.combatState.issue = "defaite";
          }
          endCombat(scene);
        }
      }
    }
  }

  // Après un lancement réussi, on revient en mode déplacement :
  clearActiveSpell(caster);
  clearSpellRangePreview(scene);

  return true;
}

// Helper pratique : utilisé côté joueur.
// Tente de lancer le sort actuellement sélectionné sur la tuile ciblée.
export function tryCastActiveSpellAtTile(
  scene,
  player,
  tileX,
  tileY,
  map,
  groundLayer
) {
  const spell = getActiveSpell(player);
  if (!spell) return false;

  return castSpellAtTile(
    scene,
    player,
    spell,
    tileX,
    tileY,
    map,
    groundLayer
  );
}
// Helpers g�n�riques de port�e / conditions de sort, utilisables
// aussi bien par le joueur que par les IA de monstres.
// Elles s'appuient sur la logique d�j� d�finie plus bas dans ce fichier
// (isTileInRange et canCastSpellAtTile).
export function isSpellInRangeFromPosition(
  spell,
  fromX,
  fromY,
  toX,
  toY
) {
  // isTileInRange est d�clar� plus bas dans ce fichier.
  return isTileInRange(spell, fromX, fromY, toX, toY);
}

export function canCastSpellOnTile(
  scene,
  caster,
  spell,
  tileX,
  tileY,
  map
) {
  // canCastSpellAtTile est d�clar� plus bas dans ce fichier.
  return canCastSpellAtTile(scene, caster, spell, tileX, tileY, map);
}
