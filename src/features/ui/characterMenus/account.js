export const AUTH_MESSAGES = {
  auth_required: "Identifiant et mot de passe requis.",
  auth_failed: "Identifiant ou mot de passe incorrect.",
  account_exists: "Ce compte existe deja.",
  account_missing: "Compte introuvable.",
  account_in_use: "Ce compte est deja connecte.",
  auth_mode_invalid: "Mode de connexion invalide.",
  invalid_identifier: "Identifiant invalide.",
  invalid_password: "Mot de passe invalide.",
  auth_rate_limited: "Trop de tentatives. Attends 10 minutes.",
  auth_cooldown: "Attends 2 secondes avant de reessayer.",
  character_owned: "Ce personnage appartient a un autre compte.",
  name_in_use: "Ce nom de personnage est deja pris.",
  character_in_use: "Personnage deja connecte.",
  character_required: "Selectionne un personnage avant de te connecter.",
  character_missing: "Personnage introuvable.",
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
    try {
      const savedName = localStorage.getItem("lanAccountName") || "";
      const savedToken = localStorage.getItem("lanSessionToken") || "";
      return {
        name: savedName,
        password: "",
        sessionToken: savedToken || null,
      };
    } catch (err) {
      return {
        name: "",
        password: "",
        sessionToken: null,
      };
    }
  }

  function saveLanAccount(account, { remember } = {}) {
    if (typeof window === "undefined") return;
    try {
      if (!account || remember === false) {
        localStorage.removeItem("lanAccountName");
        localStorage.removeItem("lanSessionToken");
        return;
      }
      localStorage.setItem("lanAccountName", account.name || "");
      if (account.sessionToken) {
        localStorage.setItem("lanSessionToken", account.sessionToken);
      }
    } catch (err) {
      // ignore storage failures (private mode, blocked storage)
    }
  }

  function setLoginError(text) {
    loginError.textContent = text || "";
  }

  function applyLoginMode(nextMode) {
    setLoginMode(nextMode === "register" ? "register" : "login");
    const isRegister = getLoginMode() === "register";
    loginConfirmWrap.hidden = !isRegister;
    loginConfirmWrap.style.display = isRegister ? "" : "none";
    if (!isRegister) {
      loginPasswordConfirm.value = "";
    }
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
    loginPassword.value = "";
    loginPasswordConfirm.value = "";
  }

  function readLoginPayload() {
    const name = String(loginIdentifier.value || "").trim();
    const password = String(loginPassword.value || "");
    const confirm = String(loginPasswordConfirm.value || "");
    const hasUpper = /[A-Z]/.test(password);
    const hasValidNameChars = /^[a-zA-Z0-9._-]+$/.test(name);
    if (!name || !password) {
      if (!name && !password) {
        setLoginError("Identifiant et mot de passe requis.");
      } else if (!name) {
        setLoginError("Identifiant requis.");
      } else {
        setLoginError("Mot de passe requis.");
      }
      return null;
    }
    if (name.length < 6 || name.length > 20 || !hasValidNameChars) {
      setLoginError("Identifiant invalide (6-20, lettres/chiffres/._-).");
      return null;
    }
    if (password.length < 8 || password.length > 64 || !hasUpper) {
      setLoginError("Mot de passe invalide (8-64, 1 majuscule).");
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
