import { getTaclePenaltyPreview } from "./tacle.js";

// Logique de déplacement en combat et preview du chemin.

// Limite un chemin en fonction des règles de combat (tour, PM restants).
// Retourne { path, moveCost } ou null si le déplacement est interdit.
export function limitPathForCombat(scene, player, path) {
  const state = scene.combatState;
  if (!state || !state.enCours) {
    return { path, moveCost: 0 };
  }

  // Pour l'instant on ne gère que le tour du joueur
  if (state.tour !== "joueur") {
    return null;
  }

  if (!path || path.length === 0) {
    return null;
  }

  if (state.pmRestants <= 0) {
    return null;
  }

  let limitedPath = path;
  if (path.length > state.pmRestants) {
    limitedPath = path.slice(0, state.pmRestants);
  }

  const moveCost = limitedPath.length;
  if (moveCost === 0) {
    return null;
  }

  return { path: limitedPath, moveCost };
}

// Applique le coût de déplacement en combat (PM) et met à jour le HUD.
export function applyMoveCost(scene, player, moveCost) {
  if (!moveCost) return;

  const state = scene.combatState;
  if (!state || !state.enCours) return;
  if (state.joueur !== player) return;

  state.pmRestants = Math.max(0, state.pmRestants - moveCost);

  if (typeof player.updateHudApMp === "function") {
    player.updateHudApMp(state.paRestants, state.pmRestants);
  }
}

// Met à jour la prévisualisation du chemin en combat (cases vertes).
// path doit déjà être limité par les règles de combat (PM, tour).
export function updateCombatPreview(scene, map, groundLayer, path) {
  // On crée le graphics une seule fois, réutilisé ensuite
  if (!scene.combatPreview) {
    const g = scene.add.graphics();
    if (scene.hudCamera) {
      scene.hudCamera.ignore(g);
    }
    // Au-dessus des calques sol (y compris calque 2), mais sous les sprites/décors.
    const base =
      typeof scene.maxGroundDepth === "number" ? scene.maxGroundDepth : 1;
    g.setDepth(base + 0.2);
    scene.combatPreview = g;
  }

  const preview = scene.combatPreview;
  preview.clear();

  const state = scene.combatState;
  if (!state || !state.enCours || state.tour !== "joueur") {
    return;
  }

  if (!path || path.length === 0) {
    return;
  }

  const halfW = map.tileWidth / 2;
  const halfH = map.tileHeight / 2;
  const allowedColor = 0x00ff55;
  const blockedColor = 0xff4444;
  const allowedFill = 0.25;
  const blockedFill = 0.18;

  let blockedFromIndex = null;
  if (state && state.enCours && state.tour === "joueur" && state.joueur) {
    const { pmLoss } = getTaclePenaltyPreview(scene, state.joueur);
    const effectivePm = Math.max(0, (state.pmRestants ?? 0) - pmLoss);
    blockedFromIndex = effectivePm;
  }

  for (let i = 0; i < path.length; i += 1) {
    const step = path[i];
    const wp = map.tileToWorldXY(
      step.x,
      step.y,
      undefined,
      undefined,
      groundLayer
    );
    const cx = wp.x + map.tileWidth / 2;
    const cy = wp.y + map.tileHeight / 2;

    const points = [
      new Phaser.Math.Vector2(cx, cy - halfH),
      new Phaser.Math.Vector2(cx + halfW, cy),
      new Phaser.Math.Vector2(cx, cy + halfH),
      new Phaser.Math.Vector2(cx - halfW, cy),
    ];

    const isBlocked = typeof blockedFromIndex === "number" && i >= blockedFromIndex;
    const color = isBlocked ? blockedColor : allowedColor;
    const fill = isBlocked ? blockedFill : allowedFill;
    preview.lineStyle(1, color, 1);
    preview.fillStyle(color, fill);
    preview.fillPoints(points, true);
    preview.strokePoints(points, true);
  }
}
