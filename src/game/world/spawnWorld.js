import { loadMapLikeMain } from "../../maps/world.js";
import {
  processPendingRespawnsForCurrentMap,
  spawnInitialMonsters,
} from "../../monsters/index.js";
import { spawnTestTrees } from "../../metier/bucheron/trees.js";
import { spawnTestHerbs } from "../../metier/alchimiste/plants.js";
import { spawnTestWells } from "../../maps/world/wells.js";
import { spawnRifts } from "../../maps/world/rifts.js";
import { spawnStoryPortals } from "../../maps/world/storyPortals.js";
import { spawnNpcsForMap } from "../../npc/spawn.js";

export function ensureRespawnTick(scene) {
  if (!scene || scene.respawnTick || !scene.time?.addEvent) return;
  scene.respawnTick = scene.time.addEvent({
    delay: 1000,
    loop: true,
    callback: () => processPendingRespawnsForCurrentMap(scene),
  });
}

export function spawnWorldEntities(scene, map, groundLayer, mapDef, centerTileX, centerTileY) {
  if (!scene || !mapDef) return;

  ensureRespawnTick(scene);

  if (mapDef.spawnDefaults) {
    spawnInitialMonsters(scene, map, groundLayer, centerTileX, centerTileY, mapDef);
    processPendingRespawnsForCurrentMap(scene);

    spawnTestTrees(scene, map, scene.player, mapDef);
    spawnTestHerbs(scene, map, scene.player, mapDef);
    spawnTestWells(scene, map, scene.player, mapDef);

    spawnRifts(scene, map, scene.player, mapDef, {
      onTeleport: ({ targetMap, targetStartTile, riftId }) => {
        if (!targetMap) return;
        scene.player.activeRiftId = riftId || null;
        const startTile =
          targetStartTile &&
          typeof targetStartTile.x === "number" &&
          typeof targetStartTile.y === "number"
            ? targetStartTile
            : null;
        const cam = scene.cameras && scene.cameras.main;
        const doChange = () =>
          loadMapLikeMain(scene, targetMap, startTile ? { startTile } : undefined);
        if (scene.time?.delayedCall) {
          scene.time.delayedCall(50, () => {
            if (cam?.fadeOut && cam?.fadeIn) {
              cam.once("camerafadeoutcomplete", () => {
                doChange();
                cam.fadeIn(150, 0, 0, 0);
              });
              cam.fadeOut(150, 0, 0, 0);
            } else {
              doChange();
            }
          });
        } else {
          doChange();
        }
      },
    });
  }

  spawnStoryPortals(scene, map, scene.player, mapDef);
  spawnNpcsForMap(scene, map, groundLayer, mapDef.key);
}
