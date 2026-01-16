export function createLoginScreen({
  elements,
  account,
  state,
  actions,
  ensureLayout,
}) {
  const {
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
  } = elements;

  function showLogin() {
    ensureLayout();
    screenLoginEl.hidden = false;
    screenServersEl.hidden = true;
    screenSelectEl.hidden = true;
    screenCreateEl.hidden = true;
    document.body.classList.add("menu-open");
    document.body.classList.add("menu-login");
    document.body.classList.remove("menu-servers");

    btnBackSelect.hidden = true;
    btnCreate.hidden = true;
    btnGoCreate.hidden = true;
    btnPlay.hidden = true;
    btnLanConnect.hidden = true;

    account.setLoginError("");
    account.setLoginMode("login");
    const saved = state.getActiveAccount() || account.loadLanAccount();
    if (saved && saved.name) {
      state.setActiveAccount(saved);
      account.fillLoginForm(saved);
      loginRemember.checked = true;
    }
  }

  function submitLogin() {
    const payload = account.readLoginPayload();
    if (!payload) return;
    state.setActiveAccount(payload);
    account.saveLanAccount(payload, { remember: loginRemember.checked });
    account.setLoginError("");
    actions.showServers();
  }

  function initLoginState() {
    const savedAccount = account.loadLanAccount();
    if (savedAccount?.name) {
      state.setActiveAccount(savedAccount);
      account.fillLoginForm(savedAccount);
      loginRemember.checked = true;
    } else {
      loginRemember.checked = false;
    }
    account.setLoginMode("login");
    actions.setLanButtonLabel("Compte");
  }

  function attachLoginEvents() {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitLogin();
    });
    btnLoginToggle.addEventListener("click", () => {
      const next = state.getLoginMode() === "login" ? "register" : "login";
      account.setLoginMode(next);
      account.setLoginError("");
    });
  }

  return {
    showLogin,
    submitLogin,
    initLoginState,
    attachLoginEvents,
  };
}
