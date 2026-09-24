import fs from 'node:fs';import {spawn} from 'node:child_process';
while(!fs.existsSync('reports/lp24449b/extra-queue.json')||!JSON.parse(fs.readFileSync('reports/lp24449b/extra-queue.json')).completed)await new Promise(r=>setTimeout(r,1000));
const log=fs.openSync('.artifacts/lp24449b/ui-messages.log','w');const child=spawn(process.execPath,['tools/lp24449b/ui-messages.mjs'],{stdio:['ignore',log,log]});const exitCode=await new Promise(r=>child.on('close',r));fs.closeSync(log);console.log(JSON.stringify({job:'ui-messages',exitCode}));
