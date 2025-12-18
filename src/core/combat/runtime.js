// Démarrage / fin de combat, interaction avec l'UI et la regen.

import { startOutOfCombatRegen } from "../regen.js";
import { createCombatState, buildTurnOrder } from "./state.js";
import { onAfterCombatEnded } from "../../dungeons/runtime.js";
import { addChatMessage } from "../../chat/chat.js";
import { items } from "../../inventory/itemsConfig.js";

function joinPartsWrapped(parts, maxLineLength = 70) {
  const safeMax = Math.max(20, maxLineLength | 0);
  const lines = [];
  let current = "";

  for (const raw of parts) {
    const part = String(raw || "").trim();
    if (!part) continue;
    if (!current) {
      current = part;
      continue;
    }
    const candidate = `${current}, ${part}`;
    if (candidate.length <= safeMax) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = part;
  }

  if (current) lines.push(current);
  return lines.join("\n");
}

// Commence un combat : on crée l'état et on active l'UI.
export function startCombat(scene, player, monster) {
  // Si une régénération hors combat était en cours, on l'arrête
  if (scene.playerRegenEvent) {
    scene.playerRegenEvent.remove(false);
    scene.playerRegenEvent = null;
  }

  // Nettoie les effets temporaires (ex: poison) d'un combat précédent
  if (player) {
    player.statusEffects = [];
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

  if (scene && typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }
}

// Termine le combat, nettoie l'état et l'UI.
export function endCombat(scene) {
  if (!scene.combatState) return;

  const state = scene.combatState;
  state.enCours = false;

  // Nettoie les effets temporaires restants sur le joueur
  if (state.joueur) {
    state.joueur.statusEffects = [];
  }

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

  // Chat (général) : récap XP/or en fin de combat.
  const playerForChat = state.joueur;
  if (playerForChat && result.issue === "victoire") {
    const xp = result.xpGagne ?? 0;
    const gold = result.goldGagne ?? 0;
    const loot = Array.isArray(result.loot) ? result.loot : [];

    const parts = [];
    if (xp > 0) parts.push(`+${xp} XP`);
    if (gold > 0) parts.push(`+${gold} or`);
    loot.forEach((entry) => {
      if (!entry || !entry.itemId) return;
      const qty = entry.qty ?? 0;
      if (qty <= 0) return;
      const def = items?.[entry.itemId];
      const label = def?.label || entry.itemId;
      parts.push(`${label} x${qty}`);
    });

    if (parts.length > 0) {
      const text = `Gains : ${joinPartsWrapped(parts, 70)}`;
      addChatMessage(
        { kind: "combat", channel: "global", author: "Combat", text },
        { player: playerForChat }
      );
    }
  }

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
  if (scene.clearDamagePreview) {
    scene.clearDamagePreview();
  }
  if (scene.hideMonsterTooltip) {
    scene.hideMonsterTooltip();
  }
  if (scene.hideCombatTargetPanel) {
    scene.hideCombatTargetPanel();
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
  const player = state.joueur;
  if (player && typeof result.goldGagne === "number" && result.goldGagne > 0) {
    const currentGold =
      typeof player.gold === "number" && !Number.isNaN(player.gold)
        ? player.gold
        : 0;
    player.gold = currentGold + result.goldGagne;
  }

  startOutOfCombatRegen(scene, player);

  // Remet l'affichage PA/PM du HUD aux valeurs de base du joueur (exploration)
  if (player && typeof player.updateHudApMp === "function") {
    const basePa = player.stats?.pa ?? 0;
    const basePm = player.stats?.pm ?? 0;
    player.updateHudApMp(basePa, basePm);
  }

  // Notifie l'UI si un gestionnaire est disponible
  if (typeof scene.showCombatResult === "function") {
    scene.showCombatResult(result);
  }

  if (scene && typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }

  scene.combatState = null;

  // Donjons : auto-exit after boss kill.
  onAfterCombatEnded(scene, result);
}
