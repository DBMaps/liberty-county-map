import fs from 'node:fs';
let source=fs.readFileSync('tools/lp24449a/report.mjs','utf8').replaceAll('lp24449a','lp24449b');
source=source.replace("const required=name=>read(`reports/lp24449b/${name}.json`);","const required=name=>read(`reports/${name==='original-in-scope-failures'?'lp24449a':'lp24449b'}/${name}.json`);\nconst identityOut=`${out}/identity-regression`;fs.mkdirSync(identityOut,{recursive:true});");
source=source.replaceAll('`${out}/','`${identityOut}/');
// Inputs remain in the milestone root. Only this derived identity report set
// belongs in its own directory, so it cannot overwrite the 2,020-residual ledger.
source=source.replace('const identityOut=`${identityOut}/identity-regression`','const identityOut=`${out}/identity-regression`');
source=source.replace('const file=`${identityOut}/${name}.json`','const file=`${out}/${name}.json`');
fs.writeFileSync('tools/lp24449b/identity-report.mjs',source);
source=fs.readFileSync('tools/lp24449a/nueces-baseline.mjs','utf8').replaceAll('lp24449a','lp24449b').replaceAll("read('reports/lp24449b/original-in-scope-failures.json')","read('reports/lp24449a/original-in-scope-failures.json')");
fs.writeFileSync('tools/lp24449b/nueces-baseline.mjs',source);
