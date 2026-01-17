const ADMIN_ACCOUNT_IDS = new Set([
  // "put-account-id-here"
]);

const ADMIN_ACCOUNT_NAMES = new Set([
  "bigotdev1",
]);

function isAdminAccount(account) {
  if (!account) return false;
  const id = account.accountId || account.id || null;
  if (id && ADMIN_ACCOUNT_IDS.has(id)) return true;
  const name = String(account.name || "").trim().toLowerCase();
  if (name && ADMIN_ACCOUNT_NAMES.has(name)) return true;
  return false;
}

module.exports = {
  ADMIN_ACCOUNT_IDS,
  ADMIN_ACCOUNT_NAMES,
  isAdminAccount,
};
