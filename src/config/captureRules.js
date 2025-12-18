import { monsters } from "../content/monsters/index.js";

// Liste des monstres impossibles à capturer (trop cheat / spéciaux / boss).
// Ajoute simplement leurs ids (ex: "aluineeks", "boss_xxx", ...).
export const UNCAPTURABLE_MONSTER_IDS = new Set([
  // Boss / spéciaux à remplir
]);

export function isBossMonsterId(monsterId) {
  if (!monsterId) return false;
  const def = monsters[monsterId];
  if (!def) return false;
  return (
    def.isBoss === true ||
    def.boss === true ||
    (Array.isArray(def.tags) && def.tags.includes("boss")) ||
    (typeof def.type === "string" && def.type.toLowerCase() === "boss")
  );
}

export function isMonsterCapturable(monsterId) {
  if (!monsterId) return false;
  if (UNCAPTURABLE_MONSTER_IDS.has(monsterId)) return false;
  if (isBossMonsterId(monsterId)) return false;
  return true;
}

