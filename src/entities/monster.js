import { createCharacter } from "./character.js";
import { monsters } from "../content/monsters/index.js";
import { createStats } from "../core/stats.js";
import { XP_CONFIG } from "../config/xp.js";
import { addXpToPlayer } from "./player.js";
import { incrementKillProgressForAll } from "../features/quests/index.js";
import { createCalibratedWorldToTile } from "../features/maps/world/util.js";
import { queueMonsterRespawn } from "../features/monsters/runtime/respawnState.js";
import { tryResolveCaptureOnMonsterDeath } from "../features/combat/summons/capture.js";

// On ne scale que les stats principales (pas PA/PM/initiative/PO/etc.).
const MONSTER_SCALABLE_STAT_KEYS = new Set([
  "force",
  "intelligence",
  "agilite",
  "chance",
  "vitalite",
  "sagesse",
]);

export function computeScaledMonsterOverrides(def, level) {
  if (!def) return {};
  const overrides = def.statsOverrides || {};

  const baseLevel = typeof def.baseLevel === "number" ? def.baseLevel : 1;
  const safeLevel =
    typeof level === "number" && Number.isFinite(level) ? level : baseLevel;
  const delta = Math.max(0, safeLevel - baseLevel);
  if (!overrides || delta <= 0) return overrides;

  const HP_PCT_PER_LEVEL = 0.08;
  const HP_CAP_PER_LEVEL = 40;
  const STAT_PCT_PER_LEVEL = 0.05;
  const STAT_CAP_PER_LEVEL = 10;
  const STAT_MIN_PER_LEVEL = 1;

  const result = { ...overrides };

  const baseHp =
    typeof overrides.hpMax === "number"
      ? overrides.hpMax
      : typeof overrides.hp === "number"
        ? overrides.hp
        : null;

  if (typeof baseHp === "number") {
    const perLevel = Math.min(
      HP_CAP_PER_LEVEL,
      Math.max(1, Math.round(baseHp * HP_PCT_PER_LEVEL))
    );
    const scaledHpMax = baseHp + perLevel * delta;
    result.hpMax = scaledHpMax;
    result.hp = scaledHpMax;
  }

  for (const key of MONSTER_SCALABLE_STAT_KEYS) {
    const baseVal = overrides[key];
    if (typeof baseVal !== "number") continue;

    const perLevel = Math.min(
      STAT_CAP_PER_LEVEL,
      Math.max(STAT_MIN_PER_LEVEL, Math.round(baseVal * STAT_PCT_PER_LEVEL))
    );
    result[key] = baseVal + perLevel * delta;
  }

  return result;
}

/**
 * Crée un monstre sur la carte.
 * - stats basées sur le même modèle que le joueur
 * - pas de système de niveau pour le monstre lui‑même
 */
