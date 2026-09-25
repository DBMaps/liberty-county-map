import fs from 'node:fs';
const input=fs.readFileSync('tools/lp24449b1/publication-race.mjs','utf8');
const counties=['dallas-tx','mills-tx','liberty-tx','el-paso-tx','potter-tx','galveston-tx','cameron-tx','aransas-tx','loving-tx','smith-tx'];
let output=input.replace("suffix=process.argv.includes('--after')?'after':'before'","suffix='controls'");
output=output.replace("[['montgomery-tx','4816432'],['montague-tx','4809640'],['bexar-tx','4801600'],['dallas-tx','4801240'],['mills-tx','4830056']]",JSON.stringify(counties.map(c=>[c,c==='aransas-tx'?'4803600':null])));
output=output.replace('for(const publish of [false,true])','for(const publish of [true])');
if(output===input||!output.includes('4803600'))throw Error('Control preparation failed');
fs.writeFileSync('tools/lp24449b1/control-group.mjs',output);
const file='tools/lp24449b1/identity-report.mjs';let identity=fs.readFileSync(file,'utf8');identity=identity.replaceAll("required('starting-baseline').protectedFiles", "required('starting-baseline').tracked");fs.writeFileSync(file,identity);
