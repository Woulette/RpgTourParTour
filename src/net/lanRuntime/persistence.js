import { getNetClient, getNetPlayerId } from "../../app/session.js";
import { on as onStoreEvent } from "../../state/store.js";

const SYNC_COOLDOWN_MS = 1500;
const SYNC_INTERVAL_MS = 15000;
const MIGRATION_FLAG_KEY = "__lanInvMigrated";

export function createLanPersistenceHandlers(player) {
  let pendingTimer = null;
  let lastSyncAt = 0;
  let lastPayloadJson = null;
  let intervalId = null;

  const buildPayload = () => {
    if (!player) return null;
    const useAuthority =
      typeof window !== "undefined" && window.__lanInventoryAuthority === true;
    let inventory = useAuthority ? null : player.inventory || null;
    let gold = useAuthority ? null : Number.isFinite(player.gold) ? player.gold : 0;
    let migrateInventory = false;
    if (useAuthority && typeof window !== "undefined") {
      const alreadyMigrated =
        window.__lanInvMigrated === true ||
        (typeof localStorage !== "undefined" &&
          localStorage.getItem(MIGRATION_FLAG_KEY) === "1");
      if (!alreadyMigrated && player.inventory) {
        inventory = player.inventory;
        gold = Number.isFinite(player.gold) ? player.gold : 0;
        migrateInventory = true;
      }
    }
    const level =
      Number.isFinite(player.levelState?.niveau) && player.levelState.niveau > 0
        ? Math.round(player.levelState.niveau)
        : Number.isFinite(player.level)
          ? Math.round(player.level)
          : null;
    const baseStats = player.baseStats || null;
    const honorPoints = Number.isFinite(player.honorPoints) ? player.honorPoints : 0;
    return {
      inventory,
      gold,
      level,
      baseStats,
      levelState: player.levelState || null,
      equipment: player.equipment || null,
      trash: player.trash || null,
      quests: player.quests || null,
      achievements: player.achievements || null,
      metiers: player.metiers || null,
      spellParchments: player.spellParchments || null,
      honorPoints,
      migrateInventory,
    };
  };

  const sendSyncNow = () => {
    const client = getNetClient();
    const playerId = getNetPlayerId();
    if (!client || !Number.isInteger(playerId)) return;
    const payload = buildPayload();
    if (!payload) return;

    let inventoryJson = null;
    try {
      inventoryJson = JSON.stringify(payload);
    } catch {
      inventoryJson = null;
    }

    if (inventoryJson !== null && inventoryJson === lastPayloadJson) {
      return;
    }

    lastPayloadJson = inventoryJson;
    client.sendCmd("CmdPlayerSync", {
      playerId,
      inventory: payload.inventory,
      gold: payload.gold,
      honorPoints: payload.honorPoints,
      level: payload.level,
      baseStats: payload.baseStats,
      levelState: payload.levelState,
      equipment: payload.equipment,
      trash: payload.trash,
      quests: payload.quests,
      achievements: payload.achievements,
      metiers: payload.metiers,
      spellParchments: payload.spellParchments,
      migrateInventory: payload.migrateInventory === true,
    });
    if (payload.migrateInventory === true && typeof window !== "undefined") {
      window.__lanInvMigrated = true;
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(MIGRATION_FLAG_KEY, "1");
        }
      } catch {
        // ignore storage errors
      }
    }
    lastSyncAt = Date.now();
  };

  const scheduleSync = () => {
    if (pendingTimer) return;
    const now = Date.now();
    const elapsed = now - lastSyncAt;
    const delay = Math.max(0, SYNC_COOLDOWN_MS - elapsed);
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      sendSyncNow();
    }, delay);
  };

  const unsubs = [
    onStoreEvent("inventory:updated", scheduleSync),
    onStoreEvent("player:updated", scheduleSync),
    onStoreEvent("map:changed", scheduleSync),
    onStoreEvent("equipment:updated", scheduleSync),
    onStoreEvent("quest:updated", scheduleSync),
    onStoreEvent("achievements:updated", scheduleSync),
    onStoreEvent("metier:updated", scheduleSync),
    onStoreEvent("trash:updated", scheduleSync),
  ];

  intervalId = setInterval(sendSyncNow, SYNC_INTERVAL_MS);
  scheduleSync();

  return {
    reset() {
      unsubs.forEach((unsub) => {
        try {
          unsub();
        } catch {
          // ignore cleanup errors
        }
      });
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
    },
  };
}
