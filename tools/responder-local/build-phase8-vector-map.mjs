// Frozen local vector accounting only. No database or network access.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const prior=JSON.parse(fs.readFileSync(path.join(root,'reports/responder/responder-phase7-vector-map.json'),'utf8'));
const newIds=new Set(['N26-unauthorized-governance','P01-viewer-dashboard','P20-member-self-read']);
const vectors=prior.vectors.map(v=>newIds.has(v.id)
  ? {id:v.id,classification:'NEWLY PASSED PHASE 8 FULL VECTOR'} : {...v});
const select=c=>vectors.filter(v=>v.classification===c).map(v=>v.id);
const result={
  contractVersion:'responder.agency.v1.phase0.1',
  mappingVersion:'responder.agency.v1.phase8.1',
  classificationRule:'Full vectors require exact bounded result, state, audit/receipt where applicable, and observable public projection. Phase 8 read vectors require live-role scope and no business side effect.',
  counts:{total:54,previouslyComplete:51,newlyCompletePhase8:3,totalComplete:54,
    deferredDashboard:0,deferredConsumer:0,deferredBackend:0},
  previouslyCompleteVectorIds:prior.vectors.filter(v=>v.classification.includes('PASSED')).map(v=>v.id),
  newlyCompleteVectorIds:select('NEWLY PASSED PHASE 8 FULL VECTOR'),
  dashboardDeferredVectorIds:select('DEFERRED DASHBOARD'),
  consumerDeferredVectorIds:select('DEFERRED CONSUMER'),
  backendDeferredVectorIds:select('DEFERRED BACKEND'),
  vectors
};
const frozen=['tests/contracts/responder/responder-v1-negative-vectors.json',
  'tests/contracts/responder/responder-v1-positive-vectors.json']
  .flatMap(f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8')).vectors.map(v=>v.id));
if(frozen.length!==54 || new Set(frozen).size!==54 || vectors.length!==54
  || result.previouslyCompleteVectorIds.length!==51
  || result.newlyCompleteVectorIds.length!==3
  || result.newlyCompleteVectorIds.some(id=>!newIds.has(id))
  || vectors.some(v=>!frozen.includes(v.id) || !v.classification.includes('PASSED')))
  throw new Error('Phase 8 frozen vector partition changed');
const output=path.join(root,'reports/responder/responder-phase8-vector-map.json');
const bytes=JSON.stringify(result,null,2)+'\n';
if(process.argv.includes('--verify')) {
  if(fs.readFileSync(output,'utf8')!==bytes) throw new Error('Phase 8 vector map differs');
  console.log('VECTOR_MAP_VERIFIED total=54 previous=51 new=3 complete=54 remaining=0');
} else {
  fs.writeFileSync(output,bytes);
  console.log('VECTOR_MAP_WRITTEN total=54 previous=51 new=3 complete=54 remaining=0');
}
