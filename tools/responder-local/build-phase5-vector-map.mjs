// Local contract accounting only; no database, Supabase, or publication access.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const prior=JSON.parse(fs.readFileSync(path.join(root,'reports/responder/responder-phase4-vector-map.json'),'utf8'));
const backendReasons={
  'N26-unauthorized-governance':'Phase 5 agency-update command does not implement bounded governance approval receipts.',
  'N33-municipal-point-proxy':'Municipal authority approval is outside county-first V1; no bounded governance command/receipt is implemented.',
  'N34-mass-publication':'No owner-approved organization publication-rate threshold exists; rate_limited cannot be certified without inventing policy.',
  'P14-gridly-verify-org':'Local Phase 2 governance fixture lacks the frozen command receipt and full verification workflow.',
  'P15-gridly-approve-county':'Phase 3 authority fixture proves geometry but lacks a bounded governance command receipt.',
  'P18-suspend-hides-public':'Atomic governance suspension/affected-post withdrawal and public read behavior are outside the Phase 5 agency command.'
};
const vectors=prior.vectors.map(v=>{
  if(v.classification!=='DEFERRED PHASE 5') return {...v};
  return backendReasons[v.id]
    ? {id:v.id,classification:'DEFERRED BACKEND',reason:backendReasons[v.id]}
    : {id:v.id,classification:'NEWLY PASSED PHASE 5 FULL VECTOR'};
});
const countOf=category=>vectors.filter(v=>v.classification===category).length;
const result={
  contractVersion:'responder.agency.v1.phase0.1',
  mappingVersion:'responder.agency.v1.phase5.1',
  classificationRule:'A complete vector has its exact bounded result, business row, audit event, receipt/replay where applicable, and local visibility state exercised. Dashboard, consumer projection, governance receipt, and unapproved rate policy remain deferred.',
  counts:{
    total:vectors.length,
    previouslyPassed:countOf('PREVIOUSLY PASSED FULL VECTOR'),
    newlyPassedPhase5:countOf('NEWLY PASSED PHASE 5 FULL VECTOR'),
    totalComplete:countOf('PREVIOUSLY PASSED FULL VECTOR')+countOf('NEWLY PASSED PHASE 5 FULL VECTOR'),
    deferredDashboard:countOf('DEFERRED DASHBOARD'),
    deferredConsumer:countOf('DEFERRED CONSUMER'),
    deferredBackend:countOf('DEFERRED BACKEND')
  },
  previouslyPassedVectorIds:vectors.filter(v=>v.classification==='PREVIOUSLY PASSED FULL VECTOR').map(v=>v.id),
  newlyPassedVectorIds:vectors.filter(v=>v.classification==='NEWLY PASSED PHASE 5 FULL VECTOR').map(v=>v.id),
  backendDeferredVectorIds:vectors.filter(v=>v.classification==='DEFERRED BACKEND').map(v=>v.id),
  vectors
};
if (result.counts.total!==54 || result.counts.previouslyPassed!==9
  || result.counts.newlyPassedPhase5!==33 || result.counts.deferredDashboard!==2
  || result.counts.deferredConsumer!==4 || result.counts.deferredBackend!==6)
  throw new Error('Phase 5 vector count partition changed');
const output=path.join(root,'reports/responder/responder-phase5-vector-map.json');
const bytes=JSON.stringify(result,null,2)+'\n';
if(process.argv.includes('--verify')) {
  if(fs.readFileSync(output,'utf8')!==bytes) throw new Error('Phase 5 vector map differs');
  console.log(`VECTOR_MAP_VERIFIED total=${result.counts.total} complete=${result.counts.totalComplete}`);
} else {
  fs.writeFileSync(output,bytes);
  console.log(`VECTOR_MAP_WRITTEN total=${result.counts.total} complete=${result.counts.totalComplete}`);
}
