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

  mapJson.layers.forEach((layer) => {
    if (!layer || typeof layer.name !== "string") return;
    if (layer.name !== "collisions") return;

    if (layer.type === "objectgroup" && Array.isArray(layer.objects)) {
      layer.objects.forEach((obj) => {
        if (!obj) return;
        const props = Array.isArray(obj.properties) ? obj.properties : [];
        const tileX = props.find((p) => p?.name === "tileX")?.value;
        const tileY = props.find((p) => p?.name === "tileY")?.value;
        if (Number.isInteger(tileX) && Number.isInteger(tileY)) {
          blocked.add(`${tileX},${tileY}`);
        }
      });
      return;
    }

    if (layer.type === "tilelayer" && Array.isArray(layer.data)) {
      const width = Number.isInteger(layer.width) ? layer.width : mapJson.width;
      if (!Number.isInteger(width)) return;
      layer.data.forEach((gid, index) => {
        if (!gid || gid === 0) return;
        const x = index % width;
        const y = Math.floor(index / width);
        blocked.add(`${x},${y}`);
      });
    }
  });

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
