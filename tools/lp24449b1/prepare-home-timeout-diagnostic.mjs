import fs from 'node:fs';
let code=fs.readFileSync('tools/lp24449b1/home-browser.mjs','utf8');
code=code.replace('const cohort=inv.rows.filter','let cohort=inv.rows.filter');
const anchor='write(`${out}/browser-cohort.json`';
if(!code.includes(anchor))throw Error('Home cohort anchor absent');
code=code.replace(anchor,"cohort=['hamilton-tx|4833548','harris-tx|4801696'].map(k=>inv.rows.find(r=>`${r.county_id}|${r.place_geoid}`===k));\nprocess.argv.push('--await-weather','--diagnostic-weather');\nfs.mkdirSync(`${artifacts}/home-timeout-diagnostic`,{recursive:true});\n"+anchor);
code=code.replaceAll('${out}/','${out}/home-timeout-diagnostic/').replaceAll('${artifacts}/','${artifacts}/home-timeout-diagnostic/');
code=code.replace('`${artifacts}/home-timeout-diagnostic/home-timeout-diagnostic`','`${artifacts}/home-timeout-diagnostic`');
fs.writeFileSync('tools/lp24449b1/home-timeout-diagnostic.mjs',code);
