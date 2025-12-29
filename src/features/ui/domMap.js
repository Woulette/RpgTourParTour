// Gestion de la fenetre de carte HTML (grande carte)

export function initDomMap() {
  const button = document.getElementById("hud-map-button");
  const panel = document.getElementById("hud-map-panel");
  const mapMain = panel ? panel.querySelector(".map-main") : null;
  const mapInner = panel ? panel.querySelector(".map-inner") : null;

  if (!button || !panel || !mapMain || !mapInner) {
    return;
  }

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    document.body.classList.toggle("hud-map-open");
  });

  // Zoom a la molette sur la grande carte
  // Zoom a la molette sur la grande carte
  // Zoom a la molette sur la grande carte
  // Zoom a la molette sur la grande carte

  mapMain.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();

      const delta = event.deltaY < 0 ? 0.1 : -0.1;
  // Zoom a la molette sur la grande carte
  // Zoom a la molette sur la grande carte
  // Zoom a la molette sur la grande carte

  // Zoom a la molette sur la grande carte
    },
    { passive: false },
  );
}