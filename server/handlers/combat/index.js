const { createCombatMobHelpers } = require("./mobs");
const { createSnapshotHandlers } = require("./snapshot");
const { createStateHandlers } = require("./state");
const { createCombatAiHandlers } = require("./ai");
const { createCombatChecksumHandlers } = require("./checksum");
const { createMoveHandlers } = require("./moves");
const { createTurnHandlers } = require("./turns");
const { createSpellHandlers } = require("./spells");

function createCombatHandlers(ctx) {
  const DEBUG_COMBAT = process.env.LAN_COMBAT_DEBUG === "1";
  const debugLog = (...args) => {
    if (!DEBUG_COMBAT) return;
    // eslint-disable-next-line no-console
    console.log("[LAN][Combat]", ...args);
  };

  const mobHelpers = createCombatMobHelpers({ state: ctx.state });
  const snapshot = createSnapshotHandlers({ ...ctx, debugLog }, mobHelpers);
  const aiHandlers = createCombatAiHandlers({ ...ctx, debugLog }, snapshot);
  const checksumHandlers = createCombatChecksumHandlers({ ...ctx, debugLog }, snapshot);
  const stateHandlers = createStateHandlers({ ...ctx, debugLog }, {
    ...mobHelpers,
    ...snapshot,
    ...aiHandlers,
  });
  const moveHandlers = createMoveHandlers({ ...ctx, debugLog }, snapshot);
  const turnHandlers = createTurnHandlers({ ...ctx, debugLog }, {
    ...snapshot,
    ...aiHandlers,
  });
  const spellHandlers = createSpellHandlers(
    { ...ctx, debugLog, finalizeCombat: stateHandlers.finalizeCombat },
    snapshot
  );

  return {
    ...stateHandlers,
    ...moveHandlers,
    ...turnHandlers,
    ...spellHandlers,
    ...snapshot,
    ...checksumHandlers,
  };
}

module.exports = {
  createCombatHandlers,
};
