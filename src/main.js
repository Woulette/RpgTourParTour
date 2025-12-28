import { BACKGROUND_COLOR, GAME_HEIGHT, GAME_WIDTH } from "./config/constants.js";
import { preloadAssets } from "./game/preload/preloadAssets.js";
import { createMainScene } from "./game/scene/createScene.js";
import { initCharacterMenus } from "./features/ui/characterMenus.js";
import { closeAllHudPanels } from "./features/ui/domPanelClose.js";
import {
  getSelectedCharacter,
  setSelectedCharacter,
  setUiApi,
  getUiApi,
} from "./app/session.js";
import { getPlayer } from "./state/store.js";
import { buildSnapshotFromPlayer, saveCharacterSnapshot } from "./save/index.js";

class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
  }

  preload() {
    preloadAssets(this);
  }

  create() {
    createMainScene(this);
  }
}

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: BACKGROUND_COLOR,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scene: [MainScene],
};

let gameInstance = null;

function destroyGame() {
  if (!gameInstance) return;
  try {
    gameInstance.destroy(true);
  } finally {
    gameInstance = null;
  }
}

function startGame(character) {
  setSelectedCharacter(character || null);
  destroyGame();
  closeAllHudPanels();
  gameInstance = new Phaser.Game(config);
  document.body.classList.add("game-running");
  document.body.classList.remove("menu-open");
}

function openMenu() {
  try {
    const player = getPlayer();
    const characterId =
      player?.characterId || getSelectedCharacter()?.id || null;
    if (player && characterId) {
      const snap = buildSnapshotFromPlayer(player);
      if (snap) saveCharacterSnapshot(characterId, snap);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[save] failed to save before menu:", err);
  }
  destroyGame();
  document.body.classList.remove("game-running");
  document.body.classList.add("menu-open");
}

const returnMenuBtn = document.getElementById("ui-return-menu");
if (returnMenuBtn) {
  returnMenuBtn.addEventListener("click", () => {
    const uiApi = getUiApi();
    if (typeof uiApi?.openMenu === "function") {
      uiApi.openMenu();
      return;
    }
    openMenu();
  });
}

const menus = initCharacterMenus({
  onStartGame: (character) => startGame(character),
});
setUiApi({
  openMenu: () => {
    openMenu();
    if (menus && typeof menus.openMenu === "function") menus.openMenu();
  },
});
