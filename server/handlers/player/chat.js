function createChatHandlers({ state, clients, send, getNextEventId, accountStore }) {
  const MAX_MESSAGE_LEN = 220;
  const CHANNELS = new Set(["global", "trade", "recruitment", "private"]);

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

  function handleCmdChatMessage(clientInfo, msg) {
    if (!clientInfo || clientInfo.id !== msg.playerId) return;
    const player = state.players[clientInfo.id];
    if (!player || player.connected === false) return;

    const text = sanitizeText(msg.text);
    if (!text) return;
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
