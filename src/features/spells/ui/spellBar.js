import { setActiveSpell } from "../../combat/spells/index.js";

const keyToSlot = {
  "&": 1,
  "1": 1,
  "2": 2,
  '"': 3,
  "3": 3,
  "'": 4,
  "4": 4,
  "(": 5,
  "5": 5,
  "-": 6,
  "6": 6,
  "7": 7,
  "_": 8,
  "8": 8,
};

const codeToSlot = {
  Digit1: 1,
  Digit2: 2,
  Digit3: 3,
  Digit4: 4,
  Digit5: 5,
  Digit6: 6,
  Digit7: 7,
  Digit8: 8,
  Numpad1: 1,
  Numpad2: 2,
  Numpad3: 3,
  Numpad4: 4,
  Numpad5: 5,
  Numpad6: 6,
  Numpad7: 7,
  Numpad8: 8,
};

function ensureCooldownBadge(slot) {
  if (!slot) return null;
  let badge = slot.querySelector(".hud-spell-cd");
  if (badge) return badge;
  badge = document.createElement("span");
  badge.className = "hud-spell-cd";
  badge.textContent = "";
  slot.appendChild(badge);
  return badge;
}

function computeDisableInfo(player, spell) {
  const cooldowns = player?.spellCooldowns || {};
  const cd = cooldowns[spell.id] || 0;

  if (spell.id === "invocation_capturee") {
    if (!player?.capturedMonsterId) {
      return { disabled: true, label: "?" };
    }
    if (player?.hasAliveSummon) {
      return { disabled: true, label: "INV" };
    }
  }

  if (cd > 0) return { disabled: true, label: `${cd}t` };
  return { disabled: false, label: "" };
}

export function initSpellBar(getPlayer, bar, knownSpells) {
  if (typeof getPlayer !== "function" || !bar) return;
  const slots = bar.querySelectorAll(".hud-spell-slot");

  const slotByIndex = {};
  const slotSpellByIndex = {};
  const cooldownBadgeByIndex = {};

  const updateSpellBarState = () => {
    const player = getPlayer();
    if (!player) return;
    slots.forEach((slot, index) => {
      const spell = slotSpellByIndex[index] || null;
      if (!slot || !spell) return;
      const badge = cooldownBadgeByIndex[index];
      const info = computeDisableInfo(player, spell);
      slot.classList.toggle("is-disabled", !!info.disabled);
      if (badge) {
        badge.textContent = info.label || "";
        badge.classList.toggle("is-visible", !!info.label);
      }
    });
  };

  const setKnownSpells = (nextKnownSpells) => {
    slots.forEach((slot, index) => {
      const slotIndex = parseInt(slot.dataset.slot, 10);
      if (!Number.isNaN(slotIndex)) {
        slotByIndex[slotIndex] = slot;
      }

      const spell = nextKnownSpells[index];
      const nameEl = slot.querySelector(".hud-spell-name");

      if (!spell) {
        slot.classList.add("empty");
        if (nameEl) nameEl.textContent = "";
        slotSpellByIndex[index] = null;
        return;
      }

      slot.classList.remove("empty");
      if (nameEl) {
        nameEl.textContent = spell.label;
      }
      slotSpellByIndex[index] = spell;
      cooldownBadgeByIndex[index] = ensureCooldownBadge(slot);
    });
    updateSpellBarState();
  };

  slots.forEach((slot, index) => {
    slot.addEventListener("click", (event) => {
      const player = getPlayer();
      const spell = slotSpellByIndex[index] || null;
      if (!player || !spell) return;
      event.stopPropagation();
      slots.forEach((s) => s.classList.remove("selected"));
      slot.classList.add("selected");
      setActiveSpell(player, spell.id);
      updateSpellBarState();
    });
  });

  const player = getPlayer();
  if (player) {
    player.updateSpellBar = updateSpellBarState;
  }

  setKnownSpells(knownSpells || []);

  if (!keydownBound) {
    keydownBound = true;
    window.addEventListener("keydown", (event) => {
      const target = event.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }

      const slotIndex = codeToSlot[event.code] || keyToSlot[event.key];
      if (!slotIndex) return;

      const slot = slotByIndex[slotIndex];
      if (!slot || slot.classList.contains("empty")) return;

      slot.click();
    });
  }

  return { setKnownSpells, updateSpellBarState };
}
let keydownBound = false;
