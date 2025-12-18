import { passerTour } from "../core/combat.js";
import { runTurn as runCorbeauTurn } from "./aiCorbeau.js";
import { runTurn as runAluineeksTurn } from "./aiAluineeks.js";
import { runTurn as runGoushTurn } from "./aiGoush.js";
import { runTurn as runLiburionTurn } from "./aiLiburion.js";
import { runTurn as runCazardTurn } from "./aiCazard.js";
import { runTurn as runCedreTurn } from "./aiCedre.js";
import { runTurn as runGumgobTurn } from "./aiGumgob.js";

const AI_HANDLERS = {
  corbeau: runCorbeauTurn,
  aluineeks: runAluineeksTurn,
  chibone: runCorbeauTurn,
  skelbone: runCorbeauTurn,
  senbone: runAluineeksTurn,
  goush: runGoushTurn,
  liburion: runLiburionTurn,
  cazard: runCazardTurn,
  cedre: runCedreTurn,
  gumgob: runGumgobTurn,
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
  state.paRestants = monster.stats?.pa ?? state.paBaseMonstre;
  state.pmRestants = monster.stats?.pm ?? state.pmBaseMonstre;

  if (typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }

  const handler = AI_HANDLERS[monster.monsterId];

  const finishTurn = () => {
    if (!state.enCours) return;

    const newTurn = passerTour(scene);

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
