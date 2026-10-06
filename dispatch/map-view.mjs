import {badge,escape,empty} from './components.mjs';
import {incidentIcon} from './marker-language.mjs';
import {createBasemap} from './basemap.mjs';

let library;
function loadLibrary() {
  if(window.L)return Promise.resolve(window.L);
  if(library)return library;
  library=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='./vendor/leaflet/leaflet.js';
    script.onload=()=>window.L?resolve(window.L):reject(new Error('Map library unavailable'));
    script.onerror=()=>{script.remove();library=null;reject(new Error('Map library unavailable'));};
    document.head.append(script);
  });
  return library;
}
function loadStyles(path) {
  const existing=document.querySelector(`link[data-map-style="${path}"]`);
  if(existing)return existing._ready;
  const link=document.createElement('link');link.rel='stylesheet';link.href=path;link.dataset.mapStyle=path;
  link._ready=new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=()=>{link.remove();reject(new Error('Map styles unavailable'));};});
  document.head.append(link);return link._ready;
}
export function createGeographicView(host,{mode,rows,selectedId,onSelect,onDetail,unitName}) {
  let disposed=false,map,L,basemap,markers=new Map(),currentRows=rows,selection=selectedId;
  const abort=new AbortController();
  host.innerHTML=`<div class="geo-layout geo-${mode}"><section class="panel geo-list-panel" aria-label="Incident list"><div class="panel-heading"><h2>Unit incidents</h2><span id="geo-count"></span></div><div id="geo-list"></div></section><section class="panel geo-map-panel"><div class="panel-heading"><div><h2>Dayton, Texas</h2><small>${escape(unitName)} · Approximate demo locations</small></div><button class="text-button" id="fit-incidents">Fit incidents</button></div><div class="map-stage"><div id="dispatch-map" aria-label="Dayton incident map. Use the incident list for an equivalent keyboard path."></div><div id="map-message" role="status">Loading local map…</div></div><div class="map-caption"><span>Offline OSM context · Approximate demo positions</span><span>Category icons · Ring: selected · ✓ Resolved</span></div><div class="map-credit">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> · <a href="./demo/dayton-roads.geojson" download>ODbL roads</a> · <a href="./demo/dayton-context.geojson" download>ODbL context</a> · <a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a></div></section></div>`;
  const list=host.querySelector('#geo-list'),message=host.querySelector('#map-message');
  function renderList() {
    host.querySelector('#geo-count').textContent=`${currentRows.length} visible`;
    list.innerHTML=currentRows.length?currentRows.map(item=>`<div class="geo-list-row ${selection===item.id?'is-selected':''}" data-geo-row="${item.id}"><button class="geo-select" data-select="${item.id}" aria-pressed="${selection===item.id}"><span class="geo-row-heading"><strong>${escape(item.title)}</strong>${badge(item.severity)}</span><span>${escape(item.location)}</span><small>${escape(item.unitName)}</small><span class="geo-row-state">${badge(item.status)}<small>${item.updated} · ${item.review}</small></span></button><button class="text-button geo-detail" data-detail="${item.id}">View details<span class="sr-only"> for ${escape(item.title)}</span></button></div>`).join(''):empty('No matching incidents','No incidents match the current filters.');
    list.querySelectorAll('[data-select]').forEach(button=>button.onclick=()=>select(button.dataset.select));
    list.querySelectorAll('[data-detail]').forEach(button=>button.onclick=()=>{select(button.dataset.detail,false);onDetail(button.dataset.detail);});
  }
  function markSelection() {
    list.querySelectorAll('[data-geo-row]').forEach(row=>{const selected=row.dataset.geoRow===selection;row.classList.toggle('is-selected',selected);row.querySelector('[data-select]').setAttribute('aria-pressed',String(selected));});
    for(const [id,marker]of markers){const element=marker.getElement();if(element){element.classList.toggle('is-selected',id===selection);element.setAttribute('aria-pressed',String(id===selection));}marker.setZIndexOffset(id===selection?1000:0);}
  }
  function select(id,focusMap=true) {
    if(!currentRows.some(item=>item.id===id))return;
    selection=id;onSelect(id);markSelection();
    const marker=markers.get(id);
    if(marker&&focusMap){
      if(!map.getBounds().pad(-.2).contains(marker.getLatLng()))map.panTo(marker.getLatLng(),{animate:false});marker.openPopup();
      // Keep popup positioning immediate and inside the map, including reduced motion.
      const frame=map.getContainer().getBoundingClientRect(),bubble=marker.getPopup().getElement().getBoundingClientRect();
      const dx=bubble.right>frame.right-20?bubble.right-frame.right+20:Math.min(0,bubble.left-frame.left-20);
      const dy=bubble.top<frame.top+20?bubble.top-frame.top-20:Math.max(0,bubble.bottom-frame.bottom+20);
      if(dx||dy)map.panBy([dx,dy],{animate:false});
      const topbar=document.querySelector('.topbar').getBoundingClientRect();
      if(frame.top<topbar.bottom||frame.bottom>innerHeight)map.getContainer().scrollIntoView({block:'center',behavior:'instant'});
    }
  }
  function fit() {
    if(!map)return;
    if(currentRows.length)map.fitBounds(currentRows.map(item=>item.coordinates),{padding:[70,65],maxZoom:15,animate:false});
    else map.setView([30.047,-94.891],14,{animate:false});
  }
  function popup(item) {
    const container=document.createElement('div');container.className='dispatch-popup';
    container.innerHTML=`<strong>${escape(item.title)}</strong><div>${badge(item.severity)} ${badge(item.status)}</div><p>${escape(item.location)}</p><small>${escape(item.unitName)} · ${escape(item.source)}<br>${item.updated} · ${item.id}</small><small class="popup-authority">${escape(item.review)} in demo · Internal / Publication off<br>Approximate synthetic location · Authority unverified</small><button class="button" type="button">View details</button>`;
    container.querySelector('button').onclick=()=>{selection=item.id;onSelect(item.id);onDetail(item.id);};return container;
  }
  function renderMarkers() {
    if(!map)return;
    for(const marker of markers.values())marker.remove();markers.clear();
    for(const item of currentRows){
      const marker=L.marker(item.coordinates,{icon:incidentIcon(L,item),keyboard:true,title:`${item.title} · ${item.severity} · ${item.status}`,alt:item.title,riseOnHover:true}).addTo(map);
      marker.bindPopup(popup(item),{maxWidth:290,minWidth:250,autoPan:false,className:'dispatch-map-popup'});
      marker.on('click',()=>select(item.id));
      const element=marker.getElement();element.setAttribute('role','button');element.setAttribute('aria-label',`${item.title}, ${item.severity}, ${item.status}, ${item.location}, ${item.unitName}, ${item.updated}`);element.dataset.marker=item.id;
      element.addEventListener('keydown',event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();event.stopPropagation();select(item.id);}});
      markers.set(item.id,marker);
    }
    markSelection();
    message.textContent=currentRows.length?'':'No incidents match the current filters.';message.hidden=!!currentRows.length;
  }
  function restyle(){basemap?.restyle();}
  async function initialize() {
    message.hidden=false;message.textContent='Loading local map…';
    try{
      const results=await Promise.all([loadLibrary(),loadStyles('./vendor/leaflet/leaflet.css'),fetch('./demo/dayton-roads.geojson',{signal:abort.signal}).then(response=>{if(!response.ok)throw new Error('Map data unavailable');return response.json();}),fetch('./demo/dayton-context.geojson',{signal:abort.signal}).then(response=>{if(!response.ok)throw new Error('Map context unavailable');return response.json();})]);
      if(disposed)return;L=results[0];const data=results[2];
      if(data.type!=='FeatureCollection'||!data.features.length||results[3].type!=='FeatureCollection'||!results[3].features.some(f=>f.properties.layer==='rail'))throw new Error('Map data unavailable');
      map=L.map(host.querySelector('#dispatch-map'),{center:[30.047,-94.891],zoom:14,minZoom:13,maxZoom:17,maxBounds:[[30.017,-94.948],[30.083,-94.852]],maxBoundsViscosity:1,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false,inertia:false,scrollWheelZoom:false,attributionControl:false,preferCanvas:true});
      basemap=createBasemap(L,map,data,results[3]);
      L.control.scale({imperial:true,metric:false,position:'bottomleft'}).addTo(map);
      renderMarkers();fit();if(selection&&markers.has(selection))select(selection);
      map.on('popupclose',()=>{ /* Selection remains visible when the popup closes. */ });
    }catch(error){if(disposed||error.name==='AbortError')return;basemap?.destroy();basemap=null;map?.remove();map=null;message.hidden=false;message.innerHTML='<strong>Map unavailable</strong><p>Incident records remain available in Board view.</p><button class="button" id="retry-map">Retry map</button>';message.querySelector('button').onclick=initialize;}
  }
  host.querySelector('#fit-incidents').onclick=fit;
  window.addEventListener('gridlydispatch:themechange',restyle);
  const observer=new ResizeObserver(()=>map?.invalidateSize({animate:false}));observer.observe(host);
  renderList();initialize();
  return {
    update(next){currentRows=next;if(!next.some(item=>item.id===selection)){selection=null;onSelect(null);}renderList();renderMarkers();fit();},
    destroy(){disposed=true;abort.abort();observer.disconnect();window.removeEventListener('gridlydispatch:themechange',restyle);basemap?.destroy();basemap=null;map?.remove();map=null;}
  };
}
