import fs from 'node:fs';
const file='tools/lp24449b1/provider-matrix.mjs';let s=fs.readFileSync(file,'utf8');
if((s.match(/\.map\(r=>r\.id\)/g)||[]).length!==3)throw Error('Expected three retention ID selectors');
s=s.replaceAll('.map(r=>r.id)','.map(r=>r.evidenceId)');fs.writeFileSync(file,s);
const start=s.indexOf(" await refresh();await capture('healthy-empty');"),end=s.indexOf(' const officialRetention=await');if(start<0||end<0)throw Error('Retention boundaries absent');
let d=s.slice(0,start)+" fixture={road:'active',weather:'empty',alerts:'empty'};await refresh();\n"+s.slice(end);
d=d.replaceAll('provider-health-matrix.json','provider-official-retention.json').replace('states.length===10&&states.every(s=>s.pass)&&officialRetention.pass','officialRetention.pass').replace('pass:before.published===1','pass:before.official.length===1&&before.official.every(id=>typeof id==="string"&&id.length>0)&&before.published===1');
fs.writeFileSync('tools/lp24449b1/provider-official-retention.mjs',d);
