// Gestion d'une petite fiche d'infos au-dessus du monstre survolé.
// Affiche : XP (estimée), niveau total du groupe, niveaux individuels.

import { monsters } from "../../content/monsters/index.js";
import { XP_CONFIG } from "../../config/xp.js";

export function attachMonsterTooltip(scene) {
  if (!scene) return;

  scene.monsterTooltipText = null;
  scene.monsterTooltipDamageText = null;
  scene.monsterTooltipBg = null;
  scene.monsterTooltipTarget = null;
  scene.monsterTooltipMode = null;

  const getBounds = (entity) => {
    if (!entity) return null;
    if (typeof entity.getBounds === "function") {
      try {
        return entity.getBounds();
      } catch {
        // ignore
      }
    }
    const x = entity.x ?? 0;
    const y = entity.y ?? 0;
    return { left: x, right: x, top: y, bottom: y, centerX: x, centerY: y };
  };

  scene.updateMonsterTooltipPosition = () => {
    const target = scene.monsterTooltipTarget;
    if (!target || !scene.monsterTooltipBg || !scene.monsterTooltipText) return;

    const bounds = getBounds(target);
    const bubbleCenterX = bounds?.centerX ?? target.x;

    if (scene.monsterTooltipMode === "combat") {
      const header = scene.monsterTooltipText;
      const dmg = scene.monsterTooltipDamageText;
      const paddingX = 10;
      const paddingY = 6;
      const gapY = dmg ? 2 : 0;
      const contentW = Math.max(header.width, dmg ? dmg.width : 0);
      const contentH = header.height + (dmg ? gapY + dmg.height : 0);
      const bgWidth = contentW + paddingX * 2;
      const bgHeight = contentH + paddingY * 2;
      const margin = 10;
      const centerY = (bounds?.top ?? target.y) - bgHeight / 2 - margin;
      const bgX = bubbleCenterX - bgWidth / 2;
      const bgY = centerY - bgHeight / 2;

      scene.monsterTooltipBg.clear();
      scene.monsterTooltipBg.fillStyle(0x000000, 0.78);
      scene.monsterTooltipBg.lineStyle(1, 0xffffff, 0.18);
      const radius = 8;
      scene.monsterTooltipBg.fillRoundedRect(bgX, bgY, bgWidth, bgHeight, radius);
      scene.monsterTooltipBg.strokeRoundedRect(bgX, bgY, bgWidth, bgHeight, radius);

      const headerY = bgY + paddingY + header.height / 2;
      header.setPosition(bubbleCenterX, headerY);
      if (dmg) {
        const dmgY = headerY + header.height / 2 + gapY + dmg.height / 2;
        dmg.setPosition(bubbleCenterX, dmgY);
      }
      return;
    }

    const tooltipText = scene.monsterTooltipText;
    const lineCount = String(tooltipText.text || "").split("\n").length;
    const bubbleCenterY = target.y - 40 - lineCount * 8;
    const paddingX = 8;
    const paddingY = 4;
    const bgWidth = tooltipText.width + paddingX * 2;
    const bgHeight = tooltipText.height + paddingY * 2;
    const margin = 10;
    const centerY = (bounds?.top ?? bubbleCenterY) - bgHeight / 2 - margin;
    tooltipText.setPosition(bubbleCenterX, centerY);

    const bgX = bubbleCenterX - bgWidth / 2;
    const bgY = centerY - bgHeight / 2;
    scene.monsterTooltipBg.clear();
    scene.monsterTooltipBg.fillStyle(0x000000, 0.7);
    scene.monsterTooltipBg.lineStyle(1, 0xffffff, 0.9);
    const radius = 6;
    scene.monsterTooltipBg.fillRoundedRect(bgX, bgY, bgWidth, bgHeight, radius);
    scene.monsterTooltipBg.strokeRoundedRect(bgX, bgY, bgWidth, bgHeight, radius);
  };

  scene.showMonsterTooltip = (monster) => {
    if (!monster) {
      if (scene.hideMonsterTooltip) scene.hideMonsterTooltip();
      return;
    }
    scene.monsterTooltipTarget = monster;

    const baseName =
      monster.displayName || monster.label || monster.monsterId || "Monstre";
    const bounds = getBounds(monster);
    const bubbleCenterX = bounds?.centerX ?? monster.x;

    // En combat : affichage harmonieux (nom + niv + PV + prévisu dégâts en un seul bloc).
    if (scene.combatState && scene.combatState.enCours) {
      scene.monsterTooltipMode = "combat";
      const stats = monster.stats || {};
      const hp = typeof stats.hp === "number" ? stats.hp : stats.hpMax ?? 0;
      const hpMax = typeof stats.hpMax === "number" ? stats.hpMax : hp;
      const lvl = monster.level ?? monster.stats?.niveau ?? 1;
      const headerText = `${baseName}  Niv. ${lvl}  ♥ ${hp}/${hpMax}`;
      const dmgText =
        scene.damagePreview &&
        scene.damagePreview.monster === monster &&
        typeof scene.damagePreview.text === "string"
          ? scene.damagePreview.text
          : null;

      if (scene.monsterTooltipText) {
        scene.monsterTooltipText.destroy();
        scene.monsterTooltipText = null;
      }
      if (scene.monsterTooltipDamageText) {
        scene.monsterTooltipDamageText.destroy();
        scene.monsterTooltipDamageText = null;
      }
      if (scene.monsterTooltipBg) {
        scene.monsterTooltipBg.destroy();
        scene.monsterTooltipBg = null;
      }

      const header = scene.add.text(bubbleCenterX, monster.y - 56, headerText, {
        fontFamily: "Segoe UI, Arial",
        fontSize: 13,
        fontStyle: "bold",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
        align: "center",
      });
      header.setOrigin(0.5, 0.5);
      if (header.setResolution) header.setResolution(2);

      let dmg = null;
      if (dmgText) {
        dmg = scene.add.text(bubbleCenterX, monster.y - 56, dmgText, {
          fontFamily: "Segoe UI, Arial",
          fontSize: 12,
          fontStyle: "bold",
          color: "#f59e0b",
          stroke: "#000000",
          strokeThickness: 3,
          align: "center",
        });
        dmg.setOrigin(0.5, 0.5);
        if (dmg.setResolution) dmg.setResolution(2);
      }

      const paddingX = 10;
      const paddingY = 6;
      const gapY = dmg ? 2 : 0;
      const contentW = Math.max(header.width, dmg ? dmg.width : 0);
      const contentH = header.height + (dmg ? gapY + dmg.height : 0);
      const bgWidth = contentW + paddingX * 2;
      const bgHeight = contentH + paddingY * 2;

      const bg = scene.add.graphics();
      bg.fillStyle(0x000000, 0.78);
      bg.lineStyle(1, 0xffffff, 0.18);
      const radius = 8;

      const margin = 10;
      const centerY = (bounds?.top ?? monster.y) - bgHeight / 2 - margin;
      const bgX = bubbleCenterX - bgWidth / 2;
      const bgY = centerY - bgHeight / 2;
      bg.fillRoundedRect(bgX, bgY, bgWidth, bgHeight, radius);
      bg.strokeRoundedRect(bgX, bgY, bgWidth, bgHeight, radius);

      const headerY = bgY + paddingY + header.height / 2;
      header.setPosition(bubbleCenterX, headerY);
      if (dmg) {
        const dmgY = headerY + header.height / 2 + gapY + dmg.height / 2;
        dmg.setPosition(bubbleCenterX, dmgY);
      }

      if (scene.hudCamera) {
        scene.hudCamera.ignore(bg);
        scene.hudCamera.ignore(header);
        if (dmg) scene.hudCamera.ignore(dmg);
      }
      bg.setDepth(200000);
      header.setDepth(200001);
      if (dmg) dmg.setDepth(200001);

      scene.monsterTooltipBg = bg;
      scene.monsterTooltipText = header;
      scene.monsterTooltipDamageText = dmg;
      scene.updateMonsterTooltipPosition();
      return;
    }
    scene.monsterTooltipMode = "world";

    const baseDef = monsters[monster.monsterId] || null;
    const groupSize =
      typeof monster.groupSize === "number" && monster.groupSize > 1
        ? monster.groupSize
        : 1;
    const levels =
      Array.isArray(monster.groupLevels) && monster.groupLevels.length > 0
        ? monster.groupLevels
        : Array.from({ length: groupSize }, () => monster.level ?? 1);
    const groupIds =
      Array.isArray(monster.groupMonsterIds) && monster.groupMonsterIds.length > 0
        ? monster.groupMonsterIds
        : Array.from({ length: groupSize }, () => monster.monsterId);

    const lines = [];
    // En préparation de combat : affichage simplifié (nom + niveaux individuels).
    const inPrep = scene.prepState && scene.prepState.actif;
    if (!inPrep) {
      const xpTotal = computeGroupXp(monster, scene, baseDef, levels);
      const totalLevel = levels.reduce((sum, lvl) => sum + lvl, 0);
      lines.push(`XP : ${xpTotal}`);
      lines.push(`Niv. total : ${totalLevel}`);
      const encounter = scene.currentMapDef?.riftEncounter || null;
      const waveCount =
        Array.isArray(encounter?.wave2Monsters) && encounter.wave2Monsters.length > 0
          ? 2
          : 1;
      if (waveCount > 1) {
        lines.push(`Vagues : x${waveCount}`);
      }
    }
    for (let i = 0; i < groupSize; i += 1) {
      const lvl = levels[i] ?? monster.level ?? 1;
      const id = groupIds[i] || monster.monsterId;
      const def = monsters[id] || null;
      const name = def?.label || id || baseName;
      lines.push(`${name} - Niv. ${lvl}`);
    }
    const text = lines.join("\n");

    // bubbleCenterX calculé via bounds plus haut.
    const lineCount = lines.length;
    // Décale vers le haut en fonction de la taille pour éviter de masquer le monstre
    const bubbleCenterY = monster.y - 40 - lineCount * 8;

    if (scene.monsterTooltipText) {
      scene.monsterTooltipText.destroy();
      scene.monsterTooltipText = null;
    }
    if (scene.monsterTooltipBg) {
      scene.monsterTooltipBg.destroy();
      scene.monsterTooltipBg = null;
    }

    const tooltipText = scene.add.text(bubbleCenterX, bubbleCenterY, text, {
      fontFamily: "Arial",
      fontSize: 13,
      fontStyle: "bold",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3,
      align: "center",
    });
    tooltipText.setOrigin(0.5, 0.5);
    if (tooltipText.setResolution) {
      tooltipText.setResolution(2);
    }

    const paddingX = 8;
    const paddingY = 4;
    const bgWidth = tooltipText.width + paddingX * 2;
    const bgHeight = tooltipText.height + paddingY * 2;

    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.lineStyle(1, 0xffffff, 0.9);
    const radius = 6;

    const margin = 10;
    const centerY = (bounds?.top ?? bubbleCenterY) - bgHeight / 2 - margin;
    tooltipText.setPosition(bubbleCenterX, centerY);

    const bgX = bubbleCenterX - bgWidth / 2;
    const bgY = centerY - bgHeight / 2;

    bg.fillRoundedRect(bgX, bgY, bgWidth, bgHeight, radius);
    bg.strokeRoundedRect(bgX, bgY, bgWidth, bgHeight, radius);

    if (scene.hudCamera) {
      scene.hudCamera.ignore(bg);
      scene.hudCamera.ignore(tooltipText);
    }
    // Très au-dessus du monde (dépasse le joueur et les calques)
    bg.setDepth(200000);
    tooltipText.setDepth(200001);

    scene.monsterTooltipBg = bg;
    scene.monsterTooltipText = tooltipText;
    scene.updateMonsterTooltipPosition();
  };

  scene.hideMonsterTooltip = () => {
    if (scene.monsterTooltipText) {
      scene.monsterTooltipText.destroy();
      scene.monsterTooltipText = null;
    }
    if (scene.monsterTooltipDamageText) {
      scene.monsterTooltipDamageText.destroy();
      scene.monsterTooltipDamageText = null;
    }
    if (scene.monsterTooltipBg) {
      scene.monsterTooltipBg.destroy();
      scene.monsterTooltipBg = null;
    }
    scene.monsterTooltipTarget = null;
    scene.monsterTooltipMode = null;
  };
}

