import { blockTile } from "../../../collision/collisionGrid.js";
import { addChatMessage } from "../../../chat/chat.js";
import {
  getQuestDef,
  getQuestState,
  getCurrentQuestStage,
  incrementRiftProgress,
} from "../../quests/index.js";
import { openRiftModal } from "../../ui/domRifts.js";
import { maps } from "../index.js";
import { isCraftPanelOpen } from "../../ui/uiBlock.js";

const QUEST_ID = "keeper_north_explosion_1";

function getRiftTexture(scene, key) {
  if (!scene?.textures?.exists) return null;
  if (key && scene.textures.exists(key)) return key;
  return null;
}

function getQuestStateSilent(player) {
  return getQuestState(player, QUEST_ID, { emit: false });
}

function isRiftStageActive(player) {
  const state = getQuestStateSilent(player);
  if (!state || state.state !== "in_progress") return false;
  const questDef = getQuestDef(QUEST_ID);
  const stage = getCurrentQuestStage(questDef, state);
  return stage?.id === "close_rifts";
}

function shouldSpawnRifts(player) {
  if (!player) return false;
  const state = getQuestStateSilent(player);
  return state?.state === "in_progress";
}

function isRiftClosed(player, riftId) {
  if (!player || !riftId) return false;
  const state = getQuestStateSilent(player);
  const closed = state?.progress?.closedRifts || {};
  return Boolean(closed[riftId]);
}

function markRiftClosed(scene, riftId) {
  const player = scene?.player;
  if (!player || !riftId) return;
  const state = getQuestState(player, QUEST_ID);
  state.progress = state.progress || {};
  state.progress.closedRifts = state.progress.closedRifts || {};
  if (state.progress.closedRifts[riftId]) return;

  state.progress.closedRifts[riftId] = true;
  incrementRiftProgress(scene, player, QUEST_ID, 1);
}

function updateRiftVisual(node) {
  if (!node || !node.sprite) return;
  const desiredKey = node.isClosed
    ? node.closedTextureKey || node.openTextureKey
    : node.openTextureKey;
  if (desiredKey && node.sprite.texture?.key !== desiredKey) {
    node.sprite.setTexture(desiredKey);
  }
  node.sprite.clearTint();
  node.sprite.setAlpha(1);
}

export function closeRiftForPlayer(scene, riftId) {
  markRiftClosed(scene, riftId);
  if (!scene || !Array.isArray(scene.riftNodes)) return;
  const node = scene.riftNodes.find((r) => r.id === riftId);
  if (!node) return;
  node.isClosed = true;
  updateRiftVisual(node);
}

export function spawnRifts(scene, map, player, mapDef, options = {}) {
  if (!scene || !map || !player || !mapDef) return;
  const positions = Array.isArray(mapDef.riftPositions)
    ? mapDef.riftPositions
    : [];
  if (positions.length === 0) return;
  if (!shouldSpawnRifts(player)) return;

  const onTeleport =
    typeof options.onTeleport === "function" ? options.onTeleport : null;
  const nodes = [];

  positions.forEach((pos) => {
    if (typeof pos.tileX !== "number" || typeof pos.tileY !== "number") {
      return;
    }
    if (
      pos.tileX < 0 ||
      pos.tileY < 0 ||
      pos.tileX >= map.width ||
      pos.tileY >= map.height
    ) {
      return;
    }

    const openTextureKey = getRiftTexture(scene, pos.textureKey);
    if (!openTextureKey) return;
    const closedTextureKey = getRiftTexture(scene, pos.closedTextureKey);

    const offsetX = typeof pos.offsetX === "number" ? pos.offsetX : 0;
    const offsetY = typeof pos.offsetY === "number" ? pos.offsetY : 0;

    const worldPos = map.tileToWorldXY(pos.tileX, pos.tileY);
    const x = worldPos.x + map.tileWidth / 2 + offsetX;
    const y = worldPos.y + map.tileHeight + offsetY;

    const sprite = scene.add.sprite(x, y, openTextureKey);
    sprite.setOrigin(0.5, 1);
    sprite.setDepth(y);
    sprite.setInteractive({ useHandCursor: true });

    const node = {
      id: pos.id || `${mapDef.key}_${pos.tileX}_${pos.tileY}`,
      x,
      y,
      tileX: pos.tileX,
      tileY: pos.tileY,
      rank: pos.rank || "F",
      waveCount: Number.isFinite(pos.waveCount) ? pos.waveCount : 2,
      totalMonsters: Number.isFinite(pos.totalMonsters) ? pos.totalMonsters : 8,
      waveSizes: Array.isArray(pos.waveSizes) ? pos.waveSizes.slice() : null,
      targetMapKey: pos.targetMapKey || null,
      targetStartTile: pos.targetStartTile || null,
      sprite,
      hoverHighlight: null,
      isClosed: isRiftClosed(player, pos.id),
      openTextureKey,
      closedTextureKey,
    };

    updateRiftVisual(node);

    sprite.on("pointerover", () => {
      if (node.isClosed) return;
      if (!node.hoverHighlight && scene.add) {
        const overlay = scene.add.sprite(node.x, node.y, openTextureKey);
        overlay.setOrigin(sprite.originX, sprite.originY);
        overlay.setBlendMode(Phaser.BlendModes.ADD);
        overlay.setAlpha(0.35);
        overlay.setDepth((sprite.depth || 0) + 1);
        node.hoverHighlight = overlay;
      }
    });

    sprite.on("pointerout", () => {
      if (node.hoverHighlight) {
        node.hoverHighlight.destroy();
        node.hoverHighlight = null;
      }
    });

    sprite.on("pointerdown", (pointer, lx, ly, event) => {
      if (event?.stopPropagation) event.stopPropagation();
      if (isCraftPanelOpen()) return;
      if (scene.combatState?.enCours || scene.prepState?.actif) return;

      const mapKey = node.targetMapKey;
      const mapDefTarget = mapKey ? maps[mapKey] || null : null;
      const canTeleport = Boolean(mapDefTarget) && isRiftStageActive(player);

      openRiftModal({
        title: "Faille dimensionnelle",
        rank: node.rank,
        totalMonsters: node.totalMonsters,
        waveCount: node.waveCount,
        waveSizes: node.waveSizes,
        isClosed: node.isClosed,
        canTeleport,
        onTeleport: () => {
          if (!canTeleport) {
            addChatMessage(
              {
                kind: "system",
                author: "Systeme",
                channel: "quest",
                text: "La destination de la faille n'est pas configuree.",
              },
              { player }
            );
            return;
          }
          if (!onTeleport) return;
          onTeleport({
            targetMap: mapDefTarget,
            targetStartTile: node.targetStartTile,
            riftId: node.id,
          });
        },
      });
    });

    nodes.push(node);
    blockTile(scene, pos.tileX, pos.tileY);
  });

  scene.riftNodes = nodes;
}
