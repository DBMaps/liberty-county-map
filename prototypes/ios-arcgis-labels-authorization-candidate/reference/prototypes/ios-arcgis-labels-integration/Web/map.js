(() => {
  "use strict";
  const map = L.map("map", {
    minZoom: 12, maxZoom: 20,
    maxBounds: [[29.99, -94.98], [30.12, -94.79]],
    maxBoundsViscosity: 1
  }).setView([30.0466, -94.8852], 15);
  map.attributionControl.setPrefix(false);
  L.imageOverlay("imagery.svg", [[29.99, -94.98], [30.12, -94.79]], {
    interactive: false, attribution: "Synthetic imagery and labels"
  }).addTo(map);

  const pane = map.createPane("mockLabels");
  pane.style.zIndex = "450"; // Leaflet image overlays occupy overlayPane (400).
  pane.style.pointerEvents = "none";

  const labelLayer = L.tileLayer("gridly-label://mock/tile/{z}/{y}/{x}", {
    pane: "mockLabels", tileSize: 512, zoomOffset: -1, minZoom: 12,
    maxZoom: 20, noWrap: true, keepBuffer: 0
  });
  const toggle = document.getElementById("labels");
  const status = document.getElementById("status");
  const enabled = () => map.hasLayer(labelLayer);
  function setLabels(on) {
    if (enabled() !== on) {
      if (on) {
        status.textContent = "Waiting for tiles";
        labelLayer.addTo(map);
      } else {
        map.removeLayer(labelLayer);
      }
    }
    toggle.setAttribute("aria-pressed", String(on));
    if (!on) status.textContent = "Labels off";
  }

  labelLayer.on("tileload", () => {
    if (enabled()) status.textContent = "Mock labels loaded";
  });
  labelLayer.on("tileerror", () => {
    if (enabled()) status.textContent = "A label tile failed";
  });
  toggle.addEventListener("click", () => setLabels(!enabled()));
  window.redrawMockLabels = () => {
    if (enabled()) labelLayer.redraw();
  };
  setLabels(true);
})();
