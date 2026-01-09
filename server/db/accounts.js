const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeAccountName(name) {
  return String(name || "").trim().toLowerCase();
}

function createAccountStore({ dataDir } = {}) {
  const root = dataDir || path.join(__dirname, "..", "data");
  ensureDir(root);
  const dbPath = path.join(root, "andemia.db");
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      account_id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      password_hash TEXT,
      password_salt TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );
  `);

  const selectByNameStmt = db.prepare(
    "SELECT account_id, name, password_hash, password_salt FROM accounts WHERE name = ?"
  );
  const selectByIdStmt = db.prepare(
    "SELECT account_id, name, password_hash, password_salt FROM accounts WHERE account_id = ?"
  );
  const insertStmt = db.prepare(`
    INSERT INTO accounts
      (account_id, name, password_hash, password_salt, created_at, updated_at)
    VALUES
      (@accountId, @name, @passwordHash, @passwordSalt, @createdAt, @updatedAt)
  `);

  const getAccountByName = (name) => {
    const normalized = normalizeAccountName(name);
    if (!normalized) return null;
    const row = selectByNameStmt.get(normalized);
    if (!row) return null;
    return {
      accountId: row.account_id,
      name: row.name,
      passwordHash: row.password_hash,
      passwordSalt: row.password_salt,
    };
  };

  const getAccountById = (accountId) => {
    if (!accountId) return null;
    const row = selectByIdStmt.get(accountId);
    if (!row) return null;
    return {
      accountId: row.account_id,
      name: row.name,
      passwordHash: row.password_hash,
      passwordSalt: row.password_salt,
    };
  };

  const createAccount = ({ name, password }) => {
    const normalized = normalizeAccountName(name);
    if (!normalized || !password) return null;
    if (getAccountByName(normalized)) return null;
    const passwordSalt = crypto.randomBytes(12).toString("hex");
    const passwordHash = crypto
      .scryptSync(String(password), passwordSalt, 64)
      .toString("hex");
    const accountId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : crypto.randomBytes(16).toString("hex");
    const now = Date.now();
    insertStmt.run({
      accountId,
      name: normalized,
      passwordHash,
      passwordSalt,
      createdAt: now,
      updatedAt: now,
    });
    return getAccountById(accountId);
  };

  const verifyPassword = (account, password) => {
    if (!account || !password) return false;
    const hash = crypto
      .scryptSync(String(password), account.passwordSalt, 64)
      .toString("hex");
    return hash === account.passwordHash;
  };

  return {
    normalizeAccountName,
    getAccountByName,
    getAccountById,
    createAccount,
    verifyPassword,
    close: () => db.close(),
  };
}

module.exports = {
  createAccountStore,
  normalizeAccountName,
};
