const PLAYER_AURA_COLOR = 0x2a9df4;
const ENEMY_AURA_COLOR = 0xff4444;

function ensureAuraState(scene) {
  if (!scene) return null;
  if (!scene.combatAuras) {
    scene.combatAuras = {
      items: new Map(),
    };
  }
  return scene.combatAuras;
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

function isEntityAlive(entity) {
  if (!entity || !entity.stats) return false;
  const hp =
    typeof entity.stats.hp === "number" ? entity.stats.hp : entity.stats.hpMax ?? 0;
  return hp > 0;
}

function drawAura(graphics, halfW, halfH, color) {
  graphics.clear();
  graphics.fillStyle(color, 0.20);

  const inset = 0.82;
  const w = halfW * inset;
  const h = halfH * inset;

  const points = [
    new Phaser.Math.Vector2(0, -h),
    new Phaser.Math.Vector2(w, 0),
    new Phaser.Math.Vector2(0, h),
    new Phaser.Math.Vector2(-w, 0),
  ];

  graphics.fillPoints(points, true);

  graphics.lineStyle(2, color, 0.6);
  graphics.beginPath();
  const gapRatio = 0.22;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const cutX = vx * gapRatio * 0.5;
    const cutY = vy * gapRatio * 0.5;
    graphics.moveTo(a.x, a.y);
    graphics.lineTo(midX - cutX, midY - cutY);
    graphics.moveTo(midX + cutX, midY + cutY);
    graphics.lineTo(b.x, b.y);
  }
  graphics.strokePath();

  const radiusX = w / Math.SQRT2;
  const radiusY = h / Math.SQRT2;
  graphics.lineStyle(2, color, 0.5);
  graphics.beginPath();
  const centers = [
    Math.PI / 4,
    (3 * Math.PI) / 4,
    (5 * Math.PI) / 4,
    (7 * Math.PI) / 4,
  ];
  const gap = 0.22;
  const steps = 80;
  let penDown = false;
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    let inGap = false;
    for (let j = 0; j < centers.length; j += 1) {
      const d = Math.abs(((t - centers[j] + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < gap) {
        inGap = true;
        break;
      }
    }
    if (inGap) {
      penDown = false;
      continue;
    }
    const x = Math.cos(t) * radiusX;
    const y = Math.sin(t) * radiusY;
    if (!penDown) {
      graphics.moveTo(x, y);
      penDown = true;
    } else {
      graphics.lineTo(x, y);
    }
  }
  graphics.strokePath();
}

function collectCombatEntities(scene) {
  const state = scene?.combatState;
  if (!state || !state.enCours) return [];

  const entries = [];
  const seen = new Set();
  const player = state.joueur || null;
  if (player) {
    entries.push({ entity: player, color: PLAYER_AURA_COLOR, isPlayer: true });
    seen.add(player);
  }

  const allies =
    scene.combatAllies && Array.isArray(scene.combatAllies)
      ? scene.combatAllies
      : [];
  allies.forEach((ally) => {
    if (!ally || seen.has(ally)) return;
    entries.push({ entity: ally, color: PLAYER_AURA_COLOR, isPlayer: true });
    seen.add(ally);
  });

  const summons =
    scene.combatSummons && Array.isArray(scene.combatSummons)
      ? scene.combatSummons
      : [];
  summons.forEach((summon) => {
    if (!summon || seen.has(summon)) return;
    const isPlayerOwned = summon.owner === player;
    const color = isPlayerOwned ? PLAYER_AURA_COLOR : ENEMY_AURA_COLOR;
    entries.push({ entity: summon, color, isPlayer: false });
    seen.add(summon);
  });

  const monsters =
    scene.combatMonsters && Array.isArray(scene.combatMonsters)
      ? scene.combatMonsters
      : state.monstre
        ? [state.monstre]
        : [];
  monsters.forEach((monster) => {
    if (!monster || seen.has(monster)) return;
    entries.push({ entity: monster, color: ENEMY_AURA_COLOR, isPlayer: false });
    seen.add(monster);
  });

  return entries;
}

function getAuraWorldCenter(entity, map, groundLayer, isPlayer) {
  if (typeof entity?.x === "number" && typeof entity?.y === "number") {
    const offX = typeof entity.renderOffsetX === "number" ? entity.renderOffsetX : 0;
    const offY = typeof entity.renderOffsetY === "number" ? entity.renderOffsetY : 0;
    const cx = entity.x - offX;
    let cy = entity.y - offY;
    if (!isPlayer) {
      cy -= map.tileHeight / 2;
    }
    return { x: cx, y: cy };
  }

  const tile = getEntityTile(entity);
  if (!tile) return null;
  const worldPos = map.tileToWorldXY(
    tile.x,
    tile.y,
    undefined,
    undefined,
    groundLayer
  );
  return {
    x: worldPos.x + map.tileWidth / 2,
    y: worldPos.y + map.tileHeight / 2,
  };
}

export function updateCombatAuras(scene) {
  const state = scene?.combatState;
  if (!state || !state.enCours) {
    clearCombatAuras(scene);
    return;
  }

  const map = scene.combatMap || scene.map;
  const groundLayer = scene.combatGroundLayer || scene.groundLayer;
  if (!map || !groundLayer) return;

  const auraState = ensureAuraState(scene);
  if (!auraState) return;

  const entries = collectCombatEntities(scene);
  const active = new Set();
  const halfW = map.tileWidth / 2;
  const halfH = map.tileHeight / 2;
  const baseDepth =
    typeof scene.maxGroundDepth === "number" ? scene.maxGroundDepth : 1;

  entries.forEach(({ entity, color, isPlayer }) => {
    if (!isEntityAlive(entity) || entity.destroyed) return;
    const center = getAuraWorldCenter(entity, map, groundLayer, isPlayer);
    if (!center) return;

    active.add(entity);

    let aura = auraState.items.get(entity);
    if (!aura) {
      const g = scene.add.graphics();
      if (scene.hudCamera) {
        scene.hudCamera.ignore(g);
      }
      g.setDepth(baseDepth + 0.12);
      aura = {
        graphics: g,
        color,
        tileWidth: map.tileWidth,
        tileHeight: map.tileHeight,
      };
      auraState.items.set(entity, aura);
      drawAura(g, halfW, halfH, color);
    }

    if (
      aura.color !== color ||
      aura.tileWidth !== map.tileWidth ||
      aura.tileHeight !== map.tileHeight
    ) {
      aura.color = color;
      aura.tileWidth = map.tileWidth;
      aura.tileHeight = map.tileHeight;
      drawAura(aura.graphics, halfW, halfH, color);
    }

    aura.graphics.x = center.x;
    aura.graphics.y = center.y;
    aura.graphics.setDepth(baseDepth + 0.12);
  });

  auraState.items.forEach((aura, entity) => {
    if (active.has(entity)) return;
    if (aura?.graphics?.destroy) {
      aura.graphics.destroy();
    }
    auraState.items.delete(entity);
  });
}

export function clearCombatAuras(scene) {
  if (!scene?.combatAuras) return;
  scene.combatAuras.items.forEach((aura) => {
    if (aura?.graphics?.destroy) {
      aura.graphics.destroy();
    }
  });
  scene.combatAuras.items.clear();
}
