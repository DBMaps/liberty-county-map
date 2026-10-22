// Sequential, counterbalanced baseline/candidate pairs. Never overlap timed runs.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=process.cwd(),dir=path.resolve(process.env.STATEWIDE_OUTPUT_DIR||'.artifacts/community-loading-statewide');fs.mkdirSync(dir,{recursive:true});
const matrix=require('./statewide-matrix.json').filter(row=>!process.env.STATEWIDE_CASES||process.env.STATEWIDE_CASES.split(',').includes(row.name));
const fixtureIndex=path.join(dir,'fixture-index.json'),repetitions=Number(process.env.STATEWIDE_REPETITIONS||3),schedule=[];
for(let repetition=0;repetition<repetitions;repetition++)for(const row of repetition%2?matrix.slice().reverse():matrix)for(const phase of repetition%2?['after','before']:['before','after'])schedule.push({repetition,...row,phase});
fs.writeFileSync(path.join(dir,'schedule.json'),JSON.stringify({method:'counterbalanced interleaved cold contexts, one navigation per process; identical provider/road fixture index',repetitions,schedule},null,2));
for(const item of schedule){
 const destination=path.join(dir,'runs',item.name.replaceAll(' ','_'),String(item.repetition),item.phase);fs.mkdirSync(destination,{recursive:true});
 const resultFile=path.join(destination,item.phase+'-baseline.json');
 if(process.env.STATEWIDE_RESUME==='1'&&fs.existsSync(resultFile)&&fs.existsSync(path.join(destination,item.phase+'-metadata.json'))){console.log('retained complete',JSON.stringify(item));continue;}
 console.log('START',new Date().toISOString(),JSON.stringify(item));
 const result=cp.spawnSync(process.execPath,[path.join(__dirname,'replay.cjs')],{cwd:root,env:{...process.env,REPAIR_OUTPUT_DIR:destination,REPAIR_BASELINE_REF:'faac47368da3137b50d53813b7f0299a2f4b1830',REPAIR_PHASE:item.phase,AUDIT_MATRIX_FILE:path.join(__dirname,'statewide-matrix.json'),AUDIT_CASES:item.name,AUDIT_RUNS:'1',AUDIT_ROAD_REPLAY:'1',AUDIT_HOST:'preview.gridlygo.com',REPAIR_CHECKS:'0',REPAIR_NWS_CHECKS:'0',REPAIR_ACTIVE_POPUP:'0',STATEWIDE_METRICS:'1',STATEWIDE_FIXTURE_INDEX:fixtureIndex},encoding:'utf8',maxBuffer:16*1024*1024,timeout:1200000});
 fs.writeFileSync(path.join(destination,'replay.log'),(result.stdout||'')+(result.stderr||''));
 console.log(result.stdout?.split('\n').filter(Boolean).slice(-1).join('\n'));if(result.status!==0){console.error(result.error||result.stderr);process.exit(result.status||1);}
 assert.equal(JSON.parse(fs.readFileSync(resultFile)).length,1);console.log('DONE',new Date().toISOString(),JSON.stringify(item));
}
