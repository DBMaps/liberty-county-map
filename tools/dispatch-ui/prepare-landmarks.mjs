// Offline extraction from the already acquired OSM map response.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),source='dispatch/demo/source/dayton-context-osm.json';
const bytes=await readFile(new URL(source,root)),data=JSON.parse(bytes);
const nodes=new Map(data.elements.filter(e=>e.type==='node').map(e=>[e.id,[e.lon,e.lat]]));
const classes={police:'police',fire_station:'fire',ambulance_station:'ems',hospital:'hospital',townhall:'municipal',school:'school',community_centre:'civic'};
const candidates=[];
for(const e of data.elements){
  const t=e.tags||{},category=classes[t.amenity]||(t.emergency==='ambulance_station'?'ems':t.leisure==='park'?'park':null);
  if(!category||!t.name)continue;
  let coordinates,positionMethod;
  if(e.type==='node'){coordinates=[e.lon,e.lat];positionMethod='Source node';}
  else if(e.type==='way'&&e.nodes[0]===e.nodes.at(-1)){
    const points=e.nodes.map(id=>nodes.get(id));if(points.some(p=>!p))continue;
    coordinates=[(Math.min(...points.map(p=>p[0]))+Math.max(...points.map(p=>p[0])))/2,(Math.min(...points.map(p=>p[1]))+Math.max(...points.map(p=>p[1])))/2];positionMethod='Representative center of source footprint bounds; not an entrance';
  }else continue;
  candidates.push({type:'Feature',properties:{osmId:`${e.type}/${e.id}`,name:t.name,category,source:'OpenStreetMap',sourceModified:e.timestamp,positionMethod,authority:'Geographic orientation only; facility not independently verified'},geometry:{type:'Point',coordinates}});
}
const duplicateNames=[...new Set(candidates.filter(a=>candidates.filter(b=>b.properties.name===a.properties.name).length>1).map(f=>f.properties.name))];
const features=candidates.filter(f=>!duplicateNames.includes(f.properties.name));
const metadata={attribution:'© OpenStreetMap contributors',license:'https://opendatacommons.org/licenses/odbl/1-0/'};
await writeFile(new URL('dispatch/demo/dayton-landmarks.geojson',root),JSON.stringify({type:'FeatureCollection',...metadata,features})+'\n');
await writeFile(new URL('dispatch/demo/dayton-landmarks-provenance.json',root),JSON.stringify({...metadata,source:'https://api.openstreetmap.org/api/0.6/map.json?bbox=-94.915,30.03,-94.865,30.065',acquired:'2026-10-06',rawSha256:createHash('sha256').update(bytes).digest('hex'),requestBounds:[-94.915,30.03,-94.865,30.065],transform:'Named allowlisted civic/emergency features only. Original node or center of closed-way footprint bounds. Drop all ambiguous duplicate names, unnamed features, commercial POIs, contacts/addresses and contributor identities.',omittedDuplicateNames:duplicateNames,counts:Object.fromEntries([...new Set(features.map(f=>f.properties.category))].map(k=>[k,features.filter(f=>f.properties.category===k).length])),limitations:'Finite OSM snapshot, not an official facility directory. No verification of operational availability, emergency access, current name or entrance. Categories absent from the extract are omitted.'},null,2)+'\n');
console.log(features.map(f=>`${f.properties.category}: ${f.properties.name}`).join('\n'));
