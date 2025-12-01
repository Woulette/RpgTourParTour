// Gestion de l'UI de combat (HTML) :
// - bouton "PRÊT" pendant la phase de préparation
// - bouton "FIN DU TOUR" et indicateur de tour pendant le combat.

import { startCombatFromPrep, passerTour } from "../core/combat.js";
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

    // Passe au prochain acteur dans l'ordre d'initiative
    const newTurn = passerTour(scene);
    if (!newTurn) return;

    if (turnLabel) {
      turnLabel.textContent = newTurn === "joueur" ? "Joueur" : "Monstre";
    }

    // Si c'est un monstre qui joue ensuite, on lance son tour.
    if (newTurn === "monstre") {
      runMonsterTurn(scene);
    }
  });

  // Bouton "PRÊT" (phase de préparation)
  if (readyBtn) {
    readyBtn.addEventListener("click", (event) => {
      event.stopPropagation();

      if (!scene.prepState || !scene.prepState.actif) {
        return;
      }

      startCombatFromPrep(scene);

      const state = scene.combatState;
      if (!state || !state.enCours) return;

      // Met à jour le label de tour en fonction de l'initiative
      if (turnLabel) {
        turnLabel.textContent =
          state.tour === "joueur" ? "Joueur" : "Monstre";
      }

      // Si le monstre commence (initiative plus élevée), on lance tout de suite son tour.
      if (state.tour === "monstre") {
        runMonsterTurn(scene);
      }
    });
  }
}
