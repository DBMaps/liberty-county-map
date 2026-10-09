// Read-only local cartography. No consumer map/state imports and no tile requests.
import {roadLabelPolicy,landmarkPolicy} from './map-label-policy.mjs';
import {createContinuousBasemap} from './basemap-provider.mjs';
import {createArcgisFixtureBasemap} from './arcgis-offline.mjs';
export function createBasemap(L,map,roadData,contextData,landmarkData,incidentIcons=()=>[]){
  const layers=[],labels=L.layerGroup().addTo(map);
  const measure=document.createElement('canvas').getContext('2d');
  // Leaflet 1.9.4 can lose a pending redraw's frame ID during a synchronous
  // reset. A removed renderer must ignore that late callback. Keep the guard
  // Dispatch-local; do not change Leaflet or the consumer app's renderer.
  const LocalCanvas=L.Canvas.extend({_redraw(){if(this._map&&this._ctx)L.Canvas.prototype._redraw.call(this);}});
  const css=()=>getComputedStyle(document.documentElement);
  const color=name=>css().getPropertyValue('--map-'+name).trim();
  const major=f=>/^(trunk|primary|secondary)/.test(f.properties.highway||'');
  const arterial=f=>/^(tertiary)/.test(f.properties.highway||'');
  function roadStyle(f,casing=false){
    const width=major(f)?7:arterial(f)?5:3;
    return {color:color(casing?'road-casing':major(f)?'road-major':arterial(f)?'road-arterial':'road-local'),weight:width+(casing?2:0),opacity:1,lineCap:'round'};
  }
  function add(data,style,extra={}){const layer=L.geoJSON(data,{interactive:false,renderer:new LocalCanvas(),style,...extra}).addTo(map);layers.push({layer,style});return layer;}
  const subset=predicate=>({...contextData,features:contextData.features.filter(predicate)});
  add(subset(f=>f.properties.layer==='water'),()=>({color:color('water-edge'),weight:1,fillColor:color('water'),fillOpacity:1}));
  add(subset(f=>f.properties.layer==='waterway'),()=>({color:color('water-edge'),weight:3,opacity:1}));
  add(roadData,f=>roadStyle(f,true));add(roadData,f=>roadStyle(f));
  const rail=subset(f=>f.properties.layer==='rail');
  add(rail,()=>({color:color('rail-halo'),weight:5,opacity:1}));
  add(rail,()=>({color:color('rail'),weight:2,opacity:1}));
  add(rail,()=>({color:color('rail'),weight:6,dashArray:'2 9',lineCap:'butt',opacity:1}));
  const crossingRenderer=new LocalCanvas();
  add(subset(f=>f.properties.layer==='crossing'),()=>({}),{pointToLayer:(f,ll)=>L.circleMarker(ll,{renderer:crossingRenderer,radius:4,color:color('rail'),fillColor:color('land'),fillOpacity:1,weight:2,interactive:false})});
  const short=name=>name.replace(/North /g,'N ').replace(/South /g,'S ').replace(/East /g,'E ').replace(/West /g,'W ').replace(/ Street/g,' St').replace(/ Road/g,' Rd').replace(/ Avenue/g,' Ave').replace(/Railroad/g,'RR').replaceAll(';',' / ');
  function redrawLabels(){
    labels.clearLayers();const size=map.getSize(),zoom=map.getZoom(),candidates=[];
    map.getContainer().dataset.mapZoom=String(zoom);
    const visible=p=>p.x>45&&p.x<size.x-25&&p.y>20&&p.y<size.y-25;
    const namedArterials=roadData.features.filter(f=>f.properties.ref&&f.properties.name).map(f=>({...f,properties:{...f.properties,ref:''}}));
    for(const feature of [...roadData.features,...namedArterials,...contextData.features]){
      const p=feature.properties,kind=p.highway?(p.ref?'highway':'street'):p.layer;
      const name=p.ref||p.name;if(!name||kind==='crossing'||kind==='water')continue;
      const policy=p.highway?roadLabelPolicy(p):{rank:kind==='rail'?3.2:4,minZoom:13,group:kind};
      if(zoom<policy.minZoom)continue;
      if(feature.geometry.type==='Point'){
        if(kind!=='locality')continue;const c=feature.geometry.coordinates,ll=L.latLng(c[1],c[0]),point=map.latLngToContainerPoint(ll);
        // Text-only town label may move locally to avoid obscuring an incident.
        for(const [dx,dy]of [[0,0],[0,-55],[-80,0],[0,55],[80,0],[0,-100],[-120,0],[0,100],[120,0]]){const positioned=L.point(point.x+dx,point.y+dy);if(visible(positioned))candidates.push({name,kind,ll:map.containerPointToLatLng(positioned),point:positioned,angle:0,rank:3.3,length:1000});}continue;
      }
      if(feature.geometry.type!=='LineString')continue;
      // Simplify only label placement, never rendered/source geometry. Dense OSM
      // vertices must not suppress names along an otherwise straight road.
      const points=L.LineUtil.simplify(feature.geometry.coordinates.map(c=>map.latLngToContainerPoint([c[1],c[0]])),3);
      for(let i=1;i<points.length;i++){
        const clipped=L.LineUtil.clipSegment(points[i-1],points[i],L.bounds([45,20],[size.x-25,size.y-25]),false,true);if(!clipped)continue;
        const [a,b]=clipped,length=a.distanceTo(b);if(length<30)continue;
        for(const t of [.5,.25,.75,.1,.9,.4,.6,.15,.85,.05,.95]){
          const point=L.point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);if(!visible(point))continue;
          let angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;if(angle>90)angle-=180;if(angle< -90)angle+=180;
          candidates.push({name,kind,ll:map.containerPointToLatLng(point),point,angle:kind==='highway'?0:angle,rank:policy.rank,group:policy.group,length});
        }
      }
    }
    for(const feature of landmarkData.features){const {name,category}=feature.properties,policy=landmarkPolicy[category];if(!policy||zoom<policy.minZoom)continue;const c=feature.geometry.coordinates,ll=L.latLng(c[1],c[0]),point=map.latLngToContainerPoint(ll);if(visible(point))candidates.push({name,kind:'landmark',ll,point,angle:0,rank:policy.rank,length:0,category,policy});}
    candidates.sort((a,b)=>a.rank-b.rank||b.length-a.length);
    // Reserve the full incident icon + focus outline before placing any label,
    // shield, locality name or landmark. Incidents always have first priority.
    const placed=incidentIcons().map(icon=>{const p=map.latLngToContainerPoint(icon.latlng),[ax,ay]=icon.anchor;return {l:p.x-ax-7,r:p.x-ax+icon.size[0]+7,t:p.y-ay-7,b:p.y-ay+icon.size[1]+7};}),names=new Set();
    let countyCount=0,landmarkCount=0;
    for(const c of candidates){
      if(names.has(c.name)||(c.group==='county'&&countyCount>=(zoom===16?3:5))||(c.kind==='landmark'&&landmarkCount>=(zoom<15?2:4)))continue;
      const text=short(c.name),rendered=c.kind==='landmark'?`${c.policy.symbol} · ${text}`:text;
      const fontSize=c.kind==='locality'?14:c.kind==='landmark'||c.group==='county'?10:c.group==='major'?12:11;
      measure.font=`${c.kind==='landmark'||c.group==='county'?500:c.kind==='highway'?700:600} ${fontSize}px Arial`;
      const w=measure.measureText(rendered).width+(c.kind==='locality'?text.length*2:0)+14,h=20;
      const radians=c.angle*Math.PI/180,bw=Math.abs(w*Math.cos(radians))+Math.abs(h*Math.sin(radians)),bh=Math.abs(w*Math.sin(radians))+Math.abs(h*Math.cos(radians));
      const box={l:c.point.x-bw/2-5,r:c.point.x+bw/2+5,t:c.point.y-bh/2-5,b:c.point.y+bh/2+5};
      if(box.l<42||box.r>size.x-10||box.t<10||box.b>size.y-20||placed.some(b=>box.l<b.r&&box.r>b.l&&box.t<b.b&&box.b>b.t))continue;
      const node=document.createElement('span');node.textContent=rendered;node.style.transform=`translate(-50%,-50%) rotate(${c.angle}deg)`;
      const marker=L.marker(c.ll,{interactive:false,keyboard:false,zIndexOffset:-1000,icon:L.divIcon({className:`map-context-label label-${c.kind}`,html:node,iconSize:[0,0]})}).addTo(labels);
      marker.getElement().dataset.contextLabel=c.kind;marker.getElement().dataset.labelGroup=c.group||c.kind;marker.getElement().setAttribute('aria-label',c.kind==='landmark'?`${c.name}, ${c.policy.label}. OpenStreetMap geographic context; not independently verified.`:c.name);
      if(c.kind==='landmark'){marker.getElement().dataset.landmarkCategory=c.category;marker.getElement().title=`${c.policy.label} · OpenStreetMap orientation context · Not independently verified`;landmarkCount++;}if(c.group==='county')countyCount++;
      placed.push(box);names.add(c.name);
    }
  }
  function restyle(){for(const {layer,style}of layers)layer.setStyle(style);redrawLabels();}
  map.on('moveend zoomend resize',redrawLabels);redrawLabels();
  return {restyle,refresh:redrawLabels,destroy(){map.off('moveend zoomend resize',redrawLabels);labels.remove();for(const {layer}of layers)layer.remove();}};
}

