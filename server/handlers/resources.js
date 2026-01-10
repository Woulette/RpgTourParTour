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
    getHarvestResourceDef,
    getHarvestResourceDefsPromise,
    getHarvestResourceDefsFailed,
    applyInventoryOpFromServer,
  } = ctx;

  const BUCHERON_XP_PER_HARVEST = 10;
  const ALCHIMISTE_XP_PER_HARVEST = 8;

  const rollQty = (min, max) => {
    const low = Number.isInteger(min) ? min : 1;
    const high = Number.isInteger(max) ? max : low;
    return low + Math.floor(Math.random() * (high - low + 1));
  };

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
    handleCmdRequestMapResources(ws, clientInfo, msg);
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

    const defsFailed =
      typeof getHarvestResourceDefsFailed === "function"
        ? getHarvestResourceDefsFailed()
        : false;
    const defsPromise =
      typeof getHarvestResourceDefsPromise === "function"
        ? getHarvestResourceDefsPromise()
        : null;
    if (!getHarvestResourceDef && defsPromise && !defsFailed) {
      defsPromise.catch(() => {});
    }

    let gainedItems = 0;
    let gainedXp = 0;
    let itemId = null;
    const kind = entry.kind;
    if (kind === "tree" || kind === "herb") {
      const def =
        typeof getHarvestResourceDef === "function"
          ? getHarvestResourceDef(entry.resourceId)
          : null;
      if (def && typeof def.itemId === "string") {
        itemId = def.itemId;
        const amount = rollQty(1, 5);
        if (typeof applyInventoryOpFromServer === "function") {
          gainedItems = applyInventoryOpFromServer(
            clientInfo.id,
            "add",
            itemId,
            amount,
            "resource_harvest"
          );
        }
        gainedXp =
          typeof def.xpHarvest === "number" && def.xpHarvest > 0
            ? def.xpHarvest
            : kind === "tree"
              ? BUCHERON_XP_PER_HARVEST
              : ALCHIMISTE_XP_PER_HARVEST;
      }
    } else if (kind === "well") {
      itemId = "eau";
      const amount = rollQty(1, 10);
      if (typeof applyInventoryOpFromServer === "function") {
        gainedItems = applyInventoryOpFromServer(
          clientInfo.id,
          "add",
          itemId,
          amount,
          "resource_well"
        );
      }
    }

    broadcast({
      t: "EvResourceHarvested",
      mapId,
      entityId,
      kind: entry.kind,
      harvesterId: clientInfo.id,
      itemId,
      gainedItems,
      gainedXp,
    });
    scheduleResourceRespawn(mapId, entry);
  }

  function handleCmdRequestMapResources(ws, clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
    if (!mapId) return;
    const list = state.mapResources[mapId];
    if (!Array.isArray(list)) {
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
