// Gestion de la fen�tre de carte HTML (grande carte)

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

  // Zoom � la molette sur la grande carte
  let zoom = 0.5;
  const minZoom = 0.5;
  const maxZoom = 0.7;

  mapMain.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();

      const delta = event.deltaY < 0 ? 0.1 : -0.1;
      zoom += delta;
      if (zoom < minZoom) zoom = minZoom;
      if (zoom > maxZoom) zoom = maxZoom;

            mapInner.style.transform = `scale(${zoom})`; 
    },
    { passive: false },
  );
}
