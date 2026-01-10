export const AUTH_MESSAGES = {
  auth_required: "Identifiant et mot de passe requis.",
  auth_failed: "Identifiant ou mot de passe incorrect.",
  account_exists: "Ce compte existe deja.",
  account_missing: "Compte introuvable.",
  account_in_use: "Ce compte est deja connecte.",
  character_owned: "Ce personnage appartient a un autre compte.",
  name_in_use: "Ce nom de personnage est deja pris.",
  character_in_use: "Personnage deja connecte.",
  character_required: "Selectionne un personnage avant de te connecter.",
  room_full: "Serveur plein.",
  server_loading: "Serveur en chargement, reessaie.",
};

export function createAccountHelpers({
  elements,
  getLoginMode,
  setLoginMode,
  getActiveAccount,
}) {
  const {
    screenLoginEl,
    loginIdentifier,
    loginPassword,
    loginPasswordConfirm,
    loginConfirmWrap,
    loginError,
    btnLoginSubmit,
    btnLoginToggle,
  } = elements;

  function loadLanAccount() {
    if (typeof window === "undefined") return null;
    const savedName = localStorage.getItem("lanAccountName") || "";
    const savedPassword = localStorage.getItem("lanAccountPassword") || "";
    const savedToken = localStorage.getItem("lanSessionToken") || "";
    return {
      name: savedName,
      password: savedPassword,
      sessionToken: savedToken || null,
    };
  }

  function saveLanAccount(account, { remember } = {}) {
    if (typeof window === "undefined") return;
    if (!account || remember === false) {
      localStorage.removeItem("lanAccountName");
      localStorage.removeItem("lanAccountPassword");
      localStorage.removeItem("lanSessionToken");
      return;
    }
    localStorage.setItem("lanAccountName", account.name || "");
    localStorage.setItem("lanAccountPassword", account.password || "");
    if (account.sessionToken) {
      localStorage.setItem("lanSessionToken", account.sessionToken);
    }
  }

  function setLoginError(text) {
    loginError.textContent = text || "";
  }

  function applyLoginMode(nextMode) {
    setLoginMode(nextMode === "register" ? "register" : "login");
    loginConfirmWrap.hidden = getLoginMode() !== "register";
    btnLoginSubmit.textContent =
      getLoginMode() === "register" ? "Inscription" : "Connexion";
    btnLoginToggle.textContent =
      getLoginMode() === "register"
        ? "J'ai deja un compte"
        : "Creer un compte";
    const title = screenLoginEl.querySelector(".menu-screen-title");
    if (title) {
      title.textContent =
        getLoginMode() === "register" ? "Inscription" : "Connexion";
    }
  }

  function fillLoginForm(account) {
    if (!account) return;
    loginIdentifier.value = account.name || "";
    loginPassword.value = account.password || "";
    loginPasswordConfirm.value = "";
  }

  function readLoginPayload() {
    const name = String(loginIdentifier.value || "").trim();
    const password = String(loginPassword.value || "");
    const confirm = String(loginPasswordConfirm.value || "");
    if (!name || !password) {
      setLoginError("Identifiant et mot de passe requis.");
      return null;
    }
    if (getLoginMode() === "register" && password !== confirm) {
      setLoginError("Les mots de passe ne correspondent pas.");
      return null;
    }
    const sessionToken =
      getActiveAccount()?.sessionToken || loadLanAccount()?.sessionToken || null;
    return { name, password, sessionToken };
  }

  return {
    loadLanAccount,
    saveLanAccount,
    setLoginError,
    setLoginMode: applyLoginMode,
    fillLoginForm,
    readLoginPayload,
  };
}
