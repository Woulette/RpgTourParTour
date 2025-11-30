// Système de combat tour par tour.
// - gestion des tours, PA / PM
// - phase de préparation (placement) avant le vrai combat

import { startOutOfCombatRegen } from "./regen.js";
import { COMBAT_PATTERNS } from "../combatPatterns.js";

// Crée l'état de combat à partir d'un joueur et d'un monstre.
export function createCombatState(player, monster) {
  const paJoueur = player.stats?.pa ?? 6;
  const pmJoueur = player.stats?.pm ?? 3;

  const paMonstre = monster.stats?.pa ?? 6;
  const pmMonstre = monster.stats?.pm ?? 3;

  return {
    enCours: true,

    // Informations générales sur le combat
    startTime: Date.now(),
    xpGagne: 0,
    goldGagne: 0,
    issue: null, // "victoire" | "defaite"

    tour: "joueur", // "joueur" ou "monstre"
    joueur: player,
    monstre: monster,
    paRestants: paJoueur,
    pmRestants: pmJoueur,
    paBaseJoueur: paJoueur,
    pmBaseJoueur: pmJoueur,
    paBaseMonstre: paMonstre,
    pmBaseMonstre: pmMonstre,
  };
}

// -----------------------------------------------------------
//  PHASE DE PRÉPARATION
// -----------------------------------------------------------

// Détermine quelques cases de placement autour du monstre.
// Détermine les cases de placement du joueur autour du monstre
// en utilisant un paterne défini dans combatPatterns.js.
function computePlacementTiles(map, monsterTileX, monsterTileY) {
  const pattern = COMBAT_PATTERNS.close_melee;

  // Sécurité : si le paterne n'est pas défini, on garde l'ancien comportement.
  if (!pattern || !Array.isArray(pattern.playerOffsets)) {
    const candidates = [
      { dx: -2, dy: 0 },
      { dx: -1, dy: 1 },
      { dx: 0, dy: 2 },
      { dx: 1, dy: 1},
    ];

    const fallback = [];
    for (const { dx, dy } of candidates) {
      const tx = monsterTileX + dx;
      const ty = monsterTileY + dy;
      if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
        fallback.push({ x: tx, y: ty });
      }
    }

    if (fallback.length === 0) {
      fallback.push({ x: monsterTileX, y: monsterTileY });
    }

    return fallback;
  }

  const tiles = [];

  for (const { x: dx, y: dy } of pattern.playerOffsets) {
    const tx = monsterTileX + dx;
    const ty = monsterTileY + dy;

    if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
      tiles.push({ x: tx, y: ty });
    }
  }

  // Si, pour une raison quelconque, aucune case n'est valide,
  // on retombe sur la case du monstre pour ne pas casser le combat.
  if (tiles.length === 0) {
    tiles.push({ x: monsterTileX, y: monsterTileY });
  }

  return tiles;
}


