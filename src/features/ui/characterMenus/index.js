import { classes } from "../../../config/classes.js";
import { on as onStore } from "../../../state/store.js";
import {
  deleteCharacter,
  listCharacterMetas,
  upsertCharacterMeta,
} from "../../../save/index.js";
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
import { createLoginScreen } from "./screens/login.js";
import { createCreateScreen } from "./screens/create.js";
import { createSelectScreen } from "./screens/select.js";
import { createServersScreen } from "./screens/servers.js";

export function initCharacterMenus({ onStartGame }) {
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

  const CLASS_ORDER = ["archer", "tank", "mage", "eryon"];
  const CAROUSEL_ORDER = ["archer", "tank", "mage", "eryon"];
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
  const classUi = {
    archer: {
      title: "Archer",
      desc: "Dâ‚¬Ã·gâ‚¬Â«ts â‚¬Ëœ distance, mobilitâ‚¬Ã·.",
      bullets: ["Attaques â‚¬Ëœ distance", "Bon repositionnement", "Jeu safe"],
      previewImage: "assets/animations/animation archer/rotations/south.png",
      selectable: true,
    },
    tank: {
      title: "Tank",
      desc: "Dâ‚¬Ã·gâ‚¬Â«ts au corps â‚¬Ëœ corps, encaisse et contrâ‚¬â€¹le.",
      bullets: ["Corps â‚¬Ëœ corps", "Trâ‚¬â€”s râ‚¬Ã·sistant", "Contrâ‚¬â€¹le de zone"],
      previewImage: "assets/animations/animation tank/rotations/south.png",
      selectable: true,
    },
    mage: {
      title: "Animiste",
      desc: "Magie spirituelle : soutien, capture et invocation.",
      bullets: ["Magie & altâ‚¬Ã·rations", "Capture d'essence", "Invocation capturâ‚¬Ã·e"],
      previewImage: "assets/animations/animations-Animiste/rotations/south.png",
      selectable: true,
    },
    eryon: {
      title: "Eryon",
      desc: "Nouvelle classe en test.",
      bullets: ["Mobilitâ‚¬Ã·", "Dâ‚¬Ã·gâ‚¬Â«ts", "Style Eryon"],
      previewImage: "assets/animations/animations-Eryon/rotations/south.png",
      selectable: true,
    },
  };

  const getAvailableClassIds = () => CLASS_ORDER.filter((id) => classes[id]);
  const getCarouselClassIds = () => CAROUSEL_ORDER.filter((id) => classes[id]);

  const getDefaultCreateClassId = () => {
    const ids = getAvailableClassIds();
    const firstPlayable =
      ids.find((id) => classUi[id]?.selectable !== false) || null;
    return firstPlayable || ids[0] || "archer";
  };

  const characters = [];
  let selectedCharacterId = null;
  let selectedClassId = null;
  let lanClient = null;
  let lanConnected = false;
  let pendingStartCharacter = null;
  let resyncTimer = null;
  let loginMode = "login";
  let activeAccount = null;
  let selectedServerId = SERVERS[0]?.id || null;
  let createScreen;
  let selectScreen;
  let loginScreen;
  let serversScreen;
  let useServerCharacters = false;
  let serverAccountName = null;
  let serverListPending = false;
  let carouselOrder = getCarouselClassIds();
  let carouselIds = getCarouselClassIds();
  const carouselSlotByClassId = new Map();
  const carouselSlotByKey = new Map();

  function normalizeAccountName(name) {
    return String(name || "").trim().toLowerCase();
  }

  function reloadCharactersForAccount(accountName) {
    if (useServerCharacters) {
      return;
    }
    characters.length = 0;
    let metas = [];
    try {
      metas = listCharacterMetas(accountName);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[menu] failed to load saved characters:", err);
    }
    metas.forEach((m) => {
      if (!m || !m.id) return;
      characters.push({
        id: m.id,
        name: m.name || "Joueur",
        classId: m.classId || "archer",
        level: m.level ?? 1,
        accountName: m.accountName || null,
      });
    });
    if (selectedCharacterId) {
      const stillExists = characters.some((c) => c && c.id === selectedCharacterId);
      if (!stillExists) {
        selectedCharacterId = null;
        if (btnPlay) btnPlay.disabled = true;
      }
    }
    if (document.body.classList.contains("menu-open")) {
      if (selectScreen && typeof selectScreen.renderCharacters === "function") {
        selectScreen.renderCharacters();
      }
      if (typeof renderCarouselMeta === "function") {
        renderCarouselMeta();
      }
    }
  }

  function clearCharactersList() {
    characters.length = 0;
    selectedCharacterId = null;
    if (btnPlay) btnPlay.disabled = true;
    if (document.body.classList.contains("menu-open")) {
      if (selectScreen && typeof selectScreen.renderCharacters === "function") {
        selectScreen.renderCharacters();
      }
      if (typeof renderCarouselMeta === "function") {
        renderCarouselMeta();
      }
    }
  }

  function removeLocalCharacterEntry(characterId) {
    if (!characterId) return;
    const index = characters.findIndex((c) => c && c.id === characterId);
    if (index >= 0) {
      characters.splice(index, 1);
    }
    if (selectedCharacterId === characterId) {
      selectedCharacterId = characters[0]?.id || null;
      if (btnPlay) btnPlay.disabled = !selectedCharacterId;
    }
    if (document.body.classList.contains("menu-open")) {
      if (selectScreen && typeof selectScreen.renderCharacters === "function") {
        selectScreen.renderCharacters();
      }
      if (typeof renderCarouselMeta === "function") {
        renderCarouselMeta();
      }
    }
  }

  function setCharactersFromServer(list, accountName) {
    useServerCharacters = true;
    serverListPending = false;
    serverAccountName = normalizeAccountName(accountName);
    const normalizedAccount = serverAccountName || null;
    characters.length = 0;
    const items = Array.isArray(list) ? list : [];
    const serverIds = new Set();
    items.forEach((entry) => {
      if (!entry || !entry.characterId) return;
      serverIds.add(entry.characterId);
      const character = {
        id: entry.characterId,
        name: entry.name || "Joueur",
        classId: entry.classId || "archer",
        level: entry.level ?? 1,
        accountName: accountName || null,
      };
      characters.push(character);
      upsertCharacterMetaForAccount(character);
    });
    if (normalizedAccount) {
      try {
        const localMetas = listCharacterMetas(normalizedAccount);
        localMetas.forEach((meta) => {
          if (!meta?.id) return;
          if (!serverIds.has(meta.id)) {
            deleteCharacter(meta.id);
          }
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[menu] failed to sync local character cache:", err);
      }
    }
    if (characters.length === 0) {
      createScreen?.showCreate?.();
      return;
    }
    const fallback = characters[0];
    selectedCharacterId = fallback?.id || null;
    btnPlay.disabled = !selectedCharacterId;
    selectScreen?.showSelect?.();
  }

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
    getLoginMode: () => loginMode,
    setLoginMode: (mode) => {
      loginMode = mode;
    },
    getActiveAccount: () => activeAccount,
  });

  const lan = createLanHelpers({
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
    getCharacters: () => characters,
    getSelectedCharacterId: () => selectedCharacterId,
    setSelectedCharacterId: (id) => {
      selectedCharacterId = id;
    },
    getLanClient: () => lanClient,
    setLanClient: (client) => {
      lanClient = client;
    },
    setLanConnected: (value) => {
      lanConnected = value;
    },
    setPendingStartCharacter: (value) => {
      pendingStartCharacter = value;
    },
    getPendingStartCharacter: () => pendingStartCharacter,
    setActiveAccount: (value) => {
      activeAccount = value;
      if (useServerCharacters) {
        clearCharactersList();
        return;
      }
      const name = normalizeAccountName(activeAccount?.name);
      reloadCharactersForAccount(name || null);
    },
    onShowSelect: () => selectScreen.showSelect(),
    getServerUrl: () => getSelectedServerUrl(),
    onAuthRefused: () => loginScreen.showLogin(),
    onStartGameWithCharacter: (character, options) =>
      startGameWithCharacter(character, options),
    onAccountCharacters: (list) => {
      setCharactersFromServer(list, normalizeAccountName(activeAccount?.name));
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

  // Mapping index -> position class (comme ton dessin : centre, haut, gauche, droite)
  const POS_CLASSES = ["pos-center", "pos-top", "pos-left", "pos-right"];

  const isCreateMode = () => !screenCreateEl.hidden;

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

    ensureCarousel(carouselIds);
    applyCarouselPositions();
  }

  function ensureCarousel(ids) {
    const container = overlayEl.querySelector("#menu-preview-carousel");
    if (!container) return;
    const nextIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
    const key = nextIds.join("|");
    if (container.dataset.carouselKey === key) return;
    container.dataset.carouselKey = key;

    container.innerHTML = "";
    carouselSlotByClassId.clear();
    carouselSlotByKey.clear();

    nextIds.forEach((classId) => {
      const carouselKey = classId;
      const character =
        characters.find((c) => c && c.id === carouselKey) || null;
      const resolvedClassId = character?.classId || carouselKey;
      const ui = classUi[resolvedClassId] || {};
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "menu-class-slot";
      btn.dataset.classId = resolvedClassId;
      btn.dataset.carouselKey = carouselKey;

      if (character?.id) {
        btn.dataset.characterId = character.id;
        btn.setAttribute(
          "aria-label",
          `${character.name || "Joueur"} - ${ui.title || resolvedClassId}`
        );
      } else {
        btn.setAttribute("aria-label", ui.title || resolvedClassId);
      }

      if (ui.selectable === false) btn.classList.add("is-disabled");

      const img = document.createElement("img");
      img.alt = ui.title || resolvedClassId;
      img.draggable = false;
      img.src = ui.previewImage ? encodeURI(ui.previewImage) : "";
      btn.appendChild(img);

      const label = document.createElement("div");
      label.className = "menu-class-slot-label";
      label.textContent = ui.title || resolvedClassId;
      btn.appendChild(label);

      const sub = document.createElement("div");
      sub.className = "menu-class-slot-sub";
      if (character) {
        const lvl = character.level ?? 1;
        sub.textContent = `${character.name || "Joueur"} - Niv. ${lvl}`;
      }
      btn.appendChild(sub);

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        rotateCarouselTo(carouselKey);

        if (isCreateMode() && classUi[resolvedClassId]?.selectable !== false) {
          selectedClassId = resolvedClassId;
          createScreen.renderClasses();
          createScreen.syncCreateButton();
          return;
        }

        if (!isCreateMode()) {
          const candidate =
            (character && character.id && character) ||
            characters.find((c) => c && c.classId === resolvedClassId) ||
            null;
          if (candidate && candidate.id) {
            selectedCharacterId = candidate.id;
            btnPlay.disabled = false;
            selectScreen.renderCharacters();
            renderCarouselMeta();
            setPreview(candidate.classId || resolvedClassId || "archer", {
              characterName: candidate.name || "Joueur",
            });
          }
        }
      });

      btn.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (isCreateMode()) return;
        if (!character || !character.id) return;
        selectedCharacterId = character.id;
        btnPlay.disabled = false;
        startGameWithCharacter(character);
      });

      carouselSlotByClassId.set(resolvedClassId, btn);
      carouselSlotByKey.set(carouselKey, btn);
      container.appendChild(btn);
    });
  }

  function applyCarouselPositions() {
    const idsForPos = carouselOrder.slice(0, POS_CLASSES.length);

    // Hide all by default
    carouselSlotByKey.forEach((el) => {
      el.hidden = true;
      POS_CLASSES.forEach((cls) => el.classList.remove(cls));
    });

    idsForPos.forEach((id, index) => {
      const el = carouselSlotByKey.get(id) || carouselSlotByClassId.get(id);
      if (!el) return;
      el.hidden = false;
      el.classList.add(POS_CLASSES[index]);
    });
  }

  function rotateCarouselTo(key) {
    if (!key) return;
    const idx = carouselOrder.indexOf(key);
    if (idx < 0) return;

    const candidate = characters.find((c) => c && c.id === key) || null;

    if (idx === 0) {
      if (candidate && candidate.id) {
        selectedCharacterId = candidate.id;
        btnPlay.disabled = false;
        selectScreen.renderCharacters();
        setPreview(candidate.classId || "archer", {
          characterName: candidate.name || "Joueur",
        });
        renderCarouselMeta();
        return;
      }
      setPreview(key);
      renderCarouselMeta();
      return;
    }

    carouselOrder = [...carouselOrder.slice(idx), ...carouselOrder.slice(0, idx)];
    applyCarouselPositions();

    if (candidate && candidate.id) {
      selectedCharacterId = candidate.id;
      btnPlay.disabled = false;
      selectScreen.renderCharacters();
      setPreview(candidate.classId || "archer", {
        characterName: candidate.name || "Joueur",
      });
      renderCarouselMeta();
      return;
    }

    setPreview(key);
    renderCarouselMeta();
  }

  function buildCarouselIdsForSelect() {
    // En selection, on veut pouvoir afficher plusieurs persos de la meme classe.
    // On construit un carousel de 4 vignettes max : [selectionne] + 3 autres.
    const ids = characters.map((c) => c && c.id).filter(Boolean);
    const selectedFirst =
      selectedCharacterId && ids.includes(selectedCharacterId);
    const ordered = selectedFirst
      ? [selectedCharacterId, ...ids.filter((id) => id !== selectedCharacterId)]
      : ids;
    return ordered.slice(0, POS_CLASSES.length);
  }

  function setPreview(classId, { characterName = null } = {}) {
    const ui = classUi[classId] || null;
    const title = overlayEl.querySelector("#menu-preview-title");
    const desc = overlayEl.querySelector("#menu-preview-desc");
    const bullets = overlayEl.querySelector("#menu-preview-bullets");

    const fallbackTitle = classes[classId]?.label || classId || "-";
    const finalTitle =
      characterName && characterName.length > 0
        ? `${characterName} Å¸?" ${ui?.title || fallbackTitle}`
        : ui?.title || fallbackTitle;

    if (title) title.textContent = finalTitle;
    if (desc) desc.textContent = ui?.desc || "";
    if (bullets) {
      bullets.innerHTML = "";
      const lines = Array.isArray(ui?.bullets) ? ui.bullets : [];
      lines.forEach((line) => {
        const li = document.createElement("li");
        li.textContent = line;
        bullets.appendChild(li);
      });
    }
  }

  function getSelectedServerUrl() {
    const server = SERVERS.find((s) => s && s.id === selectedServerId) || null;
    return server?.url || null;
  }

  function getSelectedCharacter() {
    return characters.find((c) => c && c.id === selectedCharacterId) || null;
  }

  function upsertCharacterMetaForAccount(character) {
    upsertCharacterMeta(character, activeAccount?.name || null);
  }

  function renderCarouselMeta() {
    carouselSlotByKey.forEach((btn, key) => {
      const sub = btn.querySelector(".menu-class-slot-sub");
      if (!sub) return;
      const char = characters.find((c) => c && c.id === key) || null;
      if (!char) {
        sub.textContent = "";
        return;
      }
      sub.textContent = `${char.name || "Joueur"} - Niv. ${char.level ?? 1}`;
    });

    if (isCreateMode()) return;
  }

  function connectAccountForListing() {
    if (!getSelectedServerUrl()) {
      serversScreen?.showServers?.();
      return;
    }
    const hasToken = !!activeAccount?.sessionToken;
    if (!activeAccount?.name || (!activeAccount?.password && !hasToken)) {
      loginScreen.showLogin();
      return;
    }
    serverListPending = true;
    const nextAccount = normalizeAccountName(activeAccount?.name);
    lan.connectLan(activeAccount, {
      authMode: loginMode,
      url: getSelectedServerUrl(),
      requestCharacters: true,
    });
  }

  // Hydrate depuis la sauvegarde locale (persistant entre rechargements).
  reloadCharactersForAccount(null);

  function openMenu() {
    document.body.classList.add("menu-open");
    const current = getSessionSelectedCharacter() || null;
    if (current && current.id) {
      const exists = characters.some((c) => c && c.id === current.id);
      if (exists) selectedCharacterId = current.id;
    }
    if (!selectedCharacterId && characters.length > 0) {
      selectedCharacterId = characters[0]?.id || null;
    }
    if (!activeAccount) {
      const saved = account.loadLanAccount();
      if (saved?.name) {
        activeAccount = saved;
      }
    }
    if (activeAccount?.name && useServerCharacters) {
      connectAccountForListing();
      selectScreen.showSelect();
      return;
    }
    if (characters.length > 0) {
      selectScreen.showSelect();
      return;
    }
    if (activeAccount?.name && activeAccount?.password) {
      serversScreen.showServers();
      return;
    }
    loginScreen.showLogin();
  }

  function closeMenu() {
    document.body.classList.remove("menu-open");
    document.body.classList.remove("menu-login");
    document.body.classList.remove("menu-servers");
  }

  function logoutToLogin() {
    if (lanClient) {
      const playerId = getNetPlayerId();
      if (Number.isInteger(playerId) && typeof lanClient.sendCmd === "function") {
        lanClient.sendCmd("CmdLogout", { playerId });
      }
      lanClient.close();
      lanClient = null;
    }
    lanConnected = false;
    pendingStartCharacter = null;
    useServerCharacters = false;
    serverAccountName = null;
    serverListPending = false;
    activeAccount = null;
    account.saveLanAccount(null, { remember: false });
    clearSelectedCharacter();
    clearCharactersList();
    loginScreen.showLogin();
  }

  function startGameWithCharacter(chosen, options = {}) {
    if (!chosen) return;
    if (!getSelectedServerUrl()) {
      serversScreen.showServers();
      return;
    }
    const netPlayerId = getNetPlayerId();
    if (!options.skipLan && lanConnected && !Number.isInteger(netPlayerId)) {
      pendingStartCharacter = chosen;
      if (lanClient?.sendCmd) {
        lanClient.sendCmd("CmdAccountSelectCharacter", {
          characterId: chosen.id,
          inventoryAuthority: true,
        });
      }
      return;
    }
    if (!options.skipLan && !lanConnected) {
      pendingStartCharacter = chosen;
      if (activeAccount?.name && activeAccount?.password) {
        lan.connectLan(activeAccount, {
          authMode: loginMode,
          url: getSelectedServerUrl(),
        });
      } else {
        loginScreen.showLogin();
      }
      return;
    }
    upsertCharacterMetaForAccount(chosen);
    closeMenu();
    if (typeof onStartGame === "function") onStartGame(chosen);
    if (lanConnected && lanClient?.sendCmd) {
      if (resyncTimer) {
        clearTimeout(resyncTimer);
        resyncTimer = null;
      }
      let attempts = 0;
      const maxAttempts = 20;
      const tryResync = () => {
        attempts += 1;
        const playerId = getNetPlayerId();
        const scene = typeof window !== "undefined" ? window.__scene : null;
        const mapReady = !!(scene?.map && scene?.groundLayer?.layer);
        if (Number.isInteger(playerId) && mapReady) {
          lanClient.sendCmd("CmdMapResync", {
            playerId,
            mapId: scene.currentMapKey || scene.currentMapDef?.key || null,
          });
          lanClient.sendCmd("CmdCombatResync", {
            playerId,
          });
          if (typeof window !== "undefined") {
            window.__lanLastResyncSentAt = Date.now();
            window.__lanLastResyncPlayerId = playerId ?? null;
          }
          resyncTimer = null;
          return;
        }
        if (attempts < maxAttempts) {
          resyncTimer = setTimeout(tryResync, 200);
        } else {
          resyncTimer = null;
        }
      };
      resyncTimer = setTimeout(tryResync, 200);
    }
  }

  const state = {
    getActiveAccount: () => activeAccount,
    setActiveAccount: (value) => {
      activeAccount = value;
      if (useServerCharacters) {
        clearCharactersList();
        return;
      }
      const name = normalizeAccountName(activeAccount?.name);
      reloadCharactersForAccount(name || null);
    },
    getLoginMode: () => loginMode,
    getCharactersLength: () => characters.length,
    getServers: () => SERVERS,
    getSelectedServerId: () => selectedServerId,
    setSelectedServerId: (value) => {
      selectedServerId = value;
    },
    getSelectedServerUrl: () => getSelectedServerUrl(),
    getCharacters: () => characters,
    getSelectedCharacterId: () => selectedCharacterId,
    setSelectedCharacterId: (value) => {
      selectedCharacterId = value;
    },
    getSelectedClassId: () => selectedClassId,
    setSelectedClassId: (value) => {
      selectedClassId = value;
    },
    getSelectedCharacter: () => getSelectedCharacter(),
    getSessionSelectedCharacter,
    getAvailableClassIds,
  };

  const layout = {
    ensureLayout,
    getDefaultCreateClassId,
    getCarouselClassIds,
    ensureCarousel,
    applyCarouselPositions,
    setPreview,
    renderCarouselMeta,
    rotateCarouselTo,
    buildCarouselIdsForSelect,
    setCarouselIds: (ids) => {
      carouselIds = ids;
    },
    getCarouselIds: () => carouselIds,
    setCarouselOrder: (order) => {
      carouselOrder = order;
    },
    getCarouselOrder: () => carouselOrder,
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
      upsertCharacterMeta: (character) => upsertCharacterMetaForAccount(character),
      createCharacter: ({ name, classId }) => {
        if (!lanClient || !lanClient.sendCmd) return;
        lanClient.sendCmd("CmdAccountCreateCharacter", {
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
      logoutAccount: () => logoutToLogin(),
      connectAccount: () => connectAccountForListing(),
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
        if (lanClient?.sendCmd) {
          lanClient.sendCmd("CmdAccountDeleteCharacter", { characterId });
          deleteCharacter(characterId);
          removeLocalCharacterEntry(characterId);
          return;
        }
        deleteCharacter(characterId);
        removeLocalCharacterEntry(characterId);
      },
      clearSelectedCharacter,
      startGameWithCharacter,
    },
  });

  btnGoCreate.addEventListener("click", () => createScreen.showCreate());
  btnGoServers.addEventListener("click", () => serversScreen.showServers());
  btnBackSelect.addEventListener("click", () => selectScreen.showSelect());
  btnLanConnect.addEventListener("click", () => {
    if (lanClient) {
      const playerId = getNetPlayerId();
      if (Number.isInteger(playerId) && typeof lanClient.sendCmd === "function") {
        lanClient.sendCmd("CmdLogout", { playerId });
      }
      lanClient.close();
      lanClient = null;
    }
    lanConnected = false;
    loginScreen.showLogin();
  });

  loginScreen.attachLoginEvents();
  loginScreen.initLoginState();
  createScreen.attachCreateEvents();
  serversScreen.attachServersEvents();

  btnPlay.addEventListener("click", () => {
    const chosen = characters.find((c) => c.id === selectedCharacterId);
    if (!chosen) return;
    startGameWithCharacter(chosen);
  });

  onStore("player:levelup", (payload) => {
    const levelAfter =
      payload?.data?.level ?? payload?.player?.levelState?.niveau ?? null;
    if (!levelAfter || !Number.isFinite(levelAfter)) return;

    const current = getSessionSelectedCharacter() || null;
    const id = current?.id ?? selectedCharacterId;
    if (!id) return;

    const char = characters.find((c) => c && c.id === id) || null;
    if (!char) return;

    char.level = levelAfter;
    if (current && current.id === id) current.level = levelAfter;
    upsertCharacterMetaForAccount(char);

    if (document.body.classList.contains("menu-open")) {
      selectScreen.renderCharacters();
      renderCarouselMeta();
    }
  });

  openMenu();

  return {
    openMenu,
    closeMenu,
    getCharacters: () => characters.slice(),
  };
}
