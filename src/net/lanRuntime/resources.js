import { getNetClient, getNetIsHost, getNetPlayerId } from "../../app/session.js";
import {
  applyTreeHarvested,
  applyTreeRespawn,
  spawnTreesFromEntries,
  TREE_RESOURCE_KIND,
} from "../../features/metier/bucheron/trees.js";
import {
  applyHerbHarvested,
  applyHerbRespawn,
  spawnHerbsFromEntries,
  HERB_RESOURCE_KIND,
} from "../../features/metier/alchimiste/plants.js";
import {
  applyWellHarvested,
  applyWellRespawn,
  spawnWellsFromEntries,
  WELL_RESOURCE_KIND,
} from "../../features/maps/world/wells.js";

export function createResourceHandlers(ctx) {
  const {
    scene,
    player,
    getCurrentMapKey,
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
    client.sendCmd("CmdRequestMapResources", {
      playerId,
      mapId: currentMap,
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
    const reward =
      isLocal && (msg?.gainedItems || msg?.gainedXp)
        ? { gainedItems: msg.gainedItems || 0, gainedXp: msg.gainedXp || 0 }
        : null;
    if (node.kind === TREE_RESOURCE_KIND) {
      applyTreeHarvested(scene, player, node, false, reward);
    } else if (node.kind === HERB_RESOURCE_KIND) {
      applyHerbHarvested(scene, player, node, false, reward);
    } else if (node.kind === WELL_RESOURCE_KIND) {
      applyWellHarvested(scene, player, node, false, reward);
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
