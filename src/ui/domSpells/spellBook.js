import { spells } from "../../config/spells.js";
import { monsters as monsterDefs } from "../../content/monsters/index.js";
import { removeItem } from "../../inventory/inventoryCore.js";
import {
  QUEST_STATES,
  getCurrentQuestStage,
  getQuestDef,
  getQuestState,
} from "../../quests/index.js";
import { hasEquippedParchment } from "../../quests/runtime/objectives.js";
import { emit as emitStoreEvent } from "../../state/store.js";

const parchmentPreviewDefs = {
  1: {
    label: "Parchemin inferieur tier 1",
    icon: "assets/ressources/Consommable/ParcheminInferieurTier1.png",
    itemId: "parchemin_inferieur_tier_1",
  },
};

function ensureParchmentState(player) {
  if (!player.spellParchments || typeof player.spellParchments !== "object") {
    player.spellParchments = {};
  }

  if (hasEquippedParchment(player)) {
    const questId = "alchimiste_marchand_5";
    const questDef = getQuestDef(questId);
    if (questDef) {
      const state = getQuestState(player, questId, { emit: false });
      const stage = getCurrentQuestStage(questDef, state);
      if (state?.state === QUEST_STATES.IN_PROGRESS && stage?.id === "apply_parchemin") {
        state.progress = state.progress || {};
        state.progress.applied = true;
        emitStoreEvent("quest:updated", { questId, state });
      }
    }
  }
}

function getCapturedMonsterPreview(player) {
  const capturedId = player?.capturedMonsterId;
  if (!capturedId) return null;
  const def = monsterDefs[capturedId];
  return {
    id: capturedId,
    label: def?.displayName || def?.label || capturedId,
    level: player?.capturedMonsterLevel ?? def?.baseLevel ?? 1,
    baseStats: def?.statsOverrides || null,
  };
}

function buildInvocationCapturedExtraHtml(player) {
  const cap = getCapturedMonsterPreview(player);
  if (!cap) {
    return '<div class="spell-detail-line"><strong>Monstre capture :</strong> Aucun</div>';
  }

  const playerLevel = player?.levelState?.niveau ?? 1;
  const capturedLevel = cap.level ?? 1;
  const levelGap = Math.max(0, (playerLevel ?? 1) - (capturedLevel ?? 1));
  const bonus = 0.05 + 0.01 * levelGap;
  const mult = 1 + bonus;

  const base = cap.baseStats || {};
  const p = player?.stats || {};

  const baseHp = base.hpMax ?? base.hp ?? 1;
  const hpMax =
    Math.max(1, Math.round(baseHp * mult)) + Math.floor((p.hpMax ?? p.hp ?? 0) * 0.5);
  const initiative = Math.max(0, Math.round((base.initiative ?? 0) * mult));
  const force =
    Math.max(0, Math.round((base.force ?? 0) * mult)) + Math.floor((p.force ?? 0) * 0.5);
  const agilite =
    Math.max(0, Math.round((base.agilite ?? 0) * mult)) +
    Math.floor((p.agilite ?? 0) * 0.5);
  const intelligence =
    Math.max(0, Math.round((base.intelligence ?? 0) * mult)) +
    Math.floor((p.intelligence ?? 0) * 0.5);
  const chance =
    Math.max(0, Math.round((base.chance ?? 0) * mult)) +
    Math.floor((p.chance ?? 0) * 0.5);

  const lines = [];
  if (typeof hpMax === "number") lines.push(`PV: ${hpMax}`);
  if (typeof force === "number") lines.push(`Force: ${force}`);
  if (typeof agilite === "number") lines.push(`Agilite: ${agilite}`);
  if (typeof intelligence === "number") lines.push(`Intelligence: ${intelligence}`);
  if (typeof chance === "number") lines.push(`Chance: ${chance}`);
  if (typeof initiative === "number") lines.push(`Initiative: ${initiative}`);

  return `
    <div class="spell-detail-line"><strong>Monstre capture :</strong> ${cap.label} (Niv. ${capturedLevel})</div>
    <div class="spell-detail-line"><strong>Bonus niv :</strong> ${Math.round(bonus * 100)}%</div>
    ${
      lines.length > 0
        ? `<div class="spell-detail-line"><strong>Stats :</strong> ${lines.join(" - ")}</div>`
        : ""
    }
  `;
}

