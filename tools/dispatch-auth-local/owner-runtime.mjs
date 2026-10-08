// Interactive runtime. No automatic password sign-in, factor enrollment or browser authorization.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {localFixture} from './owner-fixture.mjs';
import {localAuthServer} from './server.mjs';
const runtime=process.env.DISPATCH_OWNER_RUNTIME;
let server,timer,closed=false,phase='configuration';
async function stop(){if(closed)return;closed=true;clearInterval(timer);if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}process.exit(0)}
try{
 if(!runtime||!/^gridly-dispatch-auth-[a-f0-9]{12}$/.test(runtime.split(/[\\/]/).at(-1)))throw Error('Owned runtime required');
 const fixture=localFixture({api:process.env.DISPATCH_LOCAL_API,anon:process.env.DISPATCH_LOCAL_ANON,service:process.env.DISPATCH_LOCAL_SERVICE,docker:process.env.DISPATCH_LOCAL_DOCKER,project:process.env.DISPATCH_LOCAL_PROJECT});
 phase='installation';const proof=fixture.install();phase='provisioning';const account=await fixture.provision();
 const ps=join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
 const secretPath=join(runtime,'credentials.dpapi'),script=new URL('./owner-credentials.ps1',import.meta.url);
 const {fileURLToPath}=await import('node:url');
 const sealed=spawnSync(ps,['-NoProfile','-NonInteractive','-File',fileURLToPath(script),'-Mode','Seal','-Path',secretPath],{input:JSON.stringify({email:account.email,password:account.password}),encoding:'utf8',windowsHide:true,env:{...Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('DISPATCH_'))),PSModulePath:join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','Modules')}});if(sealed.status!==0)throw Error('Private handoff failed');
 account.password='';phase='after-provision';if(process.env.DISPATCH_OWNER_FAULT==='AfterProvision')throw Error('Injected provisioning refusal');
 phase='UI-start';const anon=process.env.DISPATCH_LOCAL_ANON,project=process.env.DISPATCH_LOCAL_PROJECT;for(const key of ['DISPATCH_LOCAL_SERVICE','DISPATCH_LOCAL_ANON','DISPATCH_LOCAL_API','DISPATCH_LOCAL_DOCKER'])delete process.env[key];
 server=localAuthServer({apiUrl:'http://127.0.0.1:54321',anonKey:anon,project,allowedUsers:[account.userId]});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4180,'127.0.0.1',resolve)});
 writeFileSync(join(runtime,'ready.json'),JSON.stringify({project,url:'http://127.0.0.1:4180/',pid:process.pid,userId:account.userId,organization:account.organization,units:account.units,credentialPath:secretPath,...proof}));
 timer=setInterval(()=>{if(existsSync(join(runtime,'stop.request')))void stop()},250);process.on('SIGINT',stop);process.on('SIGTERM',stop);
}catch{if(runtime)writeFileSync(join(runtime,'failed.json'),JSON.stringify({error:'Owner runtime startup failed; see cleanup result.',phase}));if(server)server.closeAllConnections();process.exit(1)}