// Geographic display coverage is not jurisdiction, topology or roadway authority.
export const daytonDisplayBounds=Object.freeze([[30.017,-94.948],[30.083,-94.852]].map(v=>Object.freeze(v)));
export function withinDaytonDisplay(center){return center.lat>=30.017&&center.lat<=30.083&&center.lng>=-94.948&&center.lng<=-94.852;}
export function createStandardBasemap(L,map,roads,context,landmarks,icons,{onState=()=>{}}={}){
 let active,disposed=false,id='dayton',failure=false;
 function localState(){onState({id:'dayton',health:failure?'fallback':'limited',coverage:withinDaytonDisplay(map.getCenter())?'Limited Dayton source extract · no county/regional coverage':'No local cartography coverage at this camera',attribution:'OpenStreetMap contributors · bounded Dayton extract',operationalGeometry:false});}
 function select(next){if(disposed)return;if(!['dayton','local-mock','arcgis-standard-fixture','arcgis-satellite-fixture'].includes(next))throw Error('Unapproved basemap provider');active?.destroy();active=null;id=next;if(next==='dayton'){active=createBasemap(L,map,roads,context,landmarks,icons);localState();}else{failure=false;active=(next==='local-mock'?createContinuousBasemap:createArcgisFixtureBasemap)(L,map,{id:next,onState:s=>{onState(s);if(s.health==='unavailable'){failure=true;queueMicrotask(()=>{if(!disposed&&id===next)select('dayton');});}}});}return id;}
 map.on('moveend',update);function update(){if(id==='dayton'&&!disposed)localState();}
 return {select,get id(){return id;},restyle(){active?.restyle();},refresh(){active?.refresh();},destroy(){if(disposed)return;disposed=true;map.off('moveend',update);active?.destroy();active=null;}};
}
