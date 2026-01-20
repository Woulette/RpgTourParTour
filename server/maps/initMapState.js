const fs = require("fs");
const path = require("path");

const TREE_RESOURCE_KIND = "tree";
const HERB_RESOURCE_KIND = "herb";
const WELL_RESOURCE_KIND = "well";

const TREE_REGROW_DURATION_MS = 30000;
const HERB_REGROW_DURATION_MS = 25000;
const WELL_COOLDOWN_MS = 60000;

const mapJsonCache = new Map();

function resolveMapDef(mapId, maps) {
  if (!mapId || !maps) return null;
  if (maps[mapId]) return maps[mapId];
  const target = String(mapId);
  const entries = Object.values(maps);
  for (const def of entries) {
    if (!def || !def.jsonPath) continue;
    const base = path.basename(def.jsonPath, ".json");
    if (base === target) return def;
    if (def.key === target) return def;
  }
  return null;
}

function buildGroundTileInfo(mapJson, mapDef) {
  if (!mapJson || !Array.isArray(mapJson.layers)) return null;
  const targetName = mapDef?.groundLayerName ? String(mapDef.groundLayerName) : null;
  let groundLayer = null;
  if (targetName) {
    groundLayer = mapJson.layers.find(
      (layer) => layer && layer.type === "tilelayer" && layer.name === targetName
    );
  }
  if (!groundLayer) {
    groundLayer = mapJson.layers.find((layer) => layer && layer.type === "tilelayer") || null;
  }
  if (!groundLayer || !Array.isArray(groundLayer.data)) return null;

  const width = Number.isFinite(groundLayer.width)
    ? groundLayer.width
    : Number.isFinite(mapJson.width)
      ? mapJson.width
      : null;
  const height = Number.isFinite(groundLayer.height)
    ? groundLayer.height
    : Number.isFinite(mapJson.height)
      ? mapJson.height
      : null;
  if (!width || !height) return null;

  const tiles = new Set();
  let minX = width - 1;
  let maxX = 0;
  let minY = height - 1;
  let maxY = 0;
  let found = false;

  groundLayer.data.forEach((gid, index) => {
    if (!Number.isFinite(gid) || gid <= 0) return;
    const x = index % width;
    const y = Math.floor(index / width);
    tiles.add(`${x},${y}`);
    found = true;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });

  if (!found) return null;
  return {
    tiles,
    bounds: { minX, maxX, minY, maxY },
  };
}

