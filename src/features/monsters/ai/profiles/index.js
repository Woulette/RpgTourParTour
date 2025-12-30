const PROFILES = {};

export function getAiProfile(monster) {
  if (!monster) return null;
  const id = monster.aiProfileId || monster.monsterId;
  if (!id) return null;
  return PROFILES[id] || null;
}
