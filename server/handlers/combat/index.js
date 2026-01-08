const { createCombatMobHelpers } = require("./mobs");
const { createSnapshotHandlers } = require("./snapshot");
const { createStateHandlers } = require("./state");
const { createCombatAiHandlers } = require("./ai");
const { createCombatChecksumHandlers } = require("./checksum");
const { createMoveHandlers } = require("./moves");
const { createTurnHandlers } = require("./turns");
const { createSpellHandlers } = require("./spells");
const { createSpellResolver } = require("./spellResolver");

function createCombatHandlers(ctx) {
  const DEBUG_COMBAT = process.env.LAN_COMBAT_DEBUG === "1";
  const debugLog = (...args) => {
    if (!DEBUG_COMBAT) return;
    // eslint-disable-next-line no-console
    console.log("[LAN][Combat]", ...args);
  };
  const serializeActorOrder = (combat) => {
    const order = Array.isArray(combat?.actorOrder) ? combat.actorOrder : [];
    return order
      .map((actor) => {
        if (!actor) return null;
        if (actor.kind === "joueur") {
          return {
            kind: "joueur",
            playerId: Number.isInteger(actor.playerId) ? actor.playerId : null,
          };
        }
        if (actor.kind === "invocation") {
          return {
            kind: "invocation",
            summonId: Number.isInteger(actor.summonId) ? actor.summonId : null,
          };
        }
        return {
          kind: "monstre",
          entityId: Number.isInteger(actor.entityId) ? actor.entityId : null,
          combatIndex: Number.isInteger(actor.combatIndex) ? actor.combatIndex : null,
        };
      })
      .filter(Boolean);
  };
  const sharedCtx = { ...ctx, debugLog, serializeActorOrder };

  const mobHelpers = createCombatMobHelpers({ state: ctx.state });
  const snapshot = createSnapshotHandlers(sharedCtx, mobHelpers);
  const spellResolver = createSpellResolver(sharedCtx, snapshot);
  const aiHandlers = createCombatAiHandlers(sharedCtx, {
    ...snapshot,
    ...spellResolver,
  });
  let turnHandlers = null;
  const stateHandlers = createStateHandlers(sharedCtx, {
    ...mobHelpers,
    ...snapshot,
    ...aiHandlers,
    ...spellResolver,
    advanceCombatTurn: (...args) => turnHandlers?.advanceCombatTurn?.(...args),
  });
  sharedCtx.finalizeCombat = stateHandlers.finalizeCombat;
  turnHandlers = createTurnHandlers(sharedCtx, {
    ...snapshot,
    ...aiHandlers,
    ...spellResolver,
  });
  const checksumHandlers = createCombatChecksumHandlers(sharedCtx, snapshot);
  const moveHandlers = createMoveHandlers(sharedCtx, snapshot);
  const spellHandlers = createSpellHandlers(
    { ...sharedCtx, finalizeCombat: stateHandlers.finalizeCombat },
    { ...snapshot, ...spellResolver }
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
