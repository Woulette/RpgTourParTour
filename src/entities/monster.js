import { createCharacter } from "./character.js";
import { monsters } from "../config/monsters.js";
import { createStats } from "../core/stats.js";
import { addXpToPlayer } from "./player.js";

/**
 * Crée un monstre sur la carte.
 * - stats basées sur le même modèle que le joueur
 * - pas de système de niveau pour le monstre lui‑même
 */
export function createMonster(scene, x, y, monsterId) {
  const def = monsters[monsterId];
  if (!def) {
    throw new Error(`Monstre inconnu: ${monsterId}`);
  }

  // Stats de base communes, avec overrides du monstre.
  // Pour un monstre, on considère les overrides comme des valeurs FIXES
  // (on ne veut pas ajouter 50 HP de base + 40 HP du monstre).
  const stats = createStats(def.statsOverrides || {});

  const monster = createCharacter(scene, x, y, {
    textureKey: def.textureKey,
    classId: monsterId,
    stats,
  });

  // Place le monstre au-dessus de la grille debug
  monster.setDepth(2);

  // S'assure que la caméra HUD n'affiche pas le monstre
  if (scene.hudCamera) {
    scene.hudCamera.ignore(monster);
  }

  // Métadonnées utiles pour le système de combat / loot
  monster.monsterId = monsterId;
  monster.xpReward = def.xpReward || 0;
  // Sorts disponibles pour ce monstre
  monster.spellIds = def.spells || [];

  // Callback standard quand le monstre meurt
  monster.onKilled = (sceneArg, killer) => {
    const rewardXp = monster.xpReward || 0;

    if (killer && typeof addXpToPlayer === "function") {
      addXpToPlayer(killer, rewardXp);
    }

    // Si un combat est en cours, on cumule l'XP gagnée dans l'état de combat
    if (sceneArg && sceneArg.combatState && sceneArg.combatState.enCours) {
      const cs = sceneArg.combatState;
      cs.xpGagne = (cs.xpGagne || 0) + rewardXp;
    }

    if (sceneArg && typeof sceneArg.updateHudTargetInfo === "function") {
      sceneArg.updateHudTargetInfo(null);
    }

    // Respawn simple : réapparaît au même endroit 5 secondes après la mort
    if (
      sceneArg &&
      sceneArg.time &&
      sceneArg.map &&
      sceneArg.groundLayer &&
      typeof monster.tileX === "number" &&
      typeof monster.tileY === "number"
    ) {
      const respawnDelayMs = 5000;
      const respawnTileX = monster.tileX;
      const respawnTileY = monster.tileY;
      const respawnId = monster.monsterId;

      sceneArg.time.delayedCall(respawnDelayMs, () => {
        // Si la scène n'est plus active, on ne fait rien
        if (!sceneArg.scene.isActive()) return;

        const worldPos = sceneArg.map.tileToWorldXY(
          respawnTileX,
          respawnTileY,
          undefined,
          undefined,
          sceneArg.groundLayer
        );
        const spawnX = worldPos.x + sceneArg.map.tileWidth / 2;
        const spawnY = worldPos.y + sceneArg.map.tileHeight / 2;

        const newMonster = createMonster(sceneArg, spawnX, spawnY, respawnId);
        newMonster.tileX = respawnTileX;
        newMonster.tileY = respawnTileY;

        sceneArg.monsters = sceneArg.monsters || [];
        sceneArg.monsters.push(newMonster);

        // La caméra HUD doit ignorer le nouveau monstre également
        if (sceneArg.hudCamera) {
          sceneArg.hudCamera.ignore(newMonster);
        }
      });
    }
  };

  // Rendre le monstre cliquable pour entrer en combat
  monster.setInteractive({ useHandCursor: true });

  // Affichage des infos de la cible dans le HUD lors du survol
  monster.on("pointerover", () => {
    if (scene.updateHudTargetInfo) {
      scene.updateHudTargetInfo(monster);
    }
    if (scene.showDamagePreview) {
      scene.showDamagePreview(monster);
    }
  });
  monster.on("pointerout", () => {
    if (scene.updateHudTargetInfo) {
      scene.updateHudTargetInfo(null);
    }
    if (scene.clearDamagePreview) {
      scene.clearDamagePreview();
    }
  });

  return monster;
}
