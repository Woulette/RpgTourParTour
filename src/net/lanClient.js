import { DATA_HASH, PROTOCOL_VERSION } from "./protocol.js";

let inventoryOpKey = null;

function makeInventoryOpKey() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getInventoryOpKey() {
  return inventoryOpKey;
}

export function createLanClient({
  url,
  protocolVersion = PROTOCOL_VERSION,
  dataHash = DATA_HASH,
  character = null,
  account = null,
  authMode = null,
  onEvent,
  onClose,
} = {}) {
  if (!url) throw new Error("LAN url is required");

  const ws = new WebSocket(url);
  let cmdId = 0;
  inventoryOpKey = makeInventoryOpKey();

  const sendRaw = (payload) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  };

  const client = {
    sendCmd(type, payload = {}) {
      if (type === "CmdInventoryOp") {
        if (!payload || payload.__invKey !== inventoryOpKey) return;
      }
      cmdId += 1;
      sendRaw({
        t: type,
        cmdId,
        sessionToken: account?.sessionToken || null,
        ...payload,
      });
    },
    close() {
      ws.close();
    },
  };
  client.__ws = ws;
  if (typeof window !== "undefined") {
    window.__lanClient = client;
    window.__lanInventoryAuthority = true;
  }

  ws.addEventListener("open", () => {
    sendRaw({
      t: "Hello",
      protocolVersion,
      dataHash,
      sessionToken: account?.sessionToken || null,
      accountName: account?.name || null,
      accountPassword: account?.password || null,
      authMode,
      inventoryAuthority: true,
      characterId: character?.id || null,
      characterName: character?.name || null,
      classId: character?.classId || null,
      level: Number.isFinite(character?.level) ? Math.round(character.level) : null,
    });
  });

  ws.addEventListener("message", (event) => {
    let msg = null;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    if (onEvent) onEvent(msg);
  });

  ws.addEventListener("close", () => {
    if (onClose) onClose();
  });

  return client;
}
