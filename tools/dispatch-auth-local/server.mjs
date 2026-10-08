import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {previewServer} from '../dispatch-ui/serve.mjs';
import {localSession} from './session.mjs';
export function localAuthServer(config){
 if(config.demo)throw Error('Operational authentication and demo cannot be combined');
 const session=localSession(config),fallback=previewServer().listeners('request')[0];
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"};
 return createServer(async(request,response)=>{
  const send=(status,body='',type='text/plain')=>{response.writeHead(status,{...headers,'Content-Type':type});response.end(body)};
  if(!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(request.headers.host||''))return send(403);
  const url=new URL(request.url,'http://127.0.0.1');
  if(url.pathname.startsWith('/api/'))return session(request,response,headers);
  if(!['GET','HEAD'].includes(request.method))return send(405);
  if(url.pathname==='/__preview')return send(200,JSON.stringify({mode:'local-auth'}),'application/json');
  if(url.pathname==='/local-auth-view.mjs'){const bytes=await readFile(new URL('../../dispatch/local-auth-view.mjs',import.meta.url));return send(200,request.method==='HEAD'?'':bytes,'text/javascript')}
  return fallback(request,response);
 });
}
