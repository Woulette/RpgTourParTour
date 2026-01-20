const { isAdminAccount } = require("../../config/admins");

function createChatHandlers({
  state,
  clients,
  send,
  getNextEventId,
  accountStore,
  getItemDefs,
  applyInventoryOpFromServer,
  applyGoldOpFromServer,
}) {
  const MAX_MESSAGE_LEN = 220;
  const CHANNELS = new Set(["global", "trade", "recruitment", "private"]);
  const ADMIN_COMMANDS = new Set(["give", "gold", "adminhelp"]);

  const sanitizeText = (raw) => {
    if (typeof raw !== "string") return "";
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (trimmed.length <= MAX_MESSAGE_LEN) return trimmed;
    return trimmed.slice(0, MAX_MESSAGE_LEN);
  };

  const pickChannel = (raw) => {
    const chan = typeof raw === "string" ? raw.toLowerCase() : "global";
    return CHANNELS.has(chan) ? chan : "global";
  };

  const sendSystemMessageToPlayer = (playerId, text) => {
    if (!Number.isInteger(playerId)) return;
    const payload = {
      t: "EvChatMessage",
      eventId: getNextEventId ? getNextEventId() : null,
      playerId,
      author: "Systeme",
      channel: "global",
      text: String(text || ""),
      mapId: null,
      ts: Date.now(),
    };
    for (const [ws, info] of clients.entries()) {
      if (info?.id !== playerId) continue;
      send(ws, payload);
      break;
    }
  };

  const isAdminPlayer = (player) => {
    if (!player || !player.accountId) return false;
    if (!accountStore?.getAccountById) return false;
    const account = accountStore.getAccountById(player.accountId);
    return isAdminAccount(account);
  };

  const handleAdminCommand = (player, rawText) => {
    const trimmed = rawText.slice(1).trim();
    if (!trimmed) return false;
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0]?.toLowerCase() || "";
    if (!ADMIN_COMMANDS.has(cmd)) return false;
    if (!isAdminPlayer(player)) {
      sendSystemMessageToPlayer(player.id, "Commande admin: acces refuse.");
      return true;
    }

    if (cmd === "adminhelp") {
      sendSystemMessageToPlayer(
        player.id,
        "Admin: /give <itemId> [qty], /gold <montant>"
      );
      return true;
    }

    if (cmd === "give") {
      const itemId = parts[1] || "";
      const qtyRaw = parts[2];
      const qty = Number.isFinite(Number(qtyRaw))
        ? Math.max(1, Math.round(Number(qtyRaw)))
        : 1;
      if (!itemId) {
        sendSystemMessageToPlayer(player.id, "Usage: /give <itemId> [qty]");
        return true;
      }
      const defs = typeof getItemDefs === "function" ? getItemDefs() : null;
      if (!defs || !defs[itemId]) {
        sendSystemMessageToPlayer(player.id, `Item inconnu: ${itemId}`);
        return true;
      }
      const applied =
        typeof applyInventoryOpFromServer === "function"
          ? applyInventoryOpFromServer(player.id, "add", itemId, qty, "admin_give")
          : 0;
      if (!applied) {
        sendSystemMessageToPlayer(player.id, "Echec give (quantite invalide ou inventaire plein).");
        return true;
      }
      sendSystemMessageToPlayer(player.id, `Ajoute: ${itemId} x${applied}`);
      return true;
    }

    if (cmd === "gold") {
      const amountRaw = parts[1];
      const amount = Number.isFinite(Number(amountRaw)) ? Math.round(Number(amountRaw)) : 0;
      if (!amount) {
        sendSystemMessageToPlayer(player.id, "Usage: /gold <montant>");
        return true;
      }
      const applied =
        typeof applyGoldOpFromServer === "function"
          ? applyGoldOpFromServer(player.id, amount, "admin_gold")
          : 0;
      if (!applied) {
        sendSystemMessageToPlayer(player.id, "Echec gold (montant invalide).");
        return true;
      }
      sendSystemMessageToPlayer(player.id, `Or ajoute: ${amount}`);
      return true;
    }

    return false;
  };

  function handleCmdChatMessage(clientInfo, msg) {
    if (!clientInfo || clientInfo.id !== msg.playerId) return;
    const player = state.players[clientInfo.id];
    if (!player || player.connected === false) return;

    const text = sanitizeText(msg.text);
    if (!text) return;
    if (text.startsWith("/") && handleAdminCommand(player, text)) {
      return;
    }
    const channel = pickChannel(msg.channel);
    const mapId = player.mapId || null;
    const author = player.displayName || player.name || `Joueur ${player.id}`;

    const payload = {
      t: "EvChatMessage",
      eventId: getNextEventId ? getNextEventId() : null,
      playerId: player.id,
      author,
      channel,
      text,
      mapId: channel === "global" ? mapId : null,
      ts: Date.now(),
    };

    for (const [ws, info] of clients.entries()) {
      if (!info || !Number.isInteger(info.id)) continue;
      const target = state.players[info.id];
      if (!target || target.connected === false) continue;
      if (
        accountStore?.isIgnored &&
        target.accountId &&
        player.accountId &&
        accountStore.isIgnored(target.accountId, player.accountId)
      ) {
        continue;
      }
      if (channel === "global") {
        if (!mapId || target.mapId !== mapId) continue;
      }
      send(ws, payload);
    }
  }

  function handleCmdWhisper(clientInfo, msg) {
    if (!clientInfo || clientInfo.id !== msg.playerId) return;
    const player = state.players[clientInfo.id];
    if (!player || player.connected === false) return;
    const targetAccountId = msg.targetAccountId || null;
    if (!targetAccountId) return;

    const text = sanitizeText(msg.text);
    if (!text) return;

    const author = player.displayName || player.name || `Joueur ${player.id}`;
    const payload = {
      t: "EvChatMessage",
      eventId: getNextEventId ? getNextEventId() : null,
      playerId: player.id,
      author,
      channel: "private",
      text,
      mapId: null,
      ts: Date.now(),
    };

    const senderId = player.id;
    const target = Object.values(state.players).find(
      (p) => p && p.accountId === targetAccountId && p.connected !== false
    );

    for (const [ws, info] of clients.entries()) {
      if (!info || !Number.isInteger(info.id)) continue;
      if (info.id !== senderId && info.id !== target?.id) continue;
      const receiver = state.players[info.id];
      if (!receiver || receiver.connected === false) continue;
      if (
        accountStore?.isIgnored &&
        receiver.accountId &&
        player.accountId &&
        accountStore.isIgnored(receiver.accountId, player.accountId)
      ) {
        continue;
      }
      send(ws, payload);
    }
  }

  return { handleCmdChatMessage, handleCmdWhisper };
}

module.exports = {
  createChatHandlers,
};
