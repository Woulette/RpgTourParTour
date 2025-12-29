import { BACKGROUND_COLOR, GAME_HEIGHT, GAME_WIDTH } from "./config/constants.js";
import { preloadAssets } from "./game/preload/preloadAssets.js";
import { createMainScene } from "./game/scene/createScene.js";
import { initCharacterMenus } from "./features/ui/characterMenus.js";
import { closeAllHudPanels } from "./features/ui/domPanelClose.js";
import { createSessionSwitch } from "./app/sessionSwitch.js";
import {
  getSelectedCharacter,
  setSelectedCharacter,
  setUiApi,
  getUiApi,
} from "./app/session.js";
import { getPlayer } from "./state/store.js";

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

const sessionSwitch = createSessionSwitch({
  destroyGame,
  createGame: () => {
    gameInstance = new Phaser.Game(config);
  },
  closeAllHudPanels,
  setSelectedCharacter,
  getSelectedCharacter,
  getPlayer,
  onEnterMenu: () => {
    document.body.classList.remove("game-running");
    document.body.classList.add("menu-open");
  },
  onEnterGame: () => {
    document.body.classList.add("game-running");
    document.body.classList.remove("menu-open");
  },
});

const returnMenuBtn = document.getElementById("ui-return-menu");
if (returnMenuBtn) {
  returnMenuBtn.addEventListener("click", () => {
    const uiApi = getUiApi();
    if (typeof uiApi?.openMenu === "function") {
      uiApi.openMenu();
      return;
    }
    sessionSwitch.openMenu();
  });
}

const menus = initCharacterMenus({
  onStartGame: (character) => sessionSwitch.startGame(character),
});
setUiApi({
  openMenu: () => {
    sessionSwitch.openMenu();
    if (menus && typeof menus.openMenu === "function") menus.openMenu();
  },
});
