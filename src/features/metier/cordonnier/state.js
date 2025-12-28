import { cordonnierDefinition } from "./config.js";

const DEFAULT_LEVEL = 1;

function computeXpNext(level) {
  const safeLevel = typeof level === "number" && level > 0 ? level : DEFAULT_LEVEL;
  return safeLevel * 100;
}

export function ensureCordonnierState(player) {
  if (!player) return null;
  if (!player.metiers) player.metiers = {};
  if (!player.metiers.cordonnier) {
    player.metiers.cordonnier = {
      level: DEFAULT_LEVEL,
      xp: 0,
      xpNext: computeXpNext(DEFAULT_LEVEL),
    };
  }
  const state = player.metiers.cordonnier;
  state.level = state.level ?? DEFAULT_LEVEL;
  state.xp = state.xp ?? 0;
  state.xpNext = state.xpNext ?? computeXpNext(state.level);
  return state;
}

export function addCordonnierXp(player, amount) {
  const state = ensureCordonnierState(player);
  if (!state || typeof amount !== "number" || amount <= 0) {
    return { state, leveledUp: false };
  }

  state.xp += amount;
  let leveledUp = false;

  while (state.xp >= state.xpNext) {
    state.xp -= state.xpNext;
    state.level += 1;
    state.xpNext = computeXpNext(state.level);
    leveledUp = true;
  }

  return { state, leveledUp };
}

export { cordonnierDefinition };
