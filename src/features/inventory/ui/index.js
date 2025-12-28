import { initInventoryDetails } from "./details.js";
import { bindInventoryEvents } from "./events.js";
import { getPlayer } from "../../../state/store.js";

let inventoryUiInitialized = false;
let unsubscribeInventory = null;
let unsubscribeEquipment = null;

// Initialisation de la fenetre d'inventaire HTML.
export function initDomInventory(player) {
  if (inventoryUiInitialized) return;

  const invButton = document.getElementById("hud-inventory-button");
  const panel = document.getElementById("hud-inventory-panel");
  const grid = document.getElementById("inventory-grid");
  const goldEl = document.getElementById("inventory-gold-value");

  const nameEl = document.getElementById("inventory-item-name");
  const typeEl = document.getElementById("inventory-item-type");
  const bonusEl = document.getElementById("inventory-item-bonus");
  const descEl = document.getElementById("inventory-item-desc");
  const requiredEl = document.getElementById("inventory-item-required");
  let iconEl = document.getElementById("inventory-item-icon");

  if (!invButton || !panel || !grid || !player) return;

  const equipSlots = panel.querySelectorAll(".equip-slot");
  const characterPreviewEl = panel.querySelector(".equip-character");

  if (!iconEl && panel) {
    const detail = panel.querySelector(".inventory-detail");
    if (detail) {
      iconEl = document.createElement("div");
      iconEl.id = "inventory-item-icon";
      iconEl.className = "inventory-item-icon";
      detail.insertBefore(iconEl, detail.firstChild);
    }
  }

  const dom = {
    invButton,
    panel,
    grid,
    goldEl,
    nameEl,
    typeEl,
    bonusEl,
    descEl,
    requiredEl,
    iconEl,
    equipSlots,
    characterPreviewEl,
  };

  const classPreviewById = {
    archer: "assets/animations/animation archer/rotations/south.png",
    tank: "assets/animations/animation tank/rotations/south.png",
    animiste: "assets/animations/animations-Animiste/rotations/south.png",
    eryon: "assets/animations/animations-Eryon/rotations/south.png",
  };

  const updateCharacterPreview = (currentPlayer) => {
    if (!characterPreviewEl) return;
    const classId = currentPlayer?.classId || "archer";
    const img = classPreviewById[classId] || classPreviewById.archer;
    characterPreviewEl.style.backgroundImage = img ? `url("${img}")` : "";
  };

  const updateGoldDisplay = (currentPlayer) => {
    if (!goldEl) return;
    const value =
      typeof currentPlayer?.gold === "number" &&
      !Number.isNaN(currentPlayer?.gold)
        ? currentPlayer.gold
        : 0;
    goldEl.textContent = String(value);
  };

  let currentFilter = "all";
  const getFilter = () => currentFilter;
  const setFilter = (value) => {
    currentFilter = value;
  };

  const helpers = initInventoryDetails(dom);
  helpers.dom = dom;

  const getActivePlayer = () => getPlayer() || player;

  const bindings = bindInventoryEvents({
    getPlayer: getActivePlayer,
    dom,
    helpers,
    getFilter,
    setFilter,
    updateGoldDisplay,
    updateCharacterPreview,
  });

  unsubscribeInventory = bindings.unsubscribeInventory;
  unsubscribeEquipment = bindings.unsubscribeEquipment;

  inventoryUiInitialized = true;
}
