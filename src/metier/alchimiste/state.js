// Gestion centralisee de l'etat du metier alchimiste (niveau, xp, palier suivant)
import { alchimisteDefinition } from "./config.js";

const DEFAULT_LEVEL = 1;

function computeXpNext(level) {
  const safeLevel = typeof level === "number" && level > 0 ? level : DEFAULT_LEVEL;
  return safeLevel * 100;
}

/**
 * Retourne l'etat metier alchimiste du joueur en garantissant
 * les proprietes level / xp / xpNext.
 */
export function ensureAlchimisteState(player) {
  if (!player) return null;
  if (!player.metiers) {
    player.metiers = {};
  }
  if (!player.metiers.alchimiste) {
    player.metiers.alchimiste = {
      level: DEFAULT_LEVEL,
      xp: 0,
      xpNext: computeXpNext(DEFAULT_LEVEL),
    };
  }

  const state = player.metiers.alchimiste;
  state.level = state.level ?? DEFAULT_LEVEL;
  state.xp = state.xp ?? 0;
  state.xpNext = state.xpNext ?? computeXpNext(state.level);
  return state;
}

/**
 * Ajoute de l'XP au metier alchimiste et gere les montees de niveau.
 * Retourne le nouvel etat et si un niveau a ete gagne.
 */
export function addAlchimisteXp(player, amount) {
  const state = ensureAlchimisteState(player);
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

// Expose la definition statique au meme endroit pour simplifier les imports
export { alchimisteDefinition };
