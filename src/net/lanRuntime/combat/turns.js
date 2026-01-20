import { createCombatTurnStartHandlers } from "./turns/start.js";
import { createCombatTurnEndHandlers } from "./turns/end.js";

export function createCombatTurnHandlers(ctx, helpers) {
  const startHandlers = createCombatTurnStartHandlers(ctx, helpers);
  const endHandlers = createCombatTurnEndHandlers(ctx, helpers);

  return {
    ...startHandlers,
    ...endHandlers,
  };
}
