function createChatHandlers({ state, clients, send, getNextEventId }) {
  const MAX_MESSAGE_LEN = 220;
  const CHANNELS = new Set(["global", "trade", "recruitment"]);

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
      if (channel === "global") {
        if (!mapId || target.mapId !== mapId) continue;
      }
      send(ws, payload);
    }
  }

  return { handleCmdChatMessage };
}

module.exports = {
  createChatHandlers,
};
