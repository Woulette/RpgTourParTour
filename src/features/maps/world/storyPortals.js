import { blockTile, unblockTile } from "../../../collision/collisionGrid.js";
import { addChatMessage } from "../../../chat/chat.js";
import { getQuestDef, getQuestState, getCurrentQuestStage } from "../../quests/index.js";
import { on as onStoreEvent } from "../../../state/store.js";
import { loadMapLikeMain } from "./load.js";
import { maps } from "../index.js";
import { isCraftPanelOpen } from "../../ui/uiBlock.js";

function isPortalOpen(player, portalDef) {
  if (!player || !portalDef?.questId) return false;
  const state = getQuestState(player, portalDef.questId, { emit: false });
  if (!state) return false;
  if (portalDef.openWhenQuestCompleted) {
    return state.state === "completed";
  }
  const questDef = getQuestDef(portalDef.questId);
  const stage = questDef ? getCurrentQuestStage(questDef, state) : null;
  if (portalDef.openStageId) {
    return stage?.id === portalDef.openStageId;
  }
  return false;
}

function updatePortalVisual(node) {
  if (!node || !node.sprite) return;
  const key = node.isOpen ? node.openTextureKey : node.closedTextureKey;
  if (key && node.sprite.texture?.key !== key) {
    node.sprite.setTexture(key);
  }
}

function handlePortalClick(scene, player, node) {
  if (!scene || !player || !node) return;
  if (!node.isOpen) {
    addChatMessage(
      {
        kind: "info",
        channel: "quest",
        author: "Systeme",
        text: "Le portail est scelle pour le moment.",
      },
      { player }
    );
    return;
  }
  const targetMap = node.targetMapKey ? node.targetMapKey : null;
  if (!targetMap) {
    addChatMessage(
      {
        kind: "info",
        channel: "quest",
        author: "Systeme",
        text: "Destination non configuree.",
      },
      { player }
    );
    return;
  }
  const mapDefTarget =
    maps[targetMap] ||
    maps[String(targetMap).trim()] ||
    maps[Object.keys(maps).find((k) => k.toLowerCase() === String(targetMap).toLowerCase())] ||
    null;

  const startTile =
    node.targetStartTile &&
    typeof node.targetStartTile.x === "number" &&
    typeof node.targetStartTile.y === "number"
      ? node.targetStartTile
      : null;

  const doChange = () => loadMapLikeMain(scene, mapDefTarget, startTile ? { startTile } : undefined);
  if (!mapDefTarget) {
    addChatMessage(
      {
        kind: "info",
        channel: "quest",
        author: "Systeme",
        text: "Destination non configuree.",
      },
      { player }
    );
    return;
  }
  const cam = scene.cameras && scene.cameras.main;
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
}

export function spawnStoryPortals(scene, map, player, mapDef) {
  if (!scene || !map || !player || !mapDef) return;
  const defs = Array.isArray(mapDef.storyPortals) ? mapDef.storyPortals : [];
  if (defs.length === 0) return;

  const nodes = [];

  defs.forEach((def) => {
    if (!def || typeof def.tileX !== "number" || typeof def.tileY !== "number") return;
    if (def.tileX < 0 || def.tileY < 0 || def.tileX >= map.width || def.tileY >= map.height) return;
    if (!def.closedTextureKey || !scene.textures.exists(def.closedTextureKey)) return;

    const wp = map.tileToWorldXY(def.tileX, def.tileY);
    const x = wp.x + map.tileWidth / 2;
    const y = wp.y + map.tileHeight;

    const sprite = scene.add.sprite(x, y, def.closedTextureKey);
    sprite.setOrigin(0.5, 1);
    sprite.setDepth(y);
    sprite.setInteractive({ useHandCursor: true });

    const node = {
      id: def.id || `${mapDef.key}_${def.tileX}_${def.tileY}`,
      sprite,
      tileX: def.tileX,
      tileY: def.tileY,
      openTextureKey: def.openTextureKey || def.closedTextureKey,
      closedTextureKey: def.closedTextureKey,
      targetMapKey: def.targetMapKey || null,
      targetStartTile: def.targetStartTile || null,
      blocksMovement: def.blocksMovement === true,
      questId: def.questId || null,
      openWhenQuestCompleted: def.openWhenQuestCompleted === true,
      openStageId: def.openStageId || null,
      isOpen: isPortalOpen(player, def),
    };

    updatePortalVisual(node);

    if (node.blocksMovement) {
      blockTile(scene, def.tileX, def.tileY);
      node._blockedTile = { x: def.tileX, y: def.tileY };
    }

    sprite.on("pointerdown", (pointer, lx, ly, event) => {
      if (event?.stopPropagation) event.stopPropagation();
      if (isCraftPanelOpen()) return;
      handlePortalClick(scene, player, node);
    });

    nodes.push(node);
  });

  scene.storyPortals = nodes;

  if (scene.storyPortalUnsubscribe) {
    scene.storyPortalUnsubscribe();
    scene.storyPortalUnsubscribe = null;
  }
  scene.storyPortalUnsubscribe = onStoreEvent("quest:updated", () => {
    if (!scene.storyPortals || scene.storyPortals.length === 0) return;
    scene.storyPortals.forEach((node) => {
      if (!node) return;
      const nextOpen = isPortalOpen(player, node);
      if (nextOpen === node.isOpen) return;
      node.isOpen = nextOpen;
      updatePortalVisual(node);
    });
  });
}

export function clearStoryPortals(scene) {
  const list = Array.isArray(scene?.storyPortals) ? scene.storyPortals : [];
  list.forEach((node) => {
    if (node?.sprite?.destroy) node.sprite.destroy();
    if (node?.blocksMovement && node._blockedTile) {
      unblockTile(scene, node._blockedTile.x, node._blockedTile.y);
    }
  });
  if (scene) {
    scene.storyPortals = [];
    if (scene.storyPortalUnsubscribe) {
      scene.storyPortalUnsubscribe();
      scene.storyPortalUnsubscribe = null;
    }
  }
}
