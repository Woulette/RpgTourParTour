import melee from "./melee.js";
import ranged from "./ranged.js";
import support from "./support.js";
import control from "./control.js";
import boss from "./boss.js";

const PROFILES = {
  ...melee,
  ...ranged,
  ...support,
  ...control,
  ...boss,
};

export function getAiProfile(monster) {
  if (!monster) return null;
  const id = monster.aiProfileId || monster.monsterId;
  if (!id) return null;
  return PROFILES[id] || null;
}
