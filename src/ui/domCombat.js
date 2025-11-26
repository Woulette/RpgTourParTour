// Gestion de l'UI de combat (HTML) :
// - bouton "PRÊT" pendant la phase de préparation
// - bouton "FIN DU TOUR" et indicateur de tour pendant le combat.

import { startCombatFromPrep } from "../core/combat.js";
import { runMonsterTurn } from "../monsters/ai.js";

export function initDomCombat(scene) {
  const endTurnBtn = document.getElementById("combat-end-turn-button");
  const readyBtn = document.getElementById("combat-ready-button");
  const turnLabel = document.getElementById("combat-turn-label");

  if (!endTurnBtn || !turnLabel) {
    return;
  }

  // Bouton "FIN DU TOUR" (combat en cours)
  endTurnBtn.addEventListener("click", (event) => {
    event.stopPropagation();

    if (!scene.combatState || !scene.combatState.enCours) {
      return;
    }

    // Sécurité : on ne finit le tour que si c'est bien au joueur
    if (scene.combatState.tour !== "joueur") {
      return;
    }

    // L'IA du monstre gère le passage "monstre -> joueur"
    runMonsterTurn(scene);
  });

  // Bouton "PRÊT" (phase de préparation)
  if (readyBtn) {
    readyBtn.addEventListener("click", (event) => {
      event.stopPropagation();

      if (!scene.prepState || !scene.prepState.actif) {
        return;
      }

      startCombatFromPrep(scene);

      // Au début du combat, c'est le joueur qui joue
      if (turnLabel) {
        turnLabel.textContent = "Joueur";
      }
    });
  }
}

