import { createCombatState } from "../../../../features/combat/runtime/state.js";

export function createCombatResyncHandlers({
  ctx,
  helpers,
  prepHandlers,
  syncHandlers,
  applyCombatUpdated,
}) {
  const { scene, player } = ctx;
  const { shouldApplyCombatEvent } = helpers;
  const { syncCombatPlayerAllies, startJoinCombatPrep } = prepHandlers;
  const { startCombatSync, sendCombatState } = syncHandlers;

  const ensureCombatResyncState = (entry) => {
    if (!entry || scene.combatState?.enCours || scene.prepState?.actif) return;
    scene.combatMap = scene.combatMap || scene.map;
    scene.combatGroundLayer = scene.combatGroundLayer || scene.groundLayer;
    const dummyMonster = { stats: {} };
    scene.combatState = createCombatState(player, dummyMonster);
    scene.combatState.combatId = entry.combatId;
    scene.combatState.tour =
      entry.turn === "monster" || entry.turn === "summon" ? "monstre" : "joueur";
    scene.combatState.round = Number.isInteger(entry.round) ? entry.round : 1;
    scene.combatState.activePlayerId = Number.isInteger(entry.activePlayerId)
      ? entry.activePlayerId
      : null;
    scene.combatState.activeMonsterId = Number.isInteger(entry.activeMonsterId)
      ? entry.activeMonsterId
      : null;
    scene.combatState.activeMonsterIndex = Number.isInteger(entry.activeMonsterIndex)
      ? entry.activeMonsterIndex
      : null;
    scene.combatState.activeSummonId = Number.isInteger(entry.activeSummonId)
      ? entry.activeSummonId
      : null;
    scene.combatState.summonActing = entry.turn === "summon";
    scene.__lanCombatId = entry.combatId;
    scene.__lanCombatStartSent = true;
    document.body.classList.add("combat-active");
  };

  const handleCombatJoinReady = (msg) => {
    if (!msg || !msg.combat) return;
    const entry = msg.combat;
    const allowResync =
      entry.phase === "combat" && !scene.combatState?.enCours && !scene.prepState?.actif;
    if (!shouldApplyCombatEvent(msg.combat.combatId, msg.eventId, msg.combatSeq)) {
      if (!allowResync) return;
    }
    applyCombatUpdated(entry);
    const mobEntries = Array.isArray(msg.mobEntries) ? msg.mobEntries : [];
    if (entry.phase === "combat") {
      ensureCombatResyncState(entry);
      syncCombatPlayerAllies(entry);
      startCombatSync();
      sendCombatState();
      return;
    }
    startJoinCombatPrep(entry, mobEntries);
  };

  return { handleCombatJoinReady };
}
