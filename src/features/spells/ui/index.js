import { classes } from "../../../config/classes.js";
import { spells } from "../../../config/spells.js";
import { initSpellBook } from "./spellBook.js";
import { initSpellBar } from "./spellBar.js";

// Initialise la barre de sorts en bas + la fenetre grimoire des sorts.
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

  const knownSpells = spellIds.map((id) => spells[id]).filter((s) => !!s);

  initSpellBook({
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
  });

  initSpellBar(player, bar, knownSpells);
}
