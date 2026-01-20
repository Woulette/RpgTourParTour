function createCraftHandlers({
  state,
  send,
  persistPlayerState,
  getNextEventId,
  getCraftRecipe,
  getCraftDefsPromise,
  getCraftDefsFailed,
  getItemDefs,
  helpers,
  sync,
  quests,
}) {
  const {
    ensurePlayerInventory,
    snapshotInventory,
    restoreInventory,
    countItemInInventory,
    addItemToInventory,
    removeItemFromInventory,
    diffInventory,
    logAntiDup,
    ensureMetierState,
    addMetierXp,
  } = helpers;
  const { sendPlayerSync } = sync;
  const { incrementCraftProgressForPlayer, sendQuestSync } = quests;

  function handleCmdCraft(ws, clientInfo, msg) {
    const trace = process.env.LAN_TRACE === "1";
    if (clientInfo.id !== msg.playerId) return;
    const metierId = typeof msg.metierId === "string" ? msg.metierId : null;
    const recipeId = typeof msg.recipeId === "string" ? msg.recipeId : null;
    if (!metierId || !recipeId) return;

    const recipe =
      typeof getCraftRecipe === "function" ? getCraftRecipe(metierId, recipeId) : null;
    const defsFailed =
      typeof getCraftDefsFailed === "function" ? getCraftDefsFailed() : false;
    const defsPromise =
      typeof getCraftDefsPromise === "function" ? getCraftDefsPromise() : null;
    if (!recipe && !defsFailed) {
      if (!msg.__craftDefsWaited) {
        msg.__craftDefsWaited = true;
        defsPromise?.then(() => handleCmdCraft(ws, clientInfo, msg));
        return;
      }
    }
    if (!recipe) {
      if (trace) {
        // eslint-disable-next-line no-console
        console.log("[LAN][Trace] craft:reject", "recipe_missing", {
          metierId,
          recipeId,
        });
      }
      return;
    }

    const player = state.players[clientInfo.id];
    if (!player) return;
    const inv = ensurePlayerInventory(player);
    if (!inv) return;

    const inputs = Array.isArray(recipe.inputs) ? recipe.inputs : [];
    const output = recipe.output || null;
    const outItemId = typeof output?.itemId === "string" ? output.itemId : null;
    const outQty = Number.isInteger(output?.qty) ? output.qty : 0;
    if (!outItemId || outQty <= 0) return;

    const itemDefs = typeof getItemDefs === "function" ? getItemDefs() : null;
    if (!itemDefs || !itemDefs[outItemId]) {
      if (trace) {
        // eslint-disable-next-line no-console
        console.log("[LAN][Trace] craft:reject", "output_unknown", {
          outItemId,
        });
      }
      return;
    }
    const badInput = inputs.some(
      (entry) =>
        !entry ||
        typeof entry.itemId !== "string" ||
        !Number.isInteger(entry.qty) ||
        entry.qty <= 0 ||
        !itemDefs?.[entry.itemId]
    );
    if (badInput) return;

    const metierState = ensureMetierState(player, metierId);
    const requiredLevel =
      Number.isInteger(recipe.level) && recipe.level > 0 ? recipe.level : 1;
    if (!metierState || metierState.level < requiredLevel) {
      if (trace) {
        // eslint-disable-next-line no-console
        console.log("[LAN][Trace] craft:reject", "level_too_low", {
          metierId,
          level: metierState?.level ?? null,
          requiredLevel,
        });
      }
      return;
    }

    const hasAllInputs = inputs.every(
      (entry) => countItemInInventory(inv, entry.itemId) >= entry.qty
    );
    if (!hasAllInputs) {
      if (trace) {
        // eslint-disable-next-line no-console
        console.log("[LAN][Trace] craft:reject", "missing_inputs", {
          metierId,
          recipeId,
        });
      }
      return;
    }

    const beforeInv = snapshotInventory(inv);
    inputs.forEach((entry) => {
      removeItemFromInventory(inv, entry.itemId, entry.qty);
    });
    const added = addItemToInventory(inv, outItemId, outQty);
    if (added < outQty) {
      restoreInventory(inv, beforeInv);
      return;
    }

    const xpGain =
      Number.isFinite(recipe.xpGain) && recipe.xpGain > 0 ? recipe.xpGain : 0;
    if (xpGain > 0) {
      addMetierXp(player, metierId, xpGain);
    }

    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }

    const deltas = diffInventory(beforeInv, inv);
    logAntiDup({
      ts: Date.now(),
      reason: "Craft",
      accountId: player.accountId || null,
      characterId: player.characterId || null,
      playerId: player.id || null,
      mapId: player.mapId || null,
      op: "craft",
      itemId: outItemId,
      qty: outQty,
      itemDeltas: deltas.slice(0, 20),
    });

    sendPlayerSync(ws, player, "craft");
    if (incrementCraftProgressForPlayer(player, outItemId, outQty)) {
      if (typeof persistPlayerState === "function") {
        persistPlayerState(player);
      }
      sendQuestSync(player, "quest_craft");
    }
    send(ws, {
      t: "EvCraftCompleted",
      eventId: getNextEventId(),
      playerId: player.id,
      metierId,
      recipeId,
      itemId: outItemId,
      qty: outQty,
      xpGain,
    });
  }

  return {
    handleCmdCraft,
  };
}

module.exports = {
  createCraftHandlers,
};
