import { createCharacter } from "./character.js";
import { monsters } from "../config/monsters.js";
import { createStats } from "../core/stats.js";
import { XP_CONFIG } from "../config/xp.js";
import { addXpToPlayer } from "./player.js";
import { addItem } from "../inventory/inventoryCore.js";
import { incrementKillProgress } from "../quests/index.js";

/**
 * Crée un monstre sur la carte.
 * - stats basées sur le même modèle que le joueur
 * - pas de système de niveau pour le monstre lui‑même
 */
export function createMonster(scene, x, y, monsterId) {
  const def = monsters[monsterId];
  if (!def) {
    throw new Error(`Monstre inconnu: ${monsterId}`);
  }

  // Stats de base communes, avec overrides du monstre.
  // Pour un monstre, on considère les overrides comme des valeurs FIXES
  // (on ne veut pas ajouter 50 HP de base + 40 HP du monstre).
  const stats = createStats(def.statsOverrides || {});

  const monster = createCharacter(scene, x, y, {
    textureKey: def.textureKey,
    classId: monsterId,
    stats,
  });

  // Aligne visuellement le monstre sur le centre de sa tuile
  if (monster.setOrigin) {
    monster.setOrigin(0.5, 0.85);
  }

  // Place le monstre au-dessus de la grille debug
  monster.setDepth(2);

  // S'assure que la caméra HUD n'affiche pas le monstre
  if (scene.hudCamera) {
    scene.hudCamera.ignore(monster);
  }

  // Métadonnées utiles pour le système de combat / loot
  monster.monsterId = monsterId;
  monster.xpReward = def.xpReward || 0;
  monster.xpRewardBase = def.xpReward || monster.xpReward || 0;
  monster.goldRewardMin = def.goldRewardMin ?? 0;
  monster.goldRewardMax = def.goldRewardMax ?? monster.goldRewardMin ?? 0;
  monster.lootTable = def.loot || [];
  // Sorts disponibles pour ce monstre
  monster.spellIds = def.spells || [];

  // Par défaut, les monstres "monde" respawnent, les clones de combat
  // pourront forcer monster.respawnEnabled = false.
  monster.respawnEnabled = monster.respawnEnabled ?? true;
  // Niveau aléatoire par défaut (modifiable en amont si besoin)
  monster.level = monster.level ?? Phaser.Math.Between(1, 4);

  // Callback standard quand le monstre meurt
  monster.onKilled = (sceneArg, killer) => {
    const rewardXp = computeMonsterXpReward(monster, killer);
    const goldMin = monster.goldRewardMin || 0;
    const goldMax = monster.goldRewardMax || goldMin;

    if (killer && typeof addXpToPlayer === "function") {
      addXpToPlayer(killer, rewardXp);
    }

    // Progression des quêtes liées aux kills
    if (killer) {
      // Pour l'instant, on incrémente uniquement la quête papi_corbeaux_1.
      incrementKillProgress(sceneArg, killer, "papi_corbeaux_1", monster.monsterId);
    }

    // Si un combat est en cours, on cumule l'XP gagnée et on gère le loot
    if (sceneArg && sceneArg.combatState && sceneArg.combatState.enCours) {
      const cs = sceneArg.combatState;
      cs.xpGagne = (cs.xpGagne || 0) + rewardXp;

      // gold de combat (pour l'instant uniquement cote joueur)
      if (goldMax > 0) {
        const goldGain =
          goldMin >= goldMax
            ? goldMin
            : Phaser.Math.Between(goldMin, goldMax);
        cs.goldGagne = (cs.goldGagne || 0) + goldGain;
      }

      // --- Génération de loot simple lié au monstre ---
      if (killer && killer.inventory && Array.isArray(monster.lootTable)) {
        cs.loot = cs.loot || [];

        for (const entry of monster.lootTable) {
          if (!entry || !entry.itemId) continue;

          const dropRate =
            typeof entry.dropRate === "number" ? entry.dropRate : 1.0;
          if (Math.random() > dropRate) continue;

          const min = entry.min ?? 1;
          const max = entry.max ?? min;
          const qty = Math.max(0, Phaser.Math.Between(min, max));
          if (qty <= 0) continue;

          const remaining = addItem(killer.inventory, entry.itemId, qty);
          const gained = qty - remaining;
          if (gained <= 0) continue;

          // Fusionne dans le tableau de loot du combat
          let slot = cs.loot.find((l) => l.itemId === entry.itemId);
          if (!slot) {
            slot = { itemId: entry.itemId, qty: 0 };
            cs.loot.push(slot);
          }
          slot.qty += gained;
        }
      }
    }

    if (sceneArg) {
      if (typeof sceneArg.updateHudTargetInfo === "function") {
        sceneArg.updateHudTargetInfo(null);
      }
      // Nettoie immédiatement tous les overlays liés à ce monstre mort
      if (typeof sceneArg.clearDamagePreview === "function") {
        sceneArg.clearDamagePreview();
      }
      if (typeof sceneArg.hideMonsterTooltip === "function") {
        sceneArg.hideMonsterTooltip();
      }
    }

    // Détruit l'éventuel effet lumineux de survol restant
    if (monster.hoverHighlight) {
      monster.hoverHighlight.destroy();
      monster.hoverHighlight = null;
    }

    // Respawn simple : réapparaît au même endroit 5 secondes après la mort.
    // Désactivable via monster.respawnEnabled = false (utile pour des clones de combat).
    const allowRespawn =
      monster.respawnEnabled === undefined || monster.respawnEnabled === true;

    if (
      allowRespawn &&
      sceneArg &&
      sceneArg.time &&
      sceneArg.map &&
      sceneArg.groundLayer &&
      typeof monster.tileX === "number" &&
      typeof monster.tileY === "number"
    ) {
      const respawnDelayMs = 5000;
      const respawnTileX = monster.tileX;
      const respawnTileY = monster.tileY;
      const respawnId = monster.monsterId;

      sceneArg.time.delayedCall(respawnDelayMs, () => {
        // Si la scène n'est plus active, on ne fait rien
        if (!sceneArg.scene.isActive()) return;

        const worldPos = sceneArg.map.tileToWorldXY(
          respawnTileX,
          respawnTileY,
          undefined,
          undefined,
          sceneArg.groundLayer
        );
        const spawnX = worldPos.x + sceneArg.map.tileWidth / 2;
        const spawnY = worldPos.y + sceneArg.map.tileHeight / 2;

        const newMonster = createMonster(sceneArg, spawnX, spawnY, respawnId);
        newMonster.tileX = respawnTileX;
        newMonster.tileY = respawnTileY;
        // Applique la logique de groupe/niveaux aléatoires au respawn
        newMonster.groupSize = Phaser.Math.Between(1, 4);
        newMonster.groupLevels = Array.from(
          { length: newMonster.groupSize },
          () => Phaser.Math.Between(1, 4)
        );
        newMonster.level = newMonster.groupLevels[0];
        newMonster.groupLevelTotal = newMonster.groupLevels.reduce(
          (sum, lvl) => sum + lvl,
          0
        );

        sceneArg.monsters = sceneArg.monsters || [];
        sceneArg.monsters.push(newMonster);

        // Si un combat est en cours, ce monstre respawné
        // doit être hors combat : on le cache et on le rend non interactif
        // jusqu'à la fin du combat.
        if (sceneArg.combatState && sceneArg.combatState.enCours) {
          newMonster.setVisible(false);
          if (newMonster.disableInteractive) {
            newMonster.disableInteractive();
          }
          sceneArg.hiddenWorldMonsters = sceneArg.hiddenWorldMonsters || [];
          sceneArg.hiddenWorldMonsters.push(newMonster);
        }

        // La caméra HUD doit ignorer le nouveau monstre également
        if (sceneArg.hudCamera) {
          sceneArg.hudCamera.ignore(newMonster);
        }
      });
    }
  };

  // Rendre le monstre cliquable pour entrer en combat
  monster.setInteractive({ useHandCursor: true });

  // Affichage des infos de la cible dans le HUD lors du survol
  monster.on("pointerover", () => {
    // Effet de lumière directement sur le sprite :
    // on ajoute un doublon du sprite en mode ADD par‑dessus lui.
    if (!monster.hoverHighlight && scene.add) {
      const overlay = scene.add.sprite(
        monster.x,
        monster.y,
        monster.texture.key
      );

      // même origine que le monstre pour coller parfaitement
      overlay.setOrigin(monster.originX, monster.originY);

      // si le monstre a une frame (anim), on la copie
      if (monster.frame && overlay.setFrame) {
        overlay.setFrame(monster.frame.name);
      }

      overlay.setBlendMode(Phaser.BlendModes.ADD); // effet lumineux
      overlay.setAlpha(0.6); // intensité
      overlay.setDepth((monster.depth || 0) + 1); // au-dessus du sprite

      if (scene.hudCamera) {
        scene.hudCamera.ignore(overlay);
      }

      monster.hoverHighlight = overlay;
    }

    if (scene.updateHudTargetInfo) {
      scene.updateHudTargetInfo(monster);
    }
    if (scene.showDamagePreview) {
      scene.showDamagePreview(monster);
    }
    if (scene.showMonsterTooltip) {
      scene.showMonsterTooltip(monster);
    }
  });

  monster.on("pointerout", () => {
    // Retire le doublon lumineux s'il existe
    if (monster.hoverHighlight) {
      monster.hoverHighlight.destroy();
      monster.hoverHighlight = null;
    }
    if (scene.updateHudTargetInfo) {
      scene.updateHudTargetInfo(null);
    }
    if (scene.clearDamagePreview) {
      scene.clearDamagePreview();
    }
    if (scene.hideMonsterTooltip) {
      scene.hideMonsterTooltip();
    }
  });

  return monster;
}

