// Read-only local cartography. No consumer map/state imports and no tile requests.
export function createBasemap(L,map,roadData,contextData){
  const layers=[],labels=L.layerGroup().addTo(map);
  const css=()=>getComputedStyle(document.documentElement);
  const color=name=>css().getPropertyValue('--map-'+name).trim();
  const major=f=>/^(trunk|primary|secondary)/.test(f.properties.highway||'');
  const arterial=f=>/^(tertiary)/.test(f.properties.highway||'');
  function roadStyle(f,casing=false){
    const width=major(f)?7:arterial(f)?5:3;
    return {color:color(casing?'road-casing':major(f)?'road-major':arterial(f)?'road-arterial':'road-local'),weight:width+(casing?2:0),opacity:1,lineCap:'round'};
  }
  function add(data,style,extra={}){const layer=L.geoJSON(data,{interactive:false,renderer:L.canvas(),style,...extra}).addTo(map);layers.push({layer,style});return layer;}
  const subset=predicate=>({...contextData,features:contextData.features.filter(predicate)});
  add(subset(f=>f.properties.layer==='water'),()=>({color:color('water-edge'),weight:1,fillColor:color('water'),fillOpacity:1}));
  add(subset(f=>f.properties.layer==='waterway'),()=>({color:color('water-edge'),weight:3,opacity:1}));
  add(roadData,f=>roadStyle(f,true));add(roadData,f=>roadStyle(f));
  const rail=subset(f=>f.properties.layer==='rail');
  add(rail,()=>({color:color('rail-halo'),weight:5,opacity:1}));
  add(rail,()=>({color:color('rail'),weight:2,opacity:1}));
  add(rail,()=>({color:color('rail'),weight:6,dashArray:'2 9',lineCap:'butt',opacity:1}));
  add(subset(f=>f.properties.layer==='crossing'),()=>({}),{pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:4,color:color('rail'),fillColor:color('land'),fillOpacity:1,weight:2,interactive:false})});
  const short=name=>name.replace(/North /g,'N ').replace(/South /g,'S ').replace(/East /g,'E ').replace(/West /g,'W ').replace(/ Street/g,' St').replace(/ Road/g,' Rd').replace(/ Avenue/g,' Ave').replace(/Railroad/g,'RR').replaceAll(';',' / ');
  function redrawLabels(){
    labels.clearLayers();const size=map.getSize(),candidates=[];
    const visible=p=>p.x>45&&p.x<size.x-25&&p.y>20&&p.y<size.y-25;
    const namedArterials=roadData.features.filter(f=>f.properties.ref&&f.properties.name).map(f=>({...f,properties:{...f.properties,ref:''}}));
    for(const feature of [...roadData.features,...namedArterials,...contextData.features]){
      const p=feature.properties,kind=p.highway?(p.ref?'highway':'street'):p.layer;
      const name=p.ref||p.name;if(!name||kind==='crossing'||kind==='water')continue;
      if(feature.geometry.type==='Point'){
        if(kind!=='locality')continue;const c=feature.geometry.coordinates,ll=L.latLng(c[1],c[0]),point=map.latLngToContainerPoint(ll);
        if(visible(point))candidates.push({name,kind,ll,point,angle:0,rank:0,length:1000});continue;
      }
      if(feature.geometry.type!=='LineString')continue;
      // Simplify only label placement, never rendered/source geometry. Dense OSM
      // vertices must not suppress names along an otherwise straight road.
      const points=L.LineUtil.simplify(feature.geometry.coordinates.map(c=>map.latLngToContainerPoint([c[1],c[0]])),3);
      for(let i=1;i<points.length;i++){
        const clipped=L.LineUtil.clipSegment(points[i-1],points[i],L.bounds([45,20],[size.x-25,size.y-25]),false,true);if(!clipped)continue;
        const [a,b]=clipped,length=a.distanceTo(b);if(length<30)continue;
        for(const t of [.5,.25,.75,.1,.9]){
          const point=L.point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);if(!visible(point))continue;
          let angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;if(angle>90)angle-=180;if(angle< -90)angle+=180;
          const rank=/Winfree/.test(name)?.5:/Main/.test(name)?.6:kind==='rail'?.8:kind==='highway'?1:kind==='waterway'?4:5;
          candidates.push({name,kind,ll:map.containerPointToLatLng(point),point,angle:kind==='highway'?0:angle,rank,length});
        }
      }
    }
    candidates.sort((a,b)=>a.rank-b.rank||b.length-a.length);
    const placed=[],names=new Set();
    for(const c of candidates){
      if(names.has(c.name))continue;const text=short(c.name),w=text.length*(c.kind==='locality'?8:6.1)+12,h=20;
      const radians=c.angle*Math.PI/180,bw=Math.abs(w*Math.cos(radians))+Math.abs(h*Math.sin(radians)),bh=Math.abs(w*Math.sin(radians))+Math.abs(h*Math.cos(radians));
      const box={l:c.point.x-bw/2-5,r:c.point.x+bw/2+5,t:c.point.y-bh/2-5,b:c.point.y+bh/2+5};
      if(box.l<42||box.r>size.x-10||box.t<10||box.b>size.y-20||placed.some(b=>box.l<b.r&&box.r>b.l&&box.t<b.b&&box.b>b.t))continue;
      const node=document.createElement('span');node.textContent=text;node.style.transform=`translate(-50%,-50%) rotate(${c.angle}deg)`;
      const marker=L.marker(c.ll,{interactive:false,keyboard:false,zIndexOffset:-1000,icon:L.divIcon({className:`map-context-label label-${c.kind}`,html:node,iconSize:[0,0]})}).addTo(labels);
      marker.getElement().dataset.contextLabel=c.kind;marker.getElement().setAttribute('aria-label',c.name);
      placed.push(box);names.add(c.name);
    }
  }
  function restyle(){for(const {layer,style}of layers)layer.setStyle(style);redrawLabels();}
  map.on('moveend zoomend resize',redrawLabels);redrawLabels();
  return {restyle,destroy(){map.off('moveend zoomend resize',redrawLabels);labels.remove();for(const {layer}of layers)layer.remove();}};
}