function buildEffectsText(spell) {
  const effects = [];
  if (spell.lifeSteal) {
    effects.push("Vole de vie");
  }
  if (spell.id === "recharge_flux") {
    effects.push("Sur cible : +1 charge Feu");
    effects.push("Sur soi : convertit charges -> Puissance");
  }
  if (spell.id === "stabilisation_flux") {
    effects.push("Sur cible : +1 charge Eau");
    effects.push("Sur soi : convertit charges -> Puissance");
  }
  if (spell.id === "surcharge_instable") {
    effects.push("Jusqu'a 5 charges Feu : +10%/charge");
  }
  if (spell.maxCastsPerTurn) {
    effects.push(`Lancers/tour : ${spell.maxCastsPerTurn}`);
  }
  return effects.length > 0 ? effects.join(" | ") : null;
}

function getElementLabel(spell) {
  switch (spell.element) {
    case "agilite":
    case "air":
      return "Air";
    case "force":
    case "terre":
      return "Terre";
    case "intelligence":
    case "feu":
      return "Feu";
    case "chance":
    case "eau":
      return "Eau";
    default:
      return "Neutre";
  }
}

function setupSpellDetail(
  player,
  spell,
  elementLabel,
  effectsText,
  spellsDetailEl
) {
  if (!spellsDetailEl) return;

  const requiredLevel = spell.requiredLevel ?? 1;
  const dmgMin = spell.damageMin ?? 0;
  const dmgMax = spell.damageMax ?? dmgMin;
  const rangeMin = spell.rangeMin ?? 0;
  const rangeMax = spell.rangeMax ?? rangeMin;
  const paCost = spell.paCost ?? 0;
  const maxCasts = spell.maxCastsPerTurn ?? null;

  const elementClassDetail = elementLabel.toLowerCase();
  const extra = spell.id === "invocation_capturee" ? buildInvocationCapturedExtraHtml(player) : "";

  const buildSurchargeChargesHtml = () => {
    if (spell.id !== "surcharge_instable") return "";
    const baseMin = spell.damageMin ?? 0;
    const baseMax = spell.damageMax ?? baseMin;
    const lines = [];
    for (let charges = 1; charges <= 5; charges += 1) {
      const mult = 1 + 0.1 * charges;
      const min = Math.ceil(baseMin * mult);
      const max = Math.ceil(baseMax * mult);
      lines.push(
        `<div class="spell-detail-line"><strong>Charge ${charges} :</strong> ${min} - ${max} <span class="spellbook-element spellbook-element-feu">Feu</span></div>`
      );
    }
    return lines.join("");
  };

  const rangeModLabel = spell.rangeModifiable === false ? "fixe" : "modifiable";
  const statRows = [
    { key: "level", label: "Niveau requis", value: `${requiredLevel}` },
    { key: "pa", label: "PA", value: `${paCost}` },
    { key: "damage", label: "Degats", value: `${dmgMin} - ${dmgMax}` },
    {
      key: "range",
      label: "Portee",
      value: `${rangeMin}-${rangeMax} (${rangeModLabel})`,
    },
  ];

  if (typeof maxCasts === "number") {
    statRows.push({
      label: "Lancers/tour",
      value: `${maxCasts}`,
      className: "spell-detail-row-emph",
    });
  }

  if (typeof spell.cooldownTurns === "number") {
    statRows.push({
      label: "Cooldown",
      value: `${spell.cooldownTurns} tours`,
      className: "spell-detail-row-emph",
    });
  }

  const statsHtml = statRows
    .map((row) => {
      if (row.key === "damage") {
        return `
          <div class="spell-detail-row ${row.className || ""}">
            <span>${row.label}</span>
            <strong>
              <span class="spell-detail-damage-base">${row.value}</span>
              <span class="spell-detail-damage-preview"></span>
            </strong>
          </div>
        `;
      }
      return `
        <div class="spell-detail-row ${row.className || ""}">
          <span>${row.label}</span>
          <strong>${row.value}</strong>
        </div>
      `;
    })
    .join("");

  spellsDetailEl.innerHTML = `
    <div class="spell-detail-header">
      <div class="spell-detail-title">
        <h3>${spell.label}</h3>
        <span class="spellbook-element spellbook-element-${elementClassDetail}">${elementLabel}</span>
      </div>
      <div class="spell-detail-scrolls">
        <span class="spell-detail-scroll" data-tier="1" title="Parchemin faible"></span>
        <span class="spell-detail-scroll" data-tier="2" title="Parchemin moyen"></span>
        <span class="spell-detail-scroll" data-tier="3" title="Parchemin fort"></span>
        <span class="spell-detail-scroll" data-tier="4" title="Parchemin tres fort"></span>
      </div>
    </div>
    <div class="spell-detail-grid">
      ${statsHtml}
    </div>
    <div class="spell-detail-preview">
      Cliquez sur un parchemin pour voir les degats futurs.
    </div>
    <div class="spell-detail-parchment is-hidden">
      <div class="spell-detail-parchment-icon" aria-hidden="true"></div>
      <div class="spell-detail-parchment-info">
        <div class="spell-detail-parchment-name">Parchemin</div>
        <div class="spell-detail-parchment-status">Non equipe</div>
      </div>
      <button type="button" class="spell-detail-parchment-btn">Equiper</button>
    </div>
    ${spell.id === "surcharge_instable" ? `<div class="spell-detail-block">${buildSurchargeChargesHtml()}</div>` : ""}
    ${extra ? `<div class="spell-detail-block">${extra}</div>` : ""}
    ${effectsText ? `<div class="spell-detail-block"><strong>Effets :</strong> ${effectsText}</div>` : ""}
    ${spell.description ? `<div class="spell-detail-desc">${spell.description}</div>` : ""}
  `;

  const damagePreviewEl = spellsDetailEl.querySelector(
    ".spell-detail-damage-preview"
  );
  const scrollSlots = spellsDetailEl.querySelectorAll(
    ".spell-detail-scroll"
  );

  const getEquippedTier = () => player.spellParchments?.[spell.id] || null;
  const setEquippedTier = (tier) => {
    if (!player.spellParchments) player.spellParchments = {};
    if (!tier) {
      delete player.spellParchments[spell.id];
    } else {
      player.spellParchments[spell.id] = tier;
    }
  };

  const applyEquippedDamageDisplay = () => {
    const baseEl = spellsDetailEl.querySelector(
      ".spell-detail-damage-base"
    );
    if (!baseEl || !damagePreviewEl) return;
    const equippedTier = getEquippedTier();
    if (!equippedTier) {
      baseEl.textContent = `${dmgMin} - ${dmgMax}`;
      damagePreviewEl.textContent = "";
      return;
    }
    const mult = 1 + 0.1 * equippedTier;
    if (dmgMax <= 0) {
      baseEl.textContent = "0 - 0";
      damagePreviewEl.textContent = "";
      return;
    }
    const nextMin = Math.ceil(dmgMin * mult);
    const nextMax = Math.ceil(dmgMax * mult);
    baseEl.textContent = `${nextMin} - ${nextMax}`;
    damagePreviewEl.textContent = "";
  };

  const updatePreview = (tier) => {
    if (!damagePreviewEl) return;
    const mult = 1 + 0.1 * tier;
    if (dmgMax <= 0) {
      damagePreviewEl.textContent = " (pas de degats)";
      return;
    }
    const nextMin = Math.ceil(dmgMin * mult);
    const nextMax = Math.ceil(dmgMax * mult);
    damagePreviewEl.textContent = ` -> ${nextMin} - ${nextMax}`;
  };

  const updateSlotVisuals = () => {
    scrollSlots.forEach((slot) => {
      const tier = parseInt(slot.dataset.tier, 10) || 1;
      const def = parchmentPreviewDefs[tier];
      const equippedTier = getEquippedTier();
      const isEquipped = equippedTier === tier;
      slot.classList.toggle("has-parchment", isEquipped);
      slot.style.backgroundImage =
        isEquipped && def?.icon ? `url(${def.icon})` : "";
      slot.style.backgroundSize = "cover";
      slot.style.backgroundPosition = "center";
    });
  };

  const parchmentWrap = spellsDetailEl.querySelector(
    ".spell-detail-parchment"
  );
  const parchmentIcon = spellsDetailEl.querySelector(
    ".spell-detail-parchment-icon"
  );
  const parchmentName = spellsDetailEl.querySelector(
    ".spell-detail-parchment-name"
  );
  const parchmentStatus = spellsDetailEl.querySelector(
    ".spell-detail-parchment-status"
  );
  const parchmentBtn = spellsDetailEl.querySelector(
    ".spell-detail-parchment-btn"
  );

  const markParchmentApplied = () => {
    const questId = "alchimiste_marchand_5";
    const questDef = getQuestDef(questId);
    if (!questDef) return;
    const state = getQuestState(player, questId, { emit: false });
    if (!state || state.state !== QUEST_STATES.IN_PROGRESS) return;
    const stage = getCurrentQuestStage(questDef, state);
    if (!stage || stage.id !== "apply_parchemin") return;
    state.progress = state.progress || {};
    state.progress.applied = true;
    emitStoreEvent("quest:updated", { questId, state });
  };

  const countItem = (itemId) => {
    const inv = player?.inventory;
    if (!inv || !Array.isArray(inv.slots)) return 0;
    return inv.slots.reduce(
      (acc, slot) => acc + (slot && slot.itemId === itemId ? slot.qty : 0),
      0
    );
  };

  const renderParchmentPreview = (tier) => {
    if (!parchmentWrap) return;
    const def = parchmentPreviewDefs[tier];
    if (!def) {
      parchmentWrap.classList.add("is-hidden");
      return;
    }
    if (getEquippedTier() === tier) {
      parchmentWrap.classList.add("is-hidden");
      return;
    }
    parchmentWrap.classList.remove("is-hidden");
    if (parchmentIcon) {
      parchmentIcon.style.backgroundImage = def.icon ? `url(${def.icon})` : "";
    }
    if (parchmentName) {
      parchmentName.textContent = def.label;
    }
    if (parchmentStatus) {
      parchmentStatus.textContent = "Non equipe";
    }
    if (parchmentBtn) {
      const canEquip = countItem(def.itemId) > 0;
      parchmentBtn.textContent = "Equiper";
      parchmentBtn.disabled = !canEquip;
      parchmentBtn.onclick = () => {
        if (!canEquip) return;
        removeItem(player.inventory, def.itemId, 1);
        setEquippedTier(tier);
        markParchmentApplied();
        applyEquippedDamageDisplay();
        renderParchmentPreview(tier);
        updateSlotVisuals();
      };
    }
  };

  scrollSlots.forEach((slot) => {
    slot.addEventListener("click", () => {
      scrollSlots.forEach((s) => s.classList.remove("active"));
      slot.classList.add("active");
      const tier = parseInt(slot.dataset.tier, 10) || 1;
      if (!getEquippedTier()) {
        updatePreview(tier);
      }
      renderParchmentPreview(tier);
    });
  });

  applyEquippedDamageDisplay();
  updateSlotVisuals();
}

