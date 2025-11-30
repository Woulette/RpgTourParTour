import { passerTour } from "../core/combat.js";
import { runTurn as runCorbeauTurn } from "./aiCorbeau.js";
import { runTurn as runAluineeksTurn } from "./aiAluineeks.js";

const AI_HANDLERS = {
  corbeau: runCorbeauTurn,
  aluineeks: runAluineeksTurn,
};

// Point d'entrée générique : choisit l'IA en fonction du monsterId.
export function runMonsterTurn(scene) {
  const state = scene.combatState;
  if (!state || !state.enCours) return;

  const monster = state.monstre;
  const player = state.joueur;
  const map = scene.combatMap;
  const groundLayer = scene.combatGroundLayer;

  if (!monster || !player || !map || !groundLayer) return;

  // On passe officiellement au tour du monstre
  state.tour = "monstre";
  state.paRestants = state.paBaseMonstre;
  state.pmRestants = state.pmBaseMonstre;

  const lbl = document.getElementById("combat-turn-label");
  if (lbl) lbl.textContent = "Monstre";

  const finishTurn = () => {
    const newTurn = passerTour(scene);
    const turnLabel = document.getElementById("combat-turn-label");
    if (turnLabel) {
      turnLabel.textContent = newTurn === "monstre" ? "Monstre" : "Joueur";
    }
  };

  const handler = AI_HANDLERS[monster.monsterId];
  if (handler) {
    handler(scene, state, monster, player, map, groundLayer, finishTurn);
  } else {
    finishTurn();
  }
}

