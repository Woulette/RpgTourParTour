import { on as onStoreEvent } from "../../state/store.js";
import { renderInventoryGrid, renderEquipmentSlots, bindEquipmentSlotEvents } from "./render.js";

export function bindInventoryEvents({
  player,
  dom,
  helpers,
  getFilter,
  setFilter,
  updateGoldDisplay,
  updateCharacterPreview,
}) {
  const { invButton, panel, grid, equipSlots } = dom;

  const renderInventory = () => {
    if (typeof updateCharacterPreview === "function") {
      updateCharacterPreview();
    }
    renderInventoryGrid({
      player,
      grid,
      currentFilter: getFilter(),
      helpers,
      updateGoldDisplay,
      renderInventory,
    });
    renderEquipmentSlots(player, equipSlots);
  };

  invButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = !document.body.classList.contains("hud-inventory-open");
    document.body.classList.toggle("hud-inventory-open");
    if (willOpen) {
      renderInventory();
    }
  });

  const filterButtons = panel.querySelectorAll(".inventory-filter-btn");
  if (filterButtons && filterButtons.length > 0) {
    filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.getAttribute("data-filter") || "all";
        setFilter(value);
        filterButtons.forEach((b) => b.classList.remove("inventory-filter-active"));
        btn.classList.add("inventory-filter-active");
        renderInventory();
      });
    });
  }

  bindEquipmentSlotEvents(player, equipSlots, helpers, renderInventory);

  const unsubscribeInventory = onStoreEvent("inventory:updated", () => {
    if (document.body.classList.contains("hud-inventory-open")) {
      renderInventory();
    }
  });
  const unsubscribeEquipment = onStoreEvent("equipment:updated", () => {
    if (document.body.classList.contains("hud-inventory-open")) {
      renderInventory();
    }
  });

  return { renderInventory, unsubscribeInventory, unsubscribeEquipment };
}
