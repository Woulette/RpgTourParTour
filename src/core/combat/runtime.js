// Démarrage / fin de combat, interaction avec l'UI et la regen.

import { startOutOfCombatRegen } from "../regen.js";
import { createCombatState, buildTurnOrder } from "./state.js";

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

  // Construit l'ordre de tour multi‑acteurs (joueur + monstres).
  buildTurnOrder(scene);
}

// Termine le combat, nettoie l'état et l'UI.
export function endCombat(scene) {
  if (!scene.combatState) return;

  const state = scene.combatState;
  state.enCours = false;

  // Petit fondu noir � la sortie de combat (retour exploration)
  const cam = scene.cameras && scene.cameras.main;
  if (cam && cam.fadeOut && cam.fadeIn) {
    cam.once("camerafadeoutcomplete", () => {
      cam.fadeIn(1300, 0, 0, 0);
    });
    cam.fadeOut(0, 0, 0, 0);
  }

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

  // Liste des monstres engagés dans ce combat (pack éventuel)
  if (scene.combatMonsters && Array.isArray(scene.combatMonsters)) {
    // On marque les membres de ce combat comme n'étant plus "en combat".
    scene.combatMonsters.forEach((m) => {
      if (!m) return;
      m.isCombatMember = false;
    });
    scene.combatMonsters = null;
  }

  // Restaure les monstres du monde cach�s pendant ce combat.
  if (scene.hiddenWorldMonsters && Array.isArray(scene.hiddenWorldMonsters)) {
    scene.hiddenWorldMonsters.forEach((m) => {
      if (!m || m.destroyed) return;

      m.setVisible(true);
      if (m.setInteractive) {
        m.setInteractive({ useHandCursor: true });
      }
    });
    scene.hiddenWorldMonsters = null;
  }

  // Nettoyage des �l�ments d'interface li�s � la cible.
  if (scene.updateHudTargetInfo) {
    scene.updateHudTargetInfo(null);
  }
  if (scene.clearDamagePreview) {
    scene.clearDamagePreview();
  }
  if (scene.hideMonsterTooltip) {
    scene.hideMonsterTooltip();
  }

  // Supprime les effets de survol restants sur les monstres.
  const allMonsters = scene.monsters || [];
  allMonsters.forEach((m) => {
    if (!m || !m.hoverHighlight) return;
    if (m.hoverHighlight.destroy) {
      m.hoverHighlight.destroy();
    }
    m.hoverHighlight = null;
  });

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
