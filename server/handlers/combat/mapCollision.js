const fs = require("fs");
const path = require("path");

const cache = new Map();

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function extractBlockedTiles(mapJson) {
  const blocked = new Set();
  if (!mapJson || !Array.isArray(mapJson.layers)) return blocked;

  const width = Number.isInteger(mapJson.width) ? mapJson.width : null;
  const height = Number.isInteger(mapJson.height) ? mapJson.height : null;
  const tileWidth = Number.isInteger(mapJson.tilewidth) ? mapJson.tilewidth : null;
  const tileHeight = Number.isInteger(mapJson.tileheight) ? mapJson.tileheight : null;

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
        const layerWidth = Number.isInteger(layer.width) ? layer.width : width;
        const layerHeight = Number.isInteger(layer.height) ? layer.height : height;
        if (!Number.isInteger(layerWidth) || !Number.isInteger(layerHeight)) return;
        layer.data.forEach((gid, index) => {
          if (!Number.isFinite(gid) || gid <= 0) return;
          const shouldBlock = isCollisionLayer || collisionGids.has(gid);
          if (!shouldBlock) return;
          const x = index % layerWidth;
          const y = Math.floor(index / layerWidth);
          if (x >= 0 && y >= 0 && x < layerWidth && y < layerHeight) {
            blocked.add(`${x},${y}`);
          }
        });
        return;
      }

      if (layer.type === "objectgroup" && Array.isArray(layer.objects)) {
        if (!isCollisionLayer) return;
        layer.objects.forEach((obj) => {
          if (!obj) return;
          const props = Array.isArray(obj.properties) ? obj.properties : [];
          const tileX = props.find((p) => p?.name === "tileX")?.value;
          const tileY = props.find((p) => p?.name === "tileY")?.value;
          if (Number.isInteger(tileX) && Number.isInteger(tileY)) {
            blocked.add(`${tileX},${tileY}`);
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
              blocked.add(`${guessX},${guessY}`);
            }
          }
        });
      }
    });
  };

  visitLayers(mapJson.layers);
  return blocked;
}

function getMapCollision(mapId) {
  if (!mapId) return null;
  const cached = cache.get(mapId);
  if (cached) return cached;

  const filePath = path.resolve(__dirname, "..", "..", "..", "assets", "maps", `${mapId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const mapJson = readJson(filePath);
  const width = Number.isInteger(mapJson.width) ? mapJson.width : null;
  const height = Number.isInteger(mapJson.height) ? mapJson.height : null;
  const blocked = extractBlockedTiles(mapJson);
  const info = { width, height, blocked };
  cache.set(mapId, info);
  return info;
}

module.exports = {
  getMapCollision,
};
