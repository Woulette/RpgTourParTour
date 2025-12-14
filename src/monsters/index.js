import { monsters } from "../config/monsters.js";
import { createMonster } from "../entities/monster.js";
import { isTileBlocked } from "../collision/collisionGrid.js";

// Précharge toutes les textures de monstres déclarées dans la config
export function preloadMonsters(scene) {
  Object.values(monsters).forEach((m) => {
    scene.load.image(m.textureKey, m.spritePath);
  });
}

// Place les monstres déclarés dans la définition de la map (mapDef.monsterSpawns).
// Chaque map fournit sa propre liste : pas de partage implicite entre maps.
export function spawnInitialMonsters(
  scene,
  map,
  groundLayer,
  centerTileX,
  centerTileY,
  mapDef
) {
  scene.monsters = scene.monsters || [];

  const spawnDefs =
    (mapDef && Array.isArray(mapDef.monsterSpawns) && mapDef.monsterSpawns) ||
    [];

  if (spawnDefs.length === 0) return;

  let nextGroupId = 1;

  spawnDefs.forEach((spawn) => {
    if (!spawn) return;

    let tileX = null;
    let tileY = null;

    if (typeof spawn.tileX === "number" && typeof spawn.tileY === "number") {
      tileX = spawn.tileX;
      tileY = spawn.tileY;
    } else if (spawn.offsetFromCenter) {
      const { x: dx = 0, y: dy = 0 } = spawn.offsetFromCenter || {};
      tileX = centerTileX + dx;
      tileY = centerTileY + dy;
    }

    if (
      tileX === null ||
      tileY === null ||
      tileX < 0 ||
      tileY < 0 ||
      tileX >= map.width ||
      tileY >= map.height
    ) {
      return;
    }

    const worldPos = map.tileToWorldXY(
      tileX,
      tileY,
      undefined,
      undefined,
      groundLayer
    );

    const x = worldPos.x + map.tileWidth / 2;
    const y = worldPos.y + map.tileHeight / 2;

    const type = spawn.type || "corbeau";
    const monster = createMonster(scene, x, y, type);
    // Taille de groupe aléatoire 1..4 pour le combat
    monster.groupSize = Phaser.Math.Between(1, 4);
    // Niveaux individuels aléatoires pour les membres du groupe
    monster.groupLevels = Array.from(
      { length: monster.groupSize },
      () => Phaser.Math.Between(1, 4)
    );
    // Le leader hérite du premier niveau
    monster.level = monster.groupLevels[0];
    monster.groupLevelTotal = monster.groupLevels.reduce(
      (sum, lvl) => sum + lvl,
      0
    );
    monster.tileX = tileX;
    monster.tileY = tileY;
    scene.monsters.push(monster);
    startMonsterRoaming(scene, map, groundLayer, monster);
    nextGroupId += 1;
  });
}

// Cherche un monstre exactement sur une tuile donnée
export function findMonsterAtTile(scene, tileX, tileY) {
  // En combat, on ne doit considérer que les monstres
  // engagés dans le combat courant, jamais les monstres "monde".
  const list =
    (scene.combatMonsters && Array.isArray(scene.combatMonsters)
      ? scene.combatMonsters
      : scene.monsters || []);
  return (
    list.find(
      (m) =>
        typeof m.tileX === "number" &&
        typeof m.tileY === "number" &&
        m.tileX === tileX &&
        m.tileY === tileY
    ) || null
  );
}

function startMonsterRoaming(scene, map, groundLayer, monster) {
  if (!scene?.time || !map || !groundLayer || !monster) return;
  // Nettoie un ancien timer si respawn
  if (monster.roamTimer?.remove) {
    monster.roamTimer.remove(false);
  }

  const scheduleNext = () => {
    const delayMs = Phaser.Math.Between(8000, 25000);
    monster.roamTimer = scene.time.addEvent({
      delay: delayMs,
      loop: false,
      callback: () => {
        if (!monster.active || monster.isMoving || scene.combatState?.enCours) {
          scheduleNext();
          return;
        }
        const pathSteps = pickRoamPath(scene, map, monster);
        if (!pathSteps || pathSteps.length === 0) {
          scheduleNext();
          return;
        }

        monster.isMoving = true;
        const finalStep = pathSteps[pathSteps.length - 1];
        monster.targetTileX = finalStep.x;
        monster.targetTileY = finalStep.y;
        tweenAlongPath(scene, monster, map, groundLayer, pathSteps, () => {
          monster.targetTileX = null;
          monster.targetTileY = null;
          monster.isMoving = false;
          scheduleNext();
        });
      },
    });
  };

  scheduleNext();
}

