import { passerTour } from "../../combat/runtime/state.js";
import { getNetClient, getNetIsHost, getNetPlayerId } from "../../../app/session.js";
import { runTurn as runCorbeauTurn } from "../../combat/ai/corbeau.js";
import { runTurn as runAluineeksTurn } from "../../combat/ai/aluineeks.js";
import { runTurn as runGoushTurn } from "../../combat/ai/goush.js";
import { runTurn as runLiburionTurn } from "../../combat/ai/liburion.js";
import { runTurn as runLibareneTurn } from "../../combat/ai/libarene.js";
import { runTurn as runCazardTurn } from "../../combat/ai/cazard.js";
import { runTurn as runCedreTurn } from "../../combat/ai/cedre.js";
import { runTurn as runGumgobTurn } from "../../combat/ai/gumgob.js";
import { runTurn as runDonjonKeeperTurn } from "../../combat/ai/donjon_keeper.js";
import { runTurn as runChiboneTurn } from "../../combat/ai/chibone.js";
import { runTurn as runSkelboneTurn } from "../../combat/ai/skelbone.js";
import { runTurn as runSenboneTurn } from "../../combat/ai/senbone.js";
import { runTurn as runMaireCombatTurn } from "../../combat/ai/maire_combat.js";
import { runTurn as runOmbreTitanTurn } from "../../combat/ai/ombre_titan.js";
import { runGenericAi } from "./engine/genericAi.js";
import { getAiProfile } from "./profiles/index.js";

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
  maire_combat: runMaireCombatTurn,
  ombre_titan: runOmbreTitanTurn,
};

// Point d'entrée générique : choisit l'IA en fonction du monsterId.
// Utilise l'ordre de tour multi‑acteurs défini dans combatState.
export function runMonsterTurn(scene) {
  const state = scene.combatState;
  if (!state || !state.enCours) return;
  if (getNetClient() && scene.__lanCombatId) {
    const localId = getNetPlayerId();
    const driverId = Number.isInteger(scene.__lanCombatAiDriverId)
      ? scene.__lanCombatAiDriverId
      : null;
    if (driverId ? localId !== driverId : !getNetIsHost()) return;
  }

  const monster = state.monstre;
  const player = state.joueur;
  const map = scene.combatMap;
  const groundLayer = scene.combatGroundLayer;

  if (!monster || !player || !map || !groundLayer) return;

  const profile = getAiProfile(monster);

  const pickTargetForMonster = () => {
    if (monster?.isCombatAlly) {
      const enemies =
        scene?.combatMonsters && Array.isArray(scene.combatMonsters)
          ? scene.combatMonsters
          : [];
      const aliveEnemies = enemies.filter((m) => {
        if (!m || !m.stats) return false;
        const hp = typeof m.stats.hp === "number" ? m.stats.hp : m.stats.hpMax ?? 0;
        return hp > 0;
      });
      if (aliveEnemies.length === 0) return null;

      const mx = monster.tileX ?? 0;
      const my = monster.tileY ?? 0;
      let bestEnemy = null;
      let bestDist = Infinity;
      aliveEnemies.forEach((e) => {
        const ex = e.tileX ?? 0;
        const ey = e.tileY ?? 0;
        const d = Math.abs(ex - mx) + Math.abs(ey - my);
        if (d < bestDist) {
          bestDist = d;
          bestEnemy = e;
        }
      });
      return bestEnemy;
    }

    const summons =
      scene?.combatSummons && Array.isArray(scene.combatSummons)
        ? scene.combatSummons
        : [];
    const allies =
      scene?.combatAllies && Array.isArray(scene.combatAllies)
        ? scene.combatAllies
        : [];
    const aliveAllies = [...summons, ...allies].filter((s) => {
      if (!s || !s.stats) return false;
      const hp = typeof s.stats.hp === "number" ? s.stats.hp : s.stats.hpMax ?? 0;
      return hp > 0;
    });
    if (aliveAllies.length === 0) return player;

    const mx =
      typeof monster.currentTileX === "number"
        ? monster.currentTileX
        : monster.tileX ?? 0;
    const my =
      typeof monster.currentTileY === "number"
        ? monster.currentTileY
        : monster.tileY ?? 0;
    const pTx =
      typeof player.currentTileX === "number" ? player.currentTileX : player.tileX ?? 0;
    const pTy =
      typeof player.currentTileY === "number" ? player.currentTileY : player.tileY ?? 0;
    const dp = Math.abs(pTx - mx) + Math.abs(pTy - my);

    let bestSummon = null;
    let bestDist = Infinity;
    aliveAllies.forEach((s) => {
      const sx =
        typeof s.currentTileX === "number" ? s.currentTileX : s.tileX ?? 0;
      const sy =
        typeof s.currentTileY === "number" ? s.currentTileY : s.tileY ?? 0;
      const ds = Math.abs(sx - mx) + Math.abs(sy - my);
      if (ds < bestDist) {
        bestDist = ds;
        bestSummon = s;
      }
    });

    if (!bestSummon) return player;
    return bestDist <= dp ? bestSummon : player;
  };

  const target = pickTargetForMonster();
  if (!target && !profile) {
    const finishTurn = () => {
      if (!state.enCours) return;

      const newTurn = passerTour(scene);
      if (newTurn === "monstre") {
        runMonsterTurn(scene);
      }
    };
    finishTurn();
    return;
  }

  // On passe officiellement au tour du monstre courant
  state.tour = "monstre";

  if (typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }

  const handler = AI_HANDLERS[monster.monsterId];

  const finishTurn = () => {
    if (!state.enCours) return;

    const newTurn = passerTour(scene);
    const netClient = getNetClient();
    const netPlayerId = getNetPlayerId();
    if (
      newTurn === "joueur" &&
      netClient &&
      netPlayerId &&
      scene.__lanCombatId
    ) {
      netClient.sendCmd("CmdEndTurnCombat", {
        playerId: netPlayerId,
        combatId: scene.__lanCombatId,
        actorType: "monster",
      });
    }

    // Si le prochain acteur est encore un monstre (ex: C3 -> C4),
    // on enchaîne immédiatement son tour.
    if (newTurn === "monstre") {
      runMonsterTurn(scene);
    }
  };

  if (profile) {
    runGenericAi(scene, state, monster, player, map, groundLayer, profile, finishTurn);
  } else if (handler) {
    handler(scene, state, monster, target, map, groundLayer, finishTurn);
  } else {
    finishTurn();
  }
}

export function runMonsterAi(scene, state, monster, target, map, groundLayer, onComplete) {
  const profile = getAiProfile(monster);
  if (profile) {
    runGenericAi(scene, state, monster, state?.joueur, map, groundLayer, profile, onComplete);
    return;
  }
  const handler = AI_HANDLERS[monster?.monsterId];
  if (!handler) {
    onComplete?.();
    return;
  }
  handler(scene, state, monster, target, map, groundLayer, onComplete);
}
