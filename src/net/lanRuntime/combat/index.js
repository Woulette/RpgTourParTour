import { createCombatHelpers } from "./helpers.js";
import { createCombatPrepHandlers } from "./prep.js";
import { createCombatLifecycleHandlers } from "./lifecycle.js";
import { createCombatTurnHandlers } from "./turns.js";
import { createCombatMoveHandlers } from "./moves.js";
import { createCombatSpellHandlers } from "./spells.js";
import { createCombatDamageHandlers } from "./damage.js";
import { createCombatSyncHandlers } from "./sync.js";

export function createCombatHandlers(ctx) {
  const helpers = createCombatHelpers(ctx);
  const prep = createCombatPrepHandlers(ctx, helpers);
  const sync = createCombatSyncHandlers(ctx, helpers);
  const lifecycle = createCombatLifecycleHandlers(ctx, helpers, prep, sync);
  const turns = createCombatTurnHandlers(ctx, helpers);
  const moves = createCombatMoveHandlers(ctx, helpers);
  const spells = createCombatSpellHandlers(ctx);
  const damage = createCombatDamageHandlers(ctx, helpers);

  return {
    ...lifecycle,
    ...turns,
    ...moves,
    ...spells,
    ...damage,
    ...sync,
  };
}
