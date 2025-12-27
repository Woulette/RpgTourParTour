// Phase de préparation : placement joueur / monstres et highlights.

import { COMBAT_PATTERNS } from "../../combatPatterns.js";
import { COMBAT_START_POSITIONS } from "../../config/combatStartPositions.js";
import { createMonster } from "../../entities/monster.js";
import { startCombat } from "./runtime.js";
import { cleanupCombatChallenge, initPrepChallenge } from "../../challenges/runtime.js";

// Calcule une liste de tuiles à partir d'une origine et d'une liste d'offsets.
// Utilisé pour les cases joueurs et ennemies.
function computePlacementTiles(map, originX, originY, offsets) {
  const tiles = [];

  if (!offsets || !Array.isArray(offsets) || offsets.length === 0) {
    // Fallback simple : on garde l'origine si elle est sur la carte.
    if (
      originX >= 0 &&
      originX < map.width &&
      originY >= 0 &&
      originY < map.height
    ) {
      tiles.push({ x: originX, y: originY });
    }
    return tiles;
  }

  for (const { x: dx, y: dy } of offsets) {
    const tx = originX + dx;
    const ty = originY + dy;

    if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
      tiles.push({ x: tx, y: ty });
    }
  }

  // Si, pour une raison quelconque, aucune case n'est valide,
  // on retombe sur l'origine pour ne pas casser le combat.
  if (tiles.length === 0) {
    if (
      originX >= 0 &&
      originX < map.width &&
      originY >= 0 &&
      originY < map.height
    ) {
      tiles.push({ x: originX, y: originY });
    }
  }

  return tiles;
}

