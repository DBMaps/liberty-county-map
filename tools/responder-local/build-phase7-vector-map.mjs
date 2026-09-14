// Local frozen-vector accounting only. No database or remote access.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const prior=JSON.parse(fs.readFileSync(path.join(root,'reports/responder/responder-phase6-vector-map.json'),'utf8'));
const complete=new Set(['N24-expired-active','N27-private-projection-leak',
  'N34-mass-publication','P17-valid-public-projection','P18-suspend-hides-public',
  'P19-expiry-hides-public']);
const reason='Ordinary agency login has no governance EXECUTE grant and receives SQL permission denied; the frozen vector requires bounded forbidden. Granting governance EXECUTE would weaken the role boundary.';
const vectors=prior.vectors.map(v=>complete.has(v.id)
  ? {id:v.id,classification:'NEWLY PASSED PHASE 7 FULL VECTOR'}
  : v.id==='N26-unauthorized-governance'
    ? {id:v.id,classification:'DEFERRED BACKEND',reason}
    : {...v});
const select=c=>vectors.filter(v=>v.classification===c).map(v=>v.id);
const result={
  contractVersion:'responder.agency.v1.phase0.1',
  mappingVersion:'responder.agency.v1.phase7.1',
  classificationRule:'Full vectors require exact bounded result, state, audit/receipt where applicable, and observable public projection. Partial structural coverage is deferred.',
  counts:{total:54,previouslyComplete:45,newlyCompletePhase7:6,totalComplete:51,
    deferredDashboard:2,deferredConsumer:0,deferredBackend:1},
  previouslyCompleteVectorIds:prior.vectors.filter(v=>v.classification.includes('PASSED')).map(v=>v.id),
  newlyCompleteVectorIds:select('NEWLY PASSED PHASE 7 FULL VECTOR'),
  dashboardDeferredVectorIds:select('DEFERRED DASHBOARD'),
  consumerDeferredVectorIds:select('DEFERRED CONSUMER'),
  backendDeferredVectorIds:select('DEFERRED BACKEND'),
  vectors
};
if(vectors.length!==54 || result.previouslyCompleteVectorIds.length!==45
  || result.newlyCompleteVectorIds.length!==6 || result.dashboardDeferredVectorIds.length!==2
  || result.consumerDeferredVectorIds.length!==0
  || result.backendDeferredVectorIds.join(',')!=='N26-unauthorized-governance')
  throw new Error('Phase 7 vector partition changed');
const output=path.join(root,'reports/responder/responder-phase7-vector-map.json');
const bytes=JSON.stringify(result,null,2)+'\n';
if(process.argv.includes('--verify')) {
  if(fs.readFileSync(output,'utf8')!==bytes) throw new Error('Phase 7 vector map differs');
  console.log('VECTOR_MAP_VERIFIED total=54 previous=45 new=6 complete=51 dashboard=2 consumer=0 backend=1');
} else {
  fs.writeFileSync(output,bytes);
  console.log('VECTOR_MAP_WRITTEN total=54 previous=45 new=6 complete=51 dashboard=2 consumer=0 backend=1');
}
