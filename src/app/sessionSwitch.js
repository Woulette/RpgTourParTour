export function createSessionSwitch({
  destroyGame,
  createGame,
  closeAllHudPanels,
  setSelectedCharacter,
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
  if (typeof getPlayer !== "function") {
    throw new Error("createSessionSwitch requires getPlayer");
  }

  const startGame = (character) => {
    setSelectedCharacter(character || null);
    destroyGame();
    if (typeof closeAllHudPanels === "function") {
      closeAllHudPanels();
    }
    createGame();
    if (typeof onEnterGame === "function") onEnterGame();
  };

  const openMenu = () => {
    destroyGame();
    if (typeof onEnterMenu === "function") onEnterMenu();
  };

  return { startGame, openMenu };
}
