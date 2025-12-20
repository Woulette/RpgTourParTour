import { emit as emitStoreEvent, getPlayer } from "../state/store.js";
import { quests, QUEST_STATES, getQuestState, acceptQuest, advanceQuestStage, getCurrentQuestStage, incrementCraftProgress } from "../quests/index.js";
import { completeQuest } from "../quests/state.js";
import { addItem } from "../inventory/inventoryCore.js";

function isCheatsEnabled() {
  if (typeof window === "undefined") return false;
  if (window.__ENABLE_CHEATS__ === true) return true;
  const host = window.location?.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

function ensurePlayer() {
  const player = getPlayer();
  if (!player) {
    throw new Error("Cheats: player introuvable (store non initialisé)");
  }
  return player;
}

function resetProgress(state) {
  state.progress = { currentCount: 0, crafted: {} };
}

function emitQuestUpdated(questId, state) {
  emitStoreEvent("quest:updated", { questId, state });
}

function setQuestCompletedNoRewards(player, questId) {
  const questDef = quests[questId];
  if (!questDef) throw new Error(`Cheats: quête inconnue ${questId}`);
  const state = getQuestState(player, questId);
  const stageCount = Array.isArray(questDef.stages) ? questDef.stages.length : 0;
  if (stageCount > 0) state.stageIndex = stageCount - 1;
  state.state = QUEST_STATES.COMPLETED;
  resetProgress(state);
  emitQuestUpdated(questId, state);
  return state;
}

function completePrereqsNoRewards(player, questId, seen = new Set()) {
  if (!questId) return;
  if (seen.has(questId)) return;
  seen.add(questId);
  const questDef = quests[questId];
  if (!questDef) throw new Error(`Cheats: quęte inconnue ${questId}`);
  const reqs = Array.isArray(questDef.requires) ? questDef.requires.filter(Boolean) : [];
  reqs.forEach((reqId) => completePrereqsNoRewards(player, reqId, seen));
  reqs.forEach((reqId) => setQuestCompletedNoRewards(player, reqId));
}

function setQuestInProgressAtStage(player, questId, stageIdOrIndex = 0) {
  const questDef = quests[questId];
  if (!questDef) throw new Error(`Cheats: quête inconnue ${questId}`);
  const state = getQuestState(player, questId);
  state.state = QUEST_STATES.IN_PROGRESS;

  let index = 0;
  if (typeof stageIdOrIndex === "number") {
    index = stageIdOrIndex;
  } else if (typeof stageIdOrIndex === "string") {
    index = questDef.stages.findIndex((s) => s?.id === stageIdOrIndex);
    if (index < 0) index = 0;
  }
  state.stageIndex = Math.max(0, index);
  resetProgress(state);
  emitQuestUpdated(questId, state);
  return state;
}

function resetQuest(player, questId) {
  const questDef = quests[questId];
  if (!questDef) throw new Error(`Cheats: quête inconnue ${questId}`);
  const state = getQuestState(player, questId);
  state.state = QUEST_STATES.NOT_STARTED;
  state.stageIndex = 0;
  resetProgress(state);
  emitQuestUpdated(questId, state);
  return state;
}

function questSnapshot(player, questId) {
  const questDef = quests[questId];
  if (!questDef) throw new Error(`Cheats: quête inconnue ${questId}`);
  const state = getQuestState(player, questId, { emit: false });
  const stage = getCurrentQuestStage(questDef, state);
  return { questId, state: { ...state }, stage };
}

export function initDevCheats(scene) {
  if (!isCheatsEnabled()) return;
  if (typeof window === "undefined") return;
  if (window.cheat) return;

  window.__scene = scene;

  window.cheat = {
    help() {
      // eslint-disable-next-line no-console
      console.log(
        [
          "Cheats dispo:",
          "cheat.quests.list()",
          "cheat.quests.show('papi_meme_1')",
          "cheat.quests.accept('papi_corbeaux_1')",
          "cheat.quests.setStage('papi_corbeaux_1', 1) ou 'return_to_papi'",
          "cheat.quests.complete('papi_meme_1', { rewards: true|false })",
          "cheat.quests.skip('andemia_intro_3')",
          "cheat.quests.unlock('andemia_intro_3')",
          "cheat.quests.skipTo('andemia_intro_3')",
          "cheat.quests.reset('papi_meme_1')",
          "cheat.inv.give('bois_chene', 50)",
          "cheat.craft.add('coiffe_corbeau_air', 1)",
          "cheat.presets.afterWood()",
        ].join("\n")
      );
    },
    player() {
      return ensurePlayer();
    },
    pos() {
      const player = ensurePlayer();
      const sc = window.__scene;
      return {
        mapKey: sc?.currentMapKey ?? sc?.currentMapDef?.key ?? null,
        tile: { x: player.currentTileX ?? null, y: player.currentTileY ?? null },
        world: { x: player.x ?? null, y: player.y ?? null },
      };
    },
    quests: {
      list() {
        return Object.keys(quests);
      },
      show(questId) {
        return questSnapshot(ensurePlayer(), questId);
      },
      accept(questId) {
        const player = ensurePlayer();
        acceptQuest(player, questId);
        return questSnapshot(player, questId);
      },
      setStage(questId, stageIdOrIndex) {
        const player = ensurePlayer();
        return setQuestInProgressAtStage(player, questId, stageIdOrIndex);
      },
      advance(questId) {
        const player = ensurePlayer();
        advanceQuestStage(player, questId, { scene: window.__scene });
        return questSnapshot(player, questId);
      },
      complete(questId, { rewards = false } = {}) {
        const player = ensurePlayer();
        if (rewards) {
          completeQuest(window.__scene, player, questId);
          return questSnapshot(player, questId);
        }
        return setQuestCompletedNoRewards(player, questId);
      },
      skip(questId) {
        const player = ensurePlayer();
        return setQuestCompletedNoRewards(player, questId);
      },
      unlock(questId) {
        const player = ensurePlayer();
        completePrereqsNoRewards(player, questId);
        return questSnapshot(player, questId);
      },
      skipTo(questId) {
        const player = ensurePlayer();
        completePrereqsNoRewards(player, questId);
        acceptQuest(player, questId);
        return questSnapshot(player, questId);
      },
      reset(questId) {
        const player = ensurePlayer();
        return resetQuest(player, questId);
      },
    },
    inv: {
      give(itemId, qty = 1) {
        const player = ensurePlayer();
        addItem(player.inventory, itemId, qty);
      },
    },
    craft: {
      add(itemId, qty = 1) {
        const player = ensurePlayer();
        incrementCraftProgress(player, itemId, qty);
      },
    },
    presets: {
      afterWood() {
        const player = ensurePlayer();
        setQuestCompletedNoRewards(player, "papi_corbeaux_1");
        setQuestCompletedNoRewards(player, "papi_meme_1");
        setQuestInProgressAtStage(player, "meme_panoplie_corbeau_1", 0);
        return questSnapshot(player, "meme_panoplie_corbeau_1");
      },
    },
  };

  // eslint-disable-next-line no-console
  console.log("Dev cheats actifs: window.cheat (tape cheat.help())");
}
