// Local frozen-vector accounting only. No database or remote access.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const prior=JSON.parse(fs.readFileSync(path.join(root,'reports/responder/responder-phase5-vector-map.json'),'utf8'));
const complete=new Set(['N33-municipal-point-proxy','P14-gridly-verify-org','P15-gridly-approve-county']);
const reasons={
  'N26-unauthorized-governance':'Ordinary agency login has no EXECUTE grant and receives SQL permission denied; frozen vector requires a bounded forbidden result. Granting EXECUTE would violate the governance role boundary.',
  'N34-mass-publication':'No owner-approved organization publication-rate threshold exists; rate_limited cannot be certified without inventing policy.',
  'P18-suspend-hides-public':'Atomic withdrawal and backend hiding pass, but frozen publicVisibilityResult=hidden cannot be fully observed until the consumer projection exists.'
};
const vectors=prior.vectors.map(v=>complete.has(v.id)
  ? {id:v.id,classification:'NEWLY PASSED PHASE 6 FULL VECTOR'}
  : v.classification==='DEFERRED BACKEND'
    ? {id:v.id,classification:'DEFERRED BACKEND',reason:reasons[v.id]}
    : {...v});
const select=c=>vectors.filter(v=>v.classification===c).map(v=>v.id);
const result={
  contractVersion:'responder.agency.v1.phase0.1',
  mappingVersion:'responder.agency.v1.phase6.1',
  classificationRule:'A full vector requires its exact bounded result, state, audit, receipt where applicable, and observable visibility. Structural coverage alone is deferred.',
  counts:{total:54,previouslyComplete:42,newlyCompletePhase6:3,totalComplete:45,
    deferredDashboard:2,deferredConsumer:4,deferredBackend:3},
  previouslyCompleteVectorIds:prior.vectors.filter(v=>v.classification.includes('PASSED')).map(v=>v.id),
  newlyCompleteVectorIds:select('NEWLY PASSED PHASE 6 FULL VECTOR'),
  backendDeferredVectorIds:select('DEFERRED BACKEND'),
  vectors
};
if(vectors.length!==54 || result.previouslyCompleteVectorIds.length!==42
  || result.newlyCompleteVectorIds.length!==3 || result.backendDeferredVectorIds.length!==3
  || select('DEFERRED DASHBOARD').length!==2 || select('DEFERRED CONSUMER').length!==4
  || Object.keys(reasons).some(id=>!result.backendDeferredVectorIds.includes(id)))
  throw new Error('Phase 6 vector partition changed');
const output=path.join(root,'reports/responder/responder-phase6-vector-map.json');
const bytes=JSON.stringify(result,null,2)+'\n';
if(process.argv.includes('--verify')) {
  if(fs.readFileSync(output,'utf8')!==bytes) throw new Error('Phase 6 vector map differs');
  console.log('VECTOR_MAP_VERIFIED total=54 previous=42 new=3 complete=45 dashboard=2 consumer=4 backend=3');
} else {
  fs.writeFileSync(output,bytes);
  console.log('VECTOR_MAP_WRITTEN total=54 previous=42 new=3 complete=45 dashboard=2 consumer=4 backend=3');
}
