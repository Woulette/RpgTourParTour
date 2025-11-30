// Gestion d'une petite fiche d'infos au-dessus du monstre survolé.
// Affiche : niveau, nom, XP gagnée.

export function attachMonsterTooltip(scene) {
  if (!scene) return;

  scene.monsterTooltipText = null;
  scene.monsterTooltipBg = null;

  scene.showMonsterTooltip = (monster) => {
    if (!monster) {
      scene.hideMonsterTooltip && scene.hideMonsterTooltip();
      return;
    }

    const baseName =
      monster.displayName || monster.label || monster.monsterId || "Monstre";
    const level =
      monster.level ?? (monster.stats && monster.stats.niveau) ?? 1;
    const xp = monster.xpReward ?? 0;
    const groupSize =
      typeof monster.groupSize === "number" && monster.groupSize > 1
        ? monster.groupSize
        : null;

    const name = groupSize ? `${baseName} x${groupSize}` : baseName;

    const titleLine = `Niv. ${level} - ${name}`;
    const xpLine = `XP : ${xp}`;
    const text = `${titleLine}\n${xpLine}`;

    const bubbleCenterX = monster.x;
    // Légèrement au-dessus de la tête du monstre
    const bubbleCenterY = monster.y - 70;

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
    // Meilleure définition pour un texte plus net
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
    const bgX = bubbleCenterX - bgWidth / 2;
    const bgY = bubbleCenterY - bgHeight / 2;

    bg.fillRoundedRect(bgX, bgY, bgWidth, bgHeight, radius);
    bg.strokeRoundedRect(bgX, bgY, bgWidth, bgHeight, radius);

    if (scene.hudCamera) {
      scene.hudCamera.ignore(bg);
      scene.hudCamera.ignore(tooltipText);
    }
    bg.setDepth(9);
    tooltipText.setDepth(10);

    scene.monsterTooltipBg = bg;
    scene.monsterTooltipText = tooltipText;
  };

  scene.hideMonsterTooltip = () => {
    if (scene.monsterTooltipText) {
      scene.monsterTooltipText.destroy();
      scene.monsterTooltipText = null;
    }
    if (scene.monsterTooltipBg) {
      scene.monsterTooltipBg.destroy();
      scene.monsterTooltipBg = null;
    }
  };
}
