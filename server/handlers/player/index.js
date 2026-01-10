const { createPlayerHelpers } = require("./helpers");
const { createPlayerSyncHandlers } = require("./sync");
const { createInventoryHandlers } = require("./inventory");
const { createCraftHandlers } = require("./craft");
const { createQuestHandlers } = require("./quests");
const { createMovementHandlers } = require("./movement");
const { createCombatHandlers } = require("./combat");
const { createAuthHandlers } = require("./auth");
const { createEconomyHandlers } = require("./economy");

function createPlayerHandlers(ctx) {
  const MAX_INV_SIZE = 200;
  const MAX_GOLD_DELTA = 100000;
  const MAX_QTY_PER_OP = 9999;

  const helpers = createPlayerHelpers({
    getItemDefs: ctx.getItemDefs,
    MAX_INV_SIZE,
    MAX_QTY_PER_OP,
  });

  const sync = createPlayerSyncHandlers({
    state: ctx.state,
    clients: ctx.clients,
    send: ctx.send,
    persistPlayerState: ctx.persistPlayerState,
    computeFinalStats: ctx.computeFinalStats,
    getNextEventId: ctx.getNextEventId,
    helpers,
  });

  const quests = createQuestHandlers({
    state: ctx.state,
    persistPlayerState: ctx.persistPlayerState,
    getQuestDefs: ctx.getQuestDefs,
    getQuestDefsPromise: ctx.getQuestDefsPromise,
    getQuestDefsFailed: ctx.getQuestDefsFailed,
    getQuestStates: ctx.getQuestStates,
    getLevelApi: ctx.getLevelApi,
    getMonsterDef: ctx.getMonsterDef,
    computeFinalStats: ctx.computeFinalStats,
    helpers,
    sync,
  });

  const inventory = createInventoryHandlers({
    state: ctx.state,
    send: ctx.send,
    persistPlayerState: ctx.persistPlayerState,
    getItemDefs: ctx.getItemDefs,
    getItemDefsPromise: ctx.getItemDefsPromise,
    getItemDefsFailed: ctx.getItemDefsFailed,
    helpers,
    sync,
    MAX_QTY_PER_OP,
  });

  const craft = createCraftHandlers({
    state: ctx.state,
    send: ctx.send,
    persistPlayerState: ctx.persistPlayerState,
    getNextEventId: ctx.getNextEventId,
    getCraftRecipe: ctx.getCraftRecipe,
    getCraftDefsPromise: ctx.getCraftDefsPromise,
    getCraftDefsFailed: ctx.getCraftDefsFailed,
    getItemDefs: ctx.getItemDefs,
    helpers,
    sync,
    quests,
  });

  const economy = createEconomyHandlers({
    state: ctx.state,
    persistPlayerState: ctx.persistPlayerState,
    helpers,
    sync,
    MAX_GOLD_DELTA,
  });

  const combat = createCombatHandlers({
    state: ctx.state,
    clients: ctx.clients,
    send: ctx.send,
    broadcast: ctx.broadcast,
    getNextEventId: ctx.getNextEventId,
    getCombatJoinPayload: ctx.getCombatJoinPayload,
    ensureCombatSnapshot: ctx.ensureCombatSnapshot,
  });

  const movement = createMovementHandlers({
    state: ctx.state,
    broadcast: ctx.broadcast,
    send: ctx.send,
    ensureMapInitialized: ctx.ensureMapInitialized,
    persistPlayerState: ctx.persistPlayerState,
    getNextEventId: ctx.getNextEventId,
    tryStartCombatIfNeeded: ctx.tryStartCombatIfNeeded,
  });

  const auth = createAuthHandlers({
    state: ctx.state,
    clients: ctx.clients,
    broadcast: ctx.broadcast,
    send: ctx.send,
    createPlayer: ctx.createPlayer,
    accountStore: ctx.accountStore,
    characterStore: ctx.characterStore,
    buildBaseStatsForClass: ctx.buildBaseStatsForClass,
    computeFinalStats: ctx.computeFinalStats,
    config: ctx.config,
    getNextPlayerId: ctx.getNextPlayerId,
    getNextEventId: ctx.getNextEventId,
    getHostId: ctx.getHostId,
    setHostId: ctx.setHostId,
    snapshotForClient: ctx.snapshotForClient,
    issueSessionToken: ctx.issueSessionToken,
    getAccountIdFromSession: ctx.getAccountIdFromSession,
    combat,
  });

  return {
    handleHello: auth.handleHello,
    handleCmdMove: movement.handleCmdMove,
    handleCmdMapChange: movement.handleCmdMapChange,
    handleCmdEndTurn: combat.handleCmdEndTurn,
    handleCmdCombatResync: combat.handleCmdCombatResync,
    handleCmdRequestMapPlayers: movement.handleCmdRequestMapPlayers,
    handleCmdPlayerSync: sync.handleCmdPlayerSync,
    handleCmdInventoryOp: inventory.handleCmdInventoryOp,
    handleCmdCraft: craft.handleCmdCraft,
    handleCmdGoldOp: economy.handleCmdGoldOp,
    handleCmdQuestAction: quests.handleCmdQuestAction,
    applyInventoryOpFromServer: inventory.applyInventoryOpFromServer,
    applyQuestKillProgressForPlayer: quests.applyQuestKillProgressForPlayer,
    applyCombatRewardsForPlayer: quests.applyCombatRewardsForPlayer,
  };
}

module.exports = {
  createPlayerHandlers,
};
