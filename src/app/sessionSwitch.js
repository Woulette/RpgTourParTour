import { buildSnapshotFromPlayer, saveCharacterSnapshot } from "../save/index.js";

function saveCurrentPlayerSnapshot({ getPlayer, getSelectedCharacter }) {
  try {
    const player = getPlayer();
    const characterId =
      player?.characterId || getSelectedCharacter()?.id || null;
    if (!player || !characterId) return;
    const snap = buildSnapshotFromPlayer(player);
    if (snap) saveCharacterSnapshot(characterId, snap);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[save] failed to save before switch:", err);
  }
}

export function createSessionSwitch({
  destroyGame,
  createGame,
  closeAllHudPanels,
  setSelectedCharacter,
  getSelectedCharacter,
  getPlayer,
  onEnterMenu,
  onEnterGame,
}) {
  if (typeof destroyGame !== "function") {
    throw new Error("createSessionSwitch requires destroyGame");
  }
  if (typeof createGame !== "function") {
    throw new Error("createSessionSwitch requires createGame");
  }
  if (typeof setSelectedCharacter !== "function") {
    throw new Error("createSessionSwitch requires setSelectedCharacter");
  }
  if (typeof getSelectedCharacter !== "function") {
    throw new Error("createSessionSwitch requires getSelectedCharacter");
  }
  if (typeof getPlayer !== "function") {
    throw new Error("createSessionSwitch requires getPlayer");
  }

  const saveSnapshot = () =>
    saveCurrentPlayerSnapshot({ getPlayer, getSelectedCharacter });

  const startGame = (character) => {
    saveSnapshot();
    setSelectedCharacter(character || null);
    destroyGame();
    if (typeof closeAllHudPanels === "function") {
      closeAllHudPanels();
    }
    createGame();
    if (typeof onEnterGame === "function") onEnterGame();
  };

  const openMenu = () => {
    saveSnapshot();
    destroyGame();
    if (typeof onEnterMenu === "function") onEnterMenu();
  };

  return { startGame, openMenu };
}
