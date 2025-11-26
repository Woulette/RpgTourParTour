import { classes } from "../config/classes.js";
import { spells } from "../config/spells.js";
import { setActiveSpell } from "../core/spellSystem.js";

// Initialise la barre de sorts en bas + la fenêtre "grimoire" des sorts.
export function initDomSpells(player) {
  const bar = document.getElementById("hud-spell-bar");
  const spellsButtonEl = document.getElementById("hud-spells-button");
  const spellsPanelEl = document.getElementById("hud-spells-panel");
  const spellsListEl = document.getElementById("hud-spells-list");
  const spellsClassNameEl = document.getElementById("spells-class-name");

  if (!bar || !player) return;

  const classId = player.classId || "archer";
  const classDef = classes[classId] || classes.archer;
  const spellIds = classDef.spells || [];

  const knownSpells = spellIds
    .map((id) => spells[id])
    .filter((s) => !!s);

  // === Grimoire : bouton SORTS + fenêtre ===
  if (spellsButtonEl && spellsPanelEl && spellsListEl) {
    if (spellsClassNameEl) {
      spellsClassNameEl.textContent = classDef.label || classId;
    }

    spellsButtonEl.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = !document.body.classList.contains("hud-spells-open");
      document.body.classList.toggle("hud-spells-open");

      if (willOpen) {
        // Remplir la liste à chaque ouverture
        spellsListEl.innerHTML = "";
        const playerLevel = player.levelState?.niveau ?? 1;

        spellIds.forEach((id) => {
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

          // Texte d'élément pour l'affichage (Air / Terre / Feu / Eau / Neutre)
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

          li.innerHTML = `
            <div class="spellbook-item-main">
              <span class="spellbook-name">${spell.label}</span>
              <span class="spellbook-level">Niv. ${requiredLevel}</span>
            </div>
            <div class="spellbook-item-details">
              <span>PA : ${spell.paCost ?? 0}</span>
              <span>Dégâts : ${dmgMin} - ${dmgMax} (${elementLabel})</span>
              <span>Portée : ${rangeMin}-${rangeMax}</span>
            </div>
          `;

          spellsListEl.appendChild(li);
        });
      }
    });
  }

  // === Barre de sorts (slots en bas du HUD) ===
  const slots = bar.querySelectorAll(".hud-spell-slot");

  // Map index de slot -> élément DOM (pour les raccourcis clavier)
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

    // Sélection du sort au clic sur le slot
    slot.addEventListener("click", (event) => {
      event.stopPropagation();

      // Un seul slot sélectionné
      slots.forEach((s) => s.classList.remove("selected"));
      slot.classList.add("selected");

      // Sort actif côté joueur
      setActiveSpell(player, spell.id);
    });
  });

  // --- Raccourcis clavier pour sélectionner un slot ---
  // Mapping AZERTY : 1/& -> slot 1, 2/é -> slot 2, etc. jusqu'à 8
  const keyToSlot = {
    "&": 1,
    "1": 1,
    "é": 2,
    "2": 2,
    '"': 3,
    "3": 3,
    "'": 4,
    "4": 4,
    "(": 5,
    "5": 5,
    "-": 6,
    "6": 6,
    "è": 7,
    "7": 7,
    "_": 8,
    "8": 8,
  };

  window.addEventListener("keydown", (event) => {
    // Évite de capturer les touches quand on tape dans un champ de texte
    const target = event.target;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
      return;
    }

    const slotIndex = keyToSlot[event.key];
    if (!slotIndex) return;

    const slot = slotByIndex[slotIndex];
    if (!slot || slot.classList.contains("empty")) return;

    // Simule un clic sur le slot pour réutiliser toute la logique existante
    slot.click();
  });
}

