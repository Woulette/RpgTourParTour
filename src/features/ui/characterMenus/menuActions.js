export function createMenuActions({
  state,
  getLan,
  screens,
  account,
  getSelectedServerUrl,
  getNetPlayerId,
  clearSelectedCharacter,
  onStartGame,
  closeMenu,
  btnPlay,
}) {
  let lanClient = null;
  let lanConnected = false;
  let pendingStartCharacter = null;
  let pendingDeleteCharacterId = null;
  let isConnecting = false;
  let resyncTimer = null;

  const connection = {
    getLanClient: () => lanClient,
    setLanClient: (client) => {
      lanClient = client;
    },
    getLanConnected: () => lanConnected,
    setLanConnected: (value) => {
      lanConnected = !!value;
    },
    getPendingStartCharacter: () => pendingStartCharacter,
    setPendingStartCharacter: (value) => {
      pendingStartCharacter = value;
    },
    getPendingDeleteCharacterId: () => pendingDeleteCharacterId,
    setPendingDeleteCharacterId: (value) => {
      pendingDeleteCharacterId = value;
    },
    getIsConnecting: () => isConnecting,
    setConnecting: (value) => {
      isConnecting = !!value;
      if (btnPlay) btnPlay.disabled = isConnecting || !state.getSelectedCharacterId();
    },
    getResyncTimer: () => resyncTimer,
    setResyncTimer: (value) => {
      resyncTimer = value;
    },
  };

  function connectAccountForListing() {
    const lan = typeof getLan === "function" ? getLan() : null;
    if (!lan) return;
    if (!getSelectedServerUrl()) {
      screens?.servers?.showServers?.();
      return;
    }
    const activeAccount = state.getActiveAccount();
    const hasToken = !!activeAccount?.sessionToken;
    if (!activeAccount?.name || (!activeAccount?.password && !hasToken)) {
      screens?.login?.showLogin?.();
      return;
    }
    if (typeof state.setUseServerCharacters === "function") {
      state.setUseServerCharacters(true);
    }
    state.setServerListPending(true);
    const nextAccount = state.normalizeAccountName(activeAccount?.name);
    state.setServerAccountName(nextAccount || null);
    lan.connectLan(activeAccount, {
      authMode: state.getLoginMode(),
      url: getSelectedServerUrl(),
      requestCharacters: true,
    });
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
    pendingDeleteCharacterId = null;
    state.setServerAccountName(null);
    state.setServerListPending(false);
    state.setActiveAccount(null);
    account.saveLanAccount(null, { remember: false });
    clearSelectedCharacter();
    state.clearCharactersList();
    screens?.login?.showLogin?.();
  }

  function startGameWithCharacter(chosen, options = {}) {
    if (!chosen) return;
    const lan = typeof getLan === "function" ? getLan() : null;
    if (isConnecting && !options.force) {
      pendingStartCharacter = chosen;
      if (chosen.id) {
        state.setSelectedCharacterId(chosen.id);
      }
      if (btnPlay) btnPlay.disabled = true;
      return;
    }
    if (chosen.id) {
      state.setSelectedCharacterId(chosen.id);
      if (btnPlay) btnPlay.disabled = false;
    }
    if (!getSelectedServerUrl()) {
      screens?.servers?.showServers?.();
      return;
    }
    const netPlayerId = getNetPlayerId();
    if (!options.skipLan && lanConnected && !Number.isInteger(netPlayerId)) {
      isConnecting = true;
      if (btnPlay) btnPlay.disabled = true;
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
      if (isConnecting) {
        pendingStartCharacter = chosen;
        if (chosen.id) {
          state.setSelectedCharacterId(chosen.id);
        }
        if (btnPlay) btnPlay.disabled = true;
        return;
      }
      pendingStartCharacter = chosen;
      const activeAccount = state.getActiveAccount();
      const hasToken = !!activeAccount?.sessionToken;
      if (activeAccount?.name && (activeAccount?.password || hasToken)) {
        lan.connectLan(activeAccount, {
          authMode: state.getLoginMode(),
          url: getSelectedServerUrl(),
          character: chosen,
        });
      } else {
        screens?.login?.showLogin?.();
      }
      return;
    }
    if (typeof closeMenu === "function") closeMenu();
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

  return {
    connection,
    connectAccountForListing,
    logoutToLogin,
    startGameWithCharacter,
  };
}
