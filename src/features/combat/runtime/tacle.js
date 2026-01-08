import { showFloatingTextOverEntity } from "../runtime/floatingText.js";

function getEntityTile(entity) {
  const x =
    typeof entity?.currentTileX === "number"
      ? entity.currentTileX
      : typeof entity?.tileX === "number"
      ? entity.tileX
      : null;
  const y =
    typeof entity?.currentTileY === "number"
      ? entity.currentTileY
      : typeof entity?.tileY === "number"
      ? entity.tileY
      : null;
  if (typeof x !== "number" || typeof y !== "number") return null;
  return { x, y };
}

function getDerivedTacle(stats) {
  if (!stats) return 0;
  if (typeof stats.tacle === "number") return Math.max(0, stats.tacle);
  const agi = typeof stats.agilite === "number" ? stats.agilite : 0;
  return Math.max(0, Math.floor(agi / 10));
}

function getDerivedFuite(stats) {
  if (!stats) return 0;
  if (typeof stats.fuite === "number") return Math.max(0, stats.fuite);
  const agi = typeof stats.agilite === "number" ? stats.agilite : 0;
  return Math.max(0, Math.floor(agi / 10));
}

function getAdjacentEnemies(scene, mover) {
  const state = scene?.combatState;
  if (!state || !state.enCours || !mover) return [];

  if (mover.isCombatAlly) {
    const list =
      scene?.combatMonsters && Array.isArray(scene.combatMonsters)
        ? scene.combatMonsters
        : [];
    return list;
  }

  if (state.joueur === mover) {
    const list =
      scene?.combatMonsters && Array.isArray(scene.combatMonsters)
        ? scene.combatMonsters
        : [];
    return list;
  }

  const targets = [];
  if (state.joueur) targets.push(state.joueur);
  if (scene?.combatAllies && Array.isArray(scene.combatAllies)) {
    targets.push(...scene.combatAllies);
  }
  if (scene?.combatSummons && Array.isArray(scene.combatSummons)) {
    targets.push(...scene.combatSummons);
  }
  return targets;
}

function hasAdjacentEnemy(scene, mover) {
  const moverTile = getEntityTile(mover);
  if (!moverTile) return false;
  const enemies = getAdjacentEnemies(scene, mover);
  for (const enemy of enemies) {
    if (!enemy || !enemy.stats) continue;
    const hp = typeof enemy.stats.hp === "number" ? enemy.stats.hp : enemy.stats.hpMax ?? 0;
    if (hp <= 0) continue;
    const t = getEntityTile(enemy);
    if (!t) continue;
    const dist = Math.abs(t.x - moverTile.x) + Math.abs(t.y - moverTile.y);
    if (dist === 1) return true;
  }
  return false;
}

function getTotalAdjacentTacle(scene, mover) {
  const moverTile = getEntityTile(mover);
  if (!moverTile) return 0;
  let total = 0;

  const enemies = getAdjacentEnemies(scene, mover);
  enemies.forEach((enemy) => {
    if (!enemy || !enemy.stats) return;
    const hp = typeof enemy.stats.hp === "number" ? enemy.stats.hp : enemy.stats.hpMax ?? 0;
    if (hp <= 0) return;
    const t = getEntityTile(enemy);
    if (!t) return;
    const dist = Math.abs(t.x - moverTile.x) + Math.abs(t.y - moverTile.y);
    if (dist !== 1) return;
    const tacle = getDerivedTacle(enemy.stats);
    if (tacle > 0) total += tacle;
  });

  return total;
}

function computeTacleMalusPercent(tacle, fuite, hasAdjacency = false) {
  if (tacle <= 0) {
    if (!hasAdjacency) return 0;
    return fuite >= 2 ? 0 : 0.25;
  }
  if (fuite <= 0 && tacle <= 1) return 0.25;
  if (fuite <= 0 && tacle <= 2) return 0.5;
  if (fuite >= tacle * 1.5) return 0;

  if (fuite >= tacle) {
    const span = tacle * 0.5;
    const progress = (fuite - tacle) / span;
    const pct = 0.25 * (1 - Math.min(1, Math.max(0, progress)));
    return pct;
  }

  const pct = (tacle - fuite) / tacle;
  return Math.min(1, Math.max(0.25, pct));
}

function computeLoss(amount, pct) {
  if (amount <= 0 || pct <= 0) return 0;
  const raw = Math.ceil(amount * pct);
  return Math.max(1, raw);
}

export function getTaclePenaltyPreview(scene, mover) {
  const state = scene?.combatState;
  if (!state || !state.enCours || !mover || !mover.stats) {
    return { paLoss: 0, pmLoss: 0, malusPct: 0 };
  }

  const basePa = Number.isFinite(state.paRestants)
    ? state.paRestants
    : mover.stats?.pa ?? 0;
  const basePm = Number.isFinite(state.pmRestants)
    ? state.pmRestants
    : mover.stats?.pm ?? 0;

  const tacle = getTotalAdjacentTacle(scene, mover);
  const hasAdjacency = hasAdjacentEnemy(scene, mover);

  const fuite = getDerivedFuite(mover.stats);
  const malusPct = computeTacleMalusPercent(tacle, fuite, hasAdjacency);
  if (malusPct <= 0) {
    return { paLoss: 0, pmLoss: 0, malusPct: 0 };
  }

  const paLoss = computeLoss(basePa, malusPct);
  const pmLoss = computeLoss(basePm, malusPct);

  return { paLoss, pmLoss, malusPct };
}

export function applyTaclePenalty(scene, mover) {
  const state = scene?.combatState;
  if (!state || !state.enCours || !mover || !mover.stats) {
    return { paLoss: 0, pmLoss: 0, malusPct: 0 };
  }

  const basePa = Number.isFinite(state.paRestants)
    ? state.paRestants
    : mover.stats?.pa ?? 0;
  const basePm = Number.isFinite(state.pmRestants)
    ? state.pmRestants
    : mover.stats?.pm ?? 0;

  const tacle = getTotalAdjacentTacle(scene, mover);
  const hasAdjacency = hasAdjacentEnemy(scene, mover);

  const fuite = getDerivedFuite(mover.stats);
  const malusPct = computeTacleMalusPercent(tacle, fuite, hasAdjacency);
  if (malusPct <= 0) {
    return { paLoss: 0, pmLoss: 0, malusPct: 0 };
  }

  const paLoss = computeLoss(basePa, malusPct);
  const pmLoss = computeLoss(basePm, malusPct);

  state.paRestants = Math.max(0, basePa - paLoss);
  state.pmRestants = Math.max(0, basePm - pmLoss);

  if (state.joueur === mover && typeof mover.updateHudApMp === "function") {
    mover.updateHudApMp(state.paRestants, state.pmRestants);
  }

  if (scene && mover && (paLoss > 0 || pmLoss > 0)) {
    const showPm = () => {
      if (pmLoss > 0) {
        showFloatingTextOverEntity(scene, mover, `-${pmLoss} PM`, { color: "#22c55e" });
      }
    };
    const showPa = () => {
      if (paLoss > 0) {
        showFloatingTextOverEntity(scene, mover, `-${paLoss} PA`, { color: "#3b82f6" });
      }
    };
    showPm();
    if (pmLoss > 0 && paLoss > 0 && scene.time?.delayedCall) {
      scene.time.delayedCall(220, showPa);
    } else {
      showPa();
    }
  }

  return { paLoss, pmLoss, malusPct };
}

export { getEntityTile, getDerivedTacle, getDerivedFuite, computeTacleMalusPercent };
