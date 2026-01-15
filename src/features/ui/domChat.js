import { on as onStoreEvent } from "../../state/store.js";
import { addChatMessage, getChatMessages } from "../../chat/chat.js";
import { getNetClient, getNetPlayerId } from "../../app/session.js";

let chatInitialized = false;
let unsubscribeChat = null;
let unsubscribePlayerChanged = null;
let keydownHandler = null;

const CHAT_CHANNELS = [
  { id: "total", label: "TOTAL" },
  { id: "global", label: "General" },
  { id: "quest", label: "Quetes" },
  { id: "trade", label: "Commerce" },
  { id: "recruitment", label: "Recrutement" },
  { id: "private", label: "Prive" },
];

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function normalizeChannel(msg) {
  return msg?.channel || "global";
}

function labelForChannel(channelId) {
  const entry = CHAT_CHANNELS.find((c) => c.id === channelId);
  if (entry) return entry.label;
  return String(channelId || "General");
}

function shouldAutoScroll(container) {
  if (!container) return true;
  const threshold = 24;
  return (
    container.scrollTop + container.clientHeight >=
    container.scrollHeight - threshold
  );
}

function normalizeElement(rawElement) {
  if (!rawElement) return null;
  const normalized = String(rawElement)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized === "air" || normalized === "agilite" || normalized === "agi") {
    return "air";
  }
  if (normalized === "eau" || normalized === "chance" || normalized === "cha") {
    return "eau";
  }
  if (
    normalized === "terre" ||
    normalized === "force" ||
    normalized === "for"
  ) {
    return "terre";
  }
  if (
    normalized === "feu" ||
    normalized === "intelligence" ||
    normalized === "int"
  ) {
    return "feu";
  }
  if (normalized === "bouclier" || normalized === "shield") {
    return "bouclier";
  }

  return null;
}

function appendTextWithColoredDamage(parent, text, element) {
  if (!parent) return;
  const raw = String(text || "");
  const el = normalizeElement(element);
  const regex = /Crit\s*!|-\d+\s*PV/g;
  let lastIndex = 0;
  let match = regex.exec(raw);

  if (!match) {
    parent.textContent = raw;
    return;
  }

  while (match) {
    const start = match.index;
    const end = start + match[0].length;

    if (start > lastIndex) {
      parent.appendChild(document.createTextNode(raw.slice(lastIndex, start)));
    }

    const token = match[0];
    if (/^-/.test(token)) {
      if (!el) {
        parent.appendChild(document.createTextNode(token));
      } else {
        const dmg = document.createElement("span");
        dmg.className = `hud-chat-damage hud-chat-damage-${el}`;
        dmg.textContent = token;
        parent.appendChild(dmg);
      }
    } else {
      const crit = document.createElement("span");
      crit.className = "hud-chat-crit";
      crit.textContent = token;
      parent.appendChild(crit);
    }

    lastIndex = end;
    match = regex.exec(raw);
  }

  if (lastIndex < raw.length) {
    parent.appendChild(document.createTextNode(raw.slice(lastIndex)));
  }
}

function renderMessage(container, msg, { activeChannel } = {}) {
  if (!container || !msg) return;

  const line = document.createElement("div");
  line.className = `hud-chat-message hud-chat-message-${msg.kind || "system"}`;
  line.dataset.chatId = String(msg.id);
  if (msg.isCrit) {
    line.classList.add("hud-chat-message-crit");
  }

  const time = document.createElement("span");
  time.className = "hud-chat-time";
  time.textContent = formatTime(msg.ts);

  const content = document.createElement("span");
  content.className = "hud-chat-content";

  if (msg.kind === "player") {
    const author = document.createElement("span");
    author.className = "hud-chat-author";
    author.textContent = msg.author || "Vous";

    const sep = document.createElement("span");
    sep.className = "hud-chat-sep";
    sep.textContent = " : ";

    const text = document.createElement("span");
    text.className = "hud-chat-text";
    text.textContent = msg.text || "";

    content.appendChild(author);
    content.appendChild(sep);
    content.appendChild(text);
  } else if (msg.kind === "combat-cast") {
    const raw = String(msg.text || "");
    const prefix = "Vous lancez ";
    if (raw.startsWith(prefix)) {
      let spellPart = raw.slice(prefix.length);
      let suffix = "";
      if (spellPart.endsWith(".")) {
        spellPart = spellPart.slice(0, -1);
        suffix = ".";
      }
      content.appendChild(document.createTextNode(prefix));
      const spellSpan = document.createElement("span");
      spellSpan.className = "hud-chat-spell";
      spellSpan.textContent = spellPart;
      content.appendChild(spellSpan);
      if (suffix) {
        content.appendChild(document.createTextNode(suffix));
      }
    } else {
      appendTextWithColoredDamage(content, raw, msg.element);
    }
  } else {
    appendTextWithColoredDamage(content, msg.text || "", msg.element);
  }

  line.appendChild(time);
  line.appendChild(content);
  container.appendChild(line);
}

