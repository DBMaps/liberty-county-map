const identity = (row) => String(row?.reportId || row?.report_id || row?.id || "").trim();
const coordinates = (row) => ({ lat: Number(row?.lat ?? row?.latitude ?? row?.rawLat), lng: Number(row?.lng ?? row?.lon ?? row?.longitude ?? row?.rawLng) });
const active = (row) => !["cleared", "recently_cleared", "hazard_cleared", "expired", "inactive"].includes(String(row?.lifecycleState || row?.lifecycle || row?.status || "active").toLowerCase()) && String(row?.report_type || row?.type || "").toLowerCase() !== "hazard_cleared";
const genericType = (row) => ["flooding", "road_hazard", "road hazard", "other_hazard", "other hazard"].includes(String(row?.report_type || row?.type || "other_hazard").toLowerCase());
export function normalizeGenericHazard(row, county, place = null) {
  return { ...row, id: String(row.id), reportKind: "hazard", type: row.report_type || row.type, countyId: county.countyId, countyFips: county.countyFips, countyName: county.name, lat: Number(row.lat), lng: Number(row.lng), lifecycleState: "active", expired: false, placeGeoid: place?.placeGeoid || "", communityKey: place?.placeGeoid || "", communityName: place?.displayName || "", countyMemberships: [...(place?.countyMemberships || [county.countyFips])] };
}
export function exerciseActualRenderPath(report, { leaflet, map, layer, alertsTarget, unifiedIncidents = [], activeHazards = [report] }) {
  const id = identity(report);
  const primary = unifiedIncidents.filter(active);
  const primaryIds = new Set(primary.map(identity));
  const merged = [...primary, ...activeHazards.filter(active).filter((row) => !primaryIds.has(identity(row)))];
  const deduped = [...new Map(merged.map((row) => [`id:${identity(row)}`, row])).values()];
  const loopRow = deduped.find((row) => identity(row) === id);
  const point = coordinates(loopRow);
  const trace = {
    presentInActiveHazards: activeHazards.includes(report), presentInUnifiedIncidents: primary.some((row) => identity(row) === id),
    presentInMergedRenderSource: merged.some((row) => identity(row) === id), presentAfterDeduplication: Boolean(loopRow),
    presentInMarkerLoop: Boolean(loopRow && active(loopRow)), coordinateAccepted: Number.isFinite(point.lat) && Number.isFinite(point.lng),
    typeAccepted: Boolean(loopRow && (loopRow.reportKind === "hazard" || genericType(loopRow) || String(loopRow.type || "").includes("rail"))),
    identityAccepted: Boolean(id), iconResolved: false, markerConstructorReached: false, markerCreated: false,
    markerAddedToMap: false, markerCurrentlyOnMap: false, crossingDependencies: 0
  };
  let marker = null;
  if (trace.presentInMarkerLoop && trace.coordinateAccepted && trace.typeAccepted && trace.identityAccepted) {
    const icon = leaflet.divIcon({ className: `marker-${String(report.type || "other_hazard").replace(/\s+/g, "_")}` });
    trace.iconResolved = Boolean(icon);
    trace.markerConstructorReached = true;
    marker = leaflet.marker([point.lat, point.lng], { report, icon }).addTo(layer);
    trace.markerCreated = Boolean(marker); trace.markerAddedToMap = layer.has(marker); trace.markerCurrentlyOnMap = map.hasLayer(layer) && layer.has(marker);
  }
  trace.firstFailedStage = [["active_hazards", trace.presentInActiveHazards], ["generic_merge", trace.presentInMergedRenderSource], ["deduplication", trace.presentAfterDeduplication], ["marker_loop", trace.presentInMarkerLoop], ["coordinates", trace.coordinateAccepted], ["type", trace.typeAccepted], ["identity", trace.identityAccepted], ["icon", trace.iconResolved], ["marker_constructor", trace.markerConstructorReached], ["marker_created", trace.markerCreated], ["layer_insertion", trace.markerAddedToMap], ["layer_visibility", trace.markerCurrentlyOnMap]].find(([, pass]) => !pass)?.[0] || null;
  const alertItem = trace.presentInMarkerLoop ? { reportId: id, countyId: report.countyId, type: report.type } : null;
  if (alertItem) alertsTarget.append(alertItem);
  return { ...trace, markerAddedToLayer: trace.markerAddedToMap, alertItemCreated: Boolean(alertItem), alertRendered: alertsTarget.items.includes(alertItem), awarenessPresented: trace.presentInMarkerLoop };
}
export function createRenderHarness() {
  const layer = { items: [], add(item) { this.items.push(item); }, has(item) { return this.items.includes(item); } };
  const map = { layers: [layer], hasLayer(candidate) { return this.layers.includes(candidate); } };
  const leaflet = { divIcon(options) { return { options }; }, marker(latlng, options) { return { latlng, options, addTo(owner) { owner.add(this); return this; } }; } };
  const alertsTarget = { items: [], append(item) { this.items.push(item); } };
  return { leaflet, map, layer, alertsTarget };
}
