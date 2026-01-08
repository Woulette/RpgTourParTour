function createResourceHandlers(ctx) {
  const {
    state,
    broadcast,
    send,
    getNextEventId,
    getNextResourceEntityId,
    getHostId,
    ensureMapInitialized,
    resourceRespawnTimers,
  } = ctx;

  function sanitizeResourceEntries(raw) {
    if (!Array.isArray(raw)) return [];
    const result = [];
    const maxResources = 400;

    for (const entry of raw) {
      if (!entry) continue;
      const kind = typeof entry.kind === "string" ? entry.kind : null;
      if (!kind) continue;
      const tileX = Number.isInteger(entry.tileX) ? entry.tileX : null;
      const tileY = Number.isInteger(entry.tileY) ? entry.tileY : null;
      if (tileX === null || tileY === null) continue;

      const respawnMs =
        Number.isInteger(entry.respawnMs) && entry.respawnMs > 0
          ? entry.respawnMs
          : 30000;

      result.push({
        kind,
        tileX,
        tileY,
        offsetX: Number.isInteger(entry.offsetX) ? entry.offsetX : 0,
        offsetY: Number.isInteger(entry.offsetY) ? entry.offsetY : 0,
        resourceId: typeof entry.resourceId === "string" ? entry.resourceId : null,
        respawnMs,
        harvested: entry.harvested === true,
      });

      if (result.length >= maxResources) break;
    }

    return result;
  }

  function serializeResourceEntries(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((entry) => entry && typeof entry.kind === "string")
      .map((entry) => ({
        entityId: Number.isInteger(entry.entityId) ? entry.entityId : null,
        kind: entry.kind,
        tileX: Number.isInteger(entry.tileX) ? entry.tileX : null,
        tileY: Number.isInteger(entry.tileY) ? entry.tileY : null,
        offsetX: Number.isInteger(entry.offsetX) ? entry.offsetX : 0,
        offsetY: Number.isInteger(entry.offsetY) ? entry.offsetY : 0,
        resourceId: typeof entry.resourceId === "string" ? entry.resourceId : null,
        respawnMs: Number.isInteger(entry.respawnMs) ? entry.respawnMs : 30000,
        harvested: entry.harvested === true,
      }));
  }

  function handleCmdMapResources(ws, clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const player = state.players[clientInfo.id];
    const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
    if (!mapId) return;
    if (!player || player.mapId !== mapId) return;

    if (!state.mapResources[mapId]) {
      const entries = sanitizeResourceEntries(msg.resources);
      entries.forEach((entry) => {
        entry.entityId = getNextResourceEntityId();
        entry.spawnMapKey = mapId;
      });
      state.mapResources[mapId] = entries;
      broadcast({ t: "EvMapResources", mapId, resources: serializeResourceEntries(entries) });
      return;
    }

    send(ws, {
      t: "EvMapResources",
      eventId: getNextEventId(),
      mapId,
      resources: serializeResourceEntries(state.mapResources[mapId]),
    });
  }

  function scheduleResourceRespawn(mapId, entry) {
    if (!mapId || !entry) return;
    const entityId = entry.entityId;
    if (resourceRespawnTimers.has(entityId)) {
      clearTimeout(resourceRespawnTimers.get(entityId));
      resourceRespawnTimers.delete(entityId);
    }
    const delayMs = Number.isInteger(entry.respawnMs) ? entry.respawnMs : 30000;

    const timer = setTimeout(() => {
      const playersOnMap = Object.values(state.players).some(
        (player) => player && player.mapId === mapId
      );
      if (!playersOnMap) {
        scheduleResourceRespawn(mapId, entry);
        return;
      }

      const list = state.mapResources[mapId];
      if (!Array.isArray(list)) return;
      const target = list.find((r) => r && r.entityId === entityId);
      if (!target) return;

      target.harvested = false;
      broadcast({
        t: "EvResourceRespawned",
        mapId,
        entityId,
        kind: target.kind,
      });
    }, delayMs);

    resourceRespawnTimers.set(entityId, timer);
  }

  function handleCmdResourceHarvest(ws, clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
    if (!mapId) return;
    const entityId = Number.isInteger(msg.entityId) ? msg.entityId : null;
    if (!entityId) return;
    const list = state.mapResources[mapId];
    if (!Array.isArray(list) || list.length === 0) return;

    const entry = list.find((r) => r && r.entityId === entityId);
    if (!entry) return;
    if (entry.harvested) return;

    entry.harvested = true;
    broadcast({
      t: "EvResourceHarvested",
      mapId,
      entityId,
      kind: entry.kind,
      harvesterId: clientInfo.id,
    });
    scheduleResourceRespawn(mapId, entry);
  }

  function handleCmdRequestMapResources(ws, clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
    if (!mapId) return;
    const list = state.mapResources[mapId];
    if (!Array.isArray(list) || list.length === 0) {
      ensureMapInitialized(mapId);
      return;
    }
    send(ws, {
      t: "EvMapResources",
      eventId: getNextEventId(),
      mapId,
      resources: serializeResourceEntries(list),
    });
  }

  return {
    serializeResourceEntries,
    handleCmdMapResources,
    handleCmdResourceHarvest,
    handleCmdRequestMapResources,
  };
}

module.exports = {
  createResourceHandlers,
};
