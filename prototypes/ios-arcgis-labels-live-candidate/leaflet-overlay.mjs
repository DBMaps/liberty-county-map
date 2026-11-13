const overlays = new WeakMap();

// Call at the existing labels-layer construction point with the existing
// Satellite group. The native pilot is the only source of the enable decision.
export function attachPilotLabels({ L, satellite, nativeEnabled = false, attribution }) {
  if (nativeEnabled !== true || typeof attribution !== 'string' || !attribution.trim()) return null;
  const existing = overlays.get(satellite);
  if (existing) return existing;
  const layer = L.tileLayer('gridly-label://pilot/tile/{z}/{y}/{x}', {
    tileSize: 512, zoomOffset: -1, maxZoom: 20, pane: 'arcgisImageryLabelsPane',
    className: 'gridly-arcgis-imagery-labels', attribution
  });
  let suspended = false, disposed = false, failed = false;
  const onError = () => { failed = true; };
  const unload = ({ tile }) => {
    // Removing the source cancels outstanding WebKit scheme work. No URL from
    // an error or from Leaflet's event is ever used for an alternate fetch.
    tile?.removeAttribute('src');
  };
  layer.on('tileerror', onError);
  layer.on('tileunload', unload);
  satellite.addLayer(layer);
  const adapter = Object.freeze({
    suspend() {
      if (disposed || suspended) return;
      suspended = true;
      satellite.removeLayer(layer);
    },
    resume() {
      if (disposed || !suspended) return;
      suspended = false;
      failed = false;
      satellite.addLayer(layer);
    },
    recoverNetwork() {
      if (disposed || suspended || !failed) return;
      failed = false;
      layer.redraw();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      satellite.removeLayer(layer);
      layer.off('tileerror', onError);
      layer.off('tileunload', unload);
      overlays.delete(satellite);
    }
  });
  overlays.set(satellite, adapter);
  return adapter;
}
