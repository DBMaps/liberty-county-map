import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {countyRegistryRange} from '../../scripts/lp189-statewide-runtime-activation-guarded.mjs';

export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const out=path.join(root,'reports/lp24449a');
export const artifacts=path.join(root,'.artifacts/lp24449a');
export const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));
export function write(p,data){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(data,null,2)+'\n');}
export function loadInventory(){
  const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),box={Object};
  vm.createContext(box);vm.runInContext(app.slice(0,countyRegistryRange(app).end)+';this.registry=GRIDLY_COUNTY_REGISTRY',box);
  const countySource=read('data/lp149/runtime-county-registry.json');
  const projection=read('data/generated/gridly-statewide-consumer-community-projection-v1.json');
  const presentation=read('data/generated/gridly-statewide-place-presentation-v1.json');
  const counties=countySource.identities.slice().sort((a,b)=>a.fips.localeCompare(b.fips));
  const communities=projection.communities.slice().sort((a,b)=>a.placeGeoid.localeCompare(b.placeGeoid));
  const rows=communities.flatMap(p=>p.countyMemberships.map((fips,i)=>{
    const c=counties.find(c=>c.fips===fips),point=presentation.places[p.placeGeoid];
    return {county_id:c?.countyId,county_fips:fips,county_name:c?.countyName,operational_county_id:c?.countyId,place_geoid:p.placeGeoid,community_name:p.displayName,canonical_place_name:p.displayName,membership_index:i+1,membership_count:p.countyMemberships.length,is_multi_county:p.countyMemberships.length>1,presentation_lat:point?.lat,presentation_lng:point?.lon??point?.lng};
  }));
  return {counties,communities,rows,presentation,registry:box.registry,projection};
}
export function hashes(){
  const tracked=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
  return tracked.filter(p=>/^(js\/|css\/|data\/|assets\/|Crossing-Packages\/|index\.html$|.*service.*worker|sw\.js$)/i.test(p)).map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}));
}
