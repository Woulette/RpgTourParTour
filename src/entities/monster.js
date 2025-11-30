import { createCharacter } from "./character.js";
import { monsters } from "../config/monsters.js";
import { createStats } from "../core/stats.js";
import { addXpToPlayer } from "./player.js";
import { addItem } from "../inventory/inventoryCore.js";

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

  // Aligne visuellement le monstre sur le centre de sa tuile
  if (monster.setOrigin) {
    monster.setOrigin(0.5, 0.85);
  }

  // Place le monstre au‑dessus de la grille debug
  monster.setDepth(2);

  // S'assure que la caméra HUD n'affiche pas le monstre
  if (scene.hudCamera) {
    scene.hudCamera.ignore(monster);
  }

  // Métadonnées utiles pour le système de combat / loot
  monster.monsterId = monsterId;
  monster.xpReward = def.xpReward || 0;
  monster.lootTable = def.loot || [];
  // Sorts disponibles pour ce monstre
  monster.spellIds = def.spells || [];

  // Callback standard quand le monstre meurt
  monster.onKilled = (sceneArg, killer) => {
    const rewardXp = monster.xpReward || 0;

    if (killer && typeof addXpToPlayer === "function") {
      addXpToPlayer(killer, rewardXp);
    }

    // Si un combat est en cours, on cumule l'XP gagnée et on gère le loot
    if (sceneArg && sceneArg.combatState && sceneArg.combatState.enCours) {
      const cs = sceneArg.combatState;
      cs.xpGagne = (cs.xpGagne || 0) + rewardXp;

      // --- Génération de loot simple lié au monstre ---
      if (killer && killer.inventory && Array.isArray(monster.lootTable)) {
        cs.loot = cs.loot || [];

        for (const entry of monster.lootTable) {
          if (!entry || !entry.itemId) continue;

          const dropRate =
            typeof entry.dropRate === "number" ? entry.dropRate : 1.0;
          if (Math.random() > dropRate) continue;

          const min = entry.min ?? 1;
          const max = entry.max ?? min;
          const qty = Math.max(0, Phaser.Math.Between(min, max));
          if (qty <= 0) continue;

          const remaining = addItem(killer.inventory, entry.itemId, qty);
          const gained = qty - remaining;
          if (gained <= 0) continue;

          // Fusionne dans le tableau de loot du combat
          let slot = cs.loot.find((l) => l.itemId === entry.itemId);
          if (!slot) {
            slot = { itemId: entry.itemId, qty: 0 };
            cs.loot.push(slot);
          }
          slot.qty += gained;
        }
      }
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
   // Rendre le monstre cliquable pour entrer en combat
   monster.setInteractive({ useHandCursor: true });

   // Affichage des infos de la cible dans le HUD lors du survol
   monster.on("pointerover", () => {
     // Effet de lumière directement sur le sprite :
     // on ajoute un doublon du sprite en mode ADD par-dessus lui.
     if (!monster.hoverHighlight && scene.add) {
       const overlay = scene.add.sprite(
         monster.x,
         monster.y,
         monster.texture.key
       );
 
       // même origine que le monstre pour coller parfaitement
       overlay.setOrigin(monster.originX, monster.originY);
 
       // si le monstre a une frame (anim), on la copie
       if (monster.frame && overlay.setFrame) {
         overlay.setFrame(monster.frame.name);
       }
 
       overlay.setBlendMode(Phaser.BlendModes.ADD); // effet lumineux
       overlay.setAlpha(0.6);                       // intensité
       overlay.setDepth((monster.depth || 0) + 1);  // au-dessus du sprite
 
       if (scene.hudCamera) {
         scene.hudCamera.ignore(overlay);
       }
 
       monster.hoverHighlight = overlay;
     }
 
     if (scene.updateHudTargetInfo) {
       scene.updateHudTargetInfo(monster);
     }
     if (scene.showDamagePreview) {
       scene.showDamagePreview(monster);
     }
     if (scene.showMonsterTooltip) {
       scene.showMonsterTooltip(monster);
     }
   });
 
   monster.on("pointerout", () => {
     // Retire le doublon lumineux s'il existe
     if (monster.hoverHighlight) {
       monster.hoverHighlight.destroy();
       monster.hoverHighlight = null;
     }
     if (scene.updateHudTargetInfo) {
       scene.updateHudTargetInfo(null);
     }
     if (scene.clearDamagePreview) {
       scene.clearDamagePreview();
     }
     if (scene.hideMonsterTooltip) {
       scene.hideMonsterTooltip();
     }
   });
 
   return monster;
 }
 
