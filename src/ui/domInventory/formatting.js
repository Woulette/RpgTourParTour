import { getItemDef } from "../../inventory/inventoryCore.js";
import { equipmentSets } from "../../inventory/sets.js";

export function labelForStatKey(key) {
  switch (key) {
    case "force":
      return "Force";
    case "intelligence":
      return "Intelligence";
    case "agilite":
      return "Agilite";
    case "chance":
      return "Chance";
    case "vitalite":
      return "Vitalite";
    case "initiative":
      return "Initiative";
    case "puissance":
      return "Puissance";
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

export function formatBonusObject(bonus) {
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

export function decorateBonusHtml(text) {
  if (!text) return "";
  let html = text;

  const patterns = [
    { label: "Force", cls: "inventory-bonus-stat-force" },
    { label: "Intelligence", cls: "inventory-bonus-stat-intel" },
    { label: "Agilite", cls: "inventory-bonus-stat-agilite" },
    { label: "Chance", cls: "inventory-bonus-stat-chance" },
    { label: "Vitalite", cls: "inventory-bonus-stat-vitalite" },
    { label: "Initiative", cls: "inventory-bonus-stat-init" },
    { label: "Puissance", cls: "inventory-bonus-stat-force" },
    { label: "PV", cls: "inventory-bonus-stat-hp" },
    { label: "PA", cls: "inventory-bonus-stat-pa" },
    { label: "PM", cls: "inventory-bonus-stat-pm" },
  ];

  patterns.forEach(({ label, cls }) => {
    const re = new RegExp(`([+\\-]\\d+\\s${label})`, "g");
    html = html.replace(
      re,
      `<span class="inventory-bonus-stat ${cls}">$1</span>`
    );
  });

  html = html.replace(/,\s*/g, "<br>");
  return html;
}

export function buildSetSummaryLine(player, def) {
  if (!def?.setId || !player?.equipment) return "";
  const setDef = equipmentSets[def.setId];
  if (!setDef || !setDef.thresholds) return "";

  let count = 0;
  for (const entry of Object.values(player.equipment)) {
    const d = entry && entry.itemId ? getItemDef(entry.itemId) : null;
    if (d && d.setId === def.setId) {
      count += 1;
    }
  }

  let bestThreshold = -1;
  let bestBonus = null;
  for (const [thStr, bonus] of Object.entries(setDef.thresholds)) {
    const threshold = parseInt(thStr, 10);
    if (Number.isNaN(threshold)) continue;
    if (count >= threshold && bonus && threshold > bestThreshold) {
      bestThreshold = threshold;
      bestBonus = bonus;
    }
  }

  if (bestThreshold > 0 && bestBonus) {
    const txt = formatBonusObject(bestBonus);
    if (txt) {
      const piecesLabel = bestThreshold > 1 ? "pieces" : "piece";
      return `Panoplie : ${bestThreshold} ${piecesLabel} : ${txt}`;
    }
  }

  return "";
}
