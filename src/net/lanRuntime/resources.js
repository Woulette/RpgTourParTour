import { getNetClient, getNetIsHost, getNetPlayerId } from "../../app/session.js";
import {
  applyTreeHarvested,
  applyTreeRespawn,
  spawnTreesFromEntries,
  TREE_REGROW_DURATION_MS,
  TREE_RESOURCE_KIND,
} from "../../features/metier/bucheron/trees.js";
import {
  applyHerbHarvested,
  applyHerbRespawn,
  spawnHerbsFromEntries,
  HERB_REGROW_DURATION_MS,
  HERB_RESOURCE_KIND,
} from "../../features/metier/alchimiste/plants.js";
import {
  applyWellHarvested,
  applyWellRespawn,
  spawnWellsFromEntries,
  WELL_COOLDOWN_MS,
  WELL_RESOURCE_KIND,
} from "../../features/maps/world/wells.js";

export function createResourceHandlers(ctx) {
  const {
    scene,
    player,
    getCurrentMapKey,
    getCurrentMapDef,
    getCurrentMapObj,
    resourceNodes,
  } = ctx;

  const clearResourceNodes = () => {
    const keys = ["bucheronNodes", "alchimisteNodes", "wellNodes"];
    keys.forEach((key) => {
      const list = scene[key];
      if (!Array.isArray(list)) return;
      list.forEach((node) => {
        if (!node) return;
        if (node.hoverHighlight?.destroy) node.hoverHighlight.destroy();
        if (node.sprite?.destroy) node.sprite.destroy();
      });
      scene[key] = [];
    });
    resourceNodes.clear();
  };

  const registerResourceNodes = (nodes) => {
    if (!Array.isArray(nodes)) return;
    nodes.forEach((node) => {
      if (!node || !Number.isInteger(node.entityId)) return;
      resourceNodes.set(node.entityId, node);
    });
  };

  const findResourceNodeByEntityId = (entityId) => {
    if (!Number.isInteger(entityId)) return null;
    return resourceNodes.get(entityId) || null;
  };

  const buildResourceEntriesForMap = () => {
    const mapDef = getCurrentMapDef();
    if (!mapDef) return [];
    const entries = [];

    const trees = Array.isArray(mapDef.treePositions) ? mapDef.treePositions : [];
    trees.forEach((pos) => {
      if (typeof pos.tileX !== "number" || typeof pos.tileY !== "number") return;
      entries.push({
        kind: TREE_RESOURCE_KIND,
        tileX: pos.tileX,
        tileY: pos.tileY,
        offsetX: typeof pos.offsetX === "number" ? pos.offsetX : 0,
        offsetY: typeof pos.offsetY === "number" ? pos.offsetY : 0,
        resourceId: typeof pos.resourceId === "string" ? pos.resourceId : "chene",
        respawnMs: TREE_REGROW_DURATION_MS,
        harvested: false,
      });
    });

    const herbs = Array.isArray(mapDef.herbPositions) ? mapDef.herbPositions : [];
    herbs.forEach((pos) => {
      if (typeof pos.tileX !== "number" || typeof pos.tileY !== "number") return;
      entries.push({
        kind: HERB_RESOURCE_KIND,
        tileX: pos.tileX,
        tileY: pos.tileY,
        offsetX: typeof pos.offsetX === "number" ? pos.offsetX : 0,
        offsetY: typeof pos.offsetY === "number" ? pos.offsetY : 0,
        resourceId: typeof pos.resourceId === "string" ? pos.resourceId : "ortie",
        respawnMs: HERB_REGROW_DURATION_MS,
        harvested: false,
      });
    });

    const wells = Array.isArray(mapDef.wellPositions) ? mapDef.wellPositions : [];
    wells.forEach((pos) => {
      if (typeof pos.tileX !== "number" || typeof pos.tileY !== "number") return;
      entries.push({
        kind: WELL_RESOURCE_KIND,
        tileX: pos.tileX,
        tileY: pos.tileY,
        offsetX: typeof pos.offsetX === "number" ? pos.offsetX : 0,
        offsetY: typeof pos.offsetY === "number" ? pos.offsetY : 0,
        resourceId: "eau",
        respawnMs: WELL_COOLDOWN_MS,
        harvested: false,
      });
    });

    return entries;
  };

  const spawnResourcesFromEntries = (entries) => {
    const currentMap = getCurrentMapObj();
    if (!currentMap || !Array.isArray(entries)) return;
    clearResourceNodes();

    const treeEntries = entries.filter((e) => e && e.kind === TREE_RESOURCE_KIND);
    const herbEntries = entries.filter((e) => e && e.kind === HERB_RESOURCE_KIND);
    const wellEntries = entries.filter((e) => e && e.kind === WELL_RESOURCE_KIND);

    const treeNodes = spawnTreesFromEntries(scene, currentMap, player, treeEntries);
    const herbNodes = spawnHerbsFromEntries(scene, currentMap, player, herbEntries);
    const wellNodes = spawnWellsFromEntries(scene, currentMap, player, wellEntries);

    registerResourceNodes(treeNodes);
    registerResourceNodes(herbNodes);
    registerResourceNodes(wellNodes);
  };

  const sendMapResourcesSnapshot = () => {
    const client = getNetClient();
    if (!client) return;
    const playerId = getNetPlayerId();
    if (!playerId) return;
    const currentMap = getCurrentMapKey();
    if (!currentMap) return;
    const seeded =
      scene.__lanMapResourcesSeeded || (scene.__lanMapResourcesSeeded = new Set());
    if (seeded.has(currentMap)) return;
    const entries = buildResourceEntriesForMap();

    client.sendCmd("CmdMapResources", {
      playerId,
      mapId: currentMap,
      resources: entries,
    });
    seeded.add(currentMap);
  };

  const requestMapResources = () => {
    const client = getNetClient();
    if (!client) return;
    const playerId = getNetPlayerId();
    if (!playerId) return;
    const currentMap = getCurrentMapKey();
    if (!currentMap) return;
    client.sendCmd("CmdRequestMapResources", {
      playerId,
      mapId: currentMap,
    });
  };

  const handleResourceHarvested = (msg) => {
    const currentMap = getCurrentMapKey();
    if (!currentMap || msg.mapId !== currentMap) return;
    const node = findResourceNodeByEntityId(msg.entityId);
    if (!node) return;
    const isLocal = getNetPlayerId() === msg.harvesterId;
    if (node.kind === TREE_RESOURCE_KIND) {
      applyTreeHarvested(scene, player, node, isLocal);
    } else if (node.kind === HERB_RESOURCE_KIND) {
      applyHerbHarvested(scene, player, node, isLocal);
    } else if (node.kind === WELL_RESOURCE_KIND) {
      applyWellHarvested(scene, player, node, isLocal);
    }
  };

  const handleResourceRespawned = (msg) => {
    const currentMap = getCurrentMapKey();
    if (!currentMap || msg.mapId !== currentMap) return;
    const node = findResourceNodeByEntityId(msg.entityId);
    if (!node) return;
    if (node.kind === TREE_RESOURCE_KIND) {
      applyTreeRespawn(scene, node);
    } else if (node.kind === HERB_RESOURCE_KIND) {
      applyHerbRespawn(scene, node);
    } else if (node.kind === WELL_RESOURCE_KIND) {
      applyWellRespawn(scene, node);
    }
  };

  return {
    clearResourceNodes,
    spawnResourcesFromEntries,
    sendMapResourcesSnapshot,
    requestMapResources,
    handleResourceHarvested,
    handleResourceRespawned,
  };
}
