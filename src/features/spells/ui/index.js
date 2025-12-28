import { classes } from "../../../config/classes.js";
import { spells } from "../../../config/spells.js";
import { initSpellBook } from "./spellBook.js";
import { initSpellBar } from "./spellBar.js";
import { getPlayer, on as onStoreEvent } from "../../../state/store.js";

// Initialise la barre de sorts en bas + la fenetre grimoire des sorts.
export function initDomSpells(player) {
  const bar = document.getElementById("hud-spell-bar");
  const spellsButtonEl = document.getElementById("hud-spells-button");
  const spellsPanelEl = document.getElementById("hud-spells-panel");
  const spellsListEl = document.getElementById("hud-spells-list");
  const spellsClassNameEl = document.getElementById("spells-class-name");
  const spellsDetailEl = document.getElementById("hud-spell-detail");
  const tierButtons = document.querySelectorAll(".spells-tier-label");

  if (!bar) return;

  let currentPlayer = getPlayer() || player || null;
  const getActivePlayer = () => getPlayer() || currentPlayer;

  const resolveSpellConfig = (currentPlayer) => {
    const classId = currentPlayer?.classId || "archer";
    const classDef = classes[classId] || classes.archer;
    const spellIds = classDef.spells || [];
    const knownSpells = spellIds.map((id) => spells[id]).filter((s) => !!s);
    return { classId, classDef, spellIds, knownSpells };
  };

  const initialConfig = resolveSpellConfig(getActivePlayer());

  const spellBook = initSpellBook({
    getPlayer: getActivePlayer,
    classDef: initialConfig.classDef,
    classId: initialConfig.classId,
    spellIds: initialConfig.spellIds,
    spellsButtonEl,
    spellsPanelEl,
    spellsListEl,
    spellsClassNameEl,
    spellsDetailEl,
    tierButtons,
  });

  const spellBar = initSpellBar(getActivePlayer, bar, initialConfig.knownSpells);

  onStoreEvent("player:changed", (nextPlayer) => {
    currentPlayer = nextPlayer || currentPlayer;
    const active = getActivePlayer();
    if (!active) return;
    const config = resolveSpellConfig(active);
    if (spellBook && typeof spellBook.setSpellBookConfig === "function") {
      spellBook.setSpellBookConfig(config);
    }
    if (spellBar && typeof spellBar.setKnownSpells === "function") {
      spellBar.setKnownSpells(config.knownSpells);
    }
  });
}
