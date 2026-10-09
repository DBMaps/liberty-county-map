import {badge,escape,empty} from './components.mjs';
import {incidentIcon} from './marker-language.mjs';
import {createBasemap,createStandardBasemap} from './basemap.mjs';
// Bounded, in-memory demo presentation state; never an authority or membership.
let geographicCamera;

let library;
const adaptedLibraries=new WeakSet();
function dispatchMapLibrary(L) {
  if(!adaptedLibraries.has(L)){
    // Leaflet's synchronous path update clears the scheduled redraw handle.
    // Cancel that frame first so it cannot outlive canvas renderer teardown.
    const updatePaths=L.Canvas.prototype._updatePaths;
    L.Canvas.prototype._updatePaths=function(...args){
      if(!this._postponeUpdatePaths && this._redrawRequest!=null){
        L.Util.cancelAnimFrame(this._redrawRequest);
        this._redrawRequest=null;
      }
      return updatePaths.apply(this,args);
    };
    const destroyContainer=L.Canvas.prototype._destroyContainer;
    L.Canvas.prototype._destroyContainer=function(...args){
      const result=destroyContainer.apply(this,args);
      // Native teardown cancels the frame but retains its ID; permit reuse.
      this._redrawRequest=null;
      return result;
    };
    adaptedLibraries.add(L);
  }
  return L;
}
function loadLibrary() {
  if(window.L)return Promise.resolve(dispatchMapLibrary(window.L));
  if(library)return library;
  library=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='./vendor/leaflet/leaflet.js';
    script.onload=()=>window.L?resolve(dispatchMapLibrary(window.L)):reject(new Error('Map library unavailable'));
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
  let normalMapSize,cameraCenter, resizing=false, workspaceResize=false;
  let expanded=false,drawer=false,filterOpen=false,entryFocus,scrollY=0;
  let nativeFullscreen=false,fullscreenPending=false;
  let disposed=false,map,L,basemap,markers=new Map(),currentRows=rows,selection=selectedId;
  const prior=geographicCamera?.unitName===unitName?geographicCamera:null;
  let freeCamera=!!prior||new URLSearchParams(location.search).get('basemap')==='mock';
  let providerId=prior?.provider|| (freeCamera?'local-mock':'dayton');
  const abort=new AbortController();
  host.innerHTML=`<div class="geo-layout geo-${mode}"><section class="panel geo-list-panel" aria-label="Incident list"><div class="panel-heading"><h2>Unit incidents</h2><span id="geo-count"></span></div><div id="geo-list"></div></section><section class="panel geo-map-panel"><div class="panel-heading"><div><h2>Dayton, Texas</h2><small>${escape(unitName)} · Approximate demo locations</small></div><button class="text-button" id="fit-incidents">Fit incidents</button></div><div class="map-stage"><div id="dispatch-map" aria-label="Dayton incident map. Use the incident list for an equivalent keyboard path."></div><div id="map-message" role="status">Loading local map…</div></div><div class="map-caption"><span>Offline OSM context · Approximate demo positions</span><span class="map-state-key" aria-label="Incident state key"><span><i class="map-key-selected" aria-hidden="true"></i>Selected</span><span><i class="map-key-resolved" aria-hidden="true">✓</i>Resolved</span></span></div><div class="map-credit">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> · <a href="./demo/dayton-roads.geojson" download>ODbL roads</a> · <a href="./demo/dayton-context.geojson" download>ODbL context</a> · <a href="./demo/dayton-landmarks.geojson" download>OSM landmarks</a> · <a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a></div></section></div>`;
  const list=host.querySelector('#geo-list'),message=host.querySelector('#map-message');
  const shell=host.closest('.shell'),listPanel=host.querySelector('.geo-list-panel');
  const heading=host.querySelector('.geo-map-panel > .panel-heading');
  const expand=document.createElement('button');expand.type='button';expand.id='expand-map';expand.className='text-button expand-map';expand.textContent='Expand Map';expand.hidden=mode!=='map';host.querySelector('.map-stage').append(expand);
  const actions=document.createElement('div');actions.className='expanded-map-actions';actions.hidden=true;
  actions.innerHTML='<button type="button" class="button" id="return-map">Return to Map</button><button type="button" class="button" id="map-incidents" aria-controls="map-incident-drawer" aria-expanded="false">Incidents</button><button type="button" class="button" id="map-filters" aria-controls="map-workspace-filters" aria-expanded="false">Filters</button><button type="button" class="button" id="map-fullscreen">Full screen</button><span id="map-fullscreen-status" role="status" aria-live="polite"></span>';
  heading.append(actions);listPanel.id='map-incident-drawer';
  const filters=host.parentElement.querySelector('.geo-filters');filters.id='map-workspace-filters';
  const source=document.createElement('div');source.className='map-source-status';source.setAttribute('role','status');source.hidden=true;host.querySelector('.map-stage').append(source);
  const picker=document.createElement('label');picker.className='basemap-picker';picker.innerHTML='Basemap <select aria-label="Basemap source"><option value="dayton">Limited Dayton extract</option><option value="local-mock">Continuous local mock — synthetic</option><option value="arcgis-standard-fixture">ArcGIS Standard contract — offline synthetic</option><option value="arcgis-satellite-fixture">ArcGIS Satellite contract — offline synthetic</option></select>';filters.append(picker);
  const choice=picker.querySelector('select');choice.value=providerId;choice.onchange=()=>switchProvider(choice.value);
  function switchProvider(id){if(!map)return;freeCamera=true;map.setMaxBounds(null);map.setMinZoom(5);map.setMaxZoom(18);providerId=id;basemap.select(id);rememberCamera();}
  function rememberCamera(){if(freeCamera&&map)geographicCamera={unitName,provider:providerId,center:[map.getCenter().lat,map.getCenter().lng],zoom:map.getZoom()};}
  const screenButton=host.querySelector('#map-fullscreen'),screenStatus=host.querySelector('#map-fullscreen-status');
  screenButton.disabled=!document.fullscreenEnabled||typeof shell.requestFullscreen!=='function';
  if(screenButton.disabled)screenButton.title='Browser full screen unavailable; viewport map remains available';
  async function leaveNativeFullscreen(){
    if(document.fullscreenElement!==shell)return;
    try{await document.exitFullscreen();}catch{if(expanded)screenStatus.textContent='Could not exit browser full screen. Use browser Escape.';}
  }
  function fullscreenChanged(){
    const owned=document.fullscreenElement===shell;
    screenButton.textContent=owned?'Exit full screen':'Full screen';
    if(owned){nativeFullscreen=true;if(!expanded)void leaveNativeFullscreen();}
    else if(nativeFullscreen){nativeFullscreen=false;setExpanded(false);}
  }
  screenButton.onclick=async()=>{
    if(fullscreenPending)return;
    if(document.fullscreenElement===shell){await leaveNativeFullscreen();return;}
    screenStatus.textContent='';fullscreenPending=true;
    try{await shell.requestFullscreen();}
    catch{if(expanded)screenStatus.textContent='Browser full screen unavailable. Viewport map remains available.';}
    finally{fullscreenPending=false;}
  };
  document.addEventListener('fullscreenchange',fullscreenChanged);
  function workspaceBounds(){
    if(freeCamera)return null;
    const bounds=L.latLngBounds([[30.017,-94.948],[30.083,-94.852]]);
    if(!expanded||!normalMapSize)return bounds;
    // Presentation padding keeps the same permitted center range as normal Map.
    // It does not invent source geometry, boundaries or jurisdiction authority.
    const delta=map.getSize().subtract(normalMapSize).divideBy(2),zoom=map.getZoom();
    return L.latLngBounds(map.unproject(map.project(bounds.getNorthWest(),zoom).subtract(delta),zoom),map.unproject(map.project(bounds.getSouthEast(),zoom).add(delta),zoom));
  }
  function closeDrawer(focus=true){drawer=false;shell.classList.remove('map-drawer-open');listPanel.inert=expanded;host.querySelector('#map-incidents').setAttribute('aria-expanded','false');if(focus)host.querySelector('#map-incidents').focus();}
  function closeFilters(focus=true){filterOpen=false;shell.classList.remove('map-filters-open');filters.inert=expanded;host.querySelector('#map-filters').setAttribute('aria-expanded','false');if(focus)host.querySelector('#map-filters').focus();}
  function setExpanded(value,restore=true){
    if(value===expanded)return;
    if(map){cameraCenter=map.getCenter();if(value)normalMapSize=map.getSize().clone();map.setMaxBounds(null);}
    workspaceResize=true;expanded=value;
    if(!value)void leaveNativeFullscreen();else screenStatus.textContent='';
    if(value){entryFocus=document.activeElement;scrollY=window.scrollY;}
    shell.classList.toggle('map-expanded',value);document.body.classList.toggle('dispatch-map-expanded',value);actions.hidden=!value;expand.hidden=value||mode!=='map';
    closeDrawer(false);closeFilters(false);
    if(value)host.querySelector('#return-map').focus();else if(restore){window.scrollTo({top:scrollY,behavior:'instant'});(entryFocus?.isConnected?entryFocus:expand).focus({preventScroll:true});}
  }
  expand.onclick=()=>setExpanded(true);host.querySelector('#return-map').onclick=()=>setExpanded(false);
  host.querySelector('#map-incidents').onclick=()=>{if(drawer){closeDrawer();return;}closeFilters(false);drawer=true;shell.classList.add('map-drawer-open');listPanel.inert=false;host.querySelector('#map-incidents').setAttribute('aria-expanded','true');listPanel.querySelector('button')?.focus();};
  host.querySelector('#map-filters').onclick=()=>{if(filterOpen){closeFilters();return;}closeDrawer(false);filterOpen=true;shell.classList.add('map-filters-open');filters.inert=false;host.querySelector('#map-filters').setAttribute('aria-expanded','true');filters.querySelector('input')?.focus();};
  function workspaceEscape(event){
    if(!expanded||event.key!=='Escape')return;
    // Some browsers deliver Escape to the page; others exit natively first.
    // Both paths converge through fullscreenchange, without a stuck workspace.
    if(document.fullscreenElement===shell){void leaveNativeFullscreen();return;}
    if(document.querySelector('dialog[open]'))return;
    event.preventDefault();event.stopPropagation();
    const popup=[...markers.values()].find(marker=>marker.isPopupOpen());
    if(popup){map.closePopup();popup.getElement()?.focus();}
    else if(filterOpen)closeFilters();else if(drawer)closeDrawer();else setExpanded(false);
  }
  window.addEventListener('keydown',workspaceEscape,true);
  function renderList() {
    host.querySelector('#geo-count').textContent=`${currentRows.length} visible`;
    list.innerHTML=currentRows.length?currentRows.map(item=>`<div class="geo-list-row ${selection===item.id?'is-selected':''}" data-geo-row="${item.id}"><button class="geo-select" data-select="${item.id}" aria-pressed="${selection===item.id}"><span class="geo-row-heading"><strong>${escape(item.title)}</strong>${badge(item.severity)}</span><span>${escape(item.location)}</span><small>${escape(item.unitName)}</small><span class="geo-row-state">${badge(item.status)}<small>${item.updated} · ${item.review}</small></span></button><button class="text-button geo-detail" data-detail="${item.id}">View details<span class="sr-only"> for ${escape(item.title)}</span></button></div>`).join(''):empty('No matching incidents','No incidents match the current filters.');
    list.querySelectorAll('[data-select]').forEach(button=>button.onclick=()=>select(button.dataset.select));
    list.querySelectorAll('[data-detail]').forEach(button=>button.onclick=()=>{select(button.dataset.detail,false);onDetail(button.dataset.detail);});
  }
  function markSelection() {
    list.querySelectorAll('[data-geo-row]').forEach(row=>{const selected=row.dataset.geoRow===selection;row.classList.toggle('is-selected',selected);row.querySelector('[data-select]').setAttribute('aria-pressed',String(selected));});
    for(const [id,marker]of markers){const element=marker.getElement();if(element){element.classList.toggle('is-selected',id===selection);element.setAttribute('aria-pressed',String(id===selection));}marker.setZIndexOffset(id===selection?1000:0);}
    basemap?.refresh();
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
      if(!expanded&&(frame.top<topbar.bottom||frame.bottom>innerHeight))map.getContainer().scrollIntoView({block:'center',behavior:'instant'});
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
      const results=await Promise.all([loadLibrary(),loadStyles('./vendor/leaflet/leaflet.css'),fetch('./demo/dayton-roads.geojson',{signal:abort.signal}).then(response=>{if(!response.ok)throw new Error('Map data unavailable');return response.json();}),fetch('./demo/dayton-context.geojson',{signal:abort.signal}).then(response=>{if(!response.ok)throw new Error('Map context unavailable');return response.json();}),fetch('./demo/dayton-landmarks.geojson',{signal:abort.signal}).then(response=>{if(!response.ok)throw new Error('Map landmarks unavailable');return response.json();})]);
      if(disposed)return;L=results[0];const data=results[2];
      if(data.type!=='FeatureCollection'||!data.features.length||results[3].type!=='FeatureCollection'||!results[3].features.some(f=>f.properties.layer==='rail'))throw new Error('Map data unavailable');
      map=L.map(host.querySelector('#dispatch-map'),{center:[30.047,-94.891],zoom:14,minZoom:13,maxZoom:17,maxBounds:[[30.017,-94.948],[30.083,-94.852]],maxBoundsViscosity:1,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false,inertia:false,scrollWheelZoom:false,attributionControl:false,preferCanvas:true});
      basemap=createStandardBasemap(L,map,data,results[3],results[4],()=>[...markers.values()].map(marker=>({latlng:marker.getLatLng(),anchor:marker.options.icon.options.iconAnchor,size:marker.options.icon.options.iconSize})),{onState:state=>{source.hidden=!freeCamera;source.dataset.health=state.health;source.textContent=state.attribution+' · '+state.health+' · '+state.coverage+(state.labels?' · Labels: '+state.labels:'')+' · Display only; no roadway authority';providerId=state.id;choice.value=state.id;}});
      if(freeCamera){map.setMaxBounds(null);map.setMinZoom(5);map.setMaxZoom(18);}basemap.select(providerId);
      L.control.scale({imperial:true,metric:false,position:'bottomleft'}).addTo(map);
      renderMarkers();if(prior)map.setView(prior.center,prior.zoom,{animate:false});else fit();if(selection&&markers.has(selection))select(selection, !freeCamera);
      cameraCenter=map.getCenter();map.on('moveend',()=>{if(!disposed&&map&&!resizing){cameraCenter=map.getCenter();rememberCamera();}});map.on('zoomend',()=>{if(expanded&&!resizing)map.setMaxBounds(workspaceBounds());rememberCamera();});
      map.on('popupclose',()=>{ /* Selection remains visible when the popup closes. */ });
    }catch(error){if(disposed||error.name==='AbortError')return;basemap?.destroy();basemap=null;map?.remove();map=null;message.hidden=false;message.innerHTML='<strong>Map unavailable</strong><p>Incident records remain available in Board view.</p><button class="button" id="retry-map">Retry map</button>';message.querySelector('button').onclick=initialize;}
  }
  host.querySelector('#fit-incidents').onclick=fit;
  window.addEventListener('gridlydispatch:themechange',restyle);
  const observer=new ResizeObserver(()=>{if(map){if(!expanded&&!workspaceResize&&!freeCamera){map.invalidateSize({animate:false});return;}const center=cameraCenter||map.getCenter();resizing=true;map.invalidateSize({animate:false,pan:false});map.setView(center,map.getZoom(),{animate:false,reset:true});map.setMaxBounds(workspaceBounds());workspaceResize=false;resizing=false;}});observer.observe(host.querySelector('#dispatch-map'));
  renderList();initialize();
  return {
    update(next){currentRows=next;if(!next.some(item=>item.id===selection)){selection=null;onSelect(null);}renderList();renderMarkers();if(!expanded&&!freeCamera)fit();},
    destroy(){rememberCamera();setExpanded(false,false);document.removeEventListener('fullscreenchange',fullscreenChanged);window.removeEventListener('keydown',workspaceEscape,true);disposed=true;abort.abort();observer.disconnect();window.removeEventListener('gridlydispatch:themechange',restyle);basemap?.destroy();basemap=null;map?.remove();map=null;}
  };
}