function renderSpellsForTier({
  player,
  spellIds,
  spellsListEl,
  spellsDetailEl,
  tier,
}) {
  if (!spellsListEl) return;

  spellsListEl.innerHTML = "";
  if (spellsDetailEl) {
    spellsDetailEl.innerHTML = "";
  }

  const playerLevel = player.levelState?.niveau ?? 1;

  let idsForTier;
  if (tier === 1) {
    idsForTier = spellIds;
  } else {
    idsForTier = [];
  }

  const items = [];

  idsForTier.forEach((id) => {
    const spell = spells[id];
    if (!spell) return;

    const li = document.createElement("li");
    li.className = "spellbook-item";

    const requiredLevel = spell.requiredLevel ?? 1;
    const unlocked = playerLevel >= requiredLevel;
    if (!unlocked) {
      li.classList.add("locked");
    }

    const dmgMin = spell.damageMin ?? 0;
    const dmgMax = spell.damageMax ?? dmgMin;
    const rangeMin = spell.rangeMin ?? 0;
    const rangeMax = spell.rangeMax ?? rangeMin;
    const paCost = spell.paCost ?? 0;
    const maxCasts = spell.maxCastsPerTurn ?? null;

    const elementLabel = getElementLabel(spell);
    const elementClass = elementLabel.toLowerCase();
    const effectsText = buildEffectsText(spell);

    li.innerHTML = `
      <div class="spellbook-item-main">
        <span class="spellbook-name">${spell.label}</span>
        <span class="spellbook-level">Niv. ${requiredLevel}</span>
      </div>
      <div class="spellbook-item-details">
        <span>PA : ${paCost}</span>
        <span>Degats : ${dmgMin} - ${dmgMax}</span>
        <span class="spellbook-element spellbook-element-${elementClass}">${elementLabel}</span>
        <span>Portee : ${rangeMin}-${rangeMax}</span>
      </div>
      ${
        effectsText
          ? `<div class="spellbook-item-effects"><span>${effectsText}</span></div>`
          : ""
      }
    `;

    li.addEventListener("click", () => {
      items.forEach((item) => item.classList.remove("selected"));
      li.classList.add("selected");
      setupSpellDetail(player, spell, elementLabel, effectsText, spellsDetailEl);
    });

    items.push(li);
    spellsListEl.appendChild(li);
  });

  if (items.length > 0) {
    items[0].click();
  } else if (spellsDetailEl) {
    spellsDetailEl.innerHTML = "<p>Aucun sort pour ce tier pour l'instant.</p>";
  }
}

