import { emit as emitStoreEvent, getPlayer } from "../state/store.js";

const MAX_MESSAGES = 200;

function ensureChatState(player) {
  if (!player) return null;
  if (!player.chat) player.chat = {};
  if (!Array.isArray(player.chat.messages)) player.chat.messages = [];
  if (typeof player.chat.nextId !== "number") player.chat.nextId = 1;
  return player.chat;
}

export function getChatMessages(player = null) {
  const p = player || getPlayer();
  const chat = ensureChatState(p);
  return chat ? chat.messages : [];
}

export function addChatMessage(message, { player = null } = {}) {
  const p = player || getPlayer();
  const chat = ensureChatState(p);
  if (!p || !chat) return null;

  const msg = {
    id: chat.nextId++,
    ts: message?.ts ?? Date.now(),
    author: message?.author ?? "Système",
    text: String(message?.text ?? ""),
    kind: message?.kind ?? "system",
    channel: message?.channel ?? "global",
  };

  chat.messages.push(msg);
  if (chat.messages.length > MAX_MESSAGES) {
    chat.messages.splice(0, chat.messages.length - MAX_MESSAGES);
  }

  emitStoreEvent("chat:message", msg);
  emitStoreEvent("chat:updated", { message: msg });
  return msg;
}

