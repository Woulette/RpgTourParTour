import { on as onStoreEvent } from "../../state/store.js";
import { openFriendActions } from "./domFriendActions.js";
import { getNetClient, getNetPlayerId } from "../../app/session.js";
import { showToast } from "./domToasts.js";

export function initDomFriends() {
  const buttonEl = document.getElementById("hud-friends-button");
  const panelEl = document.getElementById("hud-friends-panel");
  const closeBtn = panelEl ? panelEl.querySelector(".friends-close") : null;

  if (!buttonEl || !panelEl) return;

  const listEl = panelEl.querySelector(".friends-list");
  const columnTitleEl = panelEl.querySelector(".friends-column-title");
  const headerEl = panelEl.querySelector(".friends-list-header");
  const addInput = panelEl.querySelector("#friends-add-input");
  const addBtn = panelEl.querySelector(".friends-add-button");

  let friends = [];
  let ignored = [];
  let currentTab = "friends";

  const toggleOpen = () => {
    document.body.classList.toggle("hud-friends-open");
    renderList();
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

  const submitFriendAdd = () => {
    if (!addInput || !addBtn) return;
    const name = (addInput.value || "").trim();
    if (!name) return;
    const client = getNetClient();
    const playerId = getNetPlayerId();
    if (!client || !playerId) return;
    client.sendCmd("CmdFriendAddByName", {
      playerId,
      targetName: name,
    });
    showToast({ title: "Amis", text: "Demande envoyee." });
    addInput.value = "";
  };

  if (addBtn) {
    addBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      submitFriendAdd();
    });
  }

  if (addInput) {
    addInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitFriendAdd();
      }
    });
  }

  const renderList = () => {
    if (!listEl || !columnTitleEl || !headerEl) return;
    listEl.innerHTML = "";

    const forceOffline = document.body.classList.contains("menu-open");
    const normalizedFriends = forceOffline
      ? friends.map((entry) => ({ ...entry, online: false }))
      : friends;

    let entries = [];
    let title = "";
    if (currentTab === "offline") {
      entries = normalizedFriends.filter((f) => f && f.online === false);
      title = "Non connectes";
    } else if (currentTab === "ignored") {
      entries = ignored;
      title = "Ignores";
    } else {
      entries = normalizedFriends.filter((f) => f && f.online === true);
      title = "Connectes";
    }

    columnTitleEl.textContent = title;
    listEl.classList.toggle("empty", entries.length === 0);

    if (entries.length === 0) {
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "friends-entry";
      row.dataset.accountId = entry.accountId || "";

      const name = document.createElement("span");
      name.className = "friends-entry-name";
      name.textContent = entry.displayName || "Joueur";

      const level = document.createElement("span");
      level.className = "friends-entry-level";
      level.textContent =
        Number.isInteger(entry.level) && entry.level > 0 ? `Niv. ${entry.level}` : "-";

      const accomp = document.createElement("span");
      accomp.className = "friends-entry-accomp";
      accomp.textContent =
        Number.isFinite(entry.honorPoints) && entry.honorPoints >= 0
          ? `${Math.round(entry.honorPoints)}`
          : "-";

      row.appendChild(name);
      row.appendChild(level);
      row.appendChild(accomp);
      listEl.appendChild(row);

      row.addEventListener("click", (event) => {
        event.stopPropagation();
        openFriendActions(entry);
      });
    });
  };

  const tabs = Array.from(panelEl.querySelectorAll(".friends-tab"));
  const setActiveTab = (target) => {
    currentTab = target || "friends";
    tabs.forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-tab") === currentTab);
    });
    renderList();
  };
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab");
      if (!target) return;
      setActiveTab(target);
    });
  });
  setActiveTab("friends");

  onStoreEvent("friends:updated", (payload) => {
    friends = Array.isArray(payload?.friends) ? payload.friends : [];
    ignored = Array.isArray(payload?.ignored) ? payload.ignored : [];
    renderList();
  });

  if (typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver(() => {
      renderList();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
}
