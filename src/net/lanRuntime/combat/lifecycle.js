import { createCombatEnterHandlers } from "./lifecycle/enter.js";
import { createCombatExitHandlers } from "./lifecycle/exit.js";
import { createCombatResyncHandlers } from "./lifecycle/resync.js";

export function createCombatLifecycleHandlers(
  ctx,
  helpers,
  prepHandlers,
  syncHandlers
) {
  const enter = createCombatEnterHandlers({
    ctx,
    helpers,
    prepHandlers,
    syncHandlers,
  });
  const exit = createCombatExitHandlers({ ctx, helpers, syncHandlers });
  const resync = createCombatResyncHandlers({
    ctx,
    helpers,
    prepHandlers,
    syncHandlers,
    applyCombatUpdated: enter.applyCombatUpdated,
  });

  return {
    applyCombatCreated: enter.applyCombatCreated,
    applyCombatUpdated: enter.applyCombatUpdated,
    applyCombatEnded: exit.applyCombatEnded,
    handleCombatJoinReady: resync.handleCombatJoinReady,
  };
}
