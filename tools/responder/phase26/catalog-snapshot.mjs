// LOCAL DISPOSABLE REHEARSAL ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const [input,output]=process.argv.slice(2);
if(!input||!output) throw new Error('usage: node catalog-snapshot.mjs input.json output.json');
const parsed=JSON.parse(readFileSync(input,'utf8'));
const canonical=JSON.stringify(sort(parsed));
const evidence={algorithm:'sha256',hash:createHash('sha256').update(canonical).digest('hex'),catalog:sort(parsed)};
writeFileSync(output,`${JSON.stringify(evidence,null,2)}\n`);
function sort(v){if(Array.isArray(v))return v.map(sort).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]));return v;}
