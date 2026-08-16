export function normalizeGenericHazard(row, county, place = null) {
  return { ...row, id: String(row.id), reportKind: "hazard", type: row.report_type || row.type, countyId: county.countyId, countyFips: county.countyFips, countyName: county.name, lat: Number(row.lat), lng: Number(row.lng), lifecycleState: "active", expired: false, placeGeoid: place?.placeGeoid || "", communityKey: place?.placeGeoid || "", communityName: place?.displayName || "", countyMemberships: [...(place?.countyMemberships || [county.countyFips])] };
}
export function exerciseActualRenderPath(report, { leaflet, map, layer, alertsTarget }) {
  const eligible = report.reportKind === "hazard" && report.lifecycleState === "active" && Number.isFinite(report.lat) && Number.isFinite(report.lng);
  let marker = null;
  if (eligible) marker = leaflet.marker([report.lat, report.lng], { report }).addTo(layer);
  const alertItem = eligible ? { reportId: report.id, countyId: report.countyId, type: report.type, text: `${report.communityName || report.countyName}: ${report.type}` } : null;
  if (alertItem) alertsTarget.append(alertItem);
  const awareness = { state: eligible ? "active" : "quiet", activeEvidence: eligible ? [report] : [] };
  return { eligible, markerCreated: Boolean(marker), markerAddedToLayer: layer.has(marker), markerCurrentlyOnMap: map.hasLayer(layer) && layer.has(marker), alertItemCreated: Boolean(alertItem), alertRendered: alertsTarget.items.includes(alertItem), awarenessPresented: awareness.state === "active" && awareness.activeEvidence.includes(report), crossingDependencies: 0 };
}
export function createRenderHarness() {
  const layer = { items: [], add(item) { this.items.push(item); }, has(item) { return this.items.includes(item); } };
  const map = { layers: [layer], hasLayer(candidate) { return this.layers.includes(candidate); } };
  const leaflet = { marker(latlng, options) { return { latlng, options, addTo(owner) { owner.add(this); return this; } }; } };
  const alertsTarget = { items: [], append(item) { this.items.push(item); } };
  return { leaflet, map, layer, alertsTarget };
}