function pickRoamPath(scene, map, monster) {
  const maxRange = 4;
  const start = {
    x: monster.tileX ?? 0,
    y: monster.tileY ?? 0,
  };

  // Choisit une cible accessible dans un rayon.
  const target = pickRandomTargetTile(scene, map, monster, start, maxRange);
  if (!target) return null;

  const path = findPathAvoidingBlocks(scene, map, start, target, 64);
  if (!path || path.length < 2) return null;
  const stepCount = Phaser.Math.Between(1, 4);
  const lastIdx = Math.min(stepCount, path.length - 1);
  return path.slice(1, lastIdx + 1);
}

function pickRandomTargetTile(scene, map, monster, start, maxRange) {
  const attempts = 8;
  for (let i = 0; i < attempts; i += 1) {
    // Pas de diagonales : on tire un axe puis un delta
    const axes = [
      { dx: Phaser.Math.Between(1, maxRange), dy: 0 },
      { dx: -Phaser.Math.Between(1, maxRange), dy: 0 },
      { dx: 0, dy: Phaser.Math.Between(1, maxRange) },
      { dx: 0, dy: -Phaser.Math.Between(1, maxRange) },
    ];
    const choice = Phaser.Utils.Array.GetRandom(axes);
    const dx = choice.dx;
    const dy = choice.dy;
    const tx = start.x + dx;
    const ty = start.y + dy;
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
    if (isTileBlocked(scene, tx, ty)) continue;
    if (isTileOccupied(scene, monster, tx, ty)) continue;
    return { x: tx, y: ty };
  }
  return null;
}

function findPathAvoidingBlocks(scene, map, start, target, maxNodes = 64) {
  const queue = [];
  const visited = new Set();
  const parent = new Map();
  const key = (x, y) => `${x},${y}`;

  queue.push(start);
  visited.add(key(start.x, start.y));

  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  let nodes = 0;
  while (queue.length > 0 && nodes < maxNodes) {
    const cur = queue.shift();
    nodes += 1;

    if (cur.x === target.x && cur.y === target.y) {
      // Reconstruit le chemin
      const path = [];
      let k = key(cur.x, cur.y);
      let p = cur;
      while (p) {
        path.unshift(p);
        const parentKey = parent.get(k);
        if (!parentKey) break;
        p = parentKey.node;
        k = parentKey.key;
      }
      return path;
    }

    for (const dir of dirs) {
      const nx = cur.x + dir.dx;
      const ny = cur.y + dir.dy;
      const k = key(nx, ny);
      if (visited.has(k)) continue;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      if (isTileBlocked(scene, nx, ny)) continue;
      if (isTileOccupied(scene, null, nx, ny)) continue;
      visited.add(k);
      parent.set(k, { node: cur, key: key(cur.x, cur.y) });
      queue.push({ x: nx, y: ny });
    }
  }

  return null;
}

function tweenAlongPath(scene, monster, map, groundLayer, steps, onComplete) {
  // Si le monstre ou sa scene ne sont plus valides (changement de map, destruction),
  // on abandonne proprement pour éviter les erreurs.
  if (!monster || !monster.scene || !monster.scene.tweens) {
    if (onComplete) onComplete();
    return;
  }
  if (!steps || steps.length === 0) {
    if (onComplete) onComplete();
    return;
  }
  const next = steps[0];
  const wp = map.tileToWorldXY(next.x, next.y, undefined, undefined, groundLayer);
  if (!wp) {
    if (onComplete) onComplete();
    return;
  }
  const targetX = wp.x + map.tileWidth / 2;
  const targetY = wp.y + map.tileHeight / 2;

  monster.scene.tweens.add({
    targets: monster,
    x: targetX,
    y: targetY,
    duration: 550,
    ease: "Linear",
    onComplete: () => {
      monster.tileX = next.x;
      monster.tileY = next.y;
      if (steps.length > 1) {
        tweenAlongPath(scene, monster, map, groundLayer, steps.slice(1), onComplete);
      } else if (onComplete) {
        onComplete();
      }
    },
    onStop: () => {
      if (onComplete) onComplete();
    },
  });
}

function isTileOccupied(scene, selfMonster, tileX, tileY) {
  return (scene.monsters || []).some(
    (m) =>
      m !== selfMonster &&
      m.active &&
      typeof m.tileX === "number" &&
      typeof m.tileY === "number" &&
      // prend en compte la tuile rÃ©servÃ©e pendant le dÃ©placement
      ((typeof m.targetTileX === "number" &&
        typeof m.targetTileY === "number" &&
        m.targetTileX === tileX &&
        m.targetTileY === tileY) ||
        (m.tileX === tileX && m.tileY === tileY))
  );
}
