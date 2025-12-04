import { getItemDef } from "../inventory/inventoryCore.js";
import {
  equipFromInventory,
  unequipToInventory,
} from "../inventory/equipmentCore.js";
import { equipmentSets } from "../inventory/sets.js";

// Initialisation de la fenêtre d'inventaire HTML.
export function initDomInventory(player) {
  const invButton = document.getElementById("hud-inventory-button");
  const panel = document.getElementById("hud-inventory-panel");
  const grid = document.getElementById("inventory-grid");
  const goldEl = document.getElementById("inventory-gold-value");

  const nameEl = document.getElementById("inventory-item-name");
  const typeEl = document.getElementById("inventory-item-type");
  const descEl = document.getElementById("inventory-item-desc");
  let iconEl = document.getElementById("inventory-item-icon");

  // Icône de détail créée dynamiquement si absente du HTML
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

  const equipSlots = panel.querySelectorAll(".equip-slot");

  function updateGoldDisplay() {
    if (!goldEl) return;
    const value =
      typeof player.gold === "number" && !Number.isNaN(player.gold)
        ? player.gold
        : 0;
    goldEl.textContent = String(value);
  }

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

  // Utilitaire : nom humain pour une statistique
  function labelForStatKey(key) {
    switch (key) {
      case "force":
        return "Force";
      case "intelligence":
        return "Intelligence";
      case "agilite":
        return "Agilité";
      case "chance":
        return "Chance";
      case "vitalite":
        return "Vitalité";
      case "initiative":
        return "Initiative";
      case "hpPlus":
      case "hp":
      case "hpMax":
        return "PV";
      case "paPlus":
      case "pa":
        return "PA";
      case "pmPlus":
      case "pm":
        return "PM";
      default:
        return key;
    }
  }

  // Formate un objet { stat: valeur } en texte "+X Vitalité, +Y Agilité"
  function formatBonusObject(bonus) {
    if (!bonus) return "";
    const parts = [];
    for (const [key, value] of Object.entries(bonus)) {
      if (typeof value !== "number" || value === 0) continue;
      const label = labelForStatKey(key);
      const sign = value >= 0 ? "+" : "";
      parts.push(`${sign}${value} ${label}`);
    }
    return parts.join(", ");
  }

  // Affiche tous les détails pour un itemId donné (icône, nom, type, bonus, panoplie)
  function showItemDetailsById(itemId) {
    if (!itemId) {
      clearDetails();
      return;
    }

    const def = getItemDef(itemId);
    const baseName = def ? def.label : itemId;

    // Icône
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

    if (!descEl) return;

    const lines = [];

    // Description libre
    if (def && typeof def.description === "string") {
      lines.push(def.description);
    }

    // Effets "consommables" génériques
    const effect = def?.effect || {};
    const effectParts = [];
    if (typeof effect.hpPlus === "number" && effect.hpPlus !== 0) {
      effectParts.push(`+${effect.hpPlus} PV`);
    }
    if (typeof effect.paPlus === "number" && effect.paPlus !== 0) {
      effectParts.push(`+${effect.paPlus} PA`);
    }
    if (typeof effect.pmPlus === "number" && effect.pmPlus !== 0) {
      effectParts.push(`+${effect.pmPlus} PM`);
    }
    if (effectParts.length > 0) {
      lines.push(`Effets : ${effectParts.join(", ")}`);
    }

    // Bonus de l'équipement (statsBonus)
    if (def && def.category === "equipement" && def.statsBonus) {
      const bonusTxt = formatBonusObject(def.statsBonus);
      if (bonusTxt) {
        lines.push(`Bonus objet : ${bonusTxt}`);
      }

      // Bonus de panoplie actifs
      if (def.setId && player.equipment) {
        const setDef = equipmentSets[def.setId];
        if (setDef && setDef.thresholds) {
          // Compte de pièces équipées pour cette panoplie
          let count = 0;
          for (const entry of Object.values(player.equipment)) {
            const d =
              entry && entry.itemId ? getItemDef(entry.itemId) : null;
            if (d && d.setId === def.setId) {
              count += 1;
            }
          }

          const activeLines = [];
          for (const [thStr, bonus] of Object.entries(
            setDef.thresholds
          )) {
            const threshold = parseInt(thStr, 10);
            if (Number.isNaN(threshold)) continue;
            if (count >= threshold) {
              const txt = formatBonusObject(bonus);
              if (txt) {
                activeLines.push(`${threshold} pièces : ${txt}`);
              }
            }
          }

          if (activeLines.length > 0) {
            lines.push(
              `Panoplie (${count} équipés) : ${activeLines.join(" | ")}`
            );
          }
        }
      }
    }

    descEl.textContent =
      lines.length > 0
        ? lines.join(" | ")
        : "Aucun effet particulier.";
  }

  // filtre courant : "all" | "equipement" | "consommable" | "ressource" | "quete"
  let currentFilter = "all";

  // Met à jour la colonne de gauche avec les objets équipés
  function renderEquipmentSlots() {
    if (!equipSlots || equipSlots.length === 0) return;
    const equipment = player.equipment || {};

    equipSlots.forEach((slotEl) => {
      const equipSlot = slotEl.getAttribute("data-equip");
      slotEl.innerHTML = "";
      slotEl.classList.remove("filled");

      if (!equipSlot) return;

      const entry = equipment[equipSlot];
      if (!entry || !entry.itemId) return;

      const def = getItemDef(entry.itemId);
      if (!def) return;

      slotEl.classList.add("filled");

      if (def.icon) {
        const icon = document.createElement("div");
        icon.className = "inventory-slot-icon";
        icon.style.backgroundImage = `url(${def.icon})`;
        slotEl.appendChild(icon);
      } else {
        const label = document.createElement("span");
        label.className = "inventory-slot-label";
        label.textContent = def.label || entry.itemId;
        slotEl.appendChild(label);
      }
    });
  }

  function renderInventory() {
    const inv = player.inventory;
    if (!inv) return;

    grid.innerHTML = "";
    clearDetails();
    updateGoldDisplay();

    for (let i = 0; i < inv.size; i += 1) {
      const slotData = inv.slots[i];
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "inventory-slot";
      slot.dataset.index = String(i);

      if (slotData) {
        const def = getItemDef(slotData.itemId);

        // Filtre : si on n'est pas sur "all" et que la catégorie ne correspond pas,
        // on affiche le slot comme vide visuellement.
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

        // Icône principale dans la grille
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

        // Badge de quantité (uniquement sur le slot)
        if (slotData.qty > 1) {
          const qty = document.createElement("span");
          qty.className = "inventory-slot-qty";
          qty.textContent = String(slotData.qty);
          slot.appendChild(qty);
        }
      } else {
        slot.classList.add("empty");
      }

      // Clic simple : toujours afficher les détails (y compris pour un équipement)
      slot.addEventListener("click", () => {
        if (!slotData) {
          clearDetails();
          return;
        }
        showItemDetailsById(slotData.itemId);
      });

      // Double‑clic sur un équipement = équiper depuis l'inventaire
      slot.addEventListener("dblclick", () => {
        if (!slotData) return;
        const def = getItemDef(slotData.itemId);
        if (!def || def.category !== "equipement") return;

        const ok = equipFromInventory(player, player.inventory, i);
        if (ok) {
          renderInventory();
        }
      });

      grid.appendChild(slot);
    }

    // Après la grille, on met aussi à jour la colonne d'équipement
    renderEquipmentSlots();
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

  // Gestion des clics sur les cases d'équipement (colonne de gauche)
  if (equipSlots && equipSlots.length > 0) {
    equipSlots.forEach((slotEl) => {
      const equipSlot = slotEl.getAttribute("data-equip");

      // Clic simple : affiche la fiche de détails de l'objet équipé
      slotEl.addEventListener("click", () => {
        if (!equipSlot) {
          clearDetails();
          return;
        }
        const equipment = player.equipment || {};
        const entry = equipment[equipSlot];
        if (!entry || !entry.itemId) {
          clearDetails();
          return;
        }
        showItemDetailsById(entry.itemId);
      });

      // Double‑clic : déséquiper vers l'inventaire
      slotEl.addEventListener("dblclick", () => {
        if (!equipSlot) return;
        const ok = unequipToInventory(player, player.inventory, equipSlot);
        if (ok) {
          renderInventory();
        }
      });
    });
  }
}