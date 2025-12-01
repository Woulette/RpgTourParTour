import { passerTour } from "../core/combat.js";
import { runTurn as runCorbeauTurn } from "./aiCorbeau.js";
import { runTurn as runAluineeksTurn } from "./aiAluineeks.js";

const AI_HANDLERS = {
  corbeau: runCorbeauTurn,
  aluineeks: runAluineeksTurn,
};

// Point d'entrée générique : choisit l'IA en fonction du monsterId.
// Utilise l'ordre de tour multi‑acteurs défini dans combatState.
export function runMonsterTurn(scene) {
  const state = scene.combatState;
  if (!state || !state.enCours) return;

  const monster = state.monstre;
  const player = state.joueur;
  const map = scene.combatMap;
  const groundLayer = scene.combatGroundLayer;

  if (!monster || !player || !map || !groundLayer) return;

  // On passe officiellement au tour du monstre courant
  state.tour = "monstre";
  state.paRestants = state.paBaseMonstre;
  state.pmRestants = state.pmBaseMonstre;

  const lbl = document.getElementById("combat-turn-label");
  if (lbl) lbl.textContent = "Monstre";

  const handler = AI_HANDLERS[monster.monsterId];

  const finishTurn = () => {
    if (!state.enCours) return;

    const newTurn = passerTour(scene);
    const turnLabel = document.getElementById("combat-turn-label");
    if (turnLabel) {
      turnLabel.textContent =
        newTurn === "monstre" ? "Monstre" : "Joueur";
    }

    // Si le prochain acteur est encore un monstre (ex: C3 -> C4),
    // on enchaîne immédiatement son tour.
    if (newTurn === "monstre") {
      runMonsterTurn(scene);
    }
  };

  if (handler) {
    handler(scene, state, monster, player, map, groundLayer, finishTurn);
  } else {
    finishTurn();
  }
}
