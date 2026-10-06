// Read-only regression fixture: serves ONLY the approved Dispatch UI Git blobs.
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
export const approvedHead='65b59e55d772b2de4d668f3f2e15d9140b7fc329';
export function approvedBoardServer(head=approvedHead) {
  const names=['index.html','app.mjs','auth.mjs','components.mjs','styles.css','themes.css','theme.js','demo/fixtures.mjs','assets/gridly-logo.png'];
  if(head!==approvedHead)names.push('map.css','view-preference.mjs','map-view.mjs','demo/dayton-roads.geojson','vendor/leaflet/leaflet.js','vendor/leaflet/leaflet.css');
  if(['86633d7e0e76d2775d4e1567da19fa18528198ce','85e982d78aaf1c01f419a6ada07f8a8d361b496f'].includes(head))names.push('basemap.mjs','marker-language.mjs','demo/dayton-context.geojson',...['water-over-road','train-front','traffic-signal-issue','debris-in-road'].map(name=>`assets/markers/${name}.png`));
  if(head==='85e982d78aaf1c01f419a6ada07f8a8d361b496f')names.push('map-label-policy.mjs','demo/dayton-landmarks.geojson');
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
