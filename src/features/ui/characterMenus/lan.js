import { createLanClient } from "../../../net/lanClient.js";

export function createLanHelpers({
  elements,
  accountHelpers,
  authMessages,
  sessionFns,
  setConnecting,
  getCharacters,
  getSelectedCharacterId,
  setSelectedCharacterId,
  getLanClient,
  setLanClient,
  setLanConnected,
  setPendingStartCharacter,
  getPendingStartCharacter,
  setActiveAccount,
  getServerUrl,
  onShowSelect,
  onStartGameWithCharacter,
  onAuthRefused,
  onAccountCharacters,
  onAccountCreateFailed,
  onAccountDeleteFailed,
}) {
  const { btnLanConnect, loginRemember } = elements;
  const { setLoginError, saveLanAccount, loadLanAccount } = accountHelpers;

  function setLanButtonLabel(label) {
    if (!btnLanConnect) return;
    btnLanConnect.textContent = label;
  }

  function connectLan(
    account,
    { authMode, url, requestCharacters, character } = {}
  ) {
    if (typeof setConnecting === "function") setConnecting(true);
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
    const serverUrl =
      url || (typeof getServerUrl === "function" ? getServerUrl() : null) || defaultUrl;
    if (!serverUrl) {
      setLanButtonLabel("Compte");
      if (typeof setConnecting === "function") setConnecting(false);
      return;
    }
    const existing = getLanClient();
    if (existing) {
      existing.close();
      setLanClient(null);
    }
    setLanButtonLabel("Compte: ...");
    const hasToken = !!account?.sessionToken;
    if (!account || !account.name || (!account.password && !hasToken)) {
      setLanButtonLabel("Compte");
      if (typeof setConnecting === "function") setConnecting(false);
      return;
    }
    let selected = null;
    if (requestCharacters !== true) {
      if (character && character.id) {
        selected = character;
      } else {
        const characters = getCharacters();
        selected =
          characters.find((c) => c && c.id === getSelectedCharacterId()) ||
          sessionFns.getSessionSelectedCharacter?.() ||
          characters[0] ||
          null;
      }
      if (selected?.id && !getSelectedCharacterId()) {
        setSelectedCharacterId(selected.id);
      }
      if (!selected || !selected.id) {
        setLoginError("Cree un personnage avant de te connecter.");
        setLanButtonLabel("Compte");
        if (typeof setConnecting === "function") setConnecting(false);
        return;
      }
    }
    const client = createLanClient({
      url: serverUrl,
      character: selected,
      account,
      authMode,
      requestCharacters: requestCharacters === true,
      onEvent: (msg) => {
        if (typeof window !== "undefined") {
          window.__lanLastEvent = msg;
          const history = Array.isArray(window.__lanEventHistory)
            ? window.__lanEventHistory
            : [];
          history.push({
            t: msg?.t,
            eventId: msg?.eventId ?? null,
            combatId: msg?.combatId ?? msg?.combat?.combatId ?? null,
          });
          if (history.length > 50) history.shift();
          window.__lanEventHistory = history;
        }
        if (msg?.t === "EvAccountCharacters") {
          setLanConnected(true);
          setActiveAccount(account);
          if (typeof setConnecting === "function") setConnecting(false);
          if (msg.sessionToken && typeof window !== "undefined") {
            account.sessionToken = msg.sessionToken;
          }
          saveLanAccount(account, { remember: loginRemember.checked });
          setLoginError("");
          if (typeof onAccountCharacters === "function") {
            onAccountCharacters(msg.characters || []);
          }
          const combatEntry = Array.isArray(msg.characters)
            ? msg.characters.find((entry) => entry && entry.inCombat === true)
            : null;
          if (typeof window !== "undefined" && window.localStorage) {
            try {
              if (combatEntry) {
                window.localStorage.setItem("andemia_combat_reconnect", "1");
              } else {
                window.localStorage.removeItem("andemia_combat_reconnect");
              }
            } catch (err) {
              // ignore storage failures (private mode, blocked storage)
            }
          }
          if (combatEntry && !getPendingStartCharacter()) {
            const targetId = combatEntry.characterId || combatEntry.id || null;
            if (targetId) {
              const characters = getCharacters();
              const localMatch = characters.find((c) => c && c.id === targetId) || {
                id: targetId,
                name: combatEntry.name || "Joueur",
                classId: combatEntry.classId || "archer",
                level: combatEntry.level ?? 1,
              };
              setSelectedCharacterId(localMatch.id);
              setPendingStartCharacter(localMatch);
              onStartGameWithCharacter(localMatch);
              return;
            }
          }
          setLanButtonLabel("Compte: OK");
          return;
        }
        if (msg?.t === "EvAccountCreateFailed") {
          const reason = msg?.reason || "unknown";
          if (typeof onAccountCreateFailed === "function") {
            onAccountCreateFailed(reason);
          }
          return;
        }
        if (msg?.t === "EvAccountDeleteFailed") {
          const reason = msg?.reason || "unknown";
          if (typeof onAccountDeleteFailed === "function") {
            onAccountDeleteFailed(reason);
          }
          return;
        }
        if (msg?.t === "EvWelcome") {
          sessionFns.setNetPlayerId(msg.playerId);
          sessionFns.setNetClient(client);
          sessionFns.setNetIsHost(!!msg.isHost);
          setLanConnected(true);
          setActiveAccount(account);
          if (typeof setConnecting === "function") setConnecting(false);
          if (msg.sessionToken && typeof window !== "undefined") {
            account.sessionToken = msg.sessionToken;
          }
          saveLanAccount(account, { remember: loginRemember.checked });
          setLoginError("");
        }
        sessionFns.pushNetEvent(msg);
        if (msg?.t === "EvWelcome") {
          setLanButtonLabel("Compte: OK");
          const pending = getPendingStartCharacter();
          if (pending) {
            setPendingStartCharacter(null);
            onStartGameWithCharacter(pending, { skipLan: true });
            return;
          }
          onShowSelect();
        } else if (msg?.t === "EvRefuse") {
          setLanButtonLabel("Compte: KO");
          setLanConnected(false);
          setPendingStartCharacter(null);
          if (typeof setConnecting === "function") setConnecting(false);
          const reason = msg?.reason || "unknown";
          if (typeof onAuthRefused === "function") onAuthRefused(reason);
          setLoginError(authMessages[reason] || `Connexion refusee: ${reason}`);
        }
      },
      onClose: () => {
        sessionFns.setNetPlayerId(null);
        sessionFns.setNetClient(null);
        sessionFns.setNetIsHost(false);
        setLanConnected(false);
        setPendingStartCharacter(null);
        if (typeof setConnecting === "function") setConnecting(false);
        if (typeof window !== "undefined") {
          window.__lanLastEvent = null;
          window.__lanClient = null;
        }
        setLanClient(null);
        setLanButtonLabel("Compte");
      },
    });
    setLanClient(client);
    if (typeof window !== "undefined") {
      window.__lanClient = client;
    }
  }

  function ensureAccountFromStorage() {
    const saved = loadLanAccount();
    if (saved?.name) {
      return saved;
    }
    return null;
  }

  return {
    connectLan,
    setLanButtonLabel,
    ensureAccountFromStorage,
  };
}