export function initDomChat(player) {
  if (chatInitialized) return;

  let currentPlayer = player || null;
  const getPlayer = () => currentPlayer;

  const panelEl = document.getElementById("hud-chat");
  const tabsEl = document.getElementById("hud-chat-tabs");
  const messagesEl = document.getElementById("chat-messages");
  const formEl = document.getElementById("chat-form");
  const inputEl = document.getElementById("chat-input");

  if (!panelEl || !tabsEl || !messagesEl || !formEl || !inputEl) {
    return;
  }

  let activeChannel = "global";
  const commandChannels = {
    "/g": "global",
    "/t": "total",
    "/c": "trade",
    "/r": "recruitment",
    "/p": "private",
  };

  const passesFilter = (msg) => {
    const chan = normalizeChannel(msg);
    if (activeChannel === "total") return true;
    return chan === activeChannel;
  };

  const setActiveChannel = (next) => {
    activeChannel = next || "global";
    const buttons = Array.from(tabsEl.querySelectorAll("button[data-channel]"));
    buttons.forEach((btn) => {
      const chan = btn.getAttribute("data-channel");
      const isActive = chan === activeChannel;
      btn.classList.toggle("hud-chat-tab-active", isActive);
      btn.setAttribute("aria-selected", isActive.toString());
      btn.setAttribute("tabindex", isActive ? "0" : "-1");
    });

    messagesEl.innerHTML = "";
    const playerRef = getPlayer();
    const existing = playerRef ? getChatMessages(playerRef) : [];
    existing.forEach((msg) => {
      if (!passesFilter(msg)) return;
      renderMessage(messagesEl, msg, { activeChannel });
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  tabsEl.innerHTML = "";
  CHAT_CHANNELS.forEach((chan) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hud-chat-tab";
    btn.textContent = chan.label;
    btn.dataset.channel = chan.id;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", "false");
    btn.setAttribute("tabindex", "-1");
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      setActiveChannel(chan.id);
      inputEl.focus();
    });
    tabsEl.appendChild(btn);
  });

  setActiveChannel("global");

  keydownHandler = (event) => {
    if (event.key === "Enter") {
      if (document.activeElement === inputEl) return;
      if (document.activeElement && document.activeElement.tagName === "INPUT") {
        return;
      }
      inputEl.focus();
    }
    if (event.key === "Escape") {
      if (document.activeElement === inputEl) {
        inputEl.blur();
      }
    }
  };
  document.addEventListener("keydown", keydownHandler);

  const sendChatMessage = (text, channelId) => {
    const playerRef = getPlayer();
    if (!playerRef) return;
    const channel = channelId || "global";
    const netClient = getNetClient();
    const netPlayerId = getNetPlayerId();
    if (netClient && netPlayerId) {
      netClient.sendCmd("CmdChatMessage", {
        playerId: netPlayerId,
        mapId: playerRef.mapId || null,
        channel,
        text,
      });
      return;
    }
    addChatMessage(
      { kind: "player", author: playerRef.displayName || "Vous", text, channel },
      { player: playerRef }
    );
  };

  formEl.addEventListener("submit", (event) => {
    event.preventDefault();
    const raw = (inputEl.value || "").trim();
    const text = raw;
    if (!text) return;

    const parts = text.split(/\s+/);
    const cmd = parts[0]?.toLowerCase() || "";
    if (commandChannels[cmd]) {
      const channel = commandChannels[cmd];
      const message = text.slice(cmd.length).trim();
      setActiveChannel(channel);
      inputEl.value = "";
      if (message) {
        const sendChannel = channel === "total" ? "global" : channel;
        sendChatMessage(message, sendChannel);
      }
      return;
    }

    const sendChannel = activeChannel === "total" ? "global" : activeChannel;
    sendChatMessage(text, sendChannel);
    inputEl.value = "";
  });

  unsubscribeChat = onStoreEvent("chat:message", (msg) => {
    if (!getPlayer()) return;
    if (!msg) return;
    if (messagesEl.querySelector(`[data-chat-id="${msg.id}"]`)) return;
    if (!passesFilter(msg)) return;
    const autoScroll = shouldAutoScroll(messagesEl);
    renderMessage(messagesEl, msg, { activeChannel });
    if (autoScroll) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });

  unsubscribePlayerChanged = onStoreEvent("player:changed", (nextPlayer) => {
    currentPlayer = nextPlayer || null;
    messagesEl.innerHTML = "";
    if (!currentPlayer) return;
    setActiveChannel(activeChannel);
  });

  chatInitialized = true;
}

export function destroyDomChat() {
  if (unsubscribeChat) unsubscribeChat();
  unsubscribeChat = null;
  if (unsubscribePlayerChanged) unsubscribePlayerChanged();
  unsubscribePlayerChanged = null;
  if (keydownHandler) {
    document.removeEventListener("keydown", keydownHandler);
    keydownHandler = null;
  }
  chatInitialized = false;
}