// Lance la phase de préparation (placement) avant le combat.
export function startPrep(scene, player, monster, map, groundLayer, options = {}) {
  // Nettoie un ancien indicateur de challenge (si on relance une préparation).
  cleanupCombatChallenge(scene);

  if (
    !monster ||
    typeof monster.tileX !== "number" ||
    typeof monster.tileY !== "number"
  ) {
    // Pas de coordonnées de tuile fiables pour le monstre :
    // on démarre directement le combat.
    startCombat(scene, player, monster);
    return;
  }

  // Snapshot "monde" du monstre cliqué avant tout déplacement de préparation,
  // afin de pouvoir restaurer ses PV/position en cas de défaite.
  if (!monster._worldSnapshotBeforeCombat) {
    const stats = monster.stats || {};
    monster._worldSnapshotBeforeCombat = {
      monsterId: monster.monsterId || null,
      tileX: monster.tileX,
      tileY: monster.tileY,
      x: monster.x,
      y: monster.y,
      level: typeof monster.level === "number" ? monster.level : null,
      hp: typeof stats.hp === "number" ? stats.hp : null,
      hpMax: typeof stats.hpMax === "number" ? stats.hpMax : null,
      spawnMapKey: monster.spawnMapKey ?? scene.currentMapKey ?? null,
      respawnEnabled:
        monster.respawnEnabled === undefined ? true : !!monster.respawnEnabled,
      respawnTemplate:
        monster.respawnTemplate && typeof monster.respawnTemplate === "object"
          ? {
              groupPool: Array.isArray(monster.respawnTemplate.groupPool)
                ? monster.respawnTemplate.groupPool.slice()
                : null,
              groupSizeMin: monster.respawnTemplate.groupSizeMin ?? null,
              groupSizeMax: monster.respawnTemplate.groupSizeMax ?? null,
              forceMixedGroup: monster.respawnTemplate.forceMixedGroup === true,
            }
          : null,
      groupId: monster.groupId ?? null,
      groupSize: monster.groupSize ?? null,
      groupLevels: Array.isArray(monster.groupLevels)
        ? monster.groupLevels.slice()
        : null,
      groupMonsterIds: Array.isArray(monster.groupMonsterIds)
        ? monster.groupMonsterIds.slice()
        : null,
      groupLevelTotal:
        typeof monster.groupLevelTotal === "number" ? monster.groupLevelTotal : null,
    };
  }

  // Si une préparation est déjà active, on ne recrée pas tout.
  if (scene.prepState && scene.prepState.actif) {
    return;
  }

  // On mémorise la carte / layer de combat pour l'IA monstre, les sorts, etc.
  scene.combatMap = map;
  scene.combatGroundLayer = groundLayer;

  // Pendant la prÃ©paration, on fige les dÃ©placements automatiques des monstres (roaming).
  // Sinon leurs timers peuvent les faire bouger pendant le placement.
  if (Array.isArray(scene.monsters) && map && groundLayer) {
    scene.monsters.forEach((m) => {
      if (!m || !m.active) return;
      if (m.roamTween?.stop) m.roamTween.stop();
      m.roamTween = null;
      m.isMoving = false;
      m.targetTileX = null;
      m.targetTileY = null;

      if (typeof m.tileX === "number" && typeof m.tileY === "number") {
        const wp = map.tileToWorldXY(
          m.tileX,
          m.tileY,
          undefined,
          undefined,
          groundLayer
        );
        const offX = typeof m.renderOffsetX === "number" ? m.renderOffsetX : 0;
        const offY = typeof m.renderOffsetY === "number" ? m.renderOffsetY : 0;
        m.x = wp.x + map.tileWidth / 2 + offX;
        m.y = wp.y + map.tileHeight + offY;
      }
    });
  }

  // Petit fondu noir à l'entrée en préparation (au clic sur le monstre)
  const cam = scene.cameras && scene.cameras.main;
  if (cam && cam.fadeOut && cam.fadeIn) {
    cam.once("camerafadeoutcomplete", () => {
      cam.fadeIn(1300, 0, 0, 0);
    });
    cam.fadeOut(0, 0, 0, 0);
  }

  // Choix du paterne et des ancres (joueur / monstres)
  const desiredPatternId =
    typeof options.patternId === "string" ? options.patternId : "close_melee";
  const pattern = COMBAT_PATTERNS[desiredPatternId] || COMBAT_PATTERNS.close_melee;
  const patternId = pattern === COMBAT_PATTERNS[desiredPatternId] ? desiredPatternId : "close_melee";

  // Origines par défaut : autour du monstre cliqué (comportement actuel)
  let playerOriginX = monster.tileX;
  let playerOriginY = monster.tileY;
  let enemyOriginX = monster.tileX;
  let enemyOriginY = monster.tileY;

  if (options.playerOrigin && options.enemyOrigin) {
    if (typeof options.playerOrigin.x === "number") playerOriginX = options.playerOrigin.x;
    if (typeof options.playerOrigin.y === "number") playerOriginY = options.playerOrigin.y;
    if (typeof options.enemyOrigin.x === "number") enemyOriginX = options.enemyOrigin.x;
    if (typeof options.enemyOrigin.y === "number") enemyOriginY = options.enemyOrigin.y;
  }

  // Si des ancres sont définies pour cette map + ce paterne,
  // on en choisit une au hasard.
  const mapKey =
    scene.currentMapKey || (scene.currentMapDef && scene.currentMapDef.key);
  const anchorsForMap =
    mapKey && COMBAT_START_POSITIONS[mapKey]
      ? COMBAT_START_POSITIONS[mapKey][patternId]
      : null;

  if (
    !options.playerOrigin &&
    !options.enemyOrigin &&
    anchorsForMap &&
    Array.isArray(anchorsForMap) &&
    anchorsForMap.length > 0
  ) {
    const idx = Math.floor(Math.random() * anchorsForMap.length);
    const anchor = anchorsForMap[idx];
    if (anchor && anchor.playerOrigin && anchor.enemyOrigin) {
      playerOriginX = anchor.playerOrigin.x;
      playerOriginY = anchor.playerOrigin.y;
      enemyOriginX = anchor.enemyOrigin.x;
      enemyOriginY = anchor.enemyOrigin.y;
    }
  }

  // Cases joueurs / ennemies calculées à partir de l'origine choisie
  let allowedTiles = computePlacementTiles(
    map,
    playerOriginX,
    playerOriginY,
    pattern ? pattern.playerOffsets : null
  );

  let enemyTiles = computePlacementTiles(
    map,
    enemyOriginX,
    enemyOriginY,
    pattern ? pattern.enemyOffsets : null
  );

  // Si, pour une raison quelconque (ancres hors carte, paterne absent),
  // on se retrouve sans cases valides, on retombe sur le comportement
  // "autour du monstre cliqué".
  if (!allowedTiles.length || !enemyTiles.length) {
    const fallbackPattern = COMBAT_PATTERNS.close_melee;
    allowedTiles = computePlacementTiles(
      map,
      monster.tileX,
      monster.tileY,
      fallbackPattern ? fallbackPattern.playerOffsets : null
    );
    enemyTiles = computePlacementTiles(
      map,
      monster.tileX,
      monster.tileY,
      fallbackPattern ? fallbackPattern.enemyOffsets : null
    );
  }

  // Prépare la liste des monstres impliqués dans ce combat.
  const baseGroupSize =
    typeof monster.groupSize === "number" && monster.groupSize > 0
      ? monster.groupSize
      : 1;
  const maxEnemies = Math.max(
    1,
    Math.min(baseGroupSize, enemyTiles.length || 1)
  );

  const combatMonsters = [];

  // Au moins un monstre : on place le "pack leader" (le monstre cliqué).
  const firstTile =
    enemyTiles.length > 0
      ? enemyTiles[0]
      : { x: monster.tileX, y: monster.tileY };

  monster.tileX = firstTile.x;
  monster.tileY = firstTile.y;

  let worldPos = map.tileToWorldXY(
    firstTile.x,
    firstTile.y,
    undefined,
    undefined,
    groundLayer
  );
  monster.x = worldPos.x + map.tileWidth / 2;
  monster.y =
    worldPos.y +
    map.tileHeight +
    (typeof monster.renderOffsetY === "number" ? monster.renderOffsetY : 0);
  monster.x =
    monster.x +
    (typeof monster.renderOffsetX === "number" ? monster.renderOffsetX : 0);
  monster.isCombatMember = true;

  combatMonsters.push(monster);

  // Monstres supplémentaires du pack (corbeau x2/x3/x4, etc.)
  for (let i = 1; i < maxEnemies; i += 1) {
    const tile = enemyTiles[i] || firstTile;

    worldPos = map.tileToWorldXY(
      tile.x,
      tile.y,
      undefined,
      undefined,
      groundLayer
    );

    const memberMonsterId =
      Array.isArray(monster.groupMonsterIds) && monster.groupMonsterIds[i]
        ? monster.groupMonsterIds[i]
        : monster.monsterId;
    const memberLevel =
      Array.isArray(monster.groupLevels) && typeof monster.groupLevels[i] === "number"
        ? monster.groupLevels[i]
        : null;

    const extra = createMonster(
      scene,
      worldPos.x + map.tileWidth / 2,
      worldPos.y + map.tileHeight,
      memberMonsterId,
      memberLevel
    );
    extra.x =
      extra.x +
      (typeof extra.renderOffsetX === "number" ? extra.renderOffsetX : 0);
    extra.y =
      extra.y +
      (typeof extra.renderOffsetY === "number" ? extra.renderOffsetY : 0);
    if (typeof memberLevel === "number") {
      extra.level = memberLevel;
    }
    if (typeof monster.groupLevelTotal === "number") {
      extra.groupLevelTotal = monster.groupLevelTotal;
    }
    extra.tileX = tile.x;
    extra.tileY = tile.y;
    extra.groupId = monster.groupId;
    extra.groupSize = baseGroupSize;
    if (Array.isArray(monster.groupLevels)) {
      extra.groupLevels = monster.groupLevels.slice();
    }
    if (Array.isArray(monster.groupMonsterIds)) {
      extra.groupMonsterIds = monster.groupMonsterIds.slice();
    }
    extra.respawnEnabled = false;
    extra.isCombatMember = true;
    extra.isCombatOnly = true;

    scene.monsters = scene.monsters || [];
    scene.monsters.push(extra);
    combatMonsters.push(extra);
  }

  // Sauvegarde la liste des monstres engagés dans ce combat.
  scene.combatMonsters = combatMonsters;

  // Nettoyage visuel de base (previews, tooltips)
  if (scene.clearDamagePreview) {
    scene.clearDamagePreview();
  }
  if (scene.hideMonsterTooltip) {
    scene.hideMonsterTooltip();
  }

  // Cache les monstres du monde qui ne participent pas à ce combat.
  const allMonsters = scene.monsters || [];
  const combatSet = new Set(combatMonsters);
  scene.hiddenWorldMonsters = [];

  allMonsters.forEach((m) => {
    if (!m || combatSet.has(m)) return;

    m.setVisible(false);
    if (m.disableInteractive) {
      m.disableInteractive();
    }

    scene.hiddenWorldMonsters.push(m);
  });

  // Placement automatique du joueur sur une case bleue aléatoire dès la préparation.
  if (allowedTiles.length > 0) {
    const currentX = player.currentTileX;
    const currentY = player.currentTileY;

    // On évite de reprendre exactement la tuile actuelle si possible.
    let playerCandidates = allowedTiles.filter(
      (t) => t.x !== currentX || t.y !== currentY
    );
    if (playerCandidates.length === 0) {
      playerCandidates = allowedTiles;
    }

    const idx = Math.floor(Math.random() * playerCandidates.length);
    const tile = playerCandidates[idx];

    player.currentTileX = tile.x;
    player.currentTileY = tile.y;

    const worldPosPlayer = map.tileToWorldXY(
      tile.x,
      tile.y,
      undefined,
      undefined,
      groundLayer
    );
    player.x = worldPosPlayer.x + map.tileWidth / 2;
    player.y = worldPosPlayer.y + map.tileHeight / 2;
  }

  const highlights = [];
  const halfW = map.tileWidth / 2;
  const halfH = map.tileHeight / 2;

  // Surbrillance des cases de placement joueur (bleu)
  for (const tile of allowedTiles) {
    const worldPos = map.tileToWorldXY(
      tile.x,
      tile.y,
      undefined,
      undefined,
      groundLayer
    );
    const cx = worldPos.x + map.tileWidth / 2;
    const cy = worldPos.y + map.tileHeight / 2;

    const g = scene.add.graphics();
    g.lineStyle(2, 0x2a9df4, 1);
    g.fillStyle(0x2a9df4, 0.7);
    const base =
      typeof scene.maxGroundDepth === "number" ? scene.maxGroundDepth : 1;
    g.setDepth(base + 0.25);

    const points = [
      new Phaser.Math.Vector2(cx, cy - halfH),
      new Phaser.Math.Vector2(cx + halfW, cy),
      new Phaser.Math.Vector2(cx, cy + halfH),
      new Phaser.Math.Vector2(cx - halfW, cy),
    ];

    g.fillPoints(points, true);
    g.strokePoints(points, true);

    if (scene.hudCamera) {
      scene.hudCamera.ignore(g);
    }

    highlights.push(g);
  }

  // Surbrillance des cases "cible" ennemies (rouge)
  for (const tile of enemyTiles) {
    const worldPos = map.tileToWorldXY(
      tile.x,
      tile.y,
      undefined,
      undefined,
      groundLayer
    );
    const cx = worldPos.x + map.tileWidth / 2;
    const cy = worldPos.y + map.tileHeight / 2;

    const g = scene.add.graphics();
    g.lineStyle(2, 0xff4444, 1);
    g.fillStyle(0xff4444, 0.7);
    const base =
      typeof scene.maxGroundDepth === "number" ? scene.maxGroundDepth : 1;
    g.setDepth(base + 0.25);

    const points = [
      new Phaser.Math.Vector2(cx, cy - halfH),
      new Phaser.Math.Vector2(cx + halfW, cy),
      new Phaser.Math.Vector2(cx, cy + halfH),
      new Phaser.Math.Vector2(cx - halfW, cy),
    ];

    g.fillPoints(points, true);
    g.strokePoints(points, true);

    if (scene.hudCamera) {
      scene.hudCamera.ignore(g);
    }

    highlights.push(g);
  }

  scene.prepState = {
    actif: true,
    joueur: player,
    monstre: monster,
    allowedTiles,
    enemyTiles,
    highlights,
  };

  // Challenge : tirage dès la préparation pour que le joueur puisse se placer en conséquence.
  initPrepChallenge(scene, scene.prepState, player);

  document.body.classList.add("combat-prep");

  // Rafraîchit l'UI (y compris le badge challenge) dès l'entrée en préparation.
  if (scene && typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }
}

// Termine la phase de préparation et démarre réellement le combat.
export function startCombatFromPrep(scene) {
  const prep = scene.prepState;
  if (!prep || !prep.actif) {
    return;
  }

  // Nettoyage des surbrillances
  if (prep.highlights) {
    prep.highlights.forEach((g) => g.destroy());
  }

  scene.prepState = null;
  document.body.classList.remove("combat-prep");

  startCombat(scene, prep.joueur, prep.monstre);
}
