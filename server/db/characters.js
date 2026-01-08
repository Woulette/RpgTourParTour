const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
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
      created_at INTEGER,
      updated_at INTEGER
    );
  `);

  const selectStmt = db.prepare(
    "SELECT character_id, account_id, name, class_id, level, base_stats FROM characters WHERE character_id = ?"
  );
  const insertStmt = db.prepare(`
    INSERT INTO characters
      (character_id, account_id, name, class_id, level, base_stats, created_at, updated_at)
    VALUES
      (@characterId, @accountId, @name, @classId, @level, @baseStats, @createdAt, @updatedAt)
  `);
  const updateStmt = db.prepare(`
    UPDATE characters
    SET account_id = @accountId,
        name = @name,
        class_id = @classId,
        level = @level,
        base_stats = @baseStats,
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
    upsertCharacter,
    close: () => db.close(),
  };
}

module.exports = {
  createCharacterStore,
};
