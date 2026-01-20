import { classes } from "../../../config/classes.js";
import { on as onStore } from "../../../state/store.js";
import {
  clearSelectedCharacter,
  getSelectedCharacter as getSessionSelectedCharacter,
  getNetPlayerId,
  pushNetEvent,
  setNetClient,
  setNetIsHost,
  setNetPlayerId,
} from "../../../app/session.js";
import { AUTH_MESSAGES, createAccountHelpers } from "./account.js";
import { createLanHelpers } from "./lan.js";
import { CLASS_ORDER, CAROUSEL_ORDER, CLASS_UI } from "./classUi.js";
import { createCarousel } from "./carousel.js";
import { createMenuState } from "./menuState.js";
import { createMenuActions } from "./menuActions.js";
import { createLoginScreen } from "./screens/login.js";
import { createCreateScreen } from "./screens/create.js";
import { createSelectScreen } from "./screens/select.js";
import { createServersScreen } from "./screens/servers.js";

export function initCharacterMenus({ onStartGame, onEnterMenu }) {
  const overlayEl = document.getElementById("menu-overlay");
  const panelEl = overlayEl ? overlayEl.querySelector(".menu-panel") : null;
  const screenLoginEl = document.getElementById("menu-screen-login");
  const screenSelectEl = document.getElementById("menu-screen-select");
  const screenCreateEl = document.getElementById("menu-screen-create");
  const screenServersEl = document.getElementById("menu-screen-servers");

  const characterListEl = document.getElementById("character-list");
  const classListEl = document.getElementById("class-list");
  const serverListEl = document.getElementById("server-list");

  const btnGoCreate = document.getElementById("btn-go-create");
  const btnGoServers = document.getElementById("btn-go-servers");
  const btnLanConnect = document.getElementById("btn-lan-connect");
  const btnPlay = document.getElementById("btn-play");
  const btnBackSelect = document.getElementById("btn-back-select");
  const formCreate = document.getElementById("character-create-form");
  const inputName = document.getElementById("character-name");
  const btnCreate = document.getElementById("btn-create");
  const loginForm = document.getElementById("login-form");
  const loginIdentifier = document.getElementById("login-identifier");
  const loginPassword = document.getElementById("login-password");
  const loginPasswordConfirm = document.getElementById(
    "login-password-confirm"
  );
  const loginConfirmWrap = document.getElementById("login-confirm-wrap");
  const loginRemember = document.getElementById("login-remember");
  const loginError = document.getElementById("login-error");
  const btnLoginSubmit = document.getElementById("btn-login-submit");
  const btnLoginToggle = document.getElementById("btn-login-toggle");
  const btnServersLogout = document.getElementById("btn-servers-logout");
  const btnServersContinue = document.getElementById("btn-servers-continue");

  if (
    !overlayEl ||
    !panelEl ||
    !screenLoginEl ||
    !screenSelectEl ||
    !screenCreateEl ||
    !screenServersEl ||
    !characterListEl ||
    !classListEl ||
    !serverListEl ||
    !btnGoCreate ||
    !btnGoServers ||
    !btnLanConnect ||
    !btnPlay ||
    !btnBackSelect ||
    !formCreate ||
    !inputName ||
    !btnCreate ||
    !loginForm ||
    !loginIdentifier ||
    !loginPassword ||
    !loginPasswordConfirm ||
    !loginConfirmWrap ||
    !loginRemember ||
    !loginError ||
    !btnLoginSubmit ||
    !btnLoginToggle ||
    !btnServersLogout ||
    !btnServersContinue
  ) {
    return null;
  }

  const loadingOverlay = document.createElement("div");
  loadingOverlay.className = "menu-loading-overlay";
  loadingOverlay.hidden = true;
  loadingOverlay.innerHTML = `
    <div class="menu-loading-card">
      <div class="menu-loading-spinner"></div>
      <div class="menu-loading-text">Chargement...</div>
    </div>
  `;
  overlayEl.appendChild(loadingOverlay);
  const loadingTextEl = loadingOverlay.querySelector(".menu-loading-text");
  let pendingLoadingLabel = "Chargement...";

  const choiceOverlay = document.createElement("div");
  choiceOverlay.className = "menu-choice-overlay";
  choiceOverlay.hidden = true;
  choiceOverlay.innerHTML = `
    <div class="menu-choice-card">
      <div class="menu-choice-title">Menu du compte</div>
      <p class="menu-choice-text">
        Que veux-tu faire ?
      </p>
      <div class="menu-choice-actions">
        <button type="button" class="menu-btn menu-btn-primary" data-action="select">
          Selection personnage
        </button>
        <button type="button" class="menu-btn menu-btn-secondary" data-action="servers">
          Serveurs
        </button>
        <button type="button" class="menu-btn menu-btn-secondary" data-action="logout">
          Deconnexion
        </button>
        <button type="button" class="menu-btn" data-action="close">
          Retour au jeu
        </button>
      </div>
    </div>
  `;
  overlayEl.appendChild(choiceOverlay);
  const choiceSelectBtn = choiceOverlay.querySelector("[data-action='select']");
  const choiceServersBtn = choiceOverlay.querySelector("[data-action='servers']");
  const choiceLogoutBtn = choiceOverlay.querySelector("[data-action='logout']");
  const choiceCloseBtn = choiceOverlay.querySelector("[data-action='close']");

  function setLoadingLabel(label) {
    pendingLoadingLabel = label || "Chargement...";
    if (loadingTextEl) loadingTextEl.textContent = pendingLoadingLabel;
  }

  function setMenuLoading(isLoading) {
    loadingOverlay.hidden = !isLoading;
    document.body.classList.toggle("menu-loading", !!isLoading);
    if (isLoading && loadingTextEl) {
      loadingTextEl.textContent = pendingLoadingLabel;
    }
    const buttons = [
      btnServersContinue,
      btnPlay,
      btnCreate,
      btnGoCreate,
      btnGoServers,
      btnLanConnect,
      btnBackSelect,
    ];
    buttons.forEach((button) => {
      if (!button) return;
      if (isLoading) {
        button.dataset.wasDisabled = button.disabled ? "1" : "0";
        button.disabled = true;
        return;
      }
      if (button.dataset.wasDisabled) {
        button.disabled = button.dataset.wasDisabled === "1";
        delete button.dataset.wasDisabled;
      }
    });
  }

  function showChoiceOverlay({ inGame = false } = {}) {
    screenLoginEl.hidden = true;
    screenServersEl.hidden = true;
    screenSelectEl.hidden = true;
    screenCreateEl.hidden = true;
    choiceOverlay.hidden = false;
    document.body.classList.add("menu-choice-open");
    if (inGame) {
      document.body.classList.add("menu-choice-in-game");
    } else {
      document.body.classList.remove("menu-choice-in-game");
    }
    document.body.classList.remove("menu-login");
    document.body.classList.remove("menu-servers");
  }

  function hideChoiceOverlay() {
    choiceOverlay.hidden = true;
    document.body.classList.remove("menu-choice-open");
    document.body.classList.remove("menu-choice-in-game");
  }

  const host =
    typeof window !== "undefined" && window.location
      ? window.location.hostname
      : "localhost";
  const renderHost = "rpgtourpartour.onrender.com";
  const isHttps =
    typeof window !== "undefined" && window.location
      ? window.location.protocol === "https:"
      : false;
  const defaultUrl = host.includes("onrender.com")
    ? `wss://${host}`
    : host.includes("netlify.app") || isHttps
      ? `wss://${renderHost}`
      : `ws://${host}:8080`;
  const SERVERS = [
    {
      id: "local",
      name: "Primorce",
      url: defaultUrl,
      status: "online",
      ping: 12,
      population: "Faible",
      region: "Local",
    },
  ];
  const classUi = CLASS_UI;

  const menuState = createMenuState({
    classes,
    classUi,
    classOrder: CLASS_ORDER,
    carouselOrder: CAROUSEL_ORDER,
  });
  menuState.setSelectedServerId(SERVERS[0]?.id || null);

  const screens = {
    login: null,
    servers: null,
    select: null,
    create: null,
  };

  let createScreen;
  let selectScreen;
  let loginScreen;
  let serversScreen;
  let lan = null;

  const account = createAccountHelpers({
    elements: {
      screenLoginEl,
      loginIdentifier,
      loginPassword,
      loginPasswordConfirm,
      loginConfirmWrap,
      loginError,
      btnLoginSubmit,
      btnLoginToggle,
    },
    getLoginMode: () => menuState.getLoginMode(),
    setLoginMode: (mode) => {
      menuState.setLoginMode(mode);
    },
    getActiveAccount: () => menuState.getActiveAccount(),
  });

  const menuActions = createMenuActions({
    state: menuState,
    getLan: () => lan,
    screens,
    account,
    getSelectedServerUrl,
    getNetPlayerId,
    clearSelectedCharacter,
    onStartGame,
    closeMenu,
    btnPlay,
  });

  const { connection } = menuActions;

  lan = createLanHelpers({
    elements: { btnLanConnect, loginRemember },
    accountHelpers: account,
    authMessages: AUTH_MESSAGES,
    sessionFns: {
      setNetPlayerId,
      setNetClient,
      setNetIsHost,
      pushNetEvent,
      getSessionSelectedCharacter,
    },
    setConnecting: (value) => {
      connection.setConnecting(value);
      setMenuLoading(!!value);
    },
    getCharacters: () => menuState.getCharacters(),
    getSelectedCharacterId: () => menuState.getSelectedCharacterId(),
    setSelectedCharacterId: (id) => {
      menuState.setSelectedCharacterId(id);
    },
    getLanClient: () => connection.getLanClient(),
    setLanClient: (client) => {
      connection.setLanClient(client);
    },
    setLanConnected: (value) => {
      connection.setLanConnected(value);
    },
    setPendingStartCharacter: (value) => {
      connection.setPendingStartCharacter(value);
    },
    getPendingStartCharacter: () => connection.getPendingStartCharacter(),
    setActiveAccount: (value) => {
      menuState.setActiveAccount(value);
      menuState.clearCharactersList();
    },
    onShowSelect: () => screens.select?.showSelect?.(),
    getServerUrl: () => getSelectedServerUrl(),
    onAuthRefused: (reason) => {
      screens.login?.showLogin?.();
      account.setLoginError(
        AUTH_MESSAGES[reason] || `Connexion refusee: ${reason || "unknown"}`
      );
    },
    onStartGameWithCharacter: (character, options) =>
      menuActions.startGameWithCharacter(character, options),
    onAccountCharacters: (list) => {
      menuState.setCharactersFromServer(
        list,
        menuState.normalizeAccountName(menuState.getActiveAccount()?.name)
      );
      if (menuState.getCharacters().length === 0) {
        screens.create?.showCreate?.();
      } else {
        screens.select?.showSelect?.();
      }
      const pendingDelete = connection.getPendingDeleteCharacterId();
      const client = connection.getLanClient();
      if (pendingDelete && client?.sendCmd) {
        connection.setPendingDeleteCharacterId(null);
        client.sendCmd("CmdAccountDeleteCharacter", {
          characterId: pendingDelete,
        });
      }
    },
    onAccountCreateFailed: (reason) => {
      const message =
        reason === "name_in_use"
          ? "Nom deja pris."
          : reason === "invalid_name"
            ? "Nom invalide."
            : "Creation impossible.";
      window.alert(message);
    },
    onAccountDeleteFailed: (reason) => {
      const message =
        reason === "character_in_use"
          ? "Personnage deja connecte."
          : reason === "character_missing"
            ? "Personnage introuvable."
            : "Suppression impossible.";
      window.alert(message);
    },
  });

  const isCreateMode = () => !screenCreateEl.hidden;

  const carousel = createCarousel({
    overlayEl,
    classUi,
    classes,
    getCharacters: () => menuState.getCharacters(),
    getSelectedCharacterId: () => menuState.getSelectedCharacterId(),
    setSelectedCharacterId: (id) => {
      menuState.setSelectedCharacterId(id);
    },
    getSelectedClassId: () => menuState.getSelectedClassId(),
    setSelectedClassId: (id) => {
      menuState.setSelectedClassId(id);
    },
    isCreateMode,
    onSelectCharacter: () => {
      if (selectScreen?.renderCharacters) selectScreen.renderCharacters();
    },
    onCreateClassChange: () => {
      if (createScreen?.renderClasses) createScreen.renderClasses();
      if (createScreen?.syncCreateButton) createScreen.syncCreateButton();
    },
    onStartCharacter: (character) => menuActions.startGameWithCharacter(character),
    setPlayEnabled: (value) => {
      if (btnPlay) btnPlay.disabled = !value;
    },
    initialIds: menuState.getCarouselClassIds(),
    initialOrder: menuState.getCarouselClassIds(),
  });

  function ensureLayout() {
    if (panelEl.classList.contains("menu-v2")) return;
    panelEl.classList.add("menu-v2");

    const main = document.createElement("div");
    main.className = "menu-main";

    const left = document.createElement("div");
    left.className = "menu-left";
    left.appendChild(screenLoginEl);
    left.appendChild(screenServersEl);
    left.appendChild(screenSelectEl);
    left.appendChild(screenCreateEl);

    const center = document.createElement("div");
    center.className = "menu-center";
    center.innerHTML = `
      <div class="menu-preview-stage">
        <div id="menu-preview-carousel" class="menu-preview-carousel" aria-label="Choix de classe"></div>
      </div>
    `;

    const right = document.createElement("div");
    right.className = "menu-right";
    right.innerHTML = `
      <div class="menu-details">
        <h2 id="menu-preview-title" class="menu-preview-title">-</h2>
        <p id="menu-preview-desc" class="menu-preview-desc"></p>
        <ul id="menu-preview-bullets" class="menu-preview-bullets"></ul>
      </div>
    `;

    main.appendChild(left);
    main.appendChild(center);
    main.appendChild(right);

    const footer = document.createElement("div");
    footer.className = "menu-footer";

    const actions = document.createElement("div");
    actions.className = "menu-footer-actions";

    btnCreate.setAttribute("form", "character-create-form");
    btnCreate.type = "submit";

    actions.appendChild(btnBackSelect);
    actions.appendChild(btnGoServers);
    actions.appendChild(btnGoCreate);
    actions.appendChild(btnLanConnect);
    actions.appendChild(btnPlay);
    actions.appendChild(btnCreate);
    footer.appendChild(actions);

    // Supprime les anciens conteneurs d'actions (les boutons ont â‚¬Ã·tâ‚¬Ã· dâ‚¬Ã·placâ‚¬Ã·s).
    panelEl.querySelectorAll(".menu-actions").forEach((el) => el.remove());

    const header = panelEl.querySelector(".menu-header");
    if (header) {
      header.insertAdjacentElement("afterend", main);
      main.insertAdjacentElement("afterend", footer);
    } else {
      panelEl.appendChild(main);
      panelEl.appendChild(footer);
    }

    carousel.ensureCarousel(carousel.getCarouselIds());
    carousel.applyCarouselPositions();
  }

  function getSelectedServerUrl() {
    const server =
      SERVERS.find((s) => s && s.id === menuState.getSelectedServerId()) || null;
    return server?.url || null;
  }

  function connectAccountForListing() {
    setLoadingLabel("Chargement des personnages...");
    menuState.clearCharactersList();
    menuActions.connectAccountForListing();
  }

  function openMenu() {
    const current = getSessionSelectedCharacter() || null;
    if (current && current.id) {
      if (!choiceOverlay.hidden) {
        hideChoiceOverlay();
        return;
      }
      showChoiceOverlay({ inGame: true });
      return;
    }
    document.body.classList.add("menu-open");
    loginScreen.showLogin();
  }

  function closeMenu() {
    document.body.classList.remove("menu-open");
    document.body.classList.remove("menu-login");
    document.body.classList.remove("menu-servers");
    hideChoiceOverlay();
  }

  function logoutToLogin() {
    menuActions.logoutToLogin();
  }

  function startGameWithCharacter(chosen, options = {}) {
    setLoadingLabel("Connexion au monde...");
    menuActions.startGameWithCharacter(chosen, options);
  }

  const state = menuState;
  state.getServers = () => SERVERS;
  state.getSelectedServerUrl = () => getSelectedServerUrl();
  state.getCharactersLength = () => state.getCharacters().length;
  state.getSessionSelectedCharacter = getSessionSelectedCharacter;
  const layout = {
    ensureLayout,
    getDefaultCreateClassId: menuState.getDefaultCreateClassId,
    getCarouselClassIds: menuState.getCarouselClassIds,
    ensureCarousel: carousel.ensureCarousel,
    applyCarouselPositions: carousel.applyCarouselPositions,
    setPreview: carousel.setPreview,
    renderCarouselMeta: carousel.renderCarouselMeta,
    rotateCarouselTo: carousel.rotateCarouselTo,
    buildCarouselIdsForSelect: carousel.buildCarouselIdsForSelect,
    setCarouselIds: carousel.setCarouselIds,
    getCarouselIds: carousel.getCarouselIds,
    setCarouselOrder: carousel.setCarouselOrder,
    getCarouselOrder: carousel.getCarouselOrder,
  };

  loginScreen = createLoginScreen({
    elements: {
      screenLoginEl,
      screenServersEl,
      screenSelectEl,
      screenCreateEl,
      btnBackSelect,
      btnCreate,
      btnGoCreate,
      btnPlay,
      btnLanConnect,
      loginForm,
      btnLoginToggle,
      loginRemember,
    },
    account,
    state,
    actions: {
      showCreate: () => createScreen.showCreate(),
      showServers: () => serversScreen.showServers(),
      connectLan: lan.connectLan,
      setLanButtonLabel: lan.setLanButtonLabel,
    },
    ensureLayout,
  });

  createScreen = createCreateScreen({
    elements: {
      screenLoginEl,
      screenServersEl,
      screenSelectEl,
      screenCreateEl,
      btnBackSelect,
      btnCreate,
      btnGoCreate,
      btnPlay,
      btnLanConnect,
      formCreate,
      inputName,
      classListEl,
    },
    classes,
    classUi,
    state,
    layout: {
      ...layout,
      setCarouselIds: layout.setCarouselIds,
      setCarouselOrder: layout.setCarouselOrder,
    },
    actions: {
      showLogin: () => loginScreen.showLogin(),
      showSelect: () => selectScreen.showSelect(),
      createCharacter: ({ name, classId }) => {
        const client = connection.getLanClient();
        if (!client || !client.sendCmd) return;
        client.sendCmd("CmdAccountCreateCharacter", {
          name,
          classId,
        });
      },
    },
  });

  serversScreen = createServersScreen({
    elements: {
      screenLoginEl,
      screenServersEl,
      screenSelectEl,
      screenCreateEl,
      btnServersLogout,
      btnServersContinue,
      serverListEl,
    },
    state,
    actions: {
      showLogin: () => loginScreen.showLogin(),
      showSelect: () => selectScreen.showSelect(),
      showCreate: () => createScreen.showCreate(),
      logoutAccount: () => menuActions.logoutToLogin(),
      connectAccount: () => menuActions.connectAccountForListing(),
    },
    ensureLayout,
  });

  selectScreen = createSelectScreen({
    elements: {
      screenLoginEl,
      screenServersEl,
      screenSelectEl,
      screenCreateEl,
      btnBackSelect,
      btnCreate,
      btnGoCreate,
      btnGoServers,
      btnPlay,
      btnLanConnect,
      characterListEl,
    },
    classes,
    state: {
      ...state,
    },
    layout: {
      ...layout,
      setCarouselIds: layout.setCarouselIds,
      setCarouselOrder: layout.setCarouselOrder,
    },
    actions: {
      showLogin: () => loginScreen.showLogin(),
      showCreate: () => createScreen.showCreate(),
      deleteCharacter: (characterId) => {
        const client = connection.getLanClient();
        if (client?.sendCmd) {
          client.sendCmd("CmdAccountDeleteCharacter", { characterId });
          return;
        }
        const activeAccount = menuState.getActiveAccount();
        if (activeAccount?.name) {
          connection.setPendingDeleteCharacterId(characterId);
          lan.connectLan(activeAccount, {
            authMode: menuState.getLoginMode(),
            url: getSelectedServerUrl(),
            requestCharacters: true,
          });
          return;
        }
        loginScreen.showLogin();
      },
      clearSelectedCharacter,
      startGameWithCharacter: menuActions.startGameWithCharacter,
    },
  });

  screens.login = loginScreen;
  screens.servers = serversScreen;
  screens.select = selectScreen;
  screens.create = createScreen;

  menuState.setUiHooks({
    onRenderCharacters: () => selectScreen?.renderCharacters?.(),
    onRenderCarouselMeta: () => carousel.renderCarouselMeta(),
    onShowCreate: () => createScreen?.showCreate?.(),
    onUpdatePlayEnabled: (enabled) => {
      if (btnPlay) btnPlay.disabled = !enabled;
    },
  });

  btnGoCreate.addEventListener("click", () => createScreen.showCreate());
  btnGoServers.addEventListener("click", () => serversScreen.showServers());
  btnBackSelect.addEventListener("click", () => selectScreen.showSelect());
  btnLanConnect.addEventListener("click", () => {
    menuActions.logoutToLogin();
  });

  loginScreen.attachLoginEvents();
  loginScreen.initLoginState();
  createScreen.attachCreateEvents();
  serversScreen.attachServersEvents();

  if (choiceSelectBtn) {
    choiceSelectBtn.addEventListener("click", () => {
      hideChoiceOverlay();
      if (typeof onEnterMenu === "function") onEnterMenu();
      const activeAccount =
        menuState.getActiveAccount() || account.loadLanAccount();
      if (activeAccount?.name) {
        menuState.setActiveAccount(activeAccount);
        connectAccountForListing();
        return;
      }
      loginScreen.showLogin();
    });
  }

  if (choiceServersBtn) {
    choiceServersBtn.addEventListener("click", () => {
      hideChoiceOverlay();
      if (typeof onEnterMenu === "function") onEnterMenu();
      const activeAccount =
        menuState.getActiveAccount() || account.loadLanAccount();
      if (activeAccount?.name) {
        menuState.setActiveAccount(activeAccount);
        serversScreen.showServers();
        return;
      }
      loginScreen.showLogin();
    });
  }

  if (choiceLogoutBtn) {
    choiceLogoutBtn.addEventListener("click", () => {
      hideChoiceOverlay();
      if (typeof onEnterMenu === "function") onEnterMenu();
      menuActions.logoutToLogin();
    });
  }

  if (choiceCloseBtn) {
    choiceCloseBtn.addEventListener("click", () => {
      hideChoiceOverlay();
      closeMenu();
    });
  }

  btnPlay.addEventListener("click", () => {
    const chosen = menuState
      .getCharacters()
      .find((c) => c.id === menuState.getSelectedCharacterId());
    if (!chosen) return;
    startGameWithCharacter(chosen);
  });

  onStore("player:levelup", (payload) => {
    const levelAfter =
      payload?.data?.level ?? payload?.player?.levelState?.niveau ?? null;
    if (!levelAfter || !Number.isFinite(levelAfter)) return;

    const current = getSessionSelectedCharacter() || null;
    const id = current?.id ?? menuState.getSelectedCharacterId();
    if (!id) return;

    const char = menuState.getCharacters().find((c) => c && c.id === id) || null;
    if (!char) return;

    char.level = levelAfter;
    if (current && current.id === id) current.level = levelAfter;
    if (document.body.classList.contains("menu-open")) {
      selectScreen.renderCharacters();
      carousel.renderCarouselMeta();
    }
  });

  openMenu();

  return {
    openMenu,
    closeMenu,
    getCharacters: () => menuState.getCharacters().slice(),
  };
}