export function createMonster(scene, x, y, monsterId, forcedLevel = null) {
  const def = monsters[monsterId];
  if (!def) {
    throw new Error(`Monstre inconnu: ${monsterId}`);
  }

  const baseLevel = typeof def.baseLevel === "number" ? def.baseLevel : 1;
  const levelMin =
    typeof def.levelMin === "number" ? def.levelMin : baseLevel;
  const levelMax =
    typeof def.levelMax === "number" ? def.levelMax : Math.max(levelMin, 4);
  const level =
    typeof forcedLevel === "number" && Number.isFinite(forcedLevel)
      ? Math.max(levelMin, Math.min(levelMax, Math.round(forcedLevel)))
      : Phaser.Math.Between(levelMin, levelMax);

  const computeScaledOverrides = () => {
    const overrides = def.statsOverrides || {};
    const delta = Math.max(0, level - baseLevel);
    if (!overrides || delta <= 0) return overrides;

    // Scaling simple par niveau, avec cap pour éviter des stats qui explosent en haut niveau.
    // - HP : % plus haut mais capé
    // - autres stats : % plus bas, capé, +1 minimum pour éviter l'arrondi à 0 sur les petites valeurs
    const HP_PCT_PER_LEVEL = 0.08;
    const HP_CAP_PER_LEVEL = 40;
    const STAT_PCT_PER_LEVEL = 0.05;
    const STAT_CAP_PER_LEVEL = 10;
    const STAT_MIN_PER_LEVEL = 1;

    const result = { ...overrides };

    const baseHp =
      typeof overrides.hpMax === "number"
        ? overrides.hpMax
        : typeof overrides.hp === "number"
          ? overrides.hp
          : null;

    if (typeof baseHp === "number") {
      const perLevel = Math.min(
        HP_CAP_PER_LEVEL,
        Math.max(1, Math.round(baseHp * HP_PCT_PER_LEVEL))
      );
      const scaledHpMax = baseHp + perLevel * delta;
      result.hpMax = scaledHpMax;
      result.hp = scaledHpMax;
    }

    for (const key of MONSTER_SCALABLE_STAT_KEYS) {
      const baseVal = overrides[key];
      if (typeof baseVal !== "number") continue;

      const perLevel = Math.min(
        STAT_CAP_PER_LEVEL,
        Math.max(STAT_MIN_PER_LEVEL, Math.round(baseVal * STAT_PCT_PER_LEVEL))
      );
      result[key] = baseVal + perLevel * delta;
    }

    return result;
  };

  // Stats de base communes, avec overrides du monstre.
  // Pour un monstre, on considère les overrides comme des valeurs FIXES
  // (on ne veut pas ajouter 50 HP de base + 40 HP du monstre).
  const stats = createStats(computeScaledOverrides(), {
    applySecondaryStats: false,
  });

  const monster = createCharacter(scene, x, y, {
    textureKey: def.textureKey,
    classId: monsterId,
    stats,
  });

  const animPrefix = def.animation?.prefix || def.id || def.textureKey;
  monster.animPrefix = animPrefix;
  monster.useDiagonalFacing = def.useDiagonalFacing === true;

  const defaultDir = (() => {
    const marker = "/rotations/";
    if (def.spritePath && def.spritePath.includes(marker)) {
      const file = def.spritePath.split(marker)[1] || "";
      const dot = file.lastIndexOf(".");
      if (dot > 0) return file.slice(0, dot);
      if (file) return file;
    }
    return "south-west";
  })();

  monster.lastDirection = defaultDir;
  const idleKey = `${animPrefix}_idle_${defaultDir}`;
  if (scene?.textures?.exists && scene.textures.exists(idleKey)) {
    monster.baseTextureKey = idleKey;
    if (monster.setTexture) monster.setTexture(idleKey);
  } else {
    monster.baseTextureKey = def.textureKey;
  }
  monster.animScale =
    typeof def.animation?.scale === "number" && Number.isFinite(def.animation.scale)
      ? def.animation.scale
      : null;

  // Réglages de rendu spécifiques au monstre (origin/offset).
  const render = def.render || {};
  monster.renderOffsetX = typeof render.offsetX === "number" ? render.offsetX : 0;
  monster.renderOffsetY = typeof render.offsetY === "number" ? render.offsetY : 0;

  if (monster.setOrigin) {
    const ox = typeof render.originX === "number" ? render.originX : 0.5;
    const oy = typeof render.originY === "number" ? render.originY : 1;
    monster.setOrigin(ox, oy);
  }
  const baseScale =
    typeof render.scale === "number" && Number.isFinite(render.scale)
      ? render.scale
      : 1;
  monster.baseScale = baseScale;
  if (monster.setScale && baseScale !== 1) {
    monster.setScale(baseScale);
  }

  // Depth basé sur Y (comme le joueur/les décors) pour rester au-dessus des calques sol + grille debug.
  // (Sinon, si la grille est au-dessus de certains calques sol, elle peut passer devant le monstre.)
  monster.setDepth(typeof monster.y === "number" ? monster.y : 2);

  // S'assure que la caméra HUD n'affiche pas le monstre
  if (scene.hudCamera) {
    scene.hudCamera.ignore(monster);
  }

  // Métadonnées utiles pour le système de combat / loot
  monster.monsterId = monsterId;
  monster.label = def.label || def.displayName || monsterId;
  monster.displayName = monster.label;
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
  // Clé de map pour scoper les respawns (empêche le respawn sur une autre map).
  monster.spawnMapKey = monster.spawnMapKey ?? scene.currentMapKey ?? null;
  // Niveau aléatoire par défaut (modifiable en amont si besoin)
  monster.level = monster.level ?? level;

  // Callback standard quand le monstre meurt
  monster.onKilled = (sceneArg, killer) => {
    // Capture : si ce monstre était marqué par le joueur, on enregistre la capture.
    tryResolveCaptureOnMonsterDeath(sceneArg, monster);

    const inCombat = !!(sceneArg && sceneArg.combatState && sceneArg.combatState.enCours);

    const rewardXp = computeMonsterXpReward(monster, killer);
    const goldMin = monster.goldRewardMin || 0;
    const goldMax = monster.goldRewardMax || goldMin;

    if (!inCombat && killer && typeof addXpToPlayer === "function") {
      addXpToPlayer(killer, rewardXp);
    }

    // Progression des quêtes liées aux kills
    if (killer) {
      // Pour l'instant, on incrémente uniquement la quête papi_corbeaux_1.
      incrementKillProgressForAll(sceneArg, killer, monster.monsterId);
    }

    // Si un combat est en cours, on cumule l'XP gagnée et on gère le loot
    if (inCombat) {
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
        cs.lootSources = cs.lootSources || [];
        cs.lootSources.push({
          monsterId: monster.monsterId || null,
          lootTable: monster.lootTable,
        });
      }
    }

    if (sceneArg) {
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

    if (allowRespawn && sceneArg && !inCombat) {
      // Respawn scoppé par map : empêche les respawns sur une autre map.
      queueMonsterRespawn(sceneArg, monster, 5000);
    }
  };

  // Rendre le monstre cliquable pour entrer en combat
  monster.setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 1 });

  const getCombatWorldToTile = () => {
    const map = scene.combatMap || scene.map;
    const layer = scene.combatGroundLayer || scene.groundLayer;
    if (!map || !layer) return null;

    const cacheKey = map.key || scene.currentMapKey || "default";
    scene._worldToTileCache = scene._worldToTileCache || {};
    if (!scene._worldToTileCache[cacheKey]) {
      scene._worldToTileCache[cacheKey] = createCalibratedWorldToTile(map, layer);
    }
    return scene._worldToTileCache[cacheKey];
  };

  const clearHoverUi = () => {
    if (monster.hoverHighlight) {
      monster.hoverHighlight.destroy();
      monster.hoverHighlight = null;
    }
    if (scene.clearDamagePreview) {
      scene.clearDamagePreview();
    }
    if (scene.hideMonsterTooltip) {
      scene.hideMonsterTooltip();
    }
    if (scene.hideCombatTargetPanel) {
      scene.hideCombatTargetPanel();
    }
  };

  // Effets de survol (highlight + tooltip)
  const shouldGateHoverByTile = () =>
    (scene.combatState && scene.combatState.enCours) ||
    (scene.prepState && scene.prepState.actif);

  monster.on("pointerover", (pointer) => {
    if (shouldGateHoverByTile()) {
      const worldToTile = getCombatWorldToTile();
      const t =
        worldToTile && pointer
          ? worldToTile(pointer.worldX, pointer.worldY)
          : null;
      const tx =
        typeof monster.currentTileX === "number"
          ? monster.currentTileX
          : typeof monster.tileX === "number"
            ? monster.tileX
            : null;
      const ty =
        typeof monster.currentTileY === "number"
          ? monster.currentTileY
          : typeof monster.tileY === "number"
            ? monster.tileY
            : null;
      if (!t || t.x !== tx || t.y !== ty) {
        // Pixel-perfect hover est assez precis pour autoriser le survol
        // meme si le sprite depasse de sa tuile en isometrique.
        if (!(monster.input && monster.input.pixelPerfect)) {
          return;
        }
      }
    }
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
      if (typeof monster.scaleX === "number" && typeof monster.scaleY === "number") {
        overlay.setScale(monster.scaleX, monster.scaleY);
      }

      overlay.setBlendMode(Phaser.BlendModes.ADD); // effet lumineux
      overlay.setAlpha(0.6); // intensité
      overlay.setDepth((monster.depth || 0) + 1); // au-dessus du sprite

      if (scene.hudCamera) {
        scene.hudCamera.ignore(overlay);
      }

      monster.hoverHighlight = overlay;
    }

    if (scene.combatState && scene.combatState.enCours) {
      scene.__combatSpriteHoverLock = true;
      scene.__combatSpriteHoverEntity = monster;
    }
    if (scene.showDamagePreview) {
      scene.showDamagePreview(monster);
    }
    if (scene.showMonsterTooltip) {
      scene.showMonsterTooltip(monster);
    }
    if (scene.combatState && scene.combatState.enCours) {
      if (scene.showCombatTargetPanel) {
        scene.showCombatTargetPanel(monster);
      }
    }
  });

  monster.on("pointermove", (pointer) => {
    if (!shouldGateHoverByTile()) return;

    const worldToTile = getCombatWorldToTile();
    const t =
      worldToTile && pointer ? worldToTile(pointer.worldX, pointer.worldY) : null;
    const tx =
      typeof monster.currentTileX === "number"
        ? monster.currentTileX
        : typeof monster.tileX === "number"
          ? monster.tileX
          : null;
    const ty =
      typeof monster.currentTileY === "number"
        ? monster.currentTileY
        : typeof monster.tileY === "number"
          ? monster.tileY
          : null;
    if (t && t.x === tx && t.y === ty) {
      monster.emit("pointerover", pointer);
      return;
    }

    clearHoverUi();
  });

  monster.on("pointerout", () => {
    // En combat, la hitbox peut couvrir plusieurs cases : on force l'effacement.
    if (scene.combatState && scene.combatState.enCours) {
      scene.__combatSpriteHoverLock = false;
      scene.__combatSpriteHoverEntity = null;
    }
    clearHoverUi();
    if (scene.combatState && scene.combatState.enCours) return;
    // Retire le doublon lumineux s'il existe
    if (monster.hoverHighlight) {
      monster.hoverHighlight.destroy();
      monster.hoverHighlight = null;
    }
    if (scene.clearDamagePreview) {
      scene.clearDamagePreview();
    }
    if (scene.hideMonsterTooltip) {
      scene.hideMonsterTooltip();
    }
    if (scene.hideCombatTargetPanel) {
      scene.hideCombatTargetPanel();
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
