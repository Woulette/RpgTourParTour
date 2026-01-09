import { createCombatPrepAlliesHandlers } from "./prep/allies.js";
import { createCombatPrepPlacementHandlers } from "./prep/placement.js";

export function createCombatPrepHandlers(ctx, helpers) {
  const allies = createCombatPrepAlliesHandlers(ctx, helpers);
  const placement = createCombatPrepPlacementHandlers(ctx, helpers, allies);

  return {
    ...allies,
    ...placement,
  };
}
