import { classes } from "../config/classes.js";
import { spells } from "../config/spells.js";
import { setActiveSpell } from "../core/spellSystem.js";
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

              spellsDetailEl.innerHTML = `
                <h3>${spell.label}</h3>
                <div class="spell-detail-line">Niveau requis : ${requiredLevel}</div>
                <div class="spell-detail-line">
                  <strong>PA :</strong> ${paCost} &nbsp;|&nbsp;
                  <strong>Degats :</strong> ${dmgMin} - ${dmgMax}
                  <span class="spellbook-element spellbook-element-${elementClassDetail}">${elementLabel}</span>
                </div>
                <div class="spell-detail-line">
                  <strong>Portee :</strong> ${rangeMin}-${rangeMax}
                </div>
                ${extra}
                ${
                  effectsText
                    ? `<div class="spell-detail-line"><strong>Effets :</strong> ${effectsText}</div>`
                    : ""
                }
                ${
                  spell.description
                    ? `<div class="spell-detail-line">${spell.description}</div>`
                    : ""
                }
              `;
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

    // Selection du sort au clic sur le slot
    slot.addEventListener("click", (event) => {
      event.stopPropagation();

      // Un seul slot selectionne
      slots.forEach((s) => s.classList.remove("selected"));
      slot.classList.add("selected");

      // Sort actif cote joueur
      setActiveSpell(player, spell.id);
    });
  });

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

  window.addEventListener("keydown", (event) => {
    // Evite de capturer les touches quand on tape dans un champ de texte
    const target = event.target;
    if (
      target &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
    ) {
      return;
    }

    const slotIndex = keyToSlot[event.key];
    if (!slotIndex) return;

    const slot = slotByIndex[slotIndex];
    if (!slot || slot.classList.contains("empty")) return;

    // Simule un clic sur le slot pour reutiliser toute la logique existante
    slot.click();
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
