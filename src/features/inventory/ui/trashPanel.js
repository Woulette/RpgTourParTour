import {
  getItemDef,
  addItemToLastSlot,
  removeItem,
} from "../runtime/inventoryAuthority.js";
import {
  addItemToTrash,
  canAddItemToTrash,
  ensureTrashContainer,
  purgeExpiredTrash,
  removeTrashSlot,
} from "../runtime/trashCore.js";
import { emit as emitStoreEvent } from "../../../state/store.js";

let panelEl = null;
let isOpen = false;

function sendTrashCmd(command, payload) {
  if (typeof window === "undefined") return false;
  if (window.__lanInventoryAuthority !== true) return false;
  const client = window.__lanClient;
  const playerId = window.__netPlayerId;
  if (!client || !Number.isInteger(playerId)) return false;
  try {
    client.sendCmd(command, { playerId, ...payload });
    return true;
  } catch {
    return false;
  }
}

function formatRemaining(ms) {
  if (ms <= 0) return "expire";
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h${String(minutes).padStart(2, "0")}`;
  }
  return `${minutes}m`;
}

function ensurePanelElements() {
  if (panelEl) return panelEl;
  const ensureLink = (id, href) => {
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  };
  ensureLink("craft-base-css", "assets/css/craft-base.css");
  ensureLink("trash-panel-css", "assets/css/trash-panel.css");

  panelEl = document.createElement("div");
  panelEl.id = "trash-panel";
  panelEl.className = "craft-panel trash";
  panelEl.innerHTML = `
    <div class="craft-panel-inner">
      <header class="craft-panel-header">
        <h3>Poubelle</h3>
        <button type="button" class="craft-panel-close" aria-label="Fermer">X</button>
      </header>
      <div class="trash-body">
        <section class="trash-column">
          <div class="trash-column-title">Contenu de la poubelle</div>
          <div class="trash-grid craft-inventory-grid" id="trash-items-grid"></div>
          <div class="trash-hint">Les objets disparaissent apres 24h.</div>
        </section>
        <section class="trash-column">
          <div class="trash-column-title">Inventaire</div>
          <div class="trash-grid craft-inventory-grid" id="trash-inventory-grid"></div>
          <div class="trash-hint">Clique un objet pour le deposer dans la poubelle.</div>
        </section>
      </div>
    </div>
  `;
  document.body.appendChild(panelEl);

  const closeBtn = panelEl.querySelector(".craft-panel-close");
  closeBtn.addEventListener("click", () => closeTrashPanel());

  return panelEl;
}

function renderInventoryGrid(player) {
  const grid = panelEl.querySelector("#trash-inventory-grid");
  if (!grid) return;
  const inv = player?.inventory;
  if (!inv) return;

  grid.innerHTML = "";

  for (let i = 0; i < inv.size; i += 1) {
    const slot = inv.slots[i];
    const cell = document.createElement("div");
    cell.className = "craft-inventory-slot trash-slot";
    cell.dataset.index = String(i);
    cell.dataset.itemId = slot?.itemId || "";

    if (slot && slot.itemId) {
      const def = getItemDef(slot.itemId);
      if (def?.icon) {
        const img = document.createElement("img");
        img.src = def.icon;
        img.alt = def.label || slot.itemId;
        cell.appendChild(img);
      }
      const qty = document.createElement("span");
      qty.className = "qty";
      qty.textContent = String(slot.qty ?? 1);
      cell.appendChild(qty);
      cell.title = def?.label || slot.itemId;

      cell.addEventListener("click", () => {
        const trash = ensureTrashContainer(player, inv.size);
        purgeExpiredTrash(trash);
        if (!canAddItemToTrash(trash, slot.itemId, slot.qty ?? 1)) {
          return;
        }
        if (
          sendTrashCmd("CmdTrashItem", {
            inventorySlotIndex: i,
            qty: slot.qty ?? 1,
          })
        ) {
          return;
        }
        removeItem(inv, slot.itemId, slot.qty ?? 1);
        addItemToTrash(trash, slot.itemId, slot.qty ?? 1);
        renderTrashGrid(player);
        renderInventoryGrid(player);
      });
    } else {
      cell.classList.add("disabled");
    }

    grid.appendChild(cell);
  }
}

function renderTrashGrid(player) {
  const grid = panelEl.querySelector("#trash-items-grid");
  if (!grid) return;
  const trash = ensureTrashContainer(player, player?.inventory?.size);
  if (!trash) return;

  purgeExpiredTrash(trash);
  grid.innerHTML = "";
  const now = Date.now();

  for (let i = 0; i < trash.size; i += 1) {
    const slot = trash.slots[i];
    const cell = document.createElement("div");
    cell.className = "craft-inventory-slot trash-slot";
    cell.dataset.index = String(i);

    if (slot && slot.itemId) {
      const def = getItemDef(slot.itemId);
      if (def?.icon) {
        const img = document.createElement("img");
        img.src = def.icon;
        img.alt = def.label || slot.itemId;
        cell.appendChild(img);
      }
      const qty = document.createElement("span");
      qty.className = "qty";
      qty.textContent = String(slot.qty ?? 1);
      cell.appendChild(qty);
      const remaining = Math.max(0, (slot.expiresAt || 0) - now);
      const label = def?.label || slot.itemId;
      cell.title = `${label} - ${formatRemaining(remaining)}`;

      cell.addEventListener("click", () => {
        const inv = player?.inventory;
        if (!inv) return;
        if (sendTrashCmd("CmdTrashRestore", { trashSlotIndex: i })) {
          return;
        }
        const movedSlot = removeTrashSlot(trash, i);
        if (!movedSlot) return;
        const remainingQty = addItemToLastSlot(
          inv,
          movedSlot.itemId,
          movedSlot.qty ?? 1
        );
        if (remainingQty > 0) {
          trash.slots[i] = {
            itemId: movedSlot.itemId,
            qty: remainingQty,
            expiresAt: movedSlot.expiresAt,
          };
          emitStoreEvent("trash:updated", { container: trash });
        }
        renderTrashGrid(player);
        renderInventoryGrid(player);
      });
    } else {
      cell.classList.add("disabled");
    }

    grid.appendChild(cell);
  }
}

export function openTrashPanel(scene, player) {
  ensurePanelElements();
  if (!panelEl || !player) return;

  const trash = ensureTrashContainer(player, player?.inventory?.size);
  if (trash) {
    purgeExpiredTrash(trash);
  }
  renderTrashGrid(player);
  renderInventoryGrid(player);

  panelEl.classList.add("open");
  isOpen = true;
}

export function closeTrashPanel() {
  if (!panelEl) return;
  panelEl.classList.remove("open");
  isOpen = false;
}

export function isTrashPanelOpen() {
  return isOpen;
}
