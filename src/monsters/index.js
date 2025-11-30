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

  // Corbeau : au-dessus du centre
  const monsterOffsetTilesY = -3;
  const corbeauTileX = centerTileX;
  const corbeauTileY = centerTileY + monsterOffsetTilesY;

  const corbeauWorld = map.tileToWorldXY(
    corbeauTileX,
    corbeauTileY,
    undefined,
    undefined,
    groundLayer
  );

  const corbeauX = corbeauWorld.x + map.tileWidth / 2;
  const corbeauY = corbeauWorld.y + map.tileHeight / 2;

  const corbeau = createMonster(scene, corbeauX, corbeauY, "corbeau");
  corbeau.tileX = corbeauTileX;
  corbeau.tileY = corbeauTileY;
  scene.monsters.push(corbeau);

  // Nouveau monstre : Aluineeks, légèrement décalé sur la droite
  const aluineeksTileX = centerTileX + 3;
  const aluineeksTileY = centerTileY + monsterOffsetTilesY;

  const aluineeksWorld = map.tileToWorldXY(
    aluineeksTileX,
    aluineeksTileY,
    undefined,
    undefined,
    groundLayer
  );

  const aluineeksX = aluineeksWorld.x + map.tileWidth / 2;
  const aluineeksY = aluineeksWorld.y + map.tileHeight / 2;

  const aluineeks = createMonster(scene, aluineeksX, aluineeksY, "aluineeks");
  aluineeks.tileX = aluineeksTileX;
  aluineeks.tileY = aluineeksTileY;
  scene.monsters.push(aluineeks);
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
