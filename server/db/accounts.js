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
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_tokens (
      token TEXT PRIMARY KEY,
      account_id TEXT,
      created_at INTEGER,
      expires_at INTEGER
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS account_friends (
      account_id TEXT,
      friend_account_id TEXT,
      created_at INTEGER,
      PRIMARY KEY (account_id, friend_account_id)
    );
    CREATE TABLE IF NOT EXISTS account_ignored (
      account_id TEXT,
      ignored_account_id TEXT,
      created_at INTEGER,
      PRIMARY KEY (account_id, ignored_account_id)
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
  const insertTokenStmt = db.prepare(`
    INSERT INTO session_tokens
      (token, account_id, created_at, expires_at)
    VALUES
      (@token, @accountId, @createdAt, @expiresAt)
  `);
  const selectTokenStmt = db.prepare(
    "SELECT token, account_id, expires_at FROM session_tokens WHERE token = ?"
  );
  const deleteTokenStmt = db.prepare("DELETE FROM session_tokens WHERE token = ?");
  const deleteExpiredTokensStmt = db.prepare(
    "DELETE FROM session_tokens WHERE expires_at IS NOT NULL AND expires_at <= ?"
  );
  const selectFriendsStmt = db.prepare(
    "SELECT friend_account_id FROM account_friends WHERE account_id = ?"
  );
  const selectFriendsOfStmt = db.prepare(
    "SELECT account_id FROM account_friends WHERE friend_account_id = ?"
  );
  const selectIgnoredStmt = db.prepare(
    "SELECT ignored_account_id FROM account_ignored WHERE account_id = ?"
  );
  const insertFriendStmt = db.prepare(`
    INSERT OR IGNORE INTO account_friends
      (account_id, friend_account_id, created_at)
    VALUES
      (@accountId, @friendAccountId, @createdAt)
  `);
  const deleteFriendStmt = db.prepare(`
    DELETE FROM account_friends
    WHERE account_id = ? AND friend_account_id = ?
  `);
  const insertIgnoredStmt = db.prepare(`
    INSERT OR IGNORE INTO account_ignored
      (account_id, ignored_account_id, created_at)
    VALUES
      (@accountId, @ignoredAccountId, @createdAt)
  `);
  const deleteIgnoredStmt = db.prepare(`
    DELETE FROM account_ignored
    WHERE account_id = ? AND ignored_account_id = ?
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

  const issueSessionToken = (accountId, ttlMs) => {
    if (!accountId) return null;
    deleteExpiredTokensStmt.run(Date.now());
    const token = crypto.randomBytes(24).toString("hex");
    const now = Date.now();
    const expiresAt = Number.isFinite(ttlMs) ? now + Math.max(0, ttlMs) : null;
    insertTokenStmt.run({
      token,
      accountId,
      createdAt: now,
      expiresAt,
    });
    return token;
  };

  const getAccountIdFromSession = (token) => {
    if (!token) return null;
    const row = selectTokenStmt.get(token);
    if (!row) return null;
    if (Number.isFinite(row.expires_at) && row.expires_at <= Date.now()) {
      deleteTokenStmt.run(token);
      return null;
    }
    return row.account_id || null;
  };

  const revokeSessionToken = (token) => {
    if (!token) return false;
    deleteTokenStmt.run(token);
    return true;
  };

  return {
    normalizeAccountName,
    getAccountByName,
    getAccountById,
    createAccount,
    verifyPassword,
    issueSessionToken,
    getAccountIdFromSession,
    revokeSessionToken,
    getFriends: (accountId) => {
      if (!accountId) return [];
      return selectFriendsStmt
        .all(accountId)
        .map((row) => row.friend_account_id)
        .filter(Boolean);
    },
    getFriendsOf: (accountId) => {
      if (!accountId) return [];
      return selectFriendsOfStmt
        .all(accountId)
        .map((row) => row.account_id)
        .filter(Boolean);
    },
    getIgnored: (accountId) => {
      if (!accountId) return [];
      return selectIgnoredStmt
        .all(accountId)
        .map((row) => row.ignored_account_id)
        .filter(Boolean);
    },
    addFriend: (accountId, friendAccountId) => {
      if (!accountId || !friendAccountId || accountId === friendAccountId) return false;
      insertFriendStmt.run({
        accountId,
        friendAccountId,
        createdAt: Date.now(),
      });
      return true;
    },
    removeFriend: (accountId, friendAccountId) => {
      if (!accountId || !friendAccountId) return false;
      deleteFriendStmt.run(accountId, friendAccountId);
      return true;
    },
    addIgnored: (accountId, ignoredAccountId) => {
      if (!accountId || !ignoredAccountId || accountId === ignoredAccountId) return false;
      insertIgnoredStmt.run({
        accountId,
        ignoredAccountId,
        createdAt: Date.now(),
      });
      return true;
    },
    removeIgnored: (accountId, ignoredAccountId) => {
      if (!accountId || !ignoredAccountId) return false;
      deleteIgnoredStmt.run(accountId, ignoredAccountId);
      return true;
    },
    isIgnored: (accountId, otherAccountId) => {
      if (!accountId || !otherAccountId) return false;
      const rows = selectIgnoredStmt.all(accountId);
      return rows.some((row) => row.ignored_account_id === otherAccountId);
    },
    close: () => db.close(),
  };
}

module.exports = {
  createAccountStore,
  normalizeAccountName,
};
