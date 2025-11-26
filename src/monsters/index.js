import { monsters } from "../config/monsters.js";
import { createMonster } from "../entities/monster.js";

// Précharge toutes les textures de monstres déclarées dans la config
export function preloadMonsters(scene) {
  Object.values(monsters).forEach((m) => {
    scene.load.image(m.textureKey, m.spritePath);
  });
}

// Pour l'instant : spawn d'un corbeau de test au-dessus du centre de la map
// Plus tard, on pourra lire un calque "Monstres" dans Tiled ici.
export function spawnInitialMonsters(
  scene,
  map,
  groundLayer,
  centerTileX,
  centerTileY
) {
  scene.monsters = scene.monsters || [];

  const monsterOffsetTilesY = -3;
  const monsterTileX = centerTileX;
  const monsterTileY = centerTileY + monsterOffsetTilesY;

  const monsterWorld = map.tileToWorldXY(
    monsterTileX,
    monsterTileY,
    undefined,
    undefined,
    groundLayer
  );

  const monsterX = monsterWorld.x + map.tileWidth / 2;
  const monsterY = monsterWorld.y + map.tileHeight / 2;

  const corbeau = createMonster(scene, monsterX, monsterY, "corbeau");
  corbeau.tileX = monsterTileX;
  corbeau.tileY = monsterTileY;
  scene.monsters.push(corbeau);
}

// Cherche un monstre exactement sur une tuile donnée
export function findMonsterAtTile(scene, tileX, tileY) {
  const list = scene.monsters || [];
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
