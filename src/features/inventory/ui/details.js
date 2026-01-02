import { getItemDef } from "../runtime/inventoryCore.js";
import { equipmentSets } from "../data/sets.js";
import { formatBonusObject, decorateBonusHtml } from "./formatting.js";

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

    const objectLines = [];
    const setLines = [];
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
      objectLines.push(`Effets : ${effectParts.join(", ")}`);
    }

    if (def && typeof def.bonusInfo === "string" && def.bonusInfo.trim()) {
      objectLines.push(def.bonusInfo.trim());
    }

    if (def && def.category === "equipement" && def.statsBonus) {
      const bonusTxt = formatBonusObject(def.statsBonus);
      if (bonusTxt) {
        objectLines.push(`Bonus objet : ${bonusTxt}`);
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

          const entries = Object.entries(setDef.thresholds)
            .map(([thStr, bonus]) => ({
              threshold: parseInt(thStr, 10),
              bonus,
            }))
            .filter((entry) => !Number.isNaN(entry.threshold))
            .sort((a, b) => a.threshold - b.threshold);

          entries.forEach(({ threshold, bonus }) => {
            const txt = formatBonusObject(bonus);
            if (!txt) return;
            const active = count >= threshold;
            setLines.push(
              `${threshold} pieces : ${txt}${active ? "" : " (inactif)"}`
            );
          });
        }
      }
    }

    if (bonusTextEl) {
      lastObjectBonusText = decorateBonusHtml(objectLines.join(" | "));
      if (setLines.length > 0) {
        const rawSetText = setLines.join(" | ");
        lastSetBonusText = decorateBonusHtml(rawSetText).replace(
          /\s*\|\s*/g,
          "<br>"
        );
      } else {
        lastSetBonusText = "Aucun bonus de panoplie actif.";
      }
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