// Lance la phase de préparation (placement) avant le combat.
export function startPrep(scene, player, monster, map, groundLayer) {
  if (
    !monster ||
    typeof monster.tileX !== "number" ||
    typeof monster.tileY !== "number"
  ) {
    // Pas de coordonnées de tuile fiables pour le monstre : on démarre directement le combat.
    startCombat(scene, player, monster);
    return;
  }

  // Si une préparation est déjà active, on ne recrée pas tout.
  if (scene.prepState && scene.prepState.actif) {
    return;
  }

  // On mémorise la carte / layer de combat pour l'IA monstre, les sorts, etc.
  scene.combatMap = map;
  scene.combatGroundLayer = groundLayer;
    // Petit fondu noir à l'entrée en préparation (au clic sur le monstre)
    const cam = scene.cameras && scene.cameras.main;
    if (cam && cam.fadeOut && cam.fadeIn) {
      cam.once("camerafadeoutcomplete", () => {
        cam.fadeIn(1300, 0, 0, 0);
      });
      cam.fadeOut(0, 0, 0, 0);
    }
  

  const allowedTiles = computePlacementTiles(map, monster.tileX, monster.tileY);

  // Cases ennemies calculées à partir du même paterne
  let enemyTiles = [];
  const pattern = COMBAT_PATTERNS.close_melee;
  if (pattern && Array.isArray(pattern.enemyOffsets)) {
    for (const { x: dx, y: dy } of pattern.enemyOffsets) {
      const tx = monster.tileX + dx;
      const ty = monster.tileY + dy;
      if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
        enemyTiles.push({ x: tx, y: ty });
      }
    }
  }
    // Dès la préparation, on choisit une case rouge aléatoire pour placer le monstre.
    if (enemyTiles.length > 0) {
      const index = Math.floor(Math.random() * enemyTiles.length);
      const tile = enemyTiles[index];
  
      monster.tileX = tile.x;
      monster.tileY = tile.y;
  
      const worldPos = map.tileToWorldXY(
        tile.x,
        tile.y,
        undefined,
        undefined,
        groundLayer
      );
      monster.x = worldPos.x + map.tileWidth / 2;
      monster.y = worldPos.y + map.tileHeight / 2;
    }
    // Placement automatique du joueur sur une case bleue aléatoire dès la préparation.
    if (allowedTiles.length > 0) {
      const currentX = player.currentTileX;
      const currentY = player.currentTileY;
  
      // On évite de reprendre exactement la tuile actuelle si possible.
      let playerCandidates = allowedTiles.filter(
        (t) => t.x !== currentX || t.y !== currentY
      );
      if (playerCandidates.length === 0) {
        playerCandidates = allowedTiles;
      }
  
      const idx = Math.floor(Math.random() * playerCandidates.length);
      const tile = playerCandidates[idx];
  
      player.currentTileX = tile.x;
      player.currentTileY = tile.y;
  
      const worldPosPlayer = map.tileToWorldXY(
        tile.x,
        tile.y,
        undefined,
        undefined,
        groundLayer
      );
      player.x = worldPosPlayer.x + map.tileWidth / 2;
      player.y = worldPosPlayer.y + map.tileHeight / 2;
    }
  

  const highlights = [];
  const halfW = map.tileWidth / 2;
  const halfH = map.tileHeight / 2;

  // Surbrillance des cases de placement joueur (bleu)
  for (const tile of allowedTiles) {
    const worldPos = map.tileToWorldXY(
      tile.x,
      tile.y,
      undefined,
      undefined,
      groundLayer
    );
    const cx = worldPos.x + map.tileWidth / 2;
    const cy = worldPos.y + map.tileHeight / 2;

    const g = scene.add.graphics();
    g.lineStyle(2, 0x2a9df4, 1);
    g.fillStyle(0x2a9df4, 0.7);

    const points = [
      new Phaser.Math.Vector2(cx, cy - halfH),
      new Phaser.Math.Vector2(cx + halfW, cy),
      new Phaser.Math.Vector2(cx, cy + halfH),
      new Phaser.Math.Vector2(cx - halfW, cy),
    ];

    g.fillPoints(points, true);
    g.strokePoints(points, true);

    if (scene.hudCamera) {
      scene.hudCamera.ignore(g);
    }

    highlights.push(g);
  }

  // Surbrillance des cases "cible" ennemies (rouge)
  for (const tile of enemyTiles) {
    const worldPos = map.tileToWorldXY(
      tile.x,
      tile.y,
      undefined,
      undefined,
      groundLayer
    );
    const cx = worldPos.x + map.tileWidth / 2;
    const cy = worldPos.y + map.tileHeight / 2;

    const g = scene.add.graphics();
    g.lineStyle(2, 0xff4444, 1);
    g.fillStyle(0xff4444, 0.7);

    const points = [
      new Phaser.Math.Vector2(cx, cy - halfH),
      new Phaser.Math.Vector2(cx + halfW, cy),
      new Phaser.Math.Vector2(cx, cy + halfH),
      new Phaser.Math.Vector2(cx - halfW, cy),
    ];

    g.fillPoints(points, true);
    g.strokePoints(points, true);

    if (scene.hudCamera) {
      scene.hudCamera.ignore(g);
    }

    highlights.push(g);
  }

  scene.prepState = {
    actif: true,
    joueur: player,
    monstre: monster,
    allowedTiles,
    enemyTiles,
    highlights,
  };

  document.body.classList.add("combat-prep");
}

// Termine la phase de préparation et démarre réellement le combat.
// Termine la phase de préparation et démarre réellement le combat.
// Termine la phase de préparation et démarre réellement le combat.
export function startCombatFromPrep(scene) {
  const prep = scene.prepState;
  if (!prep || !prep.actif) {
    return;
  }

  // Nettoyage des surbrillances
  if (prep.highlights) {
    prep.highlights.forEach((g) => g.destroy());
  }

  scene.prepState = null;
  document.body.classList.remove("combat-prep");

  startCombat(scene, prep.joueur, prep.monstre);
}