// XP totale du groupe estimée avec montée douce + pénalité d'écart + sagesse
function computeGroupXp(monster, scene, baseDef, levels) {
  const baseXp =
    monster.xpRewardBase ??
    monster.xpReward ??
    baseDef?.xpReward ??
    0;
  const playerLevel = scene?.player?.levelState?.niveau ?? 1;
  const sagesse = scene?.player?.stats?.sagesse ?? 0;
  const wisdomFactor =
    1 + Math.max(0, sagesse) * (XP_CONFIG.wisdomPerPoint ?? 0.01);

  const levelBonus = computeHighestLevelBonus(levels);
  const groupBonus = computeGroupBonus(monster.groupSize);
  const factor = computeXpFactor(levels, playerLevel);

  const rawXp = baseXp * levelBonus * groupBonus;
  const xpTotal = rawXp * factor * wisdomFactor;
  return Math.max(1, Math.round(xpTotal));
}

function computeHighestLevelBonus(levels) {
  const highest = levels.reduce(
    (max, lvl) => (lvl > max ? lvl : max),
    levels[0] ?? 1
  );
  const table = XP_CONFIG.baseLevelBonus || {};
  if (table[highest] != null) {
    return table[highest];
  }
  const keys = Object.keys(table)
    .map((k) => Number(k))
    .filter((n) => !Number.isNaN(n));
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
  // Niveau de référence : pas de pénalité si le total couvre (ou dépasse un peu) le niveau du joueur,
  // mais on tient compte d'un monstre très HL (highest).
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
  const keys = Object.keys(table)
    .map((k) => Number(k))
    .filter((n) => !Number.isNaN(n));
  if (keys.length === 0) return 1.0;
  const maxKey = keys.reduce((m, v) => (v > m ? v : m), keys[0]);
  return table[maxKey] ?? 1.0;
}
