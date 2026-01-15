export function initDomFriends() {
  const buttonEl = document.getElementById("hud-friends-button");
  const panelEl = document.getElementById("hud-friends-panel");
  const closeBtn = panelEl ? panelEl.querySelector(".friends-close") : null;

  if (!buttonEl || !panelEl) return;

  const toggleOpen = () => {
    document.body.classList.toggle("hud-friends-open");
  };

  buttonEl.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleOpen();
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      document.body.classList.remove("hud-friends-open");
    });
  }

  const tabs = Array.from(panelEl.querySelectorAll(".friends-tab"));
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab");
      if (!target) return;
      tabs.forEach((btn) => {
        btn.classList.toggle("is-active", btn === tab);
      });
    });
  });
}
