import {
  processPendingRespawnsForCurrentMap,
  spawnInitialMonsters,
} from "../../../monsters/runtime/index.js";
import { spawnNpcsForMap } from "../../../npc/runtime/spawn.js";
import { spawnTestTrees } from "../../../metier/bucheron/trees.js";
import { spawnTestHerbs } from "../../../metier/alchimiste/plants.js";
import { spawnTestWells } from "../wells.js";
import { spawnRifts } from "../rifts.js";
import { spawnStoryPortals } from "../storyPortals.js";
import { createMapExits } from "../../exits.js";
import { onAfterMapLoaded } from "../../../dungeons/hooks.js";
import { emit as emitStoreEvent } from "../../../../state/store.js";
export function spawnMapEntities(scene, map, mapDef, safeTileX, safeTileY, options = {}) {
  if (!scene || !mapDef) return;
  const onRiftTeleport = typeof options.onRiftTeleport === "function" ? options.onRiftTeleport : null;

  if (mapDef.spawnDefaults) {
    spawnInitialMonsters(scene, map, scene.groundLayer, safeTileX, safeTileY, mapDef);
    spawnTestTrees(scene, map, scene.player, mapDef);
    spawnTestHerbs(scene, map, scene.player, mapDef);
    spawnTestWells(scene, map, scene.player, mapDef);
    spawnRifts(scene, map, scene.player, mapDef, {
      onTeleport: onRiftTeleport,
    });
  }

  spawnStoryPortals(scene, map, scene.player, mapDef);
  processPendingRespawnsForCurrentMap(scene);
  spawnNpcsForMap(scene, map, scene.groundLayer, mapDef.key);
  createMapExits(scene);
  onAfterMapLoaded(scene);

  emitStoreEvent("map:changed", {
    mapKey: mapDef.key,
    startTile: { x: safeTileX, y: safeTileY },
  });
}
