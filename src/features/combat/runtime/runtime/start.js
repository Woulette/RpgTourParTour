import { createCombatState, buildTurnOrder } from "../state.js";
import { clearActiveSpell } from "../../spells/core/activeSpell.js";
import { resetEryonChargeState } from "../../eryon/charges.js";
import { spawnCombatAlly } from "../../summons/summon.js";
import {
  getQuestDef,
  getQuestState,
  getCurrentQuestStage,
} from "../../../quests/index.js";
import { initCombatChallenge } from "../../../challenges/runtime/index.js";
import { snapshotMonsterForWorld } from "./snapshots.js";
import { setHarvestablesVisible } from "../../../maps/world/harvestables.js";

function maybeSpawnRiftAllies(scene, player) {
  const riftQuestId = "keeper_north_explosion_1";
  if (!player || !scene.currentMapDef?.riftEncounter) return;

  const qState = getQuestState(player, riftQuestId, { emit: false });
  const qDef = getQuestDef(riftQuestId);
  const stage = getCurrentQuestStage(qDef, qState);
  if (qState?.state !== "in_progress" || stage?.id !== "close_rifts") return;

  const map = scene.combatMap || scene.map;
  const layer = scene.combatGroundLayer || scene.groundLayer;
  if (!map || !layer) return;

  const hasAlly = (id) =>
    scene.combatAllies &&
    scene.combatAllies.some((s) => s && s.isCombatAlly && s.monsterId === id);

  if (!hasAlly("donjon_keeper")) {
    spawnCombatAlly(scene, player, map, layer, { monsterId: "donjon_keeper" });
  }
  if (!hasAlly("maire_combat")) {
    spawnCombatAlly(scene, player, map, layer, { monsterId: "maire_combat" });
  }
}

function maybeSpawnTitanAllies(scene, player, monster) {
  const riftQuestId = "keeper_north_explosion_1";
  if (!player || monster?.monsterId !== "ombre_titan") return;

  const qState = getQuestState(player, riftQuestId, { emit: false });
  const qDef = getQuestDef(riftQuestId);
  const stage = getCurrentQuestStage(qDef, qState);
  if (qState?.state !== "in_progress" || stage?.id !== "kill_ombre_titan") return;

  const map = scene.combatMap || scene.map;
  const layer = scene.combatGroundLayer || scene.groundLayer;
  if (!map || !layer) return;

  const hasAlly = (id) =>
    scene.combatAllies &&
    scene.combatAllies.some((s) => s && s.isCombatAlly && s.monsterId === id);

  if (!hasAlly("donjon_keeper")) {
    spawnCombatAlly(scene, player, map, layer, { monsterId: "donjon_keeper" });
  }
  if (!hasAlly("maire_combat")) {
    spawnCombatAlly(scene, player, map, layer, { monsterId: "maire_combat" });
  }
}

export function startCombat(scene, player, monster) {
  if (scene.playerRegenEvent) {
    scene.playerRegenEvent.remove(false);
    scene.playerRegenEvent = null;
  }

  if (player) {
    player.statusEffects = [];
    if (player.classId === "eryon" || player.classId === "assassin") {
      resetEryonChargeState(player);
    }
    player.captureState = null;
    player.spellCooldowns = player.spellCooldowns || {};
    player.spellCooldowns.invocation_capturee = 0;
    clearActiveSpell(player);
  }

  scene.combatState = createCombatState(player, monster);
  if (Number.isInteger(scene.__lanCombatId)) {
    scene.combatState.combatId = scene.__lanCombatId;
  }
  scene.combatState.worldMonsterSnapshot = snapshotMonsterForWorld(scene, monster);
  setHarvestablesVisible(scene, false);

  const keepPrepSummons = scene.prepAllies === true;
  const existingSummons =
    Array.isArray(scene.combatSummons)
      ? scene.combatSummons.filter((s) => s && !s.isCombatAlly)
      : [];
  const existingAllies =
    keepPrepSummons && Array.isArray(scene.combatAllies)
      ? scene.combatAllies.filter((s) => s && s.isCombatAlly)
      : [];
  scene.combatSummons = existingSummons;
  scene.combatAllies = existingAllies;
  scene.prepAllies = false;

  document.body.classList.add("combat-active");

  maybeSpawnRiftAllies(scene, player);
  maybeSpawnTitanAllies(scene, player, monster);

  if (scene.prepState?.challenge && !scene.combatState.challenge) {
    scene.combatState.challenge = scene.prepState.challenge;
  }

  if (player && typeof player.updateHudApMp === "function") {
    player.updateHudApMp(scene.combatState.paRestants, scene.combatState.pmRestants);
  }

  buildTurnOrder(scene);
  initCombatChallenge(scene);

  if (scene && typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }
}
