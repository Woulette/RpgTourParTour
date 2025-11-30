import { createCharacter } from "./character.js";
import { classes } from "../config/classes.js";
import { createStats, applyBonuses } from "../core/stats.js";
import { createLevelState, ajouterXp } from "../core/level.js";
import { createPlayerInventory } from "../inventory/inventoryContainers.js";
import {
  createEmptyEquipment,
  recomputePlayerStatsWithEquipment,
} from "../inventory/equipmentCore.js";

export function createPlayer(scene, x, y, classId) {
  const classDef = classes[classId] || classes.archer;

  const baseStats = createStats();
  const stats = applyBonuses(baseStats, classDef.statBonuses || []);

  const player = createCharacter(scene, x, y, {
    textureKey: "player",
    classId,
    stats,
  });

  // Aligne l'origine du sprite sur les "pieds" du personnage.
  if (player.setOrigin) {
    player.setOrigin(0.5, 0.9);
  }

  // État de niveau / XP
  player.levelState = createLevelState();
  player.inventory = createPlayerInventory();

  // État lié au déplacement (utilisé par le système de mouvement)
  player.currentTileX = null;
  player.currentTileY = null;
  player.isMoving = false;
  player.movePath = [];
  player.currentMoveTween = null;

  // Équipement (structure prête pour plus tard)
  player.equipment = createEmptyEquipment();
  player.recomputeStatsWithEquipment = () => {
    recomputePlayerStatsWithEquipment(player);
  };

  return player;
}

// Ajoute de l'XP au joueur et gère le gain de PV max par niveau
export function addXpToPlayer(player, montantXp) {
  if (!player.levelState || !player.stats) return;

  const { nouveauState, niveauxGagnes } = ajouterXp(
    player.levelState,
    montantXp
  );
  player.levelState = { ...player.levelState, ...nouveauState };

  if (niveauxGagnes > 0) {
    const gainHpMax = 5 * niveauxGagnes;
    player.stats.hpMax = (player.stats.hpMax ?? 0) + gainHpMax;
    player.stats.hp = player.stats.hpMax;
  }
}

