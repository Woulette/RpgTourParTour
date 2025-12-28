let toastContainerEl = null;

function ensureToastContainer() {
  if (toastContainerEl) return toastContainerEl;

  toastContainerEl = document.getElementById("hud-toast-container");
  if (toastContainerEl) return toastContainerEl;

  toastContainerEl = document.createElement("div");
  toastContainerEl.id = "hud-toast-container";
  toastContainerEl.setAttribute("aria-label", "Notifications");
  document.body.appendChild(toastContainerEl);
  return toastContainerEl;
}

export function showToast({ title, text, durationMs = 3500 } = {}) {
  const container = ensureToastContainer();
  if (!container) return;

  const toastEl = document.createElement("div");
  toastEl.className = "hud-toast hud-toast-enter";

  const titleEl = document.createElement("div");
  titleEl.className = "hud-toast-title";
  titleEl.textContent = title || "Notification";

  const textEl = document.createElement("p");
  textEl.className = "hud-toast-text";
  textEl.textContent = text || "";

  toastEl.appendChild(titleEl);
  toastEl.appendChild(textEl);
  container.appendChild(toastEl);

  const remove = () => {
    if (!toastEl.isConnected) return;
    toastEl.classList.remove("hud-toast-enter");
    toastEl.classList.add("hud-toast-leave");
    window.setTimeout(() => toastEl.remove(), 160);
  };

  toastEl.addEventListener("click", remove);
  window.setTimeout(remove, Math.max(800, durationMs));
}

