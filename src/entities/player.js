import { createCharacter } from "./character.js";
import { classes } from "../config/classes.js";
import { createStats, applyBonuses, applyDerivedAgilityStats } from "../core/stats.js";
import { createLevelState, ajouterXp } from "../core/level.js";
import { XP_CONFIG } from "../config/xp.js";
import { createPlayerInventory } from "../features/inventory/runtime/inventoryContainers.js";
import { createTrashContainer } from "../features/inventory/runtime/trashCore.js";
import {
  createEmptyEquipment,
  recomputePlayerStatsWithEquipment,
} from "../features/inventory/runtime/equipmentCore.js";
import { purgeDeprecatedItemsFromPlayer } from "../features/inventory/runtime/deprecatedItems.js";
import { emit as emitStoreEvent } from "../state/store.js";
import { ensureAllMetiers } from "../features/metier/ensureAllMetiers.js";

export function createPlayer(scene, x, y, classId) {
  const classDef = classes[classId] || classes.archer;

  const baseStats = createStats();
  const stats = applyDerivedAgilityStats(
    applyBonuses(baseStats, classDef.statBonuses || [])
  );
  const initBonus = stats.initiative ?? 0;
  const derivedInit =
    (stats.force ?? 0) +
    (stats.intelligence ?? 0) +
    (stats.agilite ?? 0) +
    (stats.chance ?? 0);
  stats.initiative = initBonus + derivedInit;

  const textureKey =
    classId === "tank"
      ? "tank"
      : classId === "mage"
        ? "animiste"
        : classId === "eryon" || classId === "assassin"
          ? "eryon"
          : "player";
  const player = createCharacter(scene, x, y, {
    textureKey,
    classId,
    stats,
  });

  // Utilisés par le système d'animation/déplacement.
  player.animPrefix = textureKey;
  player.baseTextureKey = `${textureKey}_idle_south-east`;
  player.lastDirection = "south-east";

  const showLocalHoverName = () => {
    if (!scene || !scene.add) return;

    if (!player.hoverLabel) {
      const text = scene.add.text(0, 0, "", {
        fontFamily: "Tahoma, Arial, sans-serif",
        fontSize: "11px",
        color: "#f8fafc",
        backgroundColor: "rgba(15, 23, 32, 0.75)",
        padding: { left: 6, right: 6, top: 2, bottom: 2 },
      });
      text.setOrigin(0.5, 1);
      text.setDepth((player.depth || 0) + 2);
      if (scene.hudCamera) {
        scene.hudCamera.ignore(text);
      }
      player.hoverLabel = text;
    }

    const name = player.displayName || player.name || player.characterName || "Vous";
    player.hoverLabel.setText(name);
    player.hoverLabel.setVisible(true);

    const update = () => {
      if (!player || !player.hoverLabel) return;
      const bounds = player.getBounds ? player.getBounds() : null;
      const x = bounds ? bounds.centerX : player.x;
      const y = bounds ? bounds.top - 6 : player.y - 32;
      player.hoverLabel.setPosition(x, y);
    };

    update();
    if (!player.__hoverUpdate) {
      player.__hoverUpdate = update;
      scene.events.on("postupdate", player.__hoverUpdate);
    }
  };

  const hideLocalHoverName = () => {
    if (player.__hoverUpdate) {
      scene.events.off("postupdate", player.__hoverUpdate);
      player.__hoverUpdate = null;
    }
    if (player.hoverLabel) {
      player.hoverLabel.destroy();
      player.hoverLabel = null;
    }
  };

  // Rend le joueur survolable (en combat) pour afficher la fiche cible.
  if (player && typeof player.setInteractive === "function") {
    player.setInteractive({ useHandCursor: false });
    player.on("pointerover", () => {
      showLocalHoverName();
      if (
        scene?.combatState?.enCours &&
        typeof scene.showCombatTargetPanel === "function"
      ) {
        scene.showCombatTargetPanel(player);
      }
    });
    player.on("pointerout", () => {
      hideLocalHoverName();
      if (typeof scene?.hideCombatTargetPanel === "function") {
        scene.hideCombatTargetPanel();
      }
    });
  }

  // Stats de base "nues" du joueur (classe + points investis, sans équipement)
  // Important : on stocke l'initiative "bonus" mais pas l'initiative dérivée,
  // sinon elle serait additionnée à chaque recalcul.
  player.baseStats = { ...stats, initiative: initBonus };

  // Stats de base "nues" du joueur (sans équipement), utilisées pour
  // recalculer les stats finales quand on équipe/déséquipe ou dépense des points.
  player.baseStats = { ...stats, initiative: initBonus };

  // aligne l'origine du sprite sur les "pieds" du personnage.
  if (player.setOrigin) {
    player.setOrigin(0.5, 0.9);
  }

  // etat de niveau / XP
  player.levelState = createLevelState();
  player.inventory = createPlayerInventory();
  player.trash = createTrashContainer(player.inventory?.size);
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

  purgeDeprecatedItemsFromPlayer(player);
  ensureAllMetiers(player);

  return player;
}

// ajoute de l'XP au joueur et gere le gain de PV max par niveau
export function addXpToPlayer(player, montantXp) {
  if (!player.levelState || !player.stats) return;

  // Bonus XP via la sagesse (1 sagesse = +1% XP)
  const sagesse = player.stats.sagesse ?? 0;
  const wisdomPerPoint = XP_CONFIG.wisdomPerPoint ?? 0.01;
  const xpMultiplier = 1 + Math.max(0, sagesse) * wisdomPerPoint;
  const finalXp = Math.round(montantXp * xpMultiplier);

  const levelBefore = player?.levelState?.niveau ?? 1;
  const pointsBefore = player?.levelState?.pointsCaracLibres ?? 0;

  const { nouveauState, niveauxGagnes } = ajouterXp(
    player.levelState,
    finalXp
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
    const oldHp = player.stats?.hp ?? player.stats?.hpMax ?? 0;
    player.recomputeStatsWithEquipment();
    if (player.stats) {
      const hpMax = player.stats.hpMax ?? player.stats.hp ?? 0;
      const newHp = niveauxGagnes > 0 ? hpMax : Math.min(oldHp, hpMax);
      player.stats.hp = newHp;
      if (typeof player.updateHudHp === "function") {
        player.updateHudHp(newHp, hpMax);
      }
    }
  }

  if (niveauxGagnes > 0) {
    const levelAfter = player?.levelState?.niveau ?? levelBefore;
    const pointsAfter = player?.levelState?.pointsCaracLibres ?? pointsBefore;
    const pointsCaracGagnes = Math.max(0, pointsAfter - pointsBefore);
    const pvMaxGagnes = 5 * niveauxGagnes;

    emitStoreEvent("player:levelup", {
      player,
      data: {
        niveauxGagnes,
        level: levelAfter,
        pointsCaracGagnes,
        pvMaxGagnes,
      },
    });
  }
}
