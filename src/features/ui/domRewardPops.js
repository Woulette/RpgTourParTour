import { on as onStoreEvent } from "../../state/store.js";
import { getItemDef } from "../inventory/runtime/inventoryCore.js";

let initialized = false;
let unsubscribe = null;
let layerEl = null;

const POP_LIFETIME_MS = 950;
const POP_GAP_MS = 140;

const popQueue = [];
let popInFlight = false;

function ensureLayer() {
  if (layerEl) return layerEl;

  layerEl = document.getElementById("hud-reward-pop-layer");
  if (layerEl) return layerEl;

  layerEl = document.createElement("div");
  layerEl.id = "hud-reward-pop-layer";
  layerEl.setAttribute("aria-hidden", "true");
  document.body.appendChild(layerEl);
  return layerEl;
}

function scheduleRemove(el, delayMs) {
  window.setTimeout(() => {
    if (el && el.isConnected) el.remove();
  }, Math.max(0, delayMs | 0));
}

function createPop({ icon, label, qty, kind }) {
  const layer = ensureLayer();
  if (!layer) return;

  const pop = document.createElement("div");
  pop.className = "hud-reward-pop";

  // Toujours au même endroit (centre écran).
  pop.style.setProperty("--reward-pop-x", "0px");

  if (icon) {
    const img = document.createElement("img");
    img.className = "hud-reward-pop-icon";
    img.alt = label || "";
    img.src = encodeURI(icon);
    pop.appendChild(img);
  } else {
    const fallback = document.createElement("div");
    fallback.className = "hud-reward-pop-fallback";
    fallback.textContent =
      kind === "gold" ? "OR" : kind === "xp" ? "XP" : kind === "honor" ? "HON" : "?";
    pop.appendChild(fallback);
  }

  const text = document.createElement("div");
  text.className = "hud-reward-pop-text";
  const qtyNumber =
    typeof qty === "number"
      ? qty
      : typeof qty === "string"
        ? Number.parseInt(qty, 10)
        : Number(qty);
  const safeQty = Number.isFinite(qtyNumber) ? qtyNumber : 0;

  if (kind === "gold") {
    text.textContent = `+${safeQty}`;
    pop.appendChild(text);
  } else if (kind === "xp") {
    text.textContent = `+${safeQty}`;
    pop.appendChild(text);
  } else if (kind === "honor") {
    text.textContent = `+${safeQty}`;
    pop.appendChild(text);
  } else {
    // Items : on affiche toujours la quantité, même x1.
    text.textContent = `x${Math.max(1, safeQty)}`;
    pop.appendChild(text);
  }

  layer.appendChild(pop);
  scheduleRemove(pop, POP_LIFETIME_MS);
}

function enqueueRewardPops(rewards) {
  if (!rewards) return;

  const items = Array.isArray(rewards.items) ? rewards.items : [];

  const jobs = [];
  items.forEach((it) => {
    if (!it || !it.itemId) return;
    const def = getItemDef(it.itemId);
    const qtyNumber =
      typeof it.qty === "number"
        ? it.qty
        : typeof it.qty === "string"
          ? Number.parseInt(it.qty, 10)
          : Number(it.qty);
    jobs.push({
      icon: def?.icon || null,
      label: def?.label || it.itemId,
      qty: Number.isFinite(qtyNumber) ? qtyNumber : 1,
      kind: "item",
    });
  });

  // Optionnel : si pas d'items, on ne spam pas (mais on garde la possibilité plus tard)
  if (jobs.length === 0) return;

  jobs.forEach((j) => popQueue.push(j));
}

function pumpQueue() {
  if (popInFlight) return;
  if (popQueue.length === 0) return;

  popInFlight = true;
  const job = popQueue.shift();
  createPop(job);

  window.setTimeout(() => {
    popInFlight = false;
    pumpQueue();
  }, POP_LIFETIME_MS + POP_GAP_MS);
}

export function initDomRewardPops() {
  if (initialized) return;
  ensureLayer();

  unsubscribe = onStoreEvent("rewards:granted", (payload) => {
    const rewards = payload?.rewards || null;
    enqueueRewardPops(rewards);
    pumpQueue();
  });

  initialized = true;
}

export function destroyDomRewardPops() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (layerEl && layerEl.remove) layerEl.remove();
  layerEl = null;
  initialized = false;
}
