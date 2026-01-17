const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function createMarketStore({ dataDir } = {}) {
  const root = dataDir || path.join(__dirname, "..", "data");
  ensureDir(root);
  const dbPath = path.join(root, "andemia.db");
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS market_listings (
      listing_id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_account_id TEXT,
      item_id TEXT,
      qty INTEGER,
      unit_price INTEGER,
      created_at INTEGER,
      expires_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS market_listings_item_idx
      ON market_listings(item_id);
    CREATE INDEX IF NOT EXISTS market_listings_expires_idx
      ON market_listings(expires_at);
    CREATE INDEX IF NOT EXISTS market_listings_seller_idx
      ON market_listings(seller_account_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS market_balance (
      account_id TEXT PRIMARY KEY,
      balance INTEGER,
      updated_at INTEGER
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS market_returns (
      return_id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT,
      item_id TEXT,
      qty INTEGER,
      created_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS market_returns_account_idx
      ON market_returns(account_id);
  `);

  const insertListingStmt = db.prepare(`
    INSERT INTO market_listings
      (seller_account_id, item_id, qty, unit_price, created_at, expires_at)
    VALUES
      (@sellerAccountId, @itemId, @qty, @unitPrice, @createdAt, @expiresAt)
  `);
  const listActiveStmt = db.prepare(`
    SELECT listing_id, seller_account_id, item_id, qty, unit_price, created_at, expires_at
    FROM market_listings
    WHERE expires_at > ?
    ORDER BY created_at DESC
  `);
  const listByAccountStmt = db.prepare(`
    SELECT listing_id, seller_account_id, item_id, qty, unit_price, created_at, expires_at
    FROM market_listings
    WHERE seller_account_id = ? AND expires_at > ?
    ORDER BY created_at DESC
  `);
  const getListingStmt = db.prepare(`
    SELECT listing_id, seller_account_id, item_id, qty, unit_price, created_at, expires_at
    FROM market_listings
    WHERE listing_id = ?
  `);
  const updateListingQtyStmt = db.prepare(`
    UPDATE market_listings SET qty = @qty WHERE listing_id = @listingId
  `);
  const deleteListingStmt = db.prepare(
    "DELETE FROM market_listings WHERE listing_id = ?"
  );
  const listExpiredStmt = db.prepare(`
    SELECT listing_id, seller_account_id, item_id, qty
    FROM market_listings
    WHERE expires_at <= ?
  `);
  const deleteExpiredStmt = db.prepare(
    "DELETE FROM market_listings WHERE expires_at <= ?"
  );

  const getBalanceStmt = db.prepare(
    "SELECT balance FROM market_balance WHERE account_id = ?"
  );
  const upsertBalanceStmt = db.prepare(`
    INSERT INTO market_balance (account_id, balance, updated_at)
    VALUES (@accountId, @balance, @updatedAt)
    ON CONFLICT(account_id) DO UPDATE SET
      balance = excluded.balance,
      updated_at = excluded.updated_at
  `);

  const insertReturnStmt = db.prepare(`
    INSERT INTO market_returns (account_id, item_id, qty, created_at)
    VALUES (@accountId, @itemId, @qty, @createdAt)
  `);
  const listReturnsStmt = db.prepare(`
    SELECT return_id, account_id, item_id, qty, created_at
    FROM market_returns
    WHERE account_id = ?
    ORDER BY created_at DESC
  `);
  const getReturnStmt = db.prepare(`
    SELECT return_id, account_id, item_id, qty, created_at
    FROM market_returns
    WHERE return_id = ?
  `);
  const updateReturnQtyStmt = db.prepare(`
    UPDATE market_returns SET qty = @qty WHERE return_id = @returnId
  `);
  const deleteReturnStmt = db.prepare(
    "DELETE FROM market_returns WHERE return_id = ?"
  );

  const expireListings = db.transaction((now) => {
    const expired = listExpiredStmt.all(now);
    if (expired.length > 0) {
      deleteExpiredStmt.run(now);
    }
    return expired;
  });

  return {
    addListing: (payload) => {
      insertListingStmt.run(payload);
    },
    getListing: (listingId) => {
      if (!Number.isInteger(listingId)) return null;
      const row = getListingStmt.get(listingId);
      if (!row) return null;
      return {
        listingId: row.listing_id,
        sellerAccountId: row.seller_account_id,
        itemId: row.item_id,
        qty: row.qty,
        unitPrice: row.unit_price,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      };
    },
    listActiveListings: (now) =>
      listActiveStmt.all(now).map((row) => ({
        listingId: row.listing_id,
        sellerAccountId: row.seller_account_id,
        itemId: row.item_id,
        qty: row.qty,
        unitPrice: row.unit_price,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      })),
    listListingsByAccount: (accountId, now) =>
      listByAccountStmt.all(accountId, now).map((row) => ({
        listingId: row.listing_id,
        sellerAccountId: row.seller_account_id,
        itemId: row.item_id,
        qty: row.qty,
        unitPrice: row.unit_price,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      })),
    updateListingQty: (listingId, qty) => {
      updateListingQtyStmt.run({ listingId, qty });
    },
    deleteListing: (listingId) => {
      deleteListingStmt.run(listingId);
    },
    expireListings,
    getBalance: (accountId) => {
      if (!accountId) return 0;
      const row = getBalanceStmt.get(accountId);
      return Number.isFinite(row?.balance) ? row.balance : 0;
    },
    setBalance: (accountId, balance) => {
      upsertBalanceStmt.run({
        accountId,
        balance: Math.max(0, Math.round(balance)),
        updatedAt: Date.now(),
      });
    },
    addBalance: (accountId, delta) => {
      const current = getBalanceStmt.get(accountId);
      const prev = Number.isFinite(current?.balance) ? current.balance : 0;
      const next = Math.max(0, prev + Math.round(delta));
      upsertBalanceStmt.run({
        accountId,
        balance: next,
        updatedAt: Date.now(),
      });
      return next;
    },
    addReturn: (accountId, itemId, qty) => {
      if (!accountId || !itemId || qty <= 0) return;
      insertReturnStmt.run({
        accountId,
        itemId,
        qty,
        createdAt: Date.now(),
      });
    },
    listReturns: (accountId) =>
      listReturnsStmt.all(accountId).map((row) => ({
        returnId: row.return_id,
        accountId: row.account_id,
        itemId: row.item_id,
        qty: row.qty,
        createdAt: row.created_at,
      })),
    getReturn: (returnId) => {
      const row = getReturnStmt.get(returnId);
      if (!row) return null;
      return {
        returnId: row.return_id,
        accountId: row.account_id,
        itemId: row.item_id,
        qty: row.qty,
        createdAt: row.created_at,
      };
    },
    updateReturnQty: (returnId, qty) => {
      updateReturnQtyStmt.run({ returnId, qty });
    },
    deleteReturn: (returnId) => {
      deleteReturnStmt.run(returnId);
    },
    close: () => db.close(),
  };
}

module.exports = {
  createMarketStore,
};
