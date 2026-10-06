// Isolated subset of js/app.js GRIDLY_PRODUCTION_MARKER_CATEGORY_ASSETS.
// Original Gridly PNGs; no consumer state, classification engine or runtime import.
export const markerCategories=Object.freeze({
  flooding:Object.freeze({asset:'water-over-road.png',tip:204/256,optical:Object.freeze({cx:127.5,cy:97.5,diameter:112})}),
  rail_blockage_delay:Object.freeze({asset:'train-front.png',tip:205/256,optical:Object.freeze({cx:127.5,cy:90,diameter:117})}),
  signal_outage:Object.freeze({asset:'traffic-signal-issue.png',tip:194/256,optical:Object.freeze({cx:128.5,cy:112,diameter:83})}),
  debris:Object.freeze({asset:'debris-in-road.png',tip:200/256,optical:Object.freeze({cx:128,cy:113,diameter:87})})
});
// Source badge bounds were measured on the original 256px PNGs and visually
// checked together. Fit the circular category badge to 35px at (40,30), inside
// the existing 48px backing. Uniform scaling preserves artwork aspect ratio.
export function opticalFit(category){
  const {cx,cy,diameter}=category.optical,pixels=35/diameter;
  return {scale:pixels*256/80,x:40-cx*pixels,y:30-cy*pixels};
}
export function incidentIcon(L,item){
  const category=markerCategories[item.mapCategory];
  if(!category)throw new Error('Unmapped demo incident category');
  const fit=opticalFit(category);
  const size=80,anchor=[size/2,size*category.tip];
  const html=document.createElement('span'),img=document.createElement('img'),state=document.createElement('span');
  img.className='gridly-category-icon';img.src='./assets/markers/'+category.asset;img.alt='';img.setAttribute('aria-hidden','true');
  // Set DOM style properties so fitting works with the existing self-only CSP.
  img.style.transform=`translate(${fit.x}px,${fit.y}px) scale(${fit.scale})`;img.style.transformOrigin='0 0';
  state.className='marker-state';state.setAttribute('aria-hidden','true');state.textContent=item.status==='Resolved'?'✓':'';html.append(img,state);
  return L.divIcon({className:`dispatch-marker marker-${item.severity.toLowerCase()} ${item.status==='Resolved'?'marker-resolved':''}`,
    html,iconSize:[size,size],iconAnchor:anchor,popupAnchor:[0,-anchor[1]+8]});
}
