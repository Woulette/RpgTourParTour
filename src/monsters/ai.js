import { passerTour } from "../core/combat.js";
import { runTurn as runCorbeauTurn } from "../systems/combat/ai/corbeau.js";
import { runTurn as runAluineeksTurn } from "../systems/combat/ai/aluineeks.js";
import { runTurn as runGoushTurn } from "../systems/combat/ai/goush.js";
import { runTurn as runLiburionTurn } from "../systems/combat/ai/liburion.js";
import { runTurn as runLibareneTurn } from "../systems/combat/ai/libarene.js";
import { runTurn as runCazardTurn } from "../systems/combat/ai/cazard.js";
import { runTurn as runCedreTurn } from "../systems/combat/ai/cedre.js";
import { runTurn as runGumgobTurn } from "../systems/combat/ai/gumgob.js";
import { runTurn as runDonjonKeeperTurn } from "../systems/combat/ai/donjon_keeper.js";
import { runTurn as runChiboneTurn } from "../systems/combat/ai/chibone.js";
import { runTurn as runSkelboneTurn } from "../systems/combat/ai/skelbone.js";
import { runTurn as runSenboneTurn } from "../systems/combat/ai/senbone.js";

const AI_HANDLERS = {
  corbeau: runCorbeauTurn,
  gravorbeau: runCorbeauTurn,
  flamorbeau: runCorbeauTurn,
  ondoreau: runCorbeauTurn,
  aluineeks: runAluineeksTurn,
  chibone: runChiboneTurn,
  skelbone: runSkelboneTurn,
  senbone: runSenboneTurn,
  goush: runGoushTurn,
  liburion: runLiburionTurn,
  libarene: runLibareneTurn,
  cazard: runCazardTurn,
  cedre: runCedreTurn,
  gumgob: runGumgobTurn,
  donjon_keeper: runDonjonKeeperTurn,
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

  const pickTargetForMonster = () => {
    const summons =
      scene?.combatSummons && Array.isArray(scene.combatSummons)
        ? scene.combatSummons
        : [];
    const aliveSummon = summons.find((s) => {
      if (!s || !s.stats) return false;
      const hp = typeof s.stats.hp === "number" ? s.stats.hp : s.stats.hpMax ?? 0;
      return hp > 0;
    });
    if (!aliveSummon) return player;

    const mx = monster.tileX ?? 0;
    const my = monster.tileY ?? 0;

    const pTx = typeof player.currentTileX === "number" ? player.currentTileX : player.tileX ?? 0;
    const pTy = typeof player.currentTileY === "number" ? player.currentTileY : player.tileY ?? 0;
    const sTx = aliveSummon.tileX ?? 0;
    const sTy = aliveSummon.tileY ?? 0;

    const dp = Math.abs(pTx - mx) + Math.abs(pTy - my);
    const ds = Math.abs(sTx - mx) + Math.abs(sTy - my);

    return ds <= dp ? aliveSummon : player;
  };

  const target = pickTargetForMonster();

  // On passe officiellement au tour du monstre courant
  state.tour = "monstre";

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
    handler(scene, state, monster, target, map, groundLayer, finishTurn);
  } else {
    finishTurn();
  }
}
