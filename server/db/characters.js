const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeCharacterName(name) {
  return String(name || "").trim().toLowerCase();
}

function createCharacterStore({ dataDir } = {}) {
  const root = dataDir || path.join(__dirname, "..", "data");
  ensureDir(root);
  const dbPath = path.join(root, "andemia.db");
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS characters (
      character_id TEXT PRIMARY KEY,
      account_id TEXT,
      name TEXT,
      class_id TEXT,
      level INTEGER,
      base_stats TEXT,
      map_id TEXT,
      pos_x INTEGER,
      pos_y INTEGER,
      hp INTEGER,
      hp_max INTEGER,
      captured_monster_id TEXT,
      captured_monster_level INTEGER,
      inventory TEXT,
      gold INTEGER,
      created_at INTEGER,
      updated_at INTEGER
    );
  `);

  const columns = db.prepare("PRAGMA table_info(characters)").all();
  const columnNames = new Set(columns.map((col) => col.name));
  const ensureColumn = (name, type) => {
    if (columnNames.has(name)) return;
    db.exec(`ALTER TABLE characters ADD COLUMN ${name} ${type}`);
    columnNames.add(name);
  };
  ensureColumn("map_id", "TEXT");
  ensureColumn("pos_x", "INTEGER");
  ensureColumn("pos_y", "INTEGER");
  ensureColumn("hp", "INTEGER");
  ensureColumn("hp_max", "INTEGER");
  ensureColumn("captured_monster_id", "TEXT");
  ensureColumn("captured_monster_level", "INTEGER");
  ensureColumn("inventory", "TEXT");
  ensureColumn("gold", "INTEGER");

  const selectStmt = db.prepare(
    `SELECT character_id, account_id, name, class_id, level, base_stats,
            map_id, pos_x, pos_y, hp, hp_max,
            captured_monster_id, captured_monster_level, inventory, gold
     FROM characters WHERE character_id = ?`
  );
  const selectByNameStmt = db.prepare(
    `SELECT character_id, account_id, name, class_id, level, base_stats,
            map_id, pos_x, pos_y, hp, hp_max,
            captured_monster_id, captured_monster_level, inventory, gold
     FROM characters WHERE lower(name) = ?`
  );
  const insertStmt = db.prepare(`
    INSERT INTO characters
      (character_id, account_id, name, class_id, level, base_stats,
       map_id, pos_x, pos_y, hp, hp_max, captured_monster_id, captured_monster_level,
       inventory, gold, created_at, updated_at)
    VALUES
      (@characterId, @accountId, @name, @classId, @level, @baseStats,
       @mapId, @posX, @posY, @hp, @hpMax, @capturedMonsterId, @capturedMonsterLevel,
       @inventory, @gold, @createdAt, @updatedAt)
  `);
  const updateStmt = db.prepare(`
    UPDATE characters
    SET account_id = @accountId,
        name = @name,
        class_id = @classId,
        level = @level,
        base_stats = @baseStats,
        map_id = @mapId,
        pos_x = @posX,
        pos_y = @posY,
        hp = @hp,
        hp_max = @hpMax,
        captured_monster_id = @capturedMonsterId,
        captured_monster_level = @capturedMonsterLevel,
        inventory = @inventory,
        gold = @gold,
        updated_at = @updatedAt
    WHERE character_id = @characterId
  `);

  const getCharacter = (characterId) => {
    if (!characterId) return null;
    const row = selectStmt.get(characterId);
    if (!row) return null;
    return {
      characterId: row.character_id,
      accountId: row.account_id || null,
      name: row.name || "Joueur",
      classId: row.class_id || "archer",
      level: Number.isInteger(row.level) ? row.level : 1,
      baseStats: row.base_stats ? JSON.parse(row.base_stats) : null,
      mapId: row.map_id || null,
      posX: Number.isFinite(row.pos_x) ? row.pos_x : null,
      posY: Number.isFinite(row.pos_y) ? row.pos_y : null,
      hp: Number.isFinite(row.hp) ? row.hp : null,
      hpMax: Number.isFinite(row.hp_max) ? row.hp_max : null,
      capturedMonsterId: row.captured_monster_id || null,
      capturedMonsterLevel: Number.isFinite(row.captured_monster_level)
        ? row.captured_monster_level
        : null,
      inventory: row.inventory ? JSON.parse(row.inventory) : null,
      gold: Number.isFinite(row.gold) ? row.gold : null,
    };
  };

  const getCharacterByName = (name) => {
    const normalized = normalizeCharacterName(name);
    if (!normalized) return null;
    const row = selectByNameStmt.get(normalized);
    if (!row) return null;
    return {
      characterId: row.character_id,
      accountId: row.account_id || null,
      name: row.name || "Joueur",
      classId: row.class_id || "archer",
      level: Number.isInteger(row.level) ? row.level : 1,
      baseStats: row.base_stats ? JSON.parse(row.base_stats) : null,
      mapId: row.map_id || null,
      posX: Number.isFinite(row.pos_x) ? row.pos_x : null,
      posY: Number.isFinite(row.pos_y) ? row.pos_y : null,
      hp: Number.isFinite(row.hp) ? row.hp : null,
      hpMax: Number.isFinite(row.hp_max) ? row.hp_max : null,
      capturedMonsterId: row.captured_monster_id || null,
      capturedMonsterLevel: Number.isFinite(row.captured_monster_level)
        ? row.captured_monster_level
        : null,
      inventory: row.inventory ? JSON.parse(row.inventory) : null,
      gold: Number.isFinite(row.gold) ? row.gold : null,
    };
  };

  const upsertCharacter = (entry) => {
    if (!entry || !entry.characterId) return null;
    const now = Date.now();
    const payload = {
      characterId: entry.characterId,
      accountId: entry.accountId || null,
      name: entry.name || "Joueur",
      classId: entry.classId || "archer",
      level: Number.isInteger(entry.level) ? entry.level : 1,
      baseStats: entry.baseStats ? JSON.stringify(entry.baseStats) : null,
      mapId: entry.mapId || null,
      posX: Number.isFinite(entry.posX) ? entry.posX : null,
      posY: Number.isFinite(entry.posY) ? entry.posY : null,
      hp: Number.isFinite(entry.hp) ? Math.round(entry.hp) : null,
      hpMax: Number.isFinite(entry.hpMax) ? Math.round(entry.hpMax) : null,
      capturedMonsterId: entry.capturedMonsterId || null,
      capturedMonsterLevel: Number.isFinite(entry.capturedMonsterLevel)
        ? Math.round(entry.capturedMonsterLevel)
        : null,
      inventory: entry.inventory ? JSON.stringify(entry.inventory) : null,
      gold: Number.isFinite(entry.gold) ? Math.round(entry.gold) : null,
      createdAt: now,
      updatedAt: now,
    };
    const existing = getCharacter(entry.characterId);
    if (!existing) {
      insertStmt.run(payload);
    } else {
      updateStmt.run(payload);
    }
    return getCharacter(entry.characterId);
  };

  return {
    getCharacter,
    getCharacterByName,
    upsertCharacter,
    close: () => db.close(),
  };
}

module.exports = {
  createCharacterStore,
};
