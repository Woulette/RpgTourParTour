import { combatChallenges } from "./defs.js";
import { isTileBlocked } from "../collision/collisionGrid.js";
import { getCasterOriginTile } from "../systems/combat/spells/util.js";
import { getAliveCombatMonsters } from "../monsters/aiUtils.js";

function clamp01(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function pickRandom(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const idx = Math.floor(Math.random() * list.length);
  return list[idx] || null;
}

function hasGroundTile(groundLayer, tileX, tileY) {
  if (!groundLayer || typeof groundLayer.getTileAt !== "function") return true;
  const t = groundLayer.getTileAt(tileX, tileY);
  return !!(t && typeof t.index === "number" && t.index >= 0);
}

function getCombatMapAndLayer(scene) {
  const map = scene?.combatMap || scene?.map || null;
  const groundLayer = scene?.combatGroundLayer || scene?.groundLayer || null;
  return { map, groundLayer };
}

function findCandidateTilesAround(scene, map, groundLayer, fromX, fromY, radius) {
  const r = Math.max(1, radius | 0);
  const tiles = [];
  for (let dy = -r; dy <= r; dy += 1) {
    for (let dx = -r; dx <= r; dx += 1) {
      const x = fromX + dx;
      const y = fromY + dy;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      if (!hasGroundTile(groundLayer, x, y)) continue;
      if (isTileBlocked(scene, x, y)) continue;
      tiles.push({ x, y });
    }
  }
  return tiles;
}

function drawTargetTile(scene, tile, color = 0xfbbf24) {
  if (!scene || !tile) return null;
  const { map, groundLayer } = getCombatMapAndLayer(scene);
  if (!map || !groundLayer) return null;

  const base =
    typeof scene.maxGroundDepth === "number" ? scene.maxGroundDepth : 1;

  if (!scene.combatChallengeTargetGfx) {
    const g = scene.add.graphics();
    if (scene.hudCamera) scene.hudCamera.ignore(g);
    g.setDepth(base + 0.22);
    scene.combatChallengeTargetGfx = g;
  }

  const g = scene.combatChallengeTargetGfx;
  g.clear();

  const wp = map.tileToWorldXY(tile.x, tile.y, undefined, undefined, groundLayer);
  const cx = wp.x + map.tileWidth / 2;
  const cy = wp.y + map.tileHeight / 2;

  const halfW = map.tileWidth / 2;
  const halfH = map.tileHeight / 2;
  const points = [
    new Phaser.Math.Vector2(cx, cy - halfH),
    new Phaser.Math.Vector2(cx + halfW, cy),
    new Phaser.Math.Vector2(cx, cy + halfH),
    new Phaser.Math.Vector2(cx - halfW, cy),
  ];

  g.lineStyle(2, color, 0.95);
  g.fillStyle(color, 0.25);
  g.fillPoints(points, true);
  g.strokePoints(points, true);

  return g;
}

export function initCombatChallenge(scene) {
  const state = scene?.combatState;
  if (!scene || !state || !state.enCours) return null;

  // Si un challenge a déjà été préparé pendant la phase de préparation,
  // on le garde (pas de reroll).
  if (state.challenge) return state.challenge;

  const def = pickRandom(combatChallenges);
  if (!def) {
    state.challenge = null;
    return null;
  }

  const player = state.joueur;
  const hpMaxStart = player?.stats?.hpMax ?? player?.stats?.hp ?? 0;

  state.challenge = {
    id: def.id,
    label: def.label,
    description: def.description,
    kind: def.kind,
    params: def.params || {},
    rewards: def.rewards || { xpBonusPct: 0, dropBonusPct: 0 },
    startedAt: Date.now(),
    status: "active", // active | success | failed
    data: {
      hpMaxStart,
      targetTile: null,
    },
  };

  if (def.kind === "finish_on_tile") {
    const { map, groundLayer } = getCombatMapAndLayer(scene);
    if (map && groundLayer) {
      const { x: px, y: py } = getCasterOriginTile(player);
      const candidates = findCandidateTilesAround(
        scene,
        map,
        groundLayer,
        px,
        py,
        def.params?.radius ?? 4
      ).filter((t) => t && (t.x !== px || t.y !== py));

      const picked = pickRandom(candidates) || { x: px, y: py };
      state.challenge.data.targetTile = picked;
      drawTargetTile(scene, picked);
    }
  }

  return state.challenge;
}

export function initPrepChallenge(scene, prepState, player) {
  if (!scene || !prepState || !prepState.actif) return null;

  const def = pickRandom(combatChallenges);
  if (!def) {
    prepState.challenge = null;
    return null;
  }

  const hpMaxStart = player?.stats?.hpMax ?? player?.stats?.hp ?? 0;

  prepState.challenge = {
    id: def.id,
    label: def.label,
    description: def.description,
    kind: def.kind,
    params: def.params || {},
    rewards: def.rewards || { xpBonusPct: 0, dropBonusPct: 0 },
    startedAt: Date.now(),
    status: "active", // active | success | failed
    data: {
      hpMaxStart,
      targetTile: null,
    },
  };

  if (def.kind === "finish_on_tile") {
    // En préparation, on choisit une case parmi les cases de placement joueur
    // pour que l'objectif soit clair et atteignable.
    const allowed = Array.isArray(prepState.allowedTiles)
      ? prepState.allowedTiles.filter(Boolean)
      : [];
    const px = player?.currentTileX;
    const py = player?.currentTileY;
    const candidates = allowed.filter(
      (t) => t && (t.x !== px || t.y !== py)
    );

    const picked = pickRandom(candidates) || pickRandom(allowed) || null;
    if (picked) {
      prepState.challenge.data.targetTile = picked;
      drawTargetTile(scene, picked);
    }
  }

  return prepState.challenge;
}

export function cleanupCombatChallenge(scene) {
  if (!scene) return;
  if (scene.combatChallengeTargetGfx?.destroy) {
    scene.combatChallengeTargetGfx.destroy();
  }
  scene.combatChallengeTargetGfx = null;
}

export function getCombatChallengeState(scene) {
  const state = scene?.combatState;
  return state?.challenge || null;
}

export function getPrepChallengeState(scene) {
  const prep = scene?.prepState;
  return prep?.challenge || null;
}

export function getChallengeBonusesIfSuccessful(scene, { issue } = {}) {
  const st = getCombatChallengeState(scene);
  if (!st) return { ok: false, xpBonusPct: 0, dropBonusPct: 0, challenge: null };
  if (issue && issue !== "victoire") {
    return { ok: false, xpBonusPct: 0, dropBonusPct: 0, challenge: st };
  }
  if (st.status !== "success") {
    return { ok: false, xpBonusPct: 0, dropBonusPct: 0, challenge: st };
  }
  const xpBonusPct = clamp01(st.rewards?.xpBonusPct ?? 0);
  const dropBonusPct = clamp01(st.rewards?.dropBonusPct ?? 0);
  return { ok: true, xpBonusPct, dropBonusPct, challenge: st };
}

export function isEnemyAdjacentToPlayer(scene, player) {
  if (!scene || !player) return false;
  const { x: px, y: py } = getCasterOriginTile(player);
  const enemies = getAliveCombatMonsters(scene);
  return enemies.some((m) => {
    if (!m) return false;
    const mx = m.tileX ?? m.currentTileX;
    const my = m.tileY ?? m.currentTileY;
    if (typeof mx !== "number" || typeof my !== "number") return false;
    return Math.abs(mx - px) + Math.abs(my - py) === 1;
  });
}

export function registerChallengeFailure(scene, reason) {
  const st = getCombatChallengeState(scene);
  if (!st || st.status !== "active") return false;
  st.status = "failed";
  st.failReason = reason || "failed";
  return true;
}

// Challenge 3 : si le joueur lance un sort alors qu'un ennemi est au CAC,
// on laisse le sort partir mais le challenge est raté (pas de bonus).
export function registerNoCastMeleeViolation(scene, player) {
  const st = getCombatChallengeState(scene);
  if (!st || st.kind !== "no_cast_when_enemy_melee") {
    return { violated: false };
  }
  if (!player) return { violated: false };
  if (st.status !== "active") return { violated: false };

  const violated = isEnemyAdjacentToPlayer(scene, player);
  if (!violated) return { violated: false };

  st.data = st.data || {};
  st.data.noCastMeleeViolated = true;

  const firstTime = st.data.noCastMeleeNotified !== true;
  st.data.noCastMeleeNotified = true;

  registerChallengeFailure(scene, "cast_while_enemy_melee");

  return { violated: true, firstTime };
}

export function finalizeCombatChallenge(scene, { issue } = {}) {
  const st = getCombatChallengeState(scene);
  if (!st) return null;

  const player = scene?.combatState?.joueur;
  const victory = issue === "victoire";

  if (!victory) {
    st.status = "failed";
    st.failReason = "not_victory";
    return st;
  }

  if (st.kind === "hp_threshold_end") {
    const hp = player?.stats?.hp ?? 0;
    const hpMaxStart = st.data?.hpMaxStart ?? player?.stats?.hpMax ?? 0;
    const ratio = hpMaxStart > 0 ? hp / hpMaxStart : 0;
    st.status = ratio >= (st.params?.minHpRatio ?? 0.7) ? "success" : "failed";
    if (st.status !== "success") st.failReason = "hp_too_low";
  } else if (st.kind === "finish_on_tile") {
    const target = st.data?.targetTile;
    const px = player?.currentTileX;
    const py = player?.currentTileY;
    const ok =
      target &&
      typeof px === "number" &&
      typeof py === "number" &&
      px === target.x &&
      py === target.y;
    st.status = ok ? "success" : "failed";
    if (!ok) st.failReason = "not_on_target_tile";
  } else if (st.kind === "no_cast_when_enemy_melee") {
    // Si le joueur a lancé un sort au CAC au moins une fois : échec (déjà enregistré).
    if (st.status !== "failed" && st.data?.noCastMeleeViolated === true) {
      st.status = "failed";
      st.failReason = "cast_while_enemy_melee";
    }
    if (st.status !== "failed") {
      st.status = "success";
    }
  } else {
    st.status = "failed";
    st.failReason = "unknown_kind";
  }

  return st;
}
