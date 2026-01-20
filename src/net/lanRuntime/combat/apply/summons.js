import { getNetPlayerId } from "../../../../app/session.js";
import { spawnSummonFromCaptured } from "../../../../features/combat/summons/summon.js";

export function applyCombatSummonsState({
  scene,
  player,
  state,
  buildEntityWorldPosition,
  msg,
}) {
  if (!Array.isArray(msg.summons)) return;
  const nextSummons = [];
  const kept = new Set();
  const mapForMove = scene.combatMap || scene.map;
  const layerForMove = scene.combatGroundLayer || scene.groundLayer;

  const findOwner = (ownerPlayerId) => {
    if (!Number.isInteger(ownerPlayerId)) return null;
    const localId = getNetPlayerId();
    if (localId && ownerPlayerId === localId) {
      return state?.joueur || player || null;
    }
    if (Array.isArray(scene.combatAllies)) {
      return (
        scene.combatAllies.find(
          (ally) => ally?.isPlayerAlly && Number(ally.netId) === ownerPlayerId
        ) || null
      );
    }
    return null;
  };

  msg.summons.forEach((s) => {
    const summonId = Number.isInteger(s?.summonId) ? s.summonId : null;
    const tileX = Number.isInteger(s.tileX) ? s.tileX : null;
    const tileY = Number.isInteger(s.tileY) ? s.tileY : null;
    if (summonId === null || tileX === null || tileY === null) return;
    let target =
      Array.isArray(scene.combatSummons)
        ? scene.combatSummons.find((sum) => sum && sum.id === summonId) || null
        : null;
    if (!target && mapForMove && layerForMove) {
      const owner = findOwner(s.ownerPlayerId);
      if (!owner || typeof s.monsterId !== "string") return;
      owner.capturedMonsterId = s.monsterId;
      if (Number.isFinite(s.level)) {
        owner.capturedMonsterLevel = s.level;
      }
      const created = spawnSummonFromCaptured(scene, owner, mapForMove, layerForMove, {
        preferTile: { x: tileX, y: tileY },
      });
      if (!created) return;
      created.id = summonId;
      created.isSummon = true;
      created.owner = owner;
      target = created;
    }
    if (!target) return;
    const isMoving =
      target.isMoving === true ||
      !!target.currentMoveTween ||
      !!target.__lanCombatMoveTween ||
      !!target.__lanMoveTween;
    if (!isMoving || msg.resync === true) {
      const pos = buildEntityWorldPosition(target, tileX, tileY);
      if (pos) {
        target.x = pos.x;
        target.y = pos.y;
      }
    }
    if (target.stats) {
      target.stats.hp = Number.isFinite(s.hp) ? s.hp : target.stats.hp;
      target.stats.hpMax = Number.isFinite(s.hpMax) ? s.hpMax : target.stats.hpMax;
    }
    if (!isMoving || msg.resync === true) {
      target.tileX = tileX;
      target.tileY = tileY;
      target.currentTileX = tileX;
      target.currentTileY = tileY;
      if (typeof target.setDepth === "function") {
        target.setDepth(target.y);
      }
    }
    if (Array.isArray(s.statusEffects)) {
      target.statusEffects = s.statusEffects.slice();
    }
    nextSummons.push(target);
    kept.add(target);
  });

  if (Array.isArray(scene.combatSummons)) {
    scene.combatSummons.forEach((sum) => {
      if (!sum || kept.has(sum)) return;
      if (typeof sum.destroy === "function") {
        sum.destroy();
      }
    });
  }
  scene.combatSummons = nextSummons;
}
