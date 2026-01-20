import { emit as emitStoreEvent } from "../../../state/store.js";

function sendGoldOp(delta, reason) {
  if (typeof window === "undefined") return;
  if (window.__lanInventoryAuthority !== true) return;
  const client = window.__lanClient;
  const playerId = window.__netPlayerId;
  if (!client || !Number.isInteger(playerId)) return;
  if (!Number.isFinite(delta) || delta === 0) return;
  try {
    client.sendCmd("CmdGoldOp", {
      playerId,
      delta,
      reason: reason || null,
    });
  } catch {
    // ignore network errors
  }
}

export function adjustGold(player, delta, reason) {
  if (!player || !Number.isFinite(delta) || delta === 0) return 0;
  const before = Number.isFinite(player.gold) ? player.gold : 0;
  const next = Math.max(0, before + Math.round(delta));
  const applied = next - before;
  if (applied === 0) return 0;
  player.gold = next;
  emitStoreEvent("player:updated", player);
  sendGoldOp(applied, reason);
  return applied;
}
