// Isolated subset of js/app.js GRIDLY_PRODUCTION_MARKER_CATEGORY_ASSETS.
// Original Gridly PNGs; no consumer state, classification engine or runtime import.
export const markerCategories=Object.freeze({
  flooding:Object.freeze({asset:'water-over-road.png',tip:204/256}),
  rail_blockage_delay:Object.freeze({asset:'train-front.png',tip:205/256}),
  signal_outage:Object.freeze({asset:'traffic-signal-issue.png',tip:194/256}),
  debris:Object.freeze({asset:'debris-in-road.png',tip:200/256})
});
export function incidentIcon(L,item){
  const category=markerCategories[item.mapCategory];
  if(!category)throw new Error('Unmapped demo incident category');
  const size=80,anchor=[size/2,size*category.tip];
  return L.divIcon({className:`dispatch-marker marker-${item.severity.toLowerCase()} ${item.status==='Resolved'?'marker-resolved':''}`,
    html:`<img class="gridly-category-icon" src="./assets/markers/${category.asset}" alt="" aria-hidden="true"><span class="marker-state" aria-hidden="true">${item.status==='Resolved'?'✓':''}</span>`,
    iconSize:[size,size],iconAnchor:anchor,popupAnchor:[0,-anchor[1]+8]});
}