function loadMapJson(mapDef, projectRoot) {
  if (!mapDef?.jsonPath || !projectRoot) return null;
  const cacheKey = mapDef.key || mapDef.jsonPath;
  if (mapJsonCache.has(cacheKey)) return mapJsonCache.get(cacheKey);
  const jsonPath = path.resolve(projectRoot, mapDef.jsonPath);
  if (!fs.existsSync(jsonPath)) return null;
  try {
    const raw = fs.readFileSync(jsonPath, "utf8");
    const parsed = JSON.parse(raw);
    mapJsonCache.set(cacheKey, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function extractCollisionKeys(mapJson) {
  if (!mapJson || !Array.isArray(mapJson.layers)) return new Set();
  const keys = new Set();
  const width = Number.isFinite(mapJson.width) ? mapJson.width : null;
  const height = Number.isFinite(mapJson.height) ? mapJson.height : null;
  const tileWidth = Number.isFinite(mapJson.tilewidth) ? mapJson.tilewidth : null;
  const tileHeight = Number.isFinite(mapJson.tileheight) ? mapJson.tileheight : null;

  const collisionGids = new Set();
  if (Array.isArray(mapJson.tilesets)) {
    mapJson.tilesets.forEach((tileset) => {
      if (!tileset || !Number.isFinite(tileset.firstgid)) return;
      const tiles = Array.isArray(tileset.tiles) ? tileset.tiles : [];
      tiles.forEach((tile) => {
        if (!tile || !Number.isFinite(tile.id)) return;
        const objGroup = tile.objectgroup;
        if (objGroup && Array.isArray(objGroup.objects) && objGroup.objects.length > 0) {
          collisionGids.add(tileset.firstgid + tile.id);
        }
      });
    });
  }

  const visitLayers = (layers) => {
    if (!Array.isArray(layers)) return;
    layers.forEach((layer) => {
      if (!layer) return;
      if (layer.type === "group" && Array.isArray(layer.layers)) {
        visitLayers(layer.layers);
        return;
      }

      const layerName = typeof layer.name === "string" ? layer.name.toLowerCase() : "";
      const isCollisionLayer = layerName === "collisions";

      if (layer.type === "tilelayer" && Array.isArray(layer.data)) {
        const layerWidth = Number.isFinite(layer.width) ? layer.width : width;
        const layerHeight = Number.isFinite(layer.height) ? layer.height : height;
        layer.data.forEach((gid, index) => {
          if (!Number.isFinite(gid) || gid <= 0) return;
          const shouldBlock = isCollisionLayer || collisionGids.has(gid);
          if (!shouldBlock) return;
          const x = layerWidth ? index % layerWidth : null;
          const y = layerWidth ? Math.floor(index / layerWidth) : null;
          if (
            x !== null &&
            y !== null &&
            layerWidth &&
            layerHeight &&
            x >= 0 &&
            y >= 0 &&
            x < layerWidth &&
            y < layerHeight
          ) {
            keys.add(`${x},${y}`);
          }
        });
        return;
      }

      if (layer.type === "objectgroup" && Array.isArray(layer.objects)) {
        if (!isCollisionLayer) return;
        layer.objects.forEach((obj) => {
          if (!obj) return;
          const props = Array.isArray(obj.properties) ? obj.properties : [];
          const propX = props.find((p) => p?.name === "tileX");
          const propY = props.find((p) => p?.name === "tileY");
          const tileX = Number.isFinite(propX?.value) ? Math.round(propX.value) : null;
          const tileY = Number.isFinite(propY?.value) ? Math.round(propY.value) : null;
          if (
            tileX !== null &&
            tileY !== null &&
            width &&
            height &&
            tileX >= 0 &&
            tileY >= 0 &&
            tileX < width &&
            tileY < height
          ) {
            keys.add(`${tileX},${tileY}`);
            return;
          }
          if (
            tileWidth &&
            tileHeight &&
            Number.isFinite(obj.x) &&
            Number.isFinite(obj.y)
          ) {
            const guessX = Math.floor(obj.x / tileWidth);
            const guessY = Math.floor(obj.y / tileHeight);
            if (
              width &&
              height &&
              guessX >= 0 &&
              guessY >= 0 &&
              guessX < width &&
              guessY < height
            ) {
              keys.add(`${guessX},${guessY}`);
            }
          }
        });
      }
    });
  };

  visitLayers(mapJson.layers);
  return keys;
}

function pickRandom(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function rollBetween(min, max) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function buildMonsterEntries(mapDef, meta, rollMonsterLevel) {
  const entries = [];
  if (!mapDef || !mapDef.spawnDefaults || !meta) return entries;

  const spawnDefs = Array.isArray(mapDef.monsterSpawns) ? mapDef.monsterSpawns : [];
  if (spawnDefs.length === 0) return entries;

  const centerTileX = Math.floor(meta.width / 2);
  const centerTileY = Math.floor(meta.height / 2);
  let nextGroupId = 1;

  spawnDefs.forEach((spawn) => {
    if (!spawn) return;

    let tileX = null;
    let tileY = null;

    if (Number.isFinite(spawn.tileX) && Number.isFinite(spawn.tileY)) {
      tileX = Math.round(spawn.tileX);
      tileY = Math.round(spawn.tileY);
    } else if (spawn.offsetFromCenter) {
      const dx = Number.isFinite(spawn.offsetFromCenter.x)
        ? Math.round(spawn.offsetFromCenter.x)
        : 0;
      const dy = Number.isFinite(spawn.offsetFromCenter.y)
        ? Math.round(spawn.offsetFromCenter.y)
        : 0;
      tileX = centerTileX + dx;
      tileY = centerTileY + dy;
    }

    if (
      tileX === null ||
      tileY === null ||
      tileX < 0 ||
      tileY < 0 ||
      tileX >= meta.width ||
      tileY >= meta.height
    ) {
      return;
    }

    const pool = Array.isArray(spawn.groupPool) ? spawn.groupPool.filter(Boolean) : [];
    const counts = spawn.groupCounts && typeof spawn.groupCounts === "object" ? spawn.groupCounts : null;

    const groupMonsterIdsFromCounts = (() => {
      if (!counts) return null;
      const ids = [];
      Object.entries(counts).forEach(([monsterId, def]) => {
        if (!monsterId) return;
        let n = 0;
        if (Number.isFinite(def)) {
          n = Math.max(0, Math.round(def));
        } else if (def && typeof def === "object") {
          const min = Number.isFinite(def.min) ? Math.round(def.min) : 0;
          const max = Number.isFinite(def.max) ? Math.round(def.max) : min;
          n = rollBetween(min, max);
        }
        for (let i = 0; i < n; i += 1) ids.push(monsterId);
      });
      return ids.length > 0 ? ids : null;
    })();

    const leaderId =
      spawn.type ||
      (Array.isArray(groupMonsterIdsFromCounts) && groupMonsterIdsFromCounts[0]) ||
      pickRandom(pool) ||
      "corbeau";

    const sizeMin =
      Number.isFinite(spawn.groupSizeMin) && spawn.groupSizeMin > 0
        ? Math.round(spawn.groupSizeMin)
        : 1;
    const sizeMax =
      Number.isFinite(spawn.groupSizeMax) && spawn.groupSizeMax > 0
        ? Math.round(spawn.groupSizeMax)
        : Number.isFinite(spawn.groupSize) && spawn.groupSize > 0
          ? Math.round(spawn.groupSize)
          : 4;
    const desiredGroupSize = rollBetween(sizeMin, sizeMax);

    let groupMonsterIds = null;
    if (Array.isArray(groupMonsterIdsFromCounts)) {
      const shuffled = groupMonsterIdsFromCounts.slice();
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = tmp;
      }
      const idx = shuffled.indexOf(leaderId);
      if (idx > 0) {
        const tmp = shuffled[0];
        shuffled[0] = shuffled[idx];
        shuffled[idx] = tmp;
      }
      groupMonsterIds = shuffled;
    } else if (pool.length > 0) {
      groupMonsterIds = Array.from(
        { length: Math.max(1, desiredGroupSize) },
        () => pickRandom(pool)
      );
      groupMonsterIds[0] = leaderId;
    } else {
      groupMonsterIds = [leaderId];
    }

    const groupLevels = groupMonsterIds.map((id) => {
      if (typeof rollMonsterLevel === "function") return rollMonsterLevel(id);
      return 1;
    });
    const level = Number.isFinite(groupLevels[0]) ? groupLevels[0] : 1;

    const respawnTemplate =
      pool.length > 0
        ? {
            groupPool: pool.slice(),
            groupSizeMin: Number.isFinite(spawn.groupSizeMin)
              ? Math.round(spawn.groupSizeMin)
              : null,
            groupSizeMax: Number.isFinite(spawn.groupSizeMax)
              ? Math.round(spawn.groupSizeMax)
              : null,
            forceMixedGroup: spawn.forceMixedGroup === true,
          }
        : null;

    entries.push({
      monsterId: leaderId,
      tileX,
      tileY,
      groupId: nextGroupId++,
      groupSize: groupMonsterIds.length,
      groupMonsterIds,
      groupLevels,
      groupLevelTotal: groupLevels.reduce((sum, lvl) => sum + lvl, 0),
      level,
      respawnTemplate,
    });
  });

  return entries;
}

function buildResourceEntries(mapDef) {
  const entries = [];
  if (!mapDef) return entries;

  const trees = Array.isArray(mapDef.treePositions) ? mapDef.treePositions : [];
  trees.forEach((pos) => {
    if (!Number.isFinite(pos.tileX) || !Number.isFinite(pos.tileY)) return;
    entries.push({
      kind: TREE_RESOURCE_KIND,
      tileX: Math.round(pos.tileX),
      tileY: Math.round(pos.tileY),
      offsetX: Number.isFinite(pos.offsetX) ? Math.round(pos.offsetX) : 0,
      offsetY: Number.isFinite(pos.offsetY) ? Math.round(pos.offsetY) : 0,
      resourceId: typeof pos.resourceId === "string" ? pos.resourceId : "chene",
      respawnMs: TREE_REGROW_DURATION_MS,
      harvested: false,
    });
  });

  const herbs = Array.isArray(mapDef.herbPositions) ? mapDef.herbPositions : [];
  herbs.forEach((pos) => {
    if (!Number.isFinite(pos.tileX) || !Number.isFinite(pos.tileY)) return;
    entries.push({
      kind: HERB_RESOURCE_KIND,
      tileX: Math.round(pos.tileX),
      tileY: Math.round(pos.tileY),
      offsetX: Number.isFinite(pos.offsetX) ? Math.round(pos.offsetX) : 0,
      offsetY: Number.isFinite(pos.offsetY) ? Math.round(pos.offsetY) : 0,
      resourceId: typeof pos.resourceId === "string" ? pos.resourceId : "ortie",
      respawnMs: HERB_REGROW_DURATION_MS,
      harvested: false,
    });
  });

  const wells = Array.isArray(mapDef.wellPositions) ? mapDef.wellPositions : [];
  wells.forEach((pos) => {
    if (!Number.isFinite(pos.tileX) || !Number.isFinite(pos.tileY)) return;
    entries.push({
      kind: WELL_RESOURCE_KIND,
      tileX: Math.round(pos.tileX),
      tileY: Math.round(pos.tileY),
      offsetX: Number.isFinite(pos.offsetX) ? Math.round(pos.offsetX) : 0,
      offsetY: Number.isFinite(pos.offsetY) ? Math.round(pos.offsetY) : 0,
      resourceId: "eau",
      respawnMs: WELL_COOLDOWN_MS,
      harvested: false,
    });
  });

  return entries;
}

function initializeMapState({
  mapId,
  maps,
  projectRoot,
  getNextMonsterEntityId,
  getNextResourceEntityId,
  rollMonsterLevel,
}) {
  const mapDef = resolveMapDef(mapId, maps);
  if (!mapDef) return null;
  const mapJson = loadMapJson(mapDef, projectRoot);
  if (!mapJson || !Number.isFinite(mapJson.width) || !Number.isFinite(mapJson.height)) {
    return null;
  }

  const groundInfo = buildGroundTileInfo(mapJson, mapDef);
  const meta = {
    width: Math.round(mapJson.width),
    height: Math.round(mapJson.height),
    playableBounds: groundInfo?.bounds || null,
    groundTiles: groundInfo?.tiles || null,
  };
  const collisions = extractCollisionKeys(mapJson);
  const addStaticBlocker = (tileX, tileY) => {
    if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) return;
    const x = Math.round(tileX);
    const y = Math.round(tileY);
    if (x < 0 || y < 0 || x >= meta.width || y >= meta.height) return;
    collisions.add(`${x},${y}`);
  };

  const resources = buildResourceEntries(mapDef).map((entry) => ({
    ...entry,
    entityId: getNextResourceEntityId(),
    spawnMapKey: mapId,
  }));

  resources.forEach((entry) => {
    addStaticBlocker(entry.tileX, entry.tileY);
  });

  if (Array.isArray(mapDef.workstations)) {
    mapDef.workstations.forEach((ws) => {
      addStaticBlocker(ws.tileX, ws.tileY);
    });
  }

  const monsters = buildMonsterEntries(mapDef, meta, rollMonsterLevel).map((entry) => ({
    ...entry,
    entityId: getNextMonsterEntityId(),
    spawnMapKey: mapId,
    spawnTileX: entry.tileX,
    spawnTileY: entry.tileY,
    isMoving: false,
    nextRoamAt: 0,
    moveEndAt: 0,
    inCombat: false,
    combatId: null,
  }));

  return { meta, collisions, monsters, resources };
}

module.exports = {
  initializeMapState,
  resolveMapDef,
};
