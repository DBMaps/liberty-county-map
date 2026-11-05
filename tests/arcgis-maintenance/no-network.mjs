// Test-only guard. No sockets or provider requests are permitted in this milestone.
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';
import dns from 'node:dns';
import childProcess from 'node:child_process';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncBuiltinESMExports } from 'node:module';
const blocked = () => { const error = new Error('OFFLINE_NETWORK_BLOCKED'); error.code = 'OFFLINE_NETWORK_BLOCKED'; throw error; };
globalThis.fetch = blocked;
globalThis.WebSocket = class { constructor() { blocked(); } };
for (const [api, methods] of [
  [http, ['request','get']], [https, ['request','get']],
  [net, ['connect','createConnection']], [tls, ['connect']],
  [dgram, ['createSocket']], [dns, ['lookup','resolve','resolve4','resolve6']]
]) for (const method of methods) api[method] = blocked;
net.Socket.prototype.connect = blocked;
net.Server.prototype.listen = blocked;
for(const method of ['lookup','resolve','resolve4','resolve6'])if(dns.promises?.[method])dns.promises[method]=blocked;
// Existing protected tests need read-only Git and one audited offline verifier.
// Deny external network clients and propagate the guard to that verifier.
for(const method of ['spawnSync','execFileSync']){
 const original=childProcess[method];
 childProcess[method]=function(command,args=[],options={}){
  const name=basename(String(command)).toLowerCase().replace(/\.exe$/,'');
  if(name==='git'&&['show','diff','ls-files','check-ignore'].includes(args[0]))
   return original.call(this,command,args,{...options,shell:false});
 if(command==='/bin/ls'&&args.length===2&&args[0]==='-ldeO'&&typeof args[1]==='string'&&args[1].startsWith('/')&&!/[\r\n\u0000]/.test(args[1]))
   return original.call(this,command,args,{...options,shell:false}); // Read-only macOS ACL inspection only.
 if(command==='/sbin/mount'&&args.length===0)
   return original.call(this,command,args,{...options,shell:false}); // Inventory only; no mount/unmount operation.
  if((name==='node'||command===process.execPath)&&args.length===2
    &&args[0]==='tools/lp1841a/build-privacy-audit.mjs'&&args[1]==='verify')
   return original.call(this,command,['--import',fileURLToPath(import.meta.url),...args],{...options,shell:false});
  return blocked();
 };
}
for(const method of ['exec','execSync','execFile','spawn'])childProcess[method]=blocked;
syncBuiltinESMExports();
