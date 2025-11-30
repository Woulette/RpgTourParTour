import { monsters } from "../config/monsters.js";
import { createMonster } from "../entities/monster.js";

// Précharge toutes les textures de monstres déclarées dans la config
export function preloadMonsters(scene) {
  Object.values(monsters).forEach((m) => {
    scene.load.image(m.textureKey, m.spritePath);
  });
}

// Pour l'instant : on place plusieurs groupes de corbeaux autour du centre
// et un Aluineeks un peu plus loin. Plus tard, on pourra lire un calque
// "Monstres" dans Tiled ici.
export function spawnInitialMonsters(
  scene,
  map,
  groundLayer,
  centerTileX,
  centerTileY
) {
  scene.monsters = scene.monsters || [];

  const monsterOffsetTilesY = -3;

  // --- Groupes de corbeaux ---
  // On crée 4 "packs" visibles : 1, 2, 3 et 4 corbeaux.
  // Visuellement : 1 sprite par pack, mais chaque pack
  // a une taille (groupSize) et une XP totale différente.
  const corbeauGroups = [
    { size: 1, tileX: centerTileX - 4, tileY: centerTileY + monsterOffsetTilesY },
    { size: 2, tileX: centerTileX - 1, tileY: centerTileY + monsterOffsetTilesY },
    { size: 3, tileX: centerTileX + 2, tileY: centerTileY + monsterOffsetTilesY },
    { size: 4, tileX: centerTileX + 5, tileY: centerTileY + monsterOffsetTilesY },
  ];

  let nextGroupId = 1;

  corbeauGroups.forEach((group) => {
    const { size, tileX, tileY } = group;

    const worldPos = map.tileToWorldXY(
      tileX,
      tileY,
      undefined,
      undefined,
      groundLayer
    );

    const x = worldPos.x + map.tileWidth / 2;
    const y = worldPos.y + map.tileHeight / 2;

    const corbeau = createMonster(scene, x, y, "corbeau");
    corbeau.tileX = tileX;
    corbeau.tileY = tileY;
    corbeau.groupId = `corbeau_group_${nextGroupId}`;
    corbeau.groupSize = size;

    // XP du pack = taille du pack * XP d'un corbeau solo
    const baseXp = monsters.corbeau?.xpReward ?? 0;
    corbeau.xpReward = baseXp * size;

    scene.monsters.push(corbeau);
    nextGroupId += 1;
  });

  // --- Aluineeks de test ---
  const aluineeksTileX = centerTileX + 8;
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
  aluineeks.groupId = "aluineeks_group_1";
  aluineeks.groupSize = 1;
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
