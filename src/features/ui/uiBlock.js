export function isCraftPanelOpen() {
  if (typeof document === "undefined") return false;
  return Boolean(document.querySelector(".craft-panel.open"));
}
