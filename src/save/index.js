import { loadSaveFile, writeSaveFile } from "./storage.js";
import { createPlayerInventory } from "../features/inventory/runtime/inventoryContainers.js";
import { createEmptyEquipment } from "../features/inventory/runtime/equipmentCore.js";
import { normalizeLevelState } from "../core/level.js";
import { ensureAllMetiers } from "../features/metier/ensureAllMetiers.js";

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function ensureCharacterEntry(saveFile, characterId) {
  if (!saveFile.characters) saveFile.characters = {};
  if (!saveFile.characters[characterId]) {
    saveFile.characters[characterId] = { meta: null, snapshot: null };
  }
  return saveFile.characters[characterId];
}

export function listCharacterMetas() {
  const saveFile = loadSaveFile();
  const entries = Object.values(saveFile.characters || {});
  const metas = entries
    .map((e) => e?.meta)
    .filter(Boolean)
    .map((m) => ({
      id: m.id,
      name: m.name || "Joueur",
      classId: m.classId || "archer",
      level: m.level ?? 1,
      updatedAt: m.updatedAt ?? 0,
    }));

  // Most recent first
  metas.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return metas;
}

export function deleteCharacter(characterId) {
  if (!characterId) return false;
  const saveFile = loadSaveFile();
  if (!saveFile?.characters || !saveFile.characters[characterId]) return false;
  delete saveFile.characters[characterId];
  return writeSaveFile(saveFile);
}

export function upsertCharacterMeta(character) {
  if (!character || !character.id) return false;
  const saveFile = loadSaveFile();
  const entry = ensureCharacterEntry(saveFile, character.id);
  entry.meta = {
    id: character.id,
    name: character.name || "Joueur",
    classId: character.classId || "archer",
    level: character.level ?? 1,
    updatedAt: Date.now(),
  };
  return writeSaveFile(saveFile);
}

export function loadCharacterSnapshot(characterId) {
  if (!characterId) return null;
  const saveFile = loadSaveFile();
  const entry = saveFile.characters?.[characterId] || null;
  return entry?.snapshot || null;
}

export function saveCharacterSnapshot(characterId, snapshot) {
  if (!characterId || !snapshot) return false;
  const saveFile = loadSaveFile();
  const entry = ensureCharacterEntry(saveFile, characterId);
  entry.snapshot = snapshot;
  // Keep meta in sync (level/name/class)
  const lvl = snapshot.level ?? snapshot.levelState?.niveau ?? 1;
  entry.meta = {
    id: characterId,
    name: snapshot.name || entry.meta?.name || "Joueur",
    classId: snapshot.classId || entry.meta?.classId || "archer",
    level: lvl,
    updatedAt: Date.now(),
  };
  return writeSaveFile(saveFile);
}

export function buildSnapshotFromPlayer(player) {
  if (!player) return null;
  const scene = player.scene || null;
  const characterId = player.characterId || null;

  const tileX = Number.isFinite(player.currentTileX) ? player.currentTileX : null;
  const tileY = Number.isFinite(player.currentTileY) ? player.currentTileY : null;

  return {
    id: characterId,
    name: player.displayName || player.name || "Joueur",
    classId: player.classId || "archer",
    level: player.levelState?.niveau ?? 1,
    mapKey: scene?.currentMapKey || null,
    tileX,
    tileY,
    gold: Number.isFinite(player.gold) ? player.gold : 0,
    honorPoints: Number.isFinite(player.honorPoints) ? player.honorPoints : 0,
    levelState: cloneJson(player.levelState || null),
    baseStats: cloneJson(player.baseStats || null),
    inventory: cloneJson(player.inventory || null),
    equipment: cloneJson(player.equipment || null),
    quests: cloneJson(player.quests || null),
    achievements: cloneJson(player.achievements || null),
    metiers: cloneJson(player.metiers || null),
    spellParchments: cloneJson(player.spellParchments || null),
    savedAt: Date.now(),
  };
}

export function applySnapshotToPlayer(player, snapshot) {
  if (!player || !snapshot) return;

  player.displayName = snapshot.name || player.displayName || "Joueur";
  if (snapshot.classId) player.classId = snapshot.classId;

  if (snapshot.levelState) {
    player.levelState = normalizeLevelState(cloneJson(snapshot.levelState));
  }
  if (snapshot.baseStats) player.baseStats = cloneJson(snapshot.baseStats);

  player.gold = Number.isFinite(snapshot.gold) ? snapshot.gold : player.gold ?? 0;
  player.honorPoints = Number.isFinite(snapshot.honorPoints)
    ? snapshot.honorPoints
    : player.honorPoints ?? 0;

  // Inventory: ensure shape, then fill.
  if (snapshot.inventory && typeof snapshot.inventory === "object") {
    const inv = createPlayerInventory();
    inv.size = Number.isFinite(snapshot.inventory.size) ? snapshot.inventory.size : inv.size;
    inv.autoGrow = snapshot.inventory.autoGrow || inv.autoGrow;
    inv.slots = Array.isArray(snapshot.inventory.slots)
      ? snapshot.inventory.slots.slice(0, inv.size)
      : inv.slots;
    while (inv.slots.length < inv.size) inv.slots.push(null);
    player.inventory = inv;
  }

  // Equipment: keep known slots, apply saved entries.
  if (snapshot.equipment && typeof snapshot.equipment === "object") {
    const eq = createEmptyEquipment();
    Object.keys(eq).forEach((k) => {
      eq[k] = snapshot.equipment[k] || null;
    });
    player.equipment = eq;
  }

  if (snapshot.quests && typeof snapshot.quests === "object") {
    player.quests = cloneJson(snapshot.quests);
  }

  if (snapshot.achievements && typeof snapshot.achievements === "object") {
    player.achievements = cloneJson(snapshot.achievements);
  }

  if (snapshot.metiers && typeof snapshot.metiers === "object") {
    player.metiers = cloneJson(snapshot.metiers);
  }
  if (snapshot.spellParchments && typeof snapshot.spellParchments === "object") {
    player.spellParchments = cloneJson(snapshot.spellParchments);
  }

  ensureAllMetiers(player);

  if (typeof player.recomputeStatsWithEquipment === "function") {
    player.recomputeStatsWithEquipment();
  }
}
