import { createCombatSpellResolveHandlers } from "./spells/resolve.js";

export function createCombatSpellHandlers(ctx, helpers) {
  const resolver = createCombatSpellResolveHandlers(ctx, helpers);

  return {
    ...resolver,
  };
}
