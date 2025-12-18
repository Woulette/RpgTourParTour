import { monsters } from "../config/monsters.js";
import { createMonster } from "../entities/monster.js";
import { isTileBlocked } from "../collision/collisionGrid.js";
import { getRespawnsForMap, setRespawnsForMap } from "./respawnState.js";

// Précharge toutes les textures de monstres déclarées dans la config
export function preloadMonsters(scene) {
  Object.values(monsters).forEach((m) => {
    if (!m || !m.textureKey || !m.spritePath) return;
    scene.load.image(m.textureKey, m.spritePath);
  });
}

export function processPendingRespawnsForCurrentMap(scene) {
  if (!scene || !scene.map || !scene.groundLayer) return;
  const mapKey =
    scene.currentMapKey || (scene.currentMapDef && scene.currentMapDef.key);
  if (!mapKey) return;
  // Pendant un combat ou la préparation, on ne fait pas respawn (évite des interactions UI/clics).
  if (scene.combatState?.enCours || scene.prepState?.actif) return;

  const now = Date.now();
  const list = getRespawnsForMap(scene, mapKey);
  if (!Array.isArray(list) || list.length === 0) return;

  const remaining = [];

  list.forEach((entry) => {
    if (!entry || entry.mapKey !== mapKey) return;
    // Dungeon: ignore respawns from previous runs.
    if (scene.currentMapDef?.isDungeon) {
      const currentRunId = scene.dungeonState?.runId ?? null;
      const entryRunId = entry.dungeonRunId ?? null;
      if (currentRunId && entryRunId && entryRunId !== currentRunId) {
        return;
      }
      if (currentRunId && !entryRunId) {
        // Old entries created before runId support
        return;
      }
    }
    if (typeof entry.atTime === "number" && entry.atTime > now) {
      remaining.push(entry);
      return;
    }

    const tileX = entry.tileX;
    const tileY = entry.tileY;
    if (
      typeof tileX !== "number" ||
      typeof tileY !== "number" ||
      tileX < 0 ||
      tileY < 0 ||
      tileX >= scene.map.width ||
      tileY >= scene.map.height
    ) {
      return;
    }

    // If something currently occupies that tile, postpone.
    const occupied = (scene.monsters || []).some(
      (m) => m && m.active && m.tileX === tileX && m.tileY === tileY
    );
    if (occupied) {
      remaining.push({ ...entry, atTime: now + 1500 });
      return;
    }

    const def = monsters[entry.monsterId] || null;
    const offX =
      def && def.render && typeof def.render.offsetX === "number"
        ? def.render.offsetX
        : 0;
    const offY =
      def && def.render && typeof def.render.offsetY === "number"
        ? def.render.offsetY
        : 0;

    const wp = scene.map.tileToWorldXY(
      tileX,
      tileY,
      undefined,
      undefined,
      scene.groundLayer
    );
    const x = wp.x + scene.map.tileWidth / 2 + offX;
    const y = wp.y + scene.map.tileHeight + offY;

    const monster = createMonster(scene, x, y, entry.monsterId);
    monster.tileX = tileX;
    monster.tileY = tileY;
    monster.spawnMapKey = mapKey;

    // Respawn "template" : reroll la composition/tailles à chaque respawn.
    if (entry.respawnTemplate && typeof entry.respawnTemplate === "object") {
      const tpl = entry.respawnTemplate;
      const pool = Array.isArray(tpl.groupPool) ? tpl.groupPool.filter(Boolean) : [];
      const sizeMin =
        typeof tpl.groupSizeMin === "number" && tpl.groupSizeMin > 0
          ? Math.round(tpl.groupSizeMin)
          : 1;
      const sizeMax =
        typeof tpl.groupSizeMax === "number" && tpl.groupSizeMax > 0
          ? Math.round(tpl.groupSizeMax)
          : Math.max(1, sizeMin);

      if (pool.length > 0) {
        const leaderId = Phaser.Utils.Array.GetRandom(pool);
        const desiredGroupSize = Phaser.Math.Between(
          Math.min(sizeMin, sizeMax),
          Math.max(sizeMin, sizeMax)
        );

        // Le leader affiché en monde doit correspondre au monstre créé.
        if (leaderId !== monster.monsterId) {
          const leaderDef = monsters[leaderId];
          if (leaderDef) {
            monster.monsterId = leaderId;
            monster.classId = leaderId;
            if (monster.setTexture) {
              monster.setTexture(leaderDef.textureKey);
            }
          }
        }

        monster.groupSize = Math.max(1, desiredGroupSize);
        const groupMonsterIds = Array.from(
          { length: monster.groupSize },
          () => Phaser.Utils.Array.GetRandom(pool)
        );
        groupMonsterIds[0] = monster.monsterId;

        if (tpl.forceMixedGroup === true && monster.groupSize > 1) {
          const hasDistinct = new Set(groupMonsterIds).size > 1;
          if (!hasDistinct && pool.length > 1) {
            const alternatives = pool.filter((id) => id !== monster.monsterId);
            if (alternatives.length > 0) {
              groupMonsterIds[1] = Phaser.Utils.Array.GetRandom(alternatives);
            }
          }
        }

        monster.groupMonsterIds = groupMonsterIds;
        monster.groupLevels = Array.from({ length: monster.groupSize }, () =>
          Phaser.Math.Between(1, 4)
        );
        monster.level = monster.groupLevels[0];
        monster.groupLevelTotal = monster.groupLevels.reduce((s, v) => s + v, 0);
        monster.respawnTemplate = { ...tpl, groupPool: pool.slice() };
      }

      scene.monsters = scene.monsters || [];
      scene.monsters.push(monster);
      startMonsterRoaming(scene, scene.map, scene.groundLayer, monster);
      return;
    }

    if (typeof entry.groupSize === "number") {
      monster.groupSize = entry.groupSize;
    }
    if (Array.isArray(entry.groupLevels) && entry.groupLevels.length > 0) {
      monster.groupLevels = entry.groupLevels.slice();
      monster.level = entry.groupLevels[0];
      monster.groupLevelTotal = entry.groupLevels.reduce((s, v) => s + v, 0);
    } else if (typeof entry.level === "number") {
      monster.level = entry.level;
    }

    if (Array.isArray(entry.groupMonsterIds) && entry.groupMonsterIds.length > 0) {
      monster.groupMonsterIds = entry.groupMonsterIds.slice();
      monster.groupSize = entry.groupMonsterIds.length;
    }

    scene.monsters = scene.monsters || [];
    scene.monsters.push(monster);
    startMonsterRoaming(scene, scene.map, scene.groundLayer, monster);
  });

  setRespawnsForMap(scene, mapKey, remaining);
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

    const pool = Array.isArray(spawn.groupPool) ? spawn.groupPool.filter(Boolean) : [];

    // Composition explicite du groupe (ex: { liburion: 1, goush: { min: 1, max: 3 } })
    const counts = spawn.groupCounts && typeof spawn.groupCounts === "object" ? spawn.groupCounts : null;
    const groupMonsterIdsFromCounts = (() => {
      if (!counts) return null;
      const ids = [];
      Object.entries(counts).forEach(([monsterId, def]) => {
        if (!monsterId) return;
        let n = 0;
        if (typeof def === "number") {
          n = Math.max(0, Math.round(def));
        } else if (def && typeof def === "object") {
          const min = typeof def.min === "number" ? Math.round(def.min) : 0;
          const max = typeof def.max === "number" ? Math.round(def.max) : min;
          n = Phaser.Math.Between(Math.min(min, max), Math.max(min, max));
        }
        for (let i = 0; i < n; i += 1) ids.push(monsterId);
      });
      return ids.length > 0 ? ids : null;
    })();

    const type = (() => {
      if (spawn.type) return spawn.type;
      if (Array.isArray(groupMonsterIdsFromCounts) && groupMonsterIdsFromCounts[0]) {
        return groupMonsterIdsFromCounts[0];
      }
      if (pool.length > 0) return Phaser.Utils.Array.GetRandom(pool);
      return "corbeau";
    })();
    const def = monsters[type] || null;
    const offX =
      def && def.render && typeof def.render.offsetX === "number"
        ? def.render.offsetX
        : 0;
    const offY =
      def && def.render && typeof def.render.offsetY === "number"
        ? def.render.offsetY
        : 0;

    const x = worldPos.x + map.tileWidth / 2 + offX;
    const y = worldPos.y + map.tileHeight + offY;

    const monster = createMonster(scene, x, y, type);
    // Taille de groupe aléatoire 1..4 pour le combat
    const sizeMin =
      typeof spawn.groupSizeMin === "number" && spawn.groupSizeMin > 0
        ? Math.round(spawn.groupSizeMin)
        : 1;
    const sizeMax =
      typeof spawn.groupSizeMax === "number" && spawn.groupSizeMax > 0
        ? Math.round(spawn.groupSizeMax)
        : typeof spawn.groupSize === "number" && spawn.groupSize > 0
          ? Math.round(spawn.groupSize)
          : 4;
    const desiredGroupSize = Phaser.Math.Between(
      Math.min(sizeMin, sizeMax),
      Math.max(sizeMin, sizeMax)
    );
    monster.groupSize = Math.max(1, desiredGroupSize);
    // Niveaux individuels aléatoires pour les membres du groupe
    if (Array.isArray(groupMonsterIdsFromCounts) && groupMonsterIdsFromCounts.length > 0) {
      // Shuffle for randomness, then force leader's id to match the displayed sprite.
      const shuffled = Phaser.Utils.Array.Shuffle(groupMonsterIdsFromCounts.slice());
      const idx = shuffled.findIndex((id) => id === type);
      if (idx > 0) {
        const tmp = shuffled[0];
        shuffled[0] = shuffled[idx];
        shuffled[idx] = tmp;
      }
      monster.groupMonsterIds = shuffled;
      monster.groupSize = shuffled.length;
    } else if (pool.length > 0) {
      const groupMonsterIds = Array.from(
        { length: monster.groupSize },
        () => Phaser.Utils.Array.GetRandom(pool)
      );
      groupMonsterIds[0] = type; // leader = sprite monde

      // Optionnel : force un minimum de mixitÇ¸ si possible (au moins 2 types diffÇ¸rents).
      if (spawn.forceMixedGroup === true && monster.groupSize > 1) {
        const hasDistinct = new Set(groupMonsterIds).size > 1;
        if (!hasDistinct && pool.length > 1) {
          const alternatives = pool.filter((id) => id !== type);
          if (alternatives.length > 0) {
            groupMonsterIds[1] = Phaser.Utils.Array.GetRandom(alternatives);
          }
        }
      }

      monster.groupMonsterIds = groupMonsterIds;
    } else {
      monster.groupMonsterIds = Array.from({ length: monster.groupSize }, () => type);
    }

    monster.groupLevels = Array.from({ length: monster.groupSize }, () =>
      Phaser.Math.Between(1, 4)
    );

    if (pool.length > 0) {
      monster.respawnTemplate = {
        groupPool: pool.slice(),
        groupSizeMin: sizeMin,
        groupSizeMax: sizeMax,
        forceMixedGroup: spawn.forceMixedGroup === true,
      };
    }
    // Le leader hérite du premier niveau
    monster.level = monster.groupLevels[0];
    monster.groupLevelTotal = monster.groupLevels.reduce(
      (sum, lvl) => sum + lvl,
      0
    );
    monster.tileX = tileX;
    monster.tileY = tileY;
    monster.groupId = nextGroupId;
    monster.spawnMapKey = mapDef?.key || scene.currentMapKey || null;
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
        if (
          !monster.active ||
          monster.isMoving ||
          scene.combatState?.enCours ||
          scene.prepState?.actif
        ) {
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
  const offX = typeof monster.renderOffsetX === "number" ? monster.renderOffsetX : 0;
  const offY = typeof monster.renderOffsetY === "number" ? monster.renderOffsetY : 0;
  const targetX = wp.x + map.tileWidth / 2 + offX;
  const targetY = wp.y + map.tileHeight + offY;

  monster.roamTween = monster.scene.tweens.add({
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