export function initSpellBook({
  player,
  classDef,
  classId,
  spellIds,
  spellsButtonEl,
  spellsPanelEl,
  spellsListEl,
  spellsClassNameEl,
  spellsDetailEl,
  tierButtons,
}) {
  if (!player || !spellsListEl) return;

  ensureParchmentState(player);

  let currentTier = 1;

  if (spellsButtonEl && spellsPanelEl && spellsListEl) {
    if (spellsClassNameEl) {
      spellsClassNameEl.textContent = classDef.label || classId;
    }

    spellsButtonEl.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = !document.body.classList.contains("hud-spells-open");
      document.body.classList.toggle("hud-spells-open");

      if (willOpen) {
        renderSpellsForTier({
          player,
          spellIds,
          spellsListEl,
          spellsDetailEl,
          tier: currentTier,
        });
      }
    });
  }

  if (tierButtons && tierButtons.length > 0) {
    tierButtons.forEach((btn) => {
      const tier = parseInt(btn.dataset.tier, 10) || 1;
      if (tier === currentTier) {
        btn.classList.add("active");
      }

      btn.addEventListener("click", () => {
        currentTier = tier;
        tierButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        if (document.body.classList.contains("hud-spells-open")) {
          renderSpellsForTier({
            player,
            spellIds,
            spellsListEl,
            spellsDetailEl,
            tier: currentTier,
          });
        }
      });
    });
  }
}
