import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, extname} from 'node:path';

const root = fileURLToPath(new URL('../../dispatch/', import.meta.url));
const files = new Set(['index.html','styles.css','map.css','view-preference.mjs','themes.css','theme.js','app.mjs','auth.mjs','components.mjs','assets/gridly-logo.png']);
export function previewServer({demo=false}={}) {
  return createServer(async (request,response) => {
    const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"};
    const send=(status,body='',type='text/plain')=>{response.writeHead(status,{...headers,'Content-Type':type});response.end(body);};
    // Loopback binding AND strict Host checks prevent network exposure / DNS rebinding.
    if(!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(request.headers.host||''))return send(403);
    if(request.method!=='GET' && request.method!=='HEAD')return send(405);
    let pathname;try{pathname=new URL(request.url,'http://127.0.0.1').pathname;}catch{return send(400);}
    if(pathname==='/__preview')return send(200,JSON.stringify({mode:demo?'local-fixtures':'login-only'}),'application/json');
    const name=pathname==='/'?'index.html':pathname.slice(1);
    if(!files.has(name) && !(demo && ['notice-preview-view.mjs','notice-preview.mjs','notice-schedule.mjs','road-selection.mjs','demo/fixtures.mjs','map-view.mjs','basemap.mjs','basemap-provider.mjs','marker-language.mjs','map-label-policy.mjs','demo/dayton-landmarks.geojson','demo/dayton-landmarks-provenance.json','demo/dayton-context.geojson','demo/dayton-context-provenance.json','assets/markers/water-over-road.png','assets/markers/train-front.png','assets/markers/traffic-signal-issue.png','assets/markers/debris-in-road.png','demo/dayton-roads.geojson','demo/dayton-roads-provenance.json','vendor/leaflet/leaflet.js','vendor/leaflet/leaflet.css','vendor/leaflet/LICENSE'].includes(name)))return send(404);
    try { const bytes=await readFile(resolve(root,name));send(200,request.method==='HEAD'?'':bytes,{'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.geojson':'application/geo+json','.json':'application/json'}[extname(name)]); } catch {send(404);}
  });
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.DISPATCH_UI_PORT||4178);
  previewServer({demo:process.argv.includes('--demo')}).listen(port,'127.0.0.1',()=>console.log(`Gridly Dispatch local preview: http://127.0.0.1:${port}/${process.argv.includes('--demo')?' (fixtures enabled)':''}`));
}
