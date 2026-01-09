import { createCombatPlayerMoveHandlers } from "./moves/player.js";
import { createCombatMonsterMoveHandlers } from "./moves/monster.js";

export function createCombatMoveHandlers(ctx, helpers) {
  const playerMoves = createCombatPlayerMoveHandlers(ctx, helpers);
  const monsterMoves = createCombatMonsterMoveHandlers(ctx, helpers);

  return {
    ...playerMoves,
    ...monsterMoves,
  };
}
