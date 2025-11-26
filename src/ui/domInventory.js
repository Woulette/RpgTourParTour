import { getItemDef } from "../inventory/inventoryCore.js";

// Initialisation de la fenetre d'inventaire HTML.
export function initDomInventory(player) {
  const invButton = document.getElementById("hud-inventory-button");
  const panel = document.getElementById("hud-inventory-panel");
  const grid = document.getElementById("inventory-grid");

  const nameEl = document.getElementById("inventory-item-name");
  const typeEl = document.getElementById("inventory-item-type");
  const descEl = document.getElementById("inventory-item-desc");
  let iconEl = document.getElementById("inventory-item-icon");

  // Si l'élément d'icône n'existe pas encore dans le HTML, on le crée
  if (!iconEl && panel) {
    const detail = panel.querySelector(".inventory-detail");
    if (detail) {
      iconEl = document.createElement("div");
      iconEl.id = "inventory-item-icon";
      iconEl.className = "inventory-item-icon";
      detail.insertBefore(iconEl, detail.firstChild);
    }
  }

  if (!invButton || !panel || !grid || !player) return;

  function clearDetails() {
    if (iconEl) {
      iconEl.style.backgroundImage = "";
    }
    if (nameEl) nameEl.textContent = "-";
    if (typeEl) typeEl.textContent = "";
    if (descEl) {
      descEl.textContent = "Selectionne un objet pour voir ses details.";
    }
  }

  // filtre courant : "all" | "equipement" | "consommable" | "ressource" | "quete"
  let currentFilter = "all";

  function renderInventory() {
    const inv = player.inventory;
    if (!inv) return;

    grid.innerHTML = "";
    clearDetails();

    for (let i = 0; i < inv.size; i += 1) {
      const slotData = inv.slots[i];
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "inventory-slot";
      slot.dataset.index = String(i);

      if (slotData) {
        const def = getItemDef(slotData.itemId);

        // Filtre : si on n'est pas sur "all" et que la catégorie ne correspond pas, on affiche le slot comme vide
        if (currentFilter !== "all") {
          const wantedCat = currentFilter;
          const cat = def?.category ?? "inconnu";
          if (cat !== wantedCat) {
            slot.classList.add("empty");
            grid.appendChild(slot);
            continue;
          }
        }
        slot.classList.add("filled");

        // Icone principale dans la grille
        if (def && def.icon) {
          const icon = document.createElement("div");
          icon.className = "inventory-slot-icon";
          icon.style.backgroundImage = `url(${def.icon})`;
          slot.appendChild(icon);
        } else {
          const label = document.createElement("span");
          label.className = "inventory-slot-label";
          const baseName = def ? def.label : slotData.itemId;
          label.textContent = baseName;
          slot.appendChild(label);
        }

        // Badge de quantite (uniquement sur le slot)
        if (slotData.qty > 1) {
          const qty = document.createElement("span");
          qty.className = "inventory-slot-qty";
          qty.textContent = String(slotData.qty);
          slot.appendChild(qty);
        }
      } else {
        slot.classList.add("empty");
      }

      slot.addEventListener("click", () => {
        if (!slotData) {
          clearDetails();
          return;
        }

        const def = getItemDef(slotData.itemId);
        const baseName = def ? def.label : slotData.itemId;

        // Icone dans la fiche de details
        if (iconEl) {
          if (def && def.icon) {
            iconEl.style.backgroundImage = `url(${def.icon})`;
          } else {
            iconEl.style.backgroundImage = "";
          }
        }

        // Nom
        if (nameEl) {
          nameEl.textContent = baseName;
        }

        // Type lisible
        if (typeEl) {
          const rawCat = def?.category ?? "inconnu";
          let catLabel = rawCat;
          switch (rawCat) {
            case "ressource":
              catLabel = "Ressource";
              break;
            case "consommable":
              catLabel = "Consommable";
              break;
            case "equipement":
              catLabel = "Equipement";
              break;
            case "quete":
              catLabel = "Objet de quete";
              break;
            default:
              catLabel = rawCat;
          }
          typeEl.textContent = `Type : ${catLabel}`;
        }

        // Details : description + effets (PAS de quantite ici)
        if (descEl) {
          const lines = [];

          if (def && typeof def.description === "string") {
            lines.push(def.description);
          }

          const effect = def?.effect || {};
          const parts = [];
          if (typeof effect.hpPlus === "number" && effect.hpPlus !== 0) {
            parts.push(`+${effect.hpPlus} PV`);
          }
          if (typeof effect.paPlus === "number" && effect.paPlus !== 0) {
            parts.push(`+${effect.paPlus} PA`);
          }
          if (typeof effect.pmPlus === "number" && effect.pmPlus !== 0) {
            parts.push(`+${effect.pmPlus} PM`);
          }
          if (parts.length > 0) {
            lines.push(`Effets : ${parts.join(", ")}`);
          }

          descEl.textContent = lines.join(" | ");
        }
      });

      grid.appendChild(slot);
    }
  }

  invButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = !document.body.classList.contains("hud-inventory-open");
    document.body.classList.toggle("hud-inventory-open");
    if (willOpen) {
      renderInventory();
    }
  });

  // Gestion des filtres (boutons dans l'en-tête de l'inventaire)
  const filterButtons = panel.querySelectorAll(".inventory-filter-btn");
  if (filterButtons && filterButtons.length > 0) {
    filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.getAttribute("data-filter") || "all";
        currentFilter = value;

        // état visuel actif
        filterButtons.forEach((b) =>
          b.classList.remove("inventory-filter-active")
        );
        btn.classList.add("inventory-filter-active");

        renderInventory();
      });
    });
  }
}
