import { getNetPlayerId } from "../../../../app/session.js";

export function applyCombatPlayersState({
  scene,
  player,
  remotePlayersData,
  updateBlockedTile,
  buildEntityWorldPosition,
  state,
  localPlayer,
  msg,
}) {
  if (!Array.isArray(msg.players)) return;

  msg.players.forEach((p) => {
    if (!Number.isInteger(p?.playerId)) return;
    if (scene.prepState?.actif) {
      const tx = Number.isInteger(p.tileX) ? p.tileX : null;
      const ty = Number.isInteger(p.tileY) ? p.tileY : null;
      if (tx !== null && ty !== null) {
        if (!(scene.__lanPrepServerPlacements instanceof Map)) {
          scene.__lanPrepServerPlacements = new Map();
        }
        scene.__lanPrepServerPlacements.set(p.playerId, { x: tx, y: ty });
      }
    }
    if (remotePlayersData) {
      const prev = remotePlayersData.get(p.playerId) || { id: p.playerId };
      remotePlayersData.set(p.playerId, {
        ...prev,
        combatHp: Number.isFinite(p.hp) ? p.hp : prev.combatHp,
        combatHpMax: Number.isFinite(p.hpMax) ? p.hpMax : prev.combatHpMax,
        classId:
          typeof p.classId === "string"
            ? p.classId
            : typeof prev.classId === "string"
              ? prev.classId
              : undefined,
        displayName:
          typeof p.displayName === "string"
            ? p.displayName
            : typeof prev.displayName === "string"
              ? prev.displayName
              : undefined,
      });
    }
    const tileX = Number.isInteger(p.tileX) ? p.tileX : null;
    const tileY = Number.isInteger(p.tileY) ? p.tileY : null;
    if (tileX === null || tileY === null) return;
    let target = null;
    const localId = getNetPlayerId();
    if (localId && p.playerId === localId) {
      target = localPlayer || player;
    } else if (Array.isArray(scene.combatAllies)) {
      target =
        scene.combatAllies.find(
          (ally) => ally?.isPlayerAlly && Number(ally.netId) === p.playerId
        ) || null;
    }
    if (!target) return;
    if (scene.prepState?.actif) {
      if (localId && p.playerId === localId) {
        const manual = scene.prepState?.__lanManualPlacement || null;
        if (
          manual &&
          Number.isInteger(manual.x) &&
          Number.isInteger(manual.y) &&
          (manual.x !== tileX || manual.y !== tileY)
        ) {
          return;
        }
      } else if (Array.isArray(scene.prepState.allowedTiles)) {
        const allowed = scene.prepState.allowedTiles.some(
          (t) => t && t.x === tileX && t.y === tileY
        );
        if (!allowed) {
          return;
        }
      }
    }
    if (Number.isInteger(p.playerId)) {
      if (!Number.isInteger(target.netId)) target.netId = p.playerId;
      if (!Number.isInteger(target.id)) target.id = p.playerId;
    }
    const isMoving =
      target.isMoving === true ||
      !!target.currentMoveTween ||
      !!target.__lanCombatMoveTween ||
      !!target.__lanMoveTween;
    if (!isMoving || msg.resync === true || scene.prepState?.actif) {
      const pos = buildEntityWorldPosition(target, tileX, tileY);
      if (!pos) return;
      target.x = pos.x;
      target.y = pos.y;
      target.currentTileX = tileX;
      target.currentTileY = tileY;
      if (typeof target.setDepth === "function") {
        target.setDepth(target.y);
      }
      if (scene.prepState?.actif && typeof updateBlockedTile === "function") {
        updateBlockedTile(target, tileX, tileY);
      }
    }
    if (target.stats) {
      target.stats.hp = Number.isFinite(p.hp) ? p.hp : target.stats.hp;
      target.stats.hpMax = Number.isFinite(p.hpMax) ? p.hpMax : target.stats.hpMax;
    }
    if (typeof p.displayName === "string" && p.displayName) {
      target.displayName = p.displayName;
    }
    if (typeof p.capturedMonsterId === "string") {
      target.capturedMonsterId = p.capturedMonsterId;
    }
    if (Number.isFinite(p.capturedMonsterLevel)) {
      target.capturedMonsterLevel = p.capturedMonsterLevel;
    }
    if (Array.isArray(p.statusEffects)) {
      target.statusEffects = p.statusEffects.slice();
    }
    if (target === state?.joueur && typeof target.updateHudHp === "function") {
      const hpMax = target.stats?.hpMax ?? target.stats?.hp ?? 0;
      target.updateHudHp(target.stats?.hp ?? 0, hpMax);
    }
  });
}
