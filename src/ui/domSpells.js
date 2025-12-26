import { classes } from "../config/classes.js";
import { spells } from "../config/spells.js";
import { setActiveSpell } from "../core/spellSystem.js";
import { removeItem } from "../inventory/inventoryCore.js";
import { monsters as monsterDefs } from "../content/monsters/index.js";

// Initialise la barre de sorts en bas + la fenetre "grimoire" des sorts.
export function initDomSpells(player) {
  const bar = document.getElementById("hud-spell-bar");
  const spellsButtonEl = document.getElementById("hud-spells-button");
  const spellsPanelEl = document.getElementById("hud-spells-panel");
  const spellsListEl = document.getElementById("hud-spells-list");
  const spellsClassNameEl = document.getElementById("spells-class-name");
  const spellsDetailEl = document.getElementById("hud-spell-detail");
  const tierButtons = document.querySelectorAll(".spells-tier-label");

  if (!bar || !player) return;

  const classId = player.classId || "archer";
  const classDef = classes[classId] || classes.archer;
  const spellIds = classDef.spells || [];

  const parchmentPreviewDefs = {
    1: {
      label: "Parchemin inferieur tier 1",
      icon: "assets/ressources/Consommable/ParcheminInferieurTier1.png",
      itemId: "parchemin_inferieur_tier_1",
    },
  };
  if (!player.spellParchments || typeof player.spellParchments !== "object") {
    player.spellParchments = {};
  }

  const knownSpells = spellIds
    .map((id) => spells[id])
    .filter((s) => !!s);

  let currentTier = 1;

  // helper pour remplir la liste selon le tier actif
  function renderSpellsForTier(tier) {
    if (!spellsListEl) return;

    spellsListEl.innerHTML = "";
    if (spellsDetailEl) {
      spellsDetailEl.innerHTML = "";
    }

    const playerLevel = player.levelState?.niveau ?? 1;

    const getCapturedMonsterPreview = () => {
      const capturedId = player?.capturedMonsterId;
      if (!capturedId) return null;
      const def = monsterDefs[capturedId];
      return {
        id: capturedId,
        label: def?.displayName || def?.label || capturedId,
        level: player?.capturedMonsterLevel ?? def?.baseLevel ?? 1,
        baseStats: def?.statsOverrides || null,
      };
    };

    const buildInvocationCapturedExtraHtml = () => {
      const cap = getCapturedMonsterPreview();
      if (!cap) {
        return `<div class="spell-detail-line"><strong>Monstre capturé :</strong> Aucun</div>`;
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
        Math.max(1, Math.round(baseHp * mult)) +
        Math.floor((p.hpMax ?? p.hp ?? 0) * 0.5);
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
      if (typeof agilite === "number") lines.push(`Agilité: ${agilite}`);
      if (typeof intelligence === "number") lines.push(`Intelligence: ${intelligence}`);
      if (typeof chance === "number") lines.push(`Chance: ${chance}`);
      if (typeof initiative === "number") lines.push(`Initiative: ${initiative}`);

      return `
        <div class="spell-detail-line"><strong>Monstre capturé :</strong> ${cap.label} (Niv. ${capturedLevel})</div>
        <div class="spell-detail-line"><strong>Bonus niv :</strong> ${Math.round(bonus * 100)}%</div>
        ${
          lines.length > 0
            ? `<div class="spell-detail-line"><strong>Stats :</strong> ${lines.join(" Жњ ")}</div>`
            : ""
        }
      `;
    };

    let idsForTier;
    if (tier === 1) {
      idsForTier = spellIds;
    } else {
      // pour l'instant, pas encore de sorts pour les tiers 2/3
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

          // Texte d'element pour l'affichage (Air / Terre / Feu / Eau / Neutre)
          let elementLabel = "Neutre";
          switch (spell.element) {
            case "agilite":
            case "air":
              elementLabel = "Air";
              break;
            case "force":
            case "terre":
              elementLabel = "Terre";
              break;
            case "intelligence":
            case "feu":
              elementLabel = "Feu";
              break;
            case "chance":
            case "eau":
              elementLabel = "Eau";
              break;
            default:
              elementLabel = "Neutre";
          }

          const effects = [];
          if (spell.lifeSteal) {
            effects.push("Vole de vie");
          }
          if (spell.id === "recharge_flux") {
            effects.push("Sur cible : +1 charge Feu");
            effects.push("Sur soi : convertit charges → Puissance");
          }
          if (spell.id === "stabilisation_flux") {
            effects.push("Sur cible : +1 charge Eau");
            effects.push("Sur soi : convertit charges → Puissance");
          }
          if (spell.id === "surcharge_instable") {
            effects.push("Jusqu'à 5 charges Feu : +10%/charge");
          }
          if (maxCasts) {
            effects.push(`Lancers/tour : ${maxCasts}`);
          }
          const effectsText = effects.length > 0 ? effects.join(" · ") : null;

          const elementClass = elementLabel.toLowerCase();

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

          // click sur un sort -> detail dans la colonne droite
          li.addEventListener("click", () => {
            // highlight de la ligne selectionnee
            items.forEach((item) => item.classList.remove("selected"));
            li.classList.add("selected");

            if (spellsDetailEl) {
              const elementClassDetail = elementLabel.toLowerCase();
              const extra =
                spell.id === "invocation_capturee"
                  ? buildInvocationCapturedExtraHtml()
                  : "";

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

              const rangeModLabel =
                spell.rangeModifiable === false ? "fixe" : "modifiable";
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
                ${
                  effectsText
                    ? `<div class="spell-detail-block"><strong>Effets :</strong> ${effectsText}</div>`
                    : ""
                }
                ${
                  spell.description
                    ? `<div class="spell-detail-desc">${spell.description}</div>`
                    : ""
                }
              `;

              const damagePreviewEl = spellsDetailEl.querySelector(
                ".spell-detail-damage-preview"
              );
              const scrollSlots = spellsDetailEl.querySelectorAll(
                ".spell-detail-scroll"
              );
              const tierLabels = {
                1: "Parchemin faible",
                2: "Parchemin moyen",
                3: "Parchemin fort",
                4: "Parchemin tres fort",
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
                damagePreviewEl.textContent = ` → ${nextMin} - ${nextMax}`;
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

              const spellKey = spell.id;
              const getEquippedTier = () =>
                player.spellParchments?.[spellKey] || null;
              const setEquippedTier = (tier) => {
                if (!player.spellParchments) player.spellParchments = {};
                if (!tier) {
                  delete player.spellParchments[spellKey];
                } else {
                  player.spellParchments[spellKey] = tier;
                }
              };

              const countItem = (itemId) => {
                const inv = player?.inventory;
                if (!inv || !Array.isArray(inv.slots)) return 0;
                return inv.slots.reduce(
                  (acc, slot) =>
                    acc + (slot && slot.itemId === itemId ? slot.qty : 0),
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
                  parchmentIcon.style.backgroundImage = def.icon
                    ? `url(${def.icon})`
                    : "";
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
          });

      items.push(li);
      spellsListEl.appendChild(li);
    });

    // selection automatique du premier sort si present
    if (items.length > 0) {
      items[0].click();
    } else if (spellsDetailEl) {
      spellsDetailEl.innerHTML =
        "<p>Aucun sort pour ce tier pour l'instant.</p>";
    }
  }

  // === Grimoire : bouton SORTS + fenetre ===
  if (spellsButtonEl && spellsPanelEl && spellsListEl) {
    if (spellsClassNameEl) {
      spellsClassNameEl.textContent = classDef.label || classId;
    }

    spellsButtonEl.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = !document.body.classList.contains("hud-spells-open");
      document.body.classList.toggle("hud-spells-open");

      if (willOpen) {
        renderSpellsForTier(currentTier);
      }
    });
  }

  // === Barre de sorts (slots en bas du HUD) ===
  const slots = bar.querySelectorAll(".hud-spell-slot");

  // Map index de slot -> element DOM (pour les raccourcis clavier)
  const slotByIndex = {};
  const slotSpellByIndex = {};
  const cooldownBadgeByIndex = {};

  const ensureCooldownBadge = (slot) => {
    if (!slot) return null;
    let badge = slot.querySelector(".hud-spell-cd");
    if (badge) return badge;
    badge = document.createElement("span");
    badge.className = "hud-spell-cd";
    badge.textContent = "";
    slot.appendChild(badge);
    return badge;
  };

  const computeDisableInfo = (spell) => {
    const cooldowns = player?.spellCooldowns || {};
    const cd = cooldowns[spell.id] || 0;

    // Règles spéciales Animiste
    if (spell.id === "invocation_capturee") {
      if (!player?.capturedMonsterId) {
        return { disabled: true, label: "—" };
      }
      if (player?.hasAliveSummon) {
        return { disabled: true, label: "INV" };
      }
    }

    if (cd > 0) return { disabled: true, label: `${cd}t` };
    return { disabled: false, label: "" };
  };

  const updateSpellBarState = () => {
    slots.forEach((slot, index) => {
      const spell = slotSpellByIndex[index] || null;
      if (!slot || !spell) return;
      const badge = cooldownBadgeByIndex[index];
      const info = computeDisableInfo(spell);
      slot.classList.toggle("is-disabled", !!info.disabled);
      if (badge) {
        badge.textContent = info.label || "";
        badge.classList.toggle("is-visible", !!info.label);
      }
    });
  };

  // Permet à l'UI combat de rafraîchir les compteurs à chaque tick de tour.
  player.updateSpellBar = updateSpellBarState;

  slots.forEach((slot, index) => {
    const slotIndex = parseInt(slot.dataset.slot, 10);
    if (!Number.isNaN(slotIndex)) {
      slotByIndex[slotIndex] = slot;
    }

    const spell = knownSpells[index];
    const nameEl = slot.querySelector(".hud-spell-name");

    if (!spell) {
      slot.classList.add("empty");
      if (nameEl) nameEl.textContent = "";
      return;
    }

    slot.classList.remove("empty");
    if (nameEl) {
      nameEl.textContent = spell.label;
    }
    slotSpellByIndex[index] = spell;
    cooldownBadgeByIndex[index] = ensureCooldownBadge(slot);

    // Selection du sort au clic sur le slot
    slot.addEventListener("click", (event) => {
      event.stopPropagation();

      // Un seul slot selectionne
      slots.forEach((s) => s.classList.remove("selected"));
      slot.classList.add("selected");

      // Sort actif cote joueur
      setActiveSpell(player, spell.id);
      updateSpellBarState();
    });
  });

  // Init visuel
  updateSpellBarState();

  // --- Raccourcis clavier pour selectionner un slot ---
  // Mapping AZERTY : 1/& -> slot 1, 2/� -> slot 2, etc. jusqu'a 8
  const keyToSlot = {
    "&": 1,
    "1": 1,
    "�": 2,
    "2": 2,
    '"': 3,
    "3": 3,
    "'": 4,
    "4": 4,
    "(": 5,
    "5": 5,
    "-": 6,
    "6": 6,
    "�": 7,
    "7": 7,
    "_": 8,
    "8": 8,
  };

  // Mapping par code (AZERTY/QWERTY) : Digit2 marche même si `event.key` vaut "é".
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

  window.addEventListener("keydown", (event) => {
    // Evite de capturer les touches quand on tape dans un champ de texte
    const target = event.target;
    if (
      target &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
    ) {
      return;
    }

    const slotIndex = codeToSlot[event.code] || keyToSlot[event.key];
    if (!slotIndex) return;

    const slot = slotByIndex[slotIndex];
    if (!slot || slot.classList.contains("empty")) return;

    // Simule un clic sur le slot pour reutiliser toute la logique existante
    slot.click();
    updateSpellBarState();
  });

  // boutons de tiers (Tier 1 / 2 / 3)
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
          renderSpellsForTier(currentTier);
        }
      });
    });
  }
}
