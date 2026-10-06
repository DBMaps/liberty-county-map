// Offline transform of the bounded public OSM API response. No operational fetch.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
const bytes=await readFile(new URL('dispatch/demo/source/dayton-context-osm.json',root));
const data=JSON.parse(bytes),nodes=new Map(data.elements.filter(e=>e.type==='node').map(e=>[e.id,[e.lon,e.lat]]));
const bbox=[-94.915,30.03,-94.865,30.065],features=[];
for(const e of data.elements){
  const t=e.tags||{};let layer=t.railway==='rail'?'rail':t.railway==='level_crossing'?'crossing':t.waterway?'waterway':t.natural==='water'?'water':t.place==='town'?'locality':null;
  if(!layer)continue;
  let geometry;
  if(e.type==='node')geometry={type:'Point',coordinates:[e.lon,e.lat]};
  else if(e.type==='way'){
    const coordinates=e.nodes.map(id=>nodes.get(id));if(coordinates.some(p=>!p))throw new Error('Incomplete OSM way');
    const closed=e.nodes[0]===e.nodes.at(-1);
    if(layer==='water'&&!closed)continue;
    geometry=layer==='water'?{type:'Polygon',coordinates:[coordinates]}:{type:'LineString',coordinates};
  }else continue;
  features.push({type:'Feature',properties:{osmId:`${e.type}/${e.id}`,layer,name:t.name||'',railway:t.railway||'',waterway:t.waterway||''},geometry});
}
const result={type:'FeatureCollection',bbox,attribution:'© OpenStreetMap contributors',license:'https://opendatacommons.org/licenses/odbl/1-0/',features};
await writeFile(new URL('dispatch/demo/dayton-context.geojson',root),JSON.stringify(result)+'\n');
await writeFile(new URL('dispatch/demo/dayton-context-provenance.json',root),JSON.stringify({source:'https://api.openstreetmap.org/api/0.6/map.json?bbox=-94.915,30.03,-94.865,30.065',acquired:'2026-10-06',sha256:createHash('sha256').update(bytes).digest('hex'),bbox,license:result.license,attribution:result.attribution,counts:Object.fromEntries(['rail','crossing','waterway','water','locality'].map(k=>[k,features.filter(f=>f.properties.layer===k).length])),transform:'Resolve way node references without changing coordinates. Keep active rail, level crossings, waterways, closed water polygons, town labels. Allowlist identifiers and cartographic tags; exclude contributor identities and all unrelated features. Complete selected ways may extend beyond request bounds. No inferred rail crossings or jurisdiction boundaries.'},null,2)+'\n');
console.log(`${features.length} sourced context features`);