function computeMonsterXpReward(monster, killer) {
  const baseXp = monster.xpRewardBase ?? monster.xpReward ?? 0;
  const playerLevel = killer?.levelState?.niveau ?? 1;
  const levels = Array.isArray(monster.groupLevels) && monster.groupLevels.length > 0
    ? monster.groupLevels
    : [monster.level ?? monster.stats?.niveau ?? 1];

  const groupSize =
    (Array.isArray(monster.groupLevels) && monster.groupLevels.length > 0
      ? monster.groupLevels.length
      : typeof monster.groupSize === "number" && monster.groupSize > 0
        ? monster.groupSize
        : 1);

  const levelBonus = computeHighestLevelBonus(levels);
  const groupBonus = computeGroupBonus(groupSize);

  const factor = computeXpFactor(levels, playerLevel);
  const totalGroupXp = baseXp * levelBonus * groupBonus * factor;

  // On renvoie la part d'XP pour CE monstre.
  const perMonsterXp =
    groupSize > 0 ? totalGroupXp / groupSize : totalGroupXp;

  return Math.max(1, Math.round(perMonsterXp));
}

function computeHighestLevelBonus(levels) {
  const highest = levels.reduce(
    (max, lvl) => (lvl > max ? lvl : max),
    levels[0] ?? 1
  );
  const table = XP_CONFIG.baseLevelBonus || {};
  // On cherche d'abord une entrée exacte
  if (table[highest] != null) {
    return table[highest];
  }
  // Sinon on prend la valeur correspondant au niveau défini le plus élevé
  const keys = Object.keys(table).map((k) => Number(k)).filter((n) => !Number.isNaN(n));
  if (keys.length === 0) return 1.0;
  const maxKey = keys.reduce((m, v) => (v > m ? v : m), keys[0]);
  return table[maxKey] ?? 1.0;
}

