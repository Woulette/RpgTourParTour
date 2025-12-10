import { monsters } from "../config/monsters.js";
import { createMonster } from "../entities/monster.js";

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
    const groupSize =
      typeof spawn.groupSize === "number" && spawn.groupSize > 0
        ? spawn.groupSize
        : 1;

    const monster = createMonster(scene, x, y, type);
    monster.tileX = tileX;
    monster.tileY = tileY;
    monster.groupId = `${type}_group_${nextGroupId}`;
    monster.groupSize = groupSize;

    scene.monsters.push(monster);
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
