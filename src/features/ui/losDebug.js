import { isTileBlocked } from "../../collision/collisionGrid.js";
import { getAliveCombatMonsters } from "../monsters/ai/aiUtils.js";
import { getAliveCombatAllies } from "../combat/summons/summon.js";

function isDebugEnabled() {
  if (typeof window === "undefined") return false;
  if (window.__ENABLE_CHEATS__ === true) return true;
  const host = window.location?.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

function getEntityTile(entity) {
  if (!entity) return null;
  const x =
    typeof entity.currentTileX === "number"
      ? entity.currentTileX
      : typeof entity.tileX === "number"
      ? entity.tileX
      : null;
  const y =
    typeof entity.currentTileY === "number"
      ? entity.currentTileY
      : typeof entity.tileY === "number"
      ? entity.tileY
      : null;
  if (typeof x !== "number" || typeof y !== "number") return null;
  return { x, y };
}

function getAliveCombatSummons(scene) {
  const list =
    scene?.combatSummons && Array.isArray(scene.combatSummons)
      ? scene.combatSummons
      : [];
  return list.filter((s) => {
    if (!s || !s.stats) return false;
    if (s.isCombatAlly) return false;
    const hp = typeof s.stats.hp === "number" ? s.stats.hp : s.stats.hpMax ?? 0;
    return hp > 0;
  });
}

function isTileOccupiedByCombatEntity(scene, tileX, tileY) {
  const state = scene?.combatState;
  if (state?.joueur) {
    const p = getEntityTile(state.joueur);
    if (p && p.x === tileX && p.y === tileY) return true;
  }

  const monsters = getAliveCombatMonsters(scene);
  if (monsters.some((m) => {
    const t = getEntityTile(m);
    return t ? t.x === tileX && t.y === tileY : false;
  })) {
    return true;
  }

  const summons = getAliveCombatSummons(scene);
  if (summons.some((s) => {
    const t = getEntityTile(s);
    return t ? t.x === tileX && t.y === tileY : false;
  })) {
    return true;
  }

  const allies = getAliveCombatAllies(scene);
  return allies.some((s) => {
    const t = getEntityTile(s);
    return t ? t.x === tileX && t.y === tileY : false;
  });
}

function traceLineOfSight(scene, fromX, fromY, toX, toY) {
  const path = [];
  const blocked = [];

  if (fromX === toX && fromY === toY) {
    return { path, blocked };
  }

  const dx = Math.abs(toX - fromX);
  const dy = Math.abs(toY - fromY);
  const sx = fromX < toX ? 1 : -1;
  const sy = fromY < toY ? 1 : -1;
  let err = dx - dy;

  let x = fromX;
  let y = fromY;

  const isBlocking = (tx, ty) => {
    if (tx === toX && ty === toY) return false;
    if (isTileBlocked(scene, tx, ty)) return true;
    if (isTileOccupiedByCombatEntity(scene, tx, ty)) return true;
    return false;
  };

  while (!(x === toX && y === toY)) {
    const e2 = 2 * err;
    let nx = x;
    let ny = y;
    if (e2 > -dy) {
      err -= dy;
      nx = x + sx;
    }
    if (e2 < dx) {
      err += dx;
      ny = y + sy;
    }

    if (nx !== x && ny !== y) {
      const blockA = isBlocking(x + sx, y);
      const blockB = isBlocking(x, y + sy);
      if (blockA) blocked.push({ x: x + sx, y });
      if (blockB) blocked.push({ x, y: y + sy });
      if (blockA || blockB) return { path, blocked };
    }

    x = nx;
    y = ny;

    if (x === toX && y === toY) break;

    if (isBlocking(x, y)) {
      blocked.push({ x, y });
      return { path, blocked };
    }
    path.push({ x, y });
  }

  return { path, blocked };
}

export function attachLosDebug(scene) {
  if (!scene || !scene.add || !isDebugEnabled()) return;
  if (scene.__losDebug) return;

  const graphics = scene.add.graphics();
  graphics.setDepth(300000);
  if (scene.hudCamera) scene.hudCamera.ignore(graphics);

  const labels = [];
  const cleanupLabels = () => {
    labels.forEach((l) => l.destroy());
    labels.length = 0;
  };

  const ensureLabel = (index) => {
    if (labels[index]) return labels[index];
    const text = scene.add.text(0, 0, "", {
      fontFamily: "Arial",
      fontSize: 12,
      color: "#00e5ff",
      stroke: "#000000",
      strokeThickness: 3,
    });
    text.setOrigin(0.5, 1);
    if (text.setResolution) text.setResolution(2);
    text.setDepth(300001);
    if (scene.hudCamera) scene.hudCamera.ignore(text);
    labels[index] = text;
    return text;
  };

  const update = () => {
    if (!scene.__losDebugEnabled) return;
    const state = scene.combatState;
    if (!state || !state.enCours) {
      graphics.clear();
      cleanupLabels();
      return;
    }

    const map = scene.combatMap || scene.map;
    const groundLayer = scene.combatGroundLayer || scene.groundLayer;
    if (!map || !groundLayer) return;

    graphics.clear();

    const entities = [];
    if (state.joueur) entities.push(state.joueur);
    const monsters = getAliveCombatMonsters(scene);
    entities.push(...monsters);
    const summons = getAliveCombatSummons(scene);
    entities.push(...summons);
    const allies = getAliveCombatAllies(scene);
    entities.push(...allies);

    entities.forEach((entity, i) => {
      const t = getEntityTile(entity);
      if (!t) return;
      const label = ensureLabel(i);
      label.setText(`${t.x},${t.y}`);
      label.setPosition(entity.x, entity.y - 6);
    });
    for (let i = entities.length; i < labels.length; i += 1) {
      if (labels[i]) labels[i].setText("");
    }

    const target = scene.__combatTileHoverEntity || null;
    const playerTile = getEntityTile(state.joueur);
    const targetTile = getEntityTile(target);
    if (!playerTile || !targetTile) return;

    const trace = traceLineOfSight(
      scene,
      playerTile.x,
      playerTile.y,
      targetTile.x,
      targetTile.y
    );

    const drawCenter = (tx, ty) => {
      const wp = map.tileToWorldXY(tx, ty, undefined, undefined, groundLayer);
      const cx = wp.x + map.tileWidth / 2;
      const cy = wp.y + map.tileHeight / 2;
      return { cx, cy };
    };

    const start = drawCenter(playerTile.x, playerTile.y);
    const end = drawCenter(targetTile.x, targetTile.y);
    graphics.lineStyle(2, 0x00e5ff, 0.85);
    graphics.beginPath();
    graphics.moveTo(start.cx, start.cy);
    graphics.lineTo(end.cx, end.cy);
    graphics.strokePath();

    graphics.fillStyle(0xff4d4d, 0.9);
    trace.blocked.forEach((b) => {
      const p = drawCenter(b.x, b.y);
      graphics.fillCircle(p.cx, p.cy, 6);
    });
  };

  scene.__losDebug = { graphics, update };
  scene.__losDebugEnabled = true;

  if (scene.input?.keyboard) {
    scene.input.keyboard.on("keydown-L", () => {
      scene.__losDebugEnabled = !scene.__losDebugEnabled;
      if (!scene.__losDebugEnabled) {
        graphics.clear();
        cleanupLabels();
      }
    });
  }

  scene.events.on("update", update);
  scene.events.once("shutdown", () => {
    scene.events.off("update", update);
    graphics.destroy();
    cleanupLabels();
    scene.__losDebug = null;
  });
}