// Dedicated composer map: existing incident views remain unchanged.
export async function createRoadPicker(host,registry,selected,onCandidates,isCurrent=()=>true){
 const {pickCandidates}=await import('./road-selection.mjs');
 const L=await loadLibrary();await loadStyles('./vendor/leaflet/leaflet.css');
 const context=await Promise.all(['dayton-context','dayton-landmarks'].map(async name=>{const r=await fetch('./demo/'+name+'.geojson');if(!r.ok)throw new Error('Local map context unavailable');return r.json();}));
 if(!host.isConnected||!isCurrent())return {destroy(){},update(){}};
 const map=L.map(host,{center:[30.047,-94.891],zoom:14,minZoom:13,maxZoom:17,maxBounds:[[30.017,-94.948],[30.083,-94.852]],maxBoundsViscosity:1,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false,inertia:false,scrollWheelZoom:false,attributionControl:false,preferCanvas:true});
 const roads={type:'FeatureCollection',features:registry.features.map(r=>r.feature)};
 const base=createBasemap(L,map,roads,context[0],context[1],()=>[]);
 const highlightColor=()=>getComputedStyle(host).getPropertyValue('--focus-ring').trim();const highlight=L.geoJSON(null,{interactive:false,style:()=>({color:highlightColor(),weight:7,opacity:1})}).addTo(map);
 function update(ids){const chosen=registry.selected(ids);highlight.clearLayers();highlight.addData({type:'FeatureCollection',features:chosen.map(r=>r.feature)});host._previewGeometry=highlight.toGeoJSON(false);}
 map.on('click',e=>onCandidates(pickCandidates(registry,e.containerPoint,p=>map.latLngToContainerPoint([p[1],p[0]]))));
 const theme=()=>{base.restyle();highlight.setStyle({color:highlightColor()});};window.addEventListener('gridlydispatch:themechange',theme);
 const observer=new ResizeObserver(()=>map.invalidateSize({animate:false}));observer.observe(host);update(selected);
 return {update,fit(ids){const f=registry.selected(ids);if(f.length)map.fitBounds(L.geoJSON({type:'FeatureCollection',features:f.map(r=>r.feature)}).getBounds(),{padding:[25,25],maxZoom:16,animate:false});},destroy(){observer.disconnect();window.removeEventListener('gridlydispatch:themechange',theme);base.destroy();map.remove();delete host._previewGeometry;}};
}
