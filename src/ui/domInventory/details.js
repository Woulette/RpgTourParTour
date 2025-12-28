import { getItemDef } from "../../inventory/inventoryCore.js";
import { equipmentSets } from "../../inventory/sets.js";
import { formatBonusObject, decorateBonusHtml, buildSetSummaryLine } from "./formatting.js";

export function initInventoryDetails(dom) {
  const { bonusEl } = dom;
  let bonusTextEl = null;
  let bonusTabsEl = null;
  let bonusMode = "object";
  let lastObjectBonusText = "";
  let lastSetBonusText = "";

  if (bonusEl) {
    bonusEl.innerHTML = `
      <div class="inventory-bonus-tabs">
        <button type="button"
                class="inventory-bonus-tab inventory-bonus-tab-active"
                data-mode="object">
          Objet
        </button>
        <button type="button"
                class="inventory-bonus-tab"
                data-mode="set">
          Panoplie
        </button>
      </div>
      <div class="inventory-bonus-text"></div>
    `;

    bonusTextEl = bonusEl.querySelector(".inventory-bonus-text");
    bonusTabsEl = bonusEl.querySelector(".inventory-bonus-tabs");

    const tabs = bonusEl.querySelectorAll(".inventory-bonus-tab");
    tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-mode") || "object";
        bonusMode = mode;

        tabs.forEach((b) =>
          b.classList.toggle("inventory-bonus-tab-active", b === btn)
        );

        applyBonusText();
      });
    });
  }

  function applyBonusText() {
    if (!bonusTextEl) return;

    if (bonusMode === "set") {
      bonusTextEl.innerHTML =
        lastSetBonusText || "Aucun bonus de panoplie actif.";
    } else {
      bonusTextEl.innerHTML = lastObjectBonusText || "Aucun effet particulier.";
    }
  }

  function setBonusUiForItem(def) {
    const isEquip = def?.category === "equipement";
    if (bonusTabsEl) {
      bonusTabsEl.style.display = isEquip ? "" : "none";
    }
    if (bonusTextEl) {
      bonusTextEl.style.marginTop = isEquip ? "" : "0";
    }
    if (!isEquip) {
      bonusMode = "object";
      if (bonusEl) {
        const tabs = bonusEl.querySelectorAll(".inventory-bonus-tab");
        tabs.forEach((btn, index) => {
          btn.classList.toggle("inventory-bonus-tab-active", index === 0);
        });
      }
    }
  }

  function clearDetails(domRef = dom) {
    if (!domRef) return;
    if (domRef.iconEl) {
      domRef.iconEl.style.backgroundImage = "";
    }
    if (domRef.nameEl) domRef.nameEl.textContent = "-";
    if (domRef.typeEl) domRef.typeEl.textContent = "";
    if (domRef.requiredEl) domRef.requiredEl.textContent = "";
    lastObjectBonusText = "";
    lastSetBonusText = "";
    applyBonusText();
    if (domRef.descEl) {
      domRef.descEl.textContent = "Selectionne un objet pour voir ses details.";
    }
  }

  function showItemDetailsById(player, itemId, domRef = dom) {
    if (!itemId) {
      clearDetails(domRef);
      return;
    }

    const def = getItemDef(itemId);
    const baseName = def ? def.label : itemId;
    setBonusUiForItem(def);

    if (domRef.iconEl) {
      if (def && def.icon) {
        domRef.iconEl.style.backgroundImage = `url("${def.icon}")`;
      } else {
        domRef.iconEl.style.backgroundImage = "";
      }
    }

    if (domRef.nameEl) {
      domRef.nameEl.textContent = baseName;
    }

    if (domRef.typeEl) {
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
      domRef.typeEl.textContent = `Type : ${catLabel}`;
    }

    if (!domRef || !domRef.descEl) return;

    const bonusLines = [];
    const descLines = [];

    if (def && typeof def.description === "string") {
      descLines.push(def.description);
    }

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
      bonusLines.push(`Effets : ${effectParts.join(", ")}`);
    }

    if (def && typeof def.bonusInfo === "string" && def.bonusInfo.trim()) {
      bonusLines.push(def.bonusInfo.trim());
    }

    if (def && def.category === "equipement" && def.statsBonus) {
      const bonusTxt = formatBonusObject(def.statsBonus);
      if (bonusTxt) {
        bonusLines.push(`Bonus objet : ${bonusTxt}`);
      }

      if (def.setId && player.equipment) {
        const setDef = equipmentSets[def.setId];
        if (setDef && setDef.thresholds) {
          let count = 0;
          for (const entry of Object.values(player.equipment)) {
            const d = entry && entry.itemId ? getItemDef(entry.itemId) : null;
            if (d && d.setId === def.setId) {
              count += 1;
            }
          }

          const activeLines = [];
          for (const [thStr, bonus] of Object.entries(setDef.thresholds)) {
            const threshold = parseInt(thStr, 10);
            if (Number.isNaN(threshold)) continue;
            if (count >= threshold) {
              const txt = formatBonusObject(bonus);
              if (txt) {
                activeLines.push(`${threshold} pieces : ${txt}`);
              }
            }
          }

          if (activeLines.length > 0) {
            bonusLines.push(`Panoplie (${count} equipes) : ${activeLines.join(" | ")}`);
          }
        }
      }
    }

    if (bonusTextEl) {
      const setSummaryLine = buildSetSummaryLine(player, def);

      const objectLines = bonusLines.filter((line) => !line.startsWith("Panoplie"));
      const setLines = bonusLines
        .filter((line) => line.startsWith("Panoplie"))
        .map((line) => {
          const match = line.match(/Panoplie\s*\((\d+)/);
          const count = match ? Number(match[1]) || 0 : 0;
          if (!count) return "";
          return `Panoplie : ${count} piece${count > 1 ? "s" : ""} equipee${count > 1 ? "s" : ""}`;
        })
        .filter(Boolean);

      lastObjectBonusText = decorateBonusHtml(objectLines.join(" | "));
      const rawSetText = setSummaryLine || setLines.join(" | ");
      const cleanedSetText = rawSetText.replace(/^Panoplie\s*:\s*/i, "");
      lastSetBonusText = decorateBonusHtml(cleanedSetText);
      applyBonusText();
    }

    if (domRef.requiredEl) {
      let levelValue = null;
      if (def && def.category === "equipement") {
        levelValue = typeof def.requiredLevel === "number" ? def.requiredLevel : 1;
      } else if (def && typeof def.level === "number") {
        levelValue = def.level;
      }
      domRef.requiredEl.textContent =
        typeof levelValue === "number" ? `Niv. ${levelValue}` : "";
    }

    if (domRef.descEl) {
      domRef.descEl.textContent = descLines.length > 0 ? descLines.join(" ") : "";
    }
  }

  return {
    applyBonusText,
    setBonusUiForItem,
    clearDetails,
    showItemDetailsById,
  };
}
