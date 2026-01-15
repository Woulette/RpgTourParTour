import { createLanClient } from "../../../net/lanClient.js";

export function createLanHelpers({
  elements,
  accountHelpers,
  authMessages,
  sessionFns,
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
}) {
  const { btnLanConnect, loginRemember } = elements;
  const { setLoginError, saveLanAccount, loadLanAccount } = accountHelpers;

  function setLanButtonLabel(label) {
    if (!btnLanConnect) return;
    btnLanConnect.textContent = label;
  }

  function connectLan(account, { authMode, url } = {}) {
    const host =
      typeof window !== "undefined" && window.location
        ? window.location.hostname
        : "localhost";
    const defaultUrl = `ws://${host}:8080`;
    const serverUrl =
      url || (typeof getServerUrl === "function" ? getServerUrl() : null) || defaultUrl;
    if (!serverUrl) {
      setLanButtonLabel("Compte");
      return;
    }
    const existing = getLanClient();
    if (existing) {
      existing.close();
      setLanClient(null);
    }
    setLanButtonLabel("Compte: ...");
    if (!account || !account.name || !account.password) {
      setLanButtonLabel("Compte");
      return;
    }
    const characters = getCharacters();
    const selected =
      characters.find((c) => c && c.id === getSelectedCharacterId()) ||
      sessionFns.getSessionSelectedCharacter?.() ||
      characters[0] ||
      null;
    if (selected?.id && !getSelectedCharacterId()) {
      setSelectedCharacterId(selected.id);
    }
    if (!selected || !selected.id) {
      setLoginError("Cree un personnage avant de te connecter.");
      setLanButtonLabel("Compte");
      return;
    }
    const client = createLanClient({
      url: serverUrl,
      character: selected,
      account,
      authMode,
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
        if (msg?.t === "EvWelcome") {
          sessionFns.setNetPlayerId(msg.playerId);
          sessionFns.setNetClient(client);
          sessionFns.setNetIsHost(!!msg.isHost);
          setLanConnected(true);
          setActiveAccount(account);
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
          const reason = msg?.reason || "unknown";
          if (typeof onAuthRefused === "function") onAuthRefused();
          setLoginError(authMessages[reason] || `Connexion refusee: ${reason}`);
        }
      },
      onClose: () => {
        sessionFns.setNetPlayerId(null);
        sessionFns.setNetClient(null);
        sessionFns.setNetIsHost(false);
        setLanConnected(false);
        setPendingStartCharacter(null);
        if (typeof window !== "undefined") {
          window.__lanLastEvent = null;
          window.__lanClient = null;
        }
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
    if (saved?.name && saved?.password) {
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