function computeXpFactor(levels, playerLevel) {
  const total = levels.reduce((sum, lvl) => sum + (lvl ?? 1), 0);
  const highest = levels.reduce(
    (max, lvl) => (lvl > max ? lvl : max),
    levels[0] ?? 1
  );
  // Niveau de référence : on évite de pénaliser un groupe faible mais nombreux,
  // mais on tient compte d'un monstre très HL.
  const effectiveLevel = Math.max(highest, Math.min(total, playerLevel));
  const diff = Math.abs(effectiveLevel - playerLevel);

  const tiers = XP_CONFIG.penaltyTiers || [];
  for (const tier of tiers) {
    if (diff <= tier.maxDiff) {
      return tier.factor;
    }
  }
  return tiers.length > 0 ? tiers[tiers.length - 1].factor : 1.0;
}

function computeGroupBonus(groupSize) {
  const size = typeof groupSize === "number" && groupSize > 0 ? groupSize : 1;
  const table = XP_CONFIG.groupBonusBySize || {};
  if (table[size] != null) {
    return table[size];
  }
  const keys = Object.keys(table).map((k) => Number(k)).filter((n) => !Number.isNaN(n));
  if (keys.length === 0) return 1.0;
  const maxKey = keys.reduce((m, v) => (v > m ? v : m), keys[0]);
  return table[maxKey] ?? 1.0;
}
