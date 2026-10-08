import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {join} from 'node:path';
import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {localAuthServer} from './server.mjs';
import {previewServer} from '../dispatch-ui/serve.mjs';
export async function certifyBrowser(t,{api,anon,project,evidence,owner,aal1,foreign,org,unit,second,foreignUnit,member,sql,q,totp,http}){
 let failed=false;const checked=(name,fn)=>t.test(name,{timeout:30000},async()=>{try{await fn()}catch(error){failed=true;throw error}});
 let offset=0;const config={apiUrl:api,anonKey:anon,project,allowedUsers:[owner.id,aal1.id],now:()=>Date.now()+offset};
 const server=localAuthServer(config);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true});let context,page;const requests=[],allowedOrigins=new Set([base]);
 const reset=async(viewport={width:1440,height:900})=>{if(context)await context.close();context=await browser.newContext({viewport});context.on('request',request=>requests.push(request));page=await context.newPage();await page.goto(base+'/?demo=1&role=OWNER&unit='+foreignUnit);await page.locator('#login').waitFor();};
 const login=async(actor=owner)=>{await page.locator('#email').fill(actor.email);await page.locator('#password').fill(actor.password);await page.locator('#login button[type=submit]').click();await page.locator('#totp').waitFor();};
 const verify=async(secret=owner.secret)=>{await page.locator('#code').fill(totp(secret));await page.locator('#totp button').click();await page.locator('#authorized-unit').waitFor();};
 const shot=async name=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:join(evidence,name+'.png'),fullPage:true});};
 let cookie='';async function call(route,body){const r=await fetch(base+'/api/'+route,{method:body===undefined?'GET':'POST',headers:{'X-Gridly-Dispatch':'local-auth',Origin:base,...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});const c=r.headers.get('set-cookie');if(c)cookie=c.split(';')[0];return {status:r.status,data:await r.json(),cookie:c};}
 async function apiLogin(actor=owner){cookie='';const r=await call('login',{email:actor.email,password:actor.password});assert.equal(r.status,200);assert.equal(r.data.state,'mfa-required');return r;}
 async function apiVerify(){const r=await call('verify',{code:totp(owner.secret)});assert.equal(r.status,200);assert.equal(r.data.units.length,2);return r;}
 try{
 await checked('local mode refuses production configuration and mixed demo',()=>{assert.throws(()=>localAuthServer({...config,apiUrl:'https://production.invalid'}));assert.throws(()=>localAuthServer({...config,demo:true}));assert.throws(()=>localAuthServer({...config,allowedUsers:[]}));});
 await checked('disposable Auth public self-registration remains disabled',async()=>{await http('/auth/v1/signup',{body:{email:'not-provisioned-'+randomUUID()+'@dispatch.invalid',password:randomUUID()},statuses:[400,403,422]});});
 await checked('anonymous, cross-origin, authority arguments and unknown write routes denied',async()=>{
  cookie='';assert.equal((await call('context')).status,401);
  const r=await fetch(base+'/api/login',{method:'POST',headers:{Origin:'http://foreign.invalid','X-Gridly-Dispatch':'local-auth','Content-Type':'application/json'},body:'{}'});assert.equal(r.status,403);
  assert.equal((await call('login',{email:owner.email,password:owner.password,role:'OWNER'})).status,400);
  assert.equal((await call('context?unit='+foreignUnit)).status,404);assert.equal((await call('notices',{unit_id:foreignUnit})).status,404);
 });
 await checked('AAL1 session cannot receive authorized context',async()=>{await apiLogin();assert.equal((await call('context')).status,403);assert.equal((await call('context')).status,401);});
 await checked('unallowlisted synthetic identity denied despite valid password',async()=>{cookie='';assert.equal((await call('login',{email:foreign.email,password:foreign.password})).status,401);});
 await checked('desktop login, real TOTP, authorized units and refresh recovery',async()=>{
  await reset();await shot('desktop-login');await page.locator('#recover').click();assert.match(await page.locator('#auth-message').innerText(),/No recovery email/);
  await login();await shot('desktop-mfa');await verify();await shot('desktop-authorized');assert.equal(await page.locator('#authorized-unit option').count(),2);
  await page.locator('#authorized-unit').selectOption(second);await expect(page.locator('#authorized-unit')).toHaveValue(second);
  await page.reload();await page.locator('#authorized-unit').waitFor();assert.equal(await page.locator('#authorized-unit option').count(),2);
 });
 await checked('browser has opaque HttpOnly cookie and no JWT or private credentials',async()=>{
  const cookies=await context.cookies();const c=cookies.find(v=>v.name==='gridlyLocalDispatch');assert.ok(c?.httpOnly);assert.equal(c.sameSite,'Strict');assert.equal(c.path,'/api/');assert.match(c.value,/^[a-f0-9]{64}$/);
  const state=await page.evaluate(()=>({cookie:document.cookie,local:JSON.stringify(localStorage),session:JSON.stringify(sessionStorage),html:document.documentElement.innerHTML}));assert.ok(!state.cookie.includes(c.value));for(const value of Object.values(state))assert.ok(!/eyJ[a-zA-Z0-9_-]+\./.test(value));
  assert.ok(!state.html.includes(owner.password));assert.ok(!state.html.includes(owner.secret));
  const r=await page.evaluate(async()=>{const response=await fetch('/api/context',{headers:{'X-Gridly-Dispatch':'local-auth'}});return response.json()});assert.deepEqual(Object.keys(r).sort(),['ok','state','units']);for(const u of r.units)assert.deepEqual(Object.keys(u).sort(),['organization_display_name','organization_id','unit_display_name','unit_id']);
 });
 await checked('forged browser department does not become authority',async()=>{
  await page.evaluate(id=>{const s=document.querySelector('#authorized-unit');const option=document.createElement('option');option.value=id;option.textContent='Forged department';s.append(option);s.value=id;s.dispatchEvent(new Event('change'))},foreignUnit);
  await page.locator('#retry-login').waitFor();assert.match(await page.locator('#auth-message').innerText(),/Department access denied/);await shot('desktop-denied');
 });
 await checked('mobile login/MFA/context and revoked membership denied on next request',async()=>{
  await reset({width:390,height:844});await shot('mobile-login');await login();await shot('mobile-mfa');await verify();await shot('mobile-authorized');
  sql(`UPDATE dispatch_private.organization_memberships SET status='REVOKED' WHERE id='${member}'`);
  try{await page.locator('#authorized-unit').selectOption(second);await page.locator('#retry-login').waitFor();await shot('mobile-denied');assert.equal(await page.locator('#authorized-unit').count(),0);await page.reload();await page.locator('#login').waitFor();}
  finally{sql(`UPDATE dispatch_private.organization_memberships SET status='ACTIVE' WHERE id='${member}'`)}
 });
 await checked('manual enrollment only for explicitly provisioned synthetic user',async()=>{
  const membership=randomUUID();sql(`INSERT INTO dispatch_private.organization_memberships(id,organization_id,user_id,status,role_template) VALUES('${membership}','${org}',${q(aal1.id)},'ACTIVE','VIEWER'); INSERT INTO dispatch_private.unit_memberships(organization_id,unit_id,membership_id) VALUES('${org}','${unit}','${membership}');`);
  try{await reset();await login(aal1);await page.locator('#enroll').click();await expect(page.locator('#enrollment-secret')).toContainText('setup key');const secret=(await page.locator('#enrollment-secret').innerText()).split(': ').at(-1);await verify(secret);assert.equal(await page.locator('#authorized-unit option').count(),1);await page.locator('#logout').click();await page.locator('#login').waitFor();assert.match(await page.locator('#auth-message').innerText(),/Signed out/)}
  finally{sql(`DELETE FROM dispatch_private.unit_memberships WHERE membership_id='${membership}'; DELETE FROM dispatch_private.organization_memberships WHERE id='${membership}'`)}
 });
 await checked('access expiration and explicit token renewal preserve only current authority',async()=>{
  await apiLogin();await apiVerify();offset=901000;try{const r=await call('context');assert.equal(r.status,401);assert.equal(r.data.state,'refresh-required')}finally{offset=0}
  const r=await call('refresh',{});assert.equal(r.status,200);assert.equal(r.data.units.length,2);assert.equal((await call('context')).status,200);
 });
 await checked('revoked session cannot recover through refresh',async()=>{
  sql(`DELETE FROM auth.sessions WHERE user_id=${q(owner.id)}`,{user:'supabase_admin'});assert.equal((await call('refresh',{})).status,403);assert.equal((await call('context')).status,401);
 });
 await checked('logout revokes upstream sessions and clears local cookie',async()=>{
  await apiLogin();await apiVerify();const r=await call('logout',{});assert.equal(r.status,200);assert.equal(r.data.upstreamRevocationConfirmed,true);assert.match(r.cookie,/Max-Age=0/);assert.equal((await call('context')).status,401);assert.equal(sql(`SELECT count(*) FROM auth.sessions WHERE user_id=${q(owner.id)}`,{user:'supabase_admin'}),'0');
 });
 await checked('operational server never exposes demo composer or private fixture assets',async()=>{for(const path of ['/notice-preview.mjs','/notice-preview-view.mjs','/demo/fixtures.mjs','/demo/dayton-roads.geojson'])assert.equal((await fetch(base+path)).status,404);});
 await checked('independent synthetic demo retains composer without operational routes',async()=>{
  const demo=previewServer({demo:true});await new Promise(resolve=>demo.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+demo.address().port;allowedOrigins.add(url);
  try{assert.equal((await fetch(url+'/local-auth-view.mjs')).status,404);assert.equal((await fetch(url+'/api/login',{method:'POST'})).status,405);await page.goto(url+'/?demo=1');await page.getByRole('button',{name:'Draft Notice Preview',exact:true}).waitFor();assert.equal(await page.locator('#authorized-unit').count(),0)}finally{demo.closeAllConnections();await new Promise(resolve=>demo.close(resolve))}
 });
 await checked('all operational HTTP requests remain on loopback and create no notices',async()=>{assert.equal(server.address().address,'127.0.0.1');for(const request of requests){assert.ok(allowedOrigins.has(new URL(request.url()).origin));assert.equal(request.headers().authorization,undefined);assert.equal(request.headers().apikey,undefined);assert.ok(!/eyJ[a-zA-Z0-9_-]+\./.test(request.postData()||''));}assert.equal(sql('SELECT count(*) FROM dispatch_private.operational_records'),'0');assert.equal(sql('SELECT count(*) FROM dispatch_private.capability_grants'),'0');});
 if(failed)throw Error('Browser/session certification failed');writeFileSync(join(evidence,'browser-gates.json'),JSON.stringify({result:'PASS',tests:16,viewports:['1440x900','390x844'],accessExpiry:'injected server clock; real Auth refresh',noticeWrites:0,demoIndependent:true},null,2));
 }finally{offset=0;if(context)await context.close();await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
}