// -----------------------------------------------------------
//  COMBAT EFFECTIF
// -----------------------------------------------------------

// Commence un combat : on crée l'état et on active l'UI.
export function startCombat(scene, player, monster) {
  // Si une régénération hors combat était en cours, on l'arrête
  if (scene.playerRegenEvent) {
    scene.playerRegenEvent.remove(false);
    scene.playerRegenEvent = null;
  }

  scene.combatState = createCombatState(player, monster);
  document.body.classList.add("combat-active");

  // Met à jour l'affichage des PA/PM du joueur dans le HUD, si dispo
  if (player && typeof player.updateHudApMp === "function") {
    player.updateHudApMp(
      scene.combatState.paRestants,
      scene.combatState.pmRestants
    );
  }
}

// Termine le combat, nettoie l'état et l'UI.
export function endCombat(scene) {
  if (!scene.combatState) return;

  const state = scene.combatState;
  state.enCours = false;

  // Prépare un petit récapitulatif pour l'UI
  const now = Date.now();
  const durationMs = state.startTime ? now - state.startTime : 0;

  let issue = state.issue;
  if (!issue) {
    const joueurHp = state.joueur?.stats?.hp ?? 0;
    const monstreHp = state.monstre?.stats?.hp ?? 0;
    if (joueurHp <= 0 && monstreHp > 0) {
      issue = "defaite";
    } else if (monstreHp <= 0 && joueurHp > 0) {
      issue = "victoire";
    } else {
      issue = "inconnu";
    }
  }

  const result = {
    issue,
    durationMs,
    xpGagne: state.xpGagne || 0,
    goldGagne: state.goldGagne || 0,
    loot: state.loot || [],
    playerLevel: state.joueur?.levelState?.niveau ?? 1,
    playerXpTotal: state.joueur?.levelState?.xp ?? 0,
    playerXpNext: state.joueur?.levelState?.xpProchain ?? 0,
    monsterId: state.monstre?.monsterId || null,
    monsterHpEnd: state.monstre?.stats?.hp ?? 0,
  };

  // Nettoyage éventuel d'une phase de préparation restante
  if (scene.prepState) {
    if (scene.prepState.highlights) {
      scene.prepState.highlights.forEach((g) => g.destroy());
    }
    scene.prepState = null;
  }

  document.body.classList.remove("combat-active");
  document.body.classList.remove("combat-prep");

  // Nettoyage des références de carte de combat
  scene.combatMap = null;
  scene.combatGroundLayer = null;

  // Démarre la régénération hors combat (+2 PV/s)
  startOutOfCombatRegen(scene, state.joueur);

  // Remet l'affichage PA/PM du HUD aux valeurs de base du joueur (exploration)
  const player = state.joueur;
  if (player && typeof player.updateHudApMp === "function") {
    const basePa = player.stats?.pa ?? 0;
    const basePm = player.stats?.pm ?? 0;
    player.updateHudApMp(basePa, basePm);
  }

  // Notifie l'UI si un gestionnaire est disponible
  if (typeof scene.showCombatResult === "function") {
    scene.showCombatResult(result);
  }

  scene.combatState = null;
}

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
    g.setDepth(5);
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

  preview.lineStyle(1, 0x00ff55, 1);
  preview.fillStyle(0x00ff55, 0.25);

  for (const step of path) {
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

    preview.fillPoints(points, true);
    preview.strokePoints(points, true);
  }
}

// Passe le tour au personnage suivant et recharge ses PA/PM.
export function passerTour(scene) {
  const state = scene.combatState;
  if (!state || !state.enCours) return;

  if (state.tour === "joueur") {
    state.tour = "monstre";
    state.paRestants = state.paBaseMonstre;
    state.pmRestants = state.pmBaseMonstre;
  } else {
    state.tour = "joueur";
    state.paRestants = state.paBaseJoueur;
    state.pmRestants = state.pmBaseJoueur;
  }

  // Si c'est au joueur de jouer, rafraîchit les PA/PM dans le HUD
  if (
    state.tour === "joueur" &&
    state.joueur &&
    typeof state.joueur.updateHudApMp === "function"
  ) {
    state.joueur.updateHudApMp(state.paRestants, state.pmRestants);
  }

  return state.tour;
}
