import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
// Read-only regression fixture: serves ONLY the approved Dispatch UI Git blobs.
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
export const approvedHead='65b59e55d772b2de4d668f3f2e15d9140b7fc329';
export function approvedBoardServer(head=approvedHead) {
  const names=['index.html','app.mjs','auth.mjs','components.mjs','styles.css','themes.css','theme.js','demo/fixtures.mjs','assets/gridly-logo.png'];
  if(head!==approvedHead)names.push('map.css','view-preference.mjs','map-view.mjs','demo/dayton-roads.geojson','vendor/leaflet/leaflet.js','vendor/leaflet/leaflet.css');
  if(['86633d7e0e76d2775d4e1567da19fa18528198ce','85e982d78aaf1c01f419a6ada07f8a8d361b496f','6bdccd803e9a30d294db7a3bbc015e86ce485210'].includes(head))names.push('basemap.mjs','marker-language.mjs','demo/dayton-context.geojson',...['water-over-road','train-front','traffic-signal-issue','debris-in-road'].map(name=>`assets/markers/${name}.png`));
  if(['85e982d78aaf1c01f419a6ada07f8a8d361b496f','6bdccd803e9a30d294db7a3bbc015e86ce485210'].includes(head))names.push('map-label-policy.mjs','demo/dayton-landmarks.geojson');
  const blobs=new Map(names.map(name=>[name,execFileSync('git',['show',`${head}:dispatch/${name}`],{maxBuffer:1024*1024})]));
  return createServer((req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname;
    res.setHeader('Cache-Control','no-store');
    if(path==='/__preview'){res.setHeader('Content-Type','application/json');return res.end('{"mode":"local-fixtures"}');}
    const name=path==='/'?'index.html':path.slice(1),blob=blobs.get(name);
    if(!blob){res.writeHead(404);return res.end();}
    res.setHeader('Content-Type',name.endsWith('.css')?'text/css':/\.m?js$/.test(name)?'text/javascript':name.endsWith('.geojson')?'application/geo+json':name.endsWith('.png')?'image/png':'text/html');res.end(blob);
  });
}

const require=createRequire(import.meta.url),{PNG}=require(join(dirname(require.resolve('playwright-core/package.json')),'lib/utilsBundle.js'));
// Canvas edge rasterization can vary by one channel level at an isolated pixel.
// Keep Board byte-exact; allow at most two such pixels in the entire map view.
export function sameMapPixels(a,b){if(a.equals(b))return true;const x=PNG.sync.read(a),y=PNG.sync.read(b);if(x.width!==y.width||x.height!==y.height)return false;let changed=0;for(let i=0;i<x.data.length;i+=4){let different=false;for(let j=0;j<4;j++){const d=Math.abs(x.data[i+j]-y.data[i+j]);if(d>1)return false;if(d)different=true;}if(different&&++changed>2)return false;}return true;}
