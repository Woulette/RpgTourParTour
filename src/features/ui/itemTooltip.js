import { getItemDef } from "../inventory/runtime/inventoryAuthority.js";

let tooltipEl = null;
let hoverTimer = null;
let currentTarget = null;
let initialized = false;

const TOOLTIP_DELAY_MS = 500;

const STAT_LABELS = {
  vitalite: "Vitalite",
  agilite: "Agilite",
  force: "Force",
  intelligence: "Intelligence",
  chance: "Chance",
  sagesse: "Sagesse",
  pa: "PA",
  pm: "PM",
};

const EFFECT_LABELS = {
  hpPlus: "PV",
  paPlusCombat: "PA (combat)",
};

const STAT_CLASS_MAP = {
  vitalite: "vitalite",
  agilite: "agilite",
  force: "force",
  intelligence: "intel",
  chance: "chance",
  sagesse: "sagesse",
  pa: "pa",
  pm: "pm",
};

const EFFECT_CLASS_MAP = {
  hpPlus: "hp",
  paPlusCombat: "pa",
};

function buildStatLines(def) {
  const lines = [];
  if (def?.statsBonus && typeof def.statsBonus === "object") {
    Object.entries(def.statsBonus).forEach(([key, value]) => {
      if (!Number.isFinite(value) || value === 0) return;
      const label = STAT_LABELS[key] || key;
      const sign = value > 0 ? "+" : "";
      const cls = STAT_CLASS_MAP[key] || "generic";
      lines.push({ text: `${sign}${value} ${label}`, cls });
    });
  }
  if (def?.effect && typeof def.effect === "object") {
    Object.entries(def.effect).forEach(([key, value]) => {
      if (!Number.isFinite(value) || value === 0) return;
      const label = EFFECT_LABELS[key] || key;
      const sign = value > 0 ? "+" : "";
      const cls = EFFECT_CLASS_MAP[key] || "generic";
      lines.push({ text: `${sign}${value} ${label}`, cls });
    });
  }
  return lines;
}

function ensureStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById("item-tooltip-css")) return;
  const link = document.createElement("link");
  link.id = "item-tooltip-css";
  link.rel = "stylesheet";
  link.href = "assets/css/itemTooltip.css";
  document.head.appendChild(link);
}

function ensureTooltipEl() {
  if (tooltipEl) return tooltipEl;
  tooltipEl = document.createElement("div");
  tooltipEl.className = "item-tooltip";
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

function hideTooltip() {
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }
  if (!tooltipEl) return;
  tooltipEl.style.display = "none";
}

function showTooltip(def, anchorEl) {
  if (!def || !anchorEl) return;
  const el = ensureTooltipEl();
  const level =
    typeof def.requiredLevel === "number"
      ? def.requiredLevel
      : typeof def.level === "number"
        ? def.level
        : 1;
  const description = String(def.description || "Aucune description.");
  const bonusInfo = String(def.bonusInfo || "");
  const statLines = buildStatLines(def);
  const statsHtml = statLines.length
    ? `<div class="item-tooltip-stats">${statLines
        .map(
          (line) =>
            `<div class="item-tooltip-stat item-tooltip-stat-${line.cls}">${line.text}</div>`
        )
        .join("")}</div>`
    : "";
  const bonusHtml = bonusInfo
    ? `<div class="item-tooltip-bonus">${bonusInfo}</div>`
    : "";
  el.innerHTML = `
    <div class="item-tooltip-title">${def.label || def.id}</div>
    <div class="item-tooltip-level">Niveau : ${level}</div>
    ${statsHtml}
    <div class="item-tooltip-desc">${description}</div>
    ${bonusHtml}
  `;
  el.style.display = "block";
  el.style.left = "0px";
  el.style.top = "0px";
  el.style.visibility = "hidden";

  const rect = anchorEl.getBoundingClientRect();
  const tooltipRect = el.getBoundingClientRect();
  const margin = 8;
  let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));
  let top = rect.top - tooltipRect.height - margin;
  if (top < margin) {
    top = rect.bottom + margin;
  }
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
  el.style.visibility = "visible";
}

function handlePointerOver(event) {
  const target = event.target?.closest?.("[data-item-id]");
  if (!target) {
    hideTooltip();
    currentTarget = null;
    return;
  }
  if (currentTarget === target) return;
  currentTarget = target;
  if (hoverTimer) clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    const itemId = target.dataset.itemId;
    const def = itemId ? getItemDef(itemId) : null;
    if (!def) return;
    showTooltip(def, target);
  }, TOOLTIP_DELAY_MS);
}

function handlePointerOut(event) {
  if (!currentTarget) return;
  if (event.relatedTarget && currentTarget.contains(event.relatedTarget)) return;
  hideTooltip();
  currentTarget = null;
}

export function initItemTooltip() {
  if (initialized || typeof document === "undefined") return;
  initialized = true;
  ensureStyles();
  document.addEventListener("mouseover", handlePointerOver);
  document.addEventListener("mouseout", handlePointerOut);
  window.addEventListener("scroll", hideTooltip, true);
  window.addEventListener("blur", hideTooltip);
}
