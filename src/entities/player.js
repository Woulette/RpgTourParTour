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

  // Stats de base "nues" du joueur (classe + points investis, sans équipement)
  player.baseStats = { ...stats };

  // Stats de base "nues" du joueur (sans équipement), utilisées pour
  // recalculer les stats finales quand on équipe/déséquipe ou dépense des points.
  player.baseStats = { ...stats };

  // aligne l'origine du sprite sur les "pieds" du personnage.
  if (player.setOrigin) {
    player.setOrigin(0.5, 0.9);
  }

  // etat de niveau / XP
  player.levelState = createLevelState();
  player.inventory = createPlayerInventory();
  // monnaie du joueur
  player.gold = 0;

  // etat lie au deplacement (utilise par le systeme de mouvement)
  player.currentTileX = null;
  player.currentTileY = null;
  player.isMoving = false;
  player.movePath = [];
  player.currentMoveTween = null;

  // equipement (structure prete pour plus tard)
  player.equipment = createEmptyEquipment();
  player.recomputeStatsWithEquipment = () => {
    recomputePlayerStatsWithEquipment(player);
  };

  return player;
}

// ajoute de l'XP au joueur et gere le gain de PV max par niveau
export function addXpToPlayer(player, montantXp) {
  if (!player.levelState || !player.stats) return;

  const { nouveauState, niveauxGagnes } = ajouterXp(
    player.levelState,
    montantXp
  );
  player.levelState = { ...player.levelState, ...nouveauState };

  if (niveauxGagnes > 0) {
    const gainHpMax = 5 * niveauxGagnes;

    if (!player.baseStats) {
      player.baseStats = { ...(player.stats || {}) };
    }

    player.baseStats.hpMax = (player.baseStats.hpMax ?? 0) + gainHpMax;
  }

  if (typeof player.recomputeStatsWithEquipment === "function") {
    player.recomputeStatsWithEquipment();
    if (player.stats) {
      const hpMax = player.stats.hpMax ?? player.stats.hp ?? 0;
      player.stats.hp = hpMax;
    }
  }
}
