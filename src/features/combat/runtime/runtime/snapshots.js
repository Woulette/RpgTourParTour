import { createMonster } from "../../../../entities/monster.js";

function getWorldMapAndLayer(scene) {
  const map = scene?.map || scene?.combatMap || null;
  const layer = scene?.groundLayer || scene?.combatGroundLayer || null;
  return { map, layer };
}

export function snapshotMonsterForWorld(scene, monster) {
  if (!scene || !monster) return null;

  const fromPrep = monster._worldSnapshotBeforeCombat;
  if (fromPrep && typeof fromPrep === "object") {
    return { ...fromPrep };
  }

  const stats = monster.stats || {};
  return {
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

export function restoreWorldMonsterFromSnapshot(scene, snapshot, fallbackRef) {
  if (!scene || !snapshot || !snapshot.monsterId) return;

  const { map, layer } = getWorldMapAndLayer(scene);
  const tileX = snapshot.tileX;
  const tileY = snapshot.tileY;

  const isValidTile =
    typeof tileX === "number" &&
    typeof tileY === "number" &&
    map &&
    layer &&
    tileX >= 0 &&
    tileY >= 0 &&
    tileX < map.width &&
    tileY < map.height;

  const ensurePos = (m) => {
    if (!m) return;
    if (typeof tileX === "number") m.tileX = tileX;
    if (typeof tileY === "number") m.tileY = tileY;

    if (isValidTile && typeof map.tileToWorldXY === "function") {
      const wp = map.tileToWorldXY(tileX, tileY, undefined, undefined, layer);
      const offX = typeof m.renderOffsetX === "number" ? m.renderOffsetX : 0;
      const offY = typeof m.renderOffsetY === "number" ? m.renderOffsetY : 0;
      m.x = wp.x + map.tileWidth / 2 + offX;
      m.y = wp.y + map.tileHeight + offY;
    } else if (typeof snapshot.x === "number" && typeof snapshot.y === "number") {
      m.x = snapshot.x;
      m.y = snapshot.y;
    }

    m.setVisible?.(true);
    m.setInteractive?.({ useHandCursor: true });
  };

  const inScene =
    fallbackRef && Array.isArray(scene.monsters)
      ? scene.monsters.includes(fallbackRef)
      : false;
  const canReuse =
    inScene &&
    !fallbackRef.destroyed &&
    typeof fallbackRef.monsterId === "string" &&
    fallbackRef.monsterId === snapshot.monsterId;

  if (canReuse) {
    fallbackRef.isCombatMember = false;
    fallbackRef.respawnEnabled =
      snapshot.respawnEnabled === undefined ? true : !!snapshot.respawnEnabled;
    fallbackRef.spawnMapKey = snapshot.spawnMapKey ?? scene.currentMapKey ?? null;
    if (snapshot.respawnTemplate && typeof snapshot.respawnTemplate === "object") {
      fallbackRef.respawnTemplate = {
        groupPool: Array.isArray(snapshot.respawnTemplate.groupPool)
          ? snapshot.respawnTemplate.groupPool.slice()
          : null,
        groupSizeMin: snapshot.respawnTemplate.groupSizeMin ?? null,
        groupSizeMax: snapshot.respawnTemplate.groupSizeMax ?? null,
        forceMixedGroup: snapshot.respawnTemplate.forceMixedGroup === true,
      };
    }
    if (typeof snapshot.level === "number") fallbackRef.level = snapshot.level;
    if (snapshot.groupId != null) fallbackRef.groupId = snapshot.groupId;
    if (typeof snapshot.groupSize === "number") fallbackRef.groupSize = snapshot.groupSize;
    if (Array.isArray(snapshot.groupLevels)) fallbackRef.groupLevels = snapshot.groupLevels.slice();
    if (Array.isArray(snapshot.groupMonsterIds))
      fallbackRef.groupMonsterIds = snapshot.groupMonsterIds.slice();
    if (typeof snapshot.groupLevelTotal === "number")
      fallbackRef.groupLevelTotal = snapshot.groupLevelTotal;

    fallbackRef.stats = fallbackRef.stats || {};
    if (typeof snapshot.hpMax === "number") fallbackRef.stats.hpMax = snapshot.hpMax;
    const hpToSet =
      typeof snapshot.hp === "number"
        ? snapshot.hp
        : typeof snapshot.hpMax === "number"
        ? snapshot.hpMax
        : null;
    if (typeof hpToSet === "number") fallbackRef.stats.hp = hpToSet;

    ensurePos(fallbackRef);
    delete fallbackRef._worldSnapshotBeforeCombat;
    return;
  }

  let spawnX = snapshot.x;
  let spawnY = snapshot.y;
  if (isValidTile && typeof map.tileToWorldXY === "function") {
    const wp = map.tileToWorldXY(tileX, tileY, undefined, undefined, layer);
    spawnX = wp.x + map.tileWidth / 2;
    spawnY = wp.y + map.tileHeight;
  }

  if (typeof spawnX !== "number" || typeof spawnY !== "number") return;

  const recreated = createMonster(scene, spawnX, spawnY, snapshot.monsterId, snapshot.level);
  recreated.isCombatMember = false;
  recreated.respawnEnabled =
    snapshot.respawnEnabled === undefined ? true : !!snapshot.respawnEnabled;
  recreated.spawnMapKey = snapshot.spawnMapKey ?? scene.currentMapKey ?? null;
  if (snapshot.respawnTemplate && typeof snapshot.respawnTemplate === "object") {
    recreated.respawnTemplate = {
      groupPool: Array.isArray(snapshot.respawnTemplate.groupPool)
        ? snapshot.respawnTemplate.groupPool.slice()
        : null,
      groupSizeMin: snapshot.respawnTemplate.groupSizeMin ?? null,
      groupSizeMax: snapshot.respawnTemplate.groupSizeMax ?? null,
      forceMixedGroup: snapshot.respawnTemplate.forceMixedGroup === true,
    };
  }
  if (typeof snapshot.level === "number") recreated.level = snapshot.level;
  if (snapshot.groupId != null) recreated.groupId = snapshot.groupId;
  if (typeof snapshot.groupSize === "number") recreated.groupSize = snapshot.groupSize;
  if (Array.isArray(snapshot.groupLevels)) recreated.groupLevels = snapshot.groupLevels.slice();
  if (Array.isArray(snapshot.groupMonsterIds))
    recreated.groupMonsterIds = snapshot.groupMonsterIds.slice();
  if (typeof snapshot.groupLevelTotal === "number")
    recreated.groupLevelTotal = snapshot.groupLevelTotal;

  recreated.stats = recreated.stats || {};
  if (typeof snapshot.hpMax === "number") recreated.stats.hpMax = snapshot.hpMax;
  const hpToSet =
    typeof snapshot.hp === "number"
      ? snapshot.hp
      : typeof snapshot.hpMax === "number"
      ? snapshot.hpMax
      : null;
  if (typeof hpToSet === "number") recreated.stats.hp = hpToSet;

  ensurePos(recreated);
  scene.monsters = scene.monsters || [];
  scene.monsters.push(recreated);
}
