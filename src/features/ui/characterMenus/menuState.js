export function createMenuState({
  classes,
  classUi,
  classOrder,
  carouselOrder,
}) {
  const characters = [];
  let selectedCharacterId = null;
  let selectedClassId = null;
  let loginMode = "login";
  let activeAccount = null;
  let selectedServerId = null;
  let useServerCharacters = true;
  let serverAccountName = null;
  let serverListPending = false;
  let uiHooks = {
    onRenderCharacters: null,
    onRenderCarouselMeta: null,
    onShowCreate: null,
    onUpdatePlayEnabled: null,
  };

  function setUiHooks(next) {
    uiHooks = { ...uiHooks, ...(next || {}) };
  }

  function normalizeAccountName(name) {
    return String(name || "").trim().toLowerCase();
  }

  const getAvailableClassIds = () => classOrder.filter((id) => classes[id]);
  const getCarouselClassIds = () => carouselOrder.filter((id) => classes[id]);

  const getDefaultCreateClassId = () => {
    const ids = getAvailableClassIds();
    const firstPlayable =
      ids.find((id) => classUi[id]?.selectable !== false) || null;
    return firstPlayable || ids[0] || "archer";
  };

  function getSelectedCharacter() {
    return characters.find((c) => c && c.id === selectedCharacterId) || null;
  }

  function refreshMenuLists() {
    if (!document.body.classList.contains("menu-open")) return;
    if (typeof uiHooks.onRenderCharacters === "function") {
      uiHooks.onRenderCharacters();
    }
    if (typeof uiHooks.onRenderCarouselMeta === "function") {
      uiHooks.onRenderCarouselMeta();
    }
  }

  function reloadCharactersForAccount() {
    characters.length = 0;
    selectedCharacterId = null;
    if (typeof uiHooks.onUpdatePlayEnabled === "function") {
      uiHooks.onUpdatePlayEnabled(false);
    }
    refreshMenuLists();
  }

  function clearCharactersList() {
    characters.length = 0;
    selectedCharacterId = null;
    if (typeof uiHooks.onUpdatePlayEnabled === "function") {
      uiHooks.onUpdatePlayEnabled(false);
    }
    refreshMenuLists();
  }

  function setCharactersFromServer(list, accountName) {
    useServerCharacters = true;
    serverListPending = false;
    serverAccountName = normalizeAccountName(accountName);
    characters.length = 0;
    const items = Array.isArray(list) ? list : [];
    items.forEach((entry) => {
      if (!entry || !entry.characterId) return;
      const character = {
        id: entry.characterId,
        name: entry.name || "Joueur",
        classId: entry.classId || "archer",
        level: entry.level ?? 1,
        accountName: accountName || null,
      };
      characters.push(character);
    });
    if (characters.length === 0) {
      if (typeof uiHooks.onShowCreate === "function") {
        uiHooks.onShowCreate();
      }
      return;
    }
    const fallback = characters[0];
    selectedCharacterId = fallback?.id || null;
    if (typeof uiHooks.onUpdatePlayEnabled === "function") {
      uiHooks.onUpdatePlayEnabled(!!selectedCharacterId);
    }
    refreshMenuLists();
  }

  return {
    setUiHooks,
    normalizeAccountName,
    getAvailableClassIds,
    getCarouselClassIds,
    getDefaultCreateClassId,
    reloadCharactersForAccount,
    clearCharactersList,
    setCharactersFromServer,
    getSelectedCharacter,
    getCharacters: () => characters,
    getSelectedCharacterId: () => selectedCharacterId,
    setSelectedCharacterId: (value) => {
      selectedCharacterId = value;
    },
    getSelectedClassId: () => selectedClassId,
    setSelectedClassId: (value) => {
      selectedClassId = value;
    },
    getLoginMode: () => loginMode,
    setLoginMode: (value) => {
      loginMode = value === "register" ? "register" : "login";
    },
    getActiveAccount: () => activeAccount,
    setActiveAccount: (value) => {
      if (!value) {
        activeAccount = null;
        return;
      }
      const current = activeAccount || {};
      const next = { ...value };
      if (current.password && !next.password) {
        next.password = current.password;
      }
      if (current.sessionToken && !next.sessionToken) {
        next.sessionToken = current.sessionToken;
      }
      activeAccount = next;
    },
    getSelectedServerId: () => selectedServerId,
    setSelectedServerId: (value) => {
      selectedServerId = value;
    },
    getUseServerCharacters: () => useServerCharacters,
    setUseServerCharacters: (value) => {
      useServerCharacters = !!value;
    },
    getServerAccountName: () => serverAccountName,
    setServerAccountName: (value) => {
      serverAccountName = value || null;
    },
    getServerListPending: () => serverListPending,
    setServerListPending: (value) => {
      serverListPending = !!value;
    },
  };
}
