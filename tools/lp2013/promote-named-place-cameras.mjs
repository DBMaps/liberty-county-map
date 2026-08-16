import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const PATHS = Object.freeze({
  whatif: 'reports/lp2012/promotion-whatif.json', summary: 'reports/lp2012/promotion-whatif-summary.json',
  certification: 'reports/lp2012/owner-visual-certification.json', production: 'data/generated/gridly-statewide-place-presentation-v1.json',
  audit: 'reports/lp2013/promotion-whatif.json', result: 'reports/lp2013/promotion-summary.json',
  target: 'reports/lp2013/proposed-gridly-statewide-place-presentation-v1.json'
});
export const PRODUCTION_WRITE_ALLOWLIST = Object.freeze([PATHS.production]);
export const LP197 = Object.freeze(['4805000','4819000','4824000','4827000']);
export const FORBIDDEN_BUCKET_PREFIXES = Object.freeze(['B_','D_','E_','G_','H_']);
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readBytes = (root, p) => fs.readFileSync(path.join(root,p));
const readJson = (root, p) => JSON.parse(readBytes(root,p));
export const stableBytes = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const fail = message => { throw new Error(`LP201.3 fail closed: ${message}`); };

export function assertExpectedCurrentHash(actual, expected) {
  if (actual !== expected) fail(`current production hash mismatch: expected ${expected}, received ${actual}`);
}

export function buildPromotionTarget({ root=ROOT }={}) {
  const whatifBytes=readBytes(root,PATHS.whatif), summaryBytes=readBytes(root,PATHS.summary), certBytes=readBytes(root,PATHS.certification);
  const evidence=JSON.parse(whatifBytes), summary=JSON.parse(summaryBytes), certification=JSON.parse(certBytes);
  const currentBytes=readBytes(root,PATHS.production), production=JSON.parse(currentBytes);
  if(evidence.schemaVersion!=='gridly.lp2012.promotion-whatif.v1'||summary.schemaVersion!=='gridly.lp2012.promotion-whatif-summary.v1') fail('LP201.2 evidence schema invalid');
  if(evidence.runtimeActivation!==false||summary.runtimeActivation!==false||certification.runtimeActivation!==false) fail('LP201.2 runtimeActivation must be false');
  if(certification.promotionDesignCertified!==true||!String(certification.certificationStatus).includes('CERTIFIED')) fail('owner promotion certification invalid');
  for(const item of certification.statewideWhatIfIdentity?.artifacts||[]) if(item.path===PATHS.whatif||item.path===PATHS.summary) {
    const actual=item.path===PATHS.whatif?sha256(whatifBytes):sha256(summaryBytes); if(actual!==item.sha256) fail(`${item.path} certification hash mismatch`);
  }
  if(summary.totalCanonicalCount!==1859||summary.proposedCount!==1555||summary.higherAuthorityRetainedCount!==4||summary.unresolvedRetainedCount!==300) fail('LP201.2 cohort accounting differs from 1859/1555/4/300');
  if(summary.inputIdentities?.presentation?.sha256!==sha256(currentBytes)) fail('production artifact differs from certified LP201.2 baseline');
  if(production.schemaVersion!=='gridly.statewide-place-presentation.v1'||Object.keys(production.places||{}).length!==1859) fail('canonical production inventory is not 1859');
  const records=evidence.records;
  if(!Array.isArray(records)||records.length!==1859) fail('LP201.2 canonical record inventory is not 1859');
  const seen=new Set(), target=structuredClone(production), audit=[]; let certified=0, changed=0, equivalent=0, lp197=0, unresolved=0;
  for(const record of records) {
    const geoid=record.canonical?.placeGeoid, current=production.places[geoid];
    if(!geoid||seen.has(geoid)) fail(`duplicate evidence GEOID ${geoid}`); seen.add(geoid);
    if(!current) fail(`missing production GEOID ${geoid}`);
    const before={lat:current.lat,lon:current.lon}; let after={...before}, decision;
    if(LP197.includes(geoid)) {
      if(record.promotionEligible||record.proposal||!record.higherAuthority?.exists) fail(`LP197 GEOID ${geoid} is not protected`);
      lp197++; decision='RETAIN_LP197_HIGHER_AUTHORITY';
    } else if(record.promotionEligible) {
      certified++;
      if(FORBIDDEN_BUCKET_PREFIXES.some(prefix=>String(record.lp2011Bucket).startsWith(prefix))) fail(`forbidden bucket promoted: ${geoid}`);
      const lat=record.proposal?.latitude, lon=record.proposal?.longitude;
      if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat > 90||lon < -180||lon > 180) fail(`invalid proposed coordinate: ${geoid}`);
      if(record.proposal.zoom!==record.currentCamera.zoom||Object.keys(current).some(k=>!['lat','lon'].includes(k))) fail(`zoom/schema contract changed: ${geoid}`);
      after={lat,lon};
      if(lat===before.lat&&lon===before.lon){equivalent++;decision='ALREADY_EQUIVALENT';}else{changed++;decision='PROMOTE_CERTIFIED_NAMED_PLACE_CAMERA';target.places[geoid]=after;}
    } else {
      unresolved++; decision='RETAIN_UNRESOLVED_OR_INELIGIBLE';
      if(record.proposal) fail(`ineligible GEOID has proposal: ${geoid}`);
    }
    const effectiveFuture=LP197.includes(geoid)?{latitude:record.currentCamera.latitude,longitude:record.currentCamera.longitude,authority:'LP197_OWNER_APPROVED'}:{latitude:after.lat,longitude:after.lon,authority:record.promotionEligible?'LP2012_CERTIFIED_NAMED_PLACE_CAMERA':'STATEWIDE_CENSUS_PRESENTATION'};
    audit.push({GEOID:geoid,name:record.canonical.name,governedType:record.canonical.governedType,countyMemberships:record.canonical.countyMemberships,
      prePromotionAuthority:record.currentCamera.authority,postPromotionAuthority:effectiveFuture.authority,effectiveCurrentCamera:{latitude:record.currentCamera.latitude,longitude:record.currentCamera.longitude},effectiveFutureCamera:{latitude:effectiveFuture.latitude,longitude:effectiveFuture.longitude},
      currentLatitude:before.lat,currentLongitude:before.lon,proposedLatitude:after.lat,proposedLongitude:after.lon,
      zoomBehavior:{value:record.currentCamera.zoom,source:'EXISTING_GOVERNED_PLACE_ZOOM_UNCHANGED'},distanceMeters:record.comparison?.distanceMeters??null,
      lp2011Bucket:record.lp2011Bucket,lp2012CertificationStatus:record.promotionEligible?'CERTIFIED_FOR_PROMOTION':'NOT_CERTIFIED_FOR_PROMOTION',decision});
  }
  if(seen.size!==Object.keys(production.places).length) fail('production/evidence GEOID join is not exact');
  if(certified!==1555||lp197!==4||unresolved!==300) fail(`constructed accounting differs: ${certified}/${lp197}/${unresolved}`);
  for(const id of LP197) if(JSON.stringify(target.places[id])!==JSON.stringify(production.places[id])) fail(`LP197 fallback row changed: ${id}`);
  const targetBytes=stableBytes(target);
  const result={schemaVersion:'gridly.lp2013.promotion-summary.v1',runtimeActivation:false,applyExecuted:false,
    counts:{canonicalCount:1859,certifiedPromotionCount:certified,coordinateChangeCount:changed,alreadyEquivalentCount:equivalent,lp197RetainedCount:lp197,unresolvedRetainedCount:unresolved,unchangedRecordCount:1859-changed},
    artifactIdentity:{current:{path:PATHS.production,bytes:currentBytes.length,sha256:sha256(currentBytes)},proposed:{path:PATHS.production,bytes:targetBytes.length,sha256:sha256(targetBytes)}},
    productionWriteAllowlist:PRODUCTION_WRITE_ALLOWLIST,zoomContract:'EXISTING_GOVERNED_PLACE_ZOOM_UNCHANGED',regionSeparation:'CANONICAL_PLACE_ROWS_ONLY',
    lifecycleProtection:{semanticIdentityPersisted:true,reloadRecomputesCameraFromSemanticIdentity:true,arbitraryViewportPersistenceAdded:false,postLoadCompetingRecenterAdded:false,runtimeFilesModified:false},
    futureApply:{requiredCurrentSha256:sha256(currentBytes),postWriteSha256:sha256(targetBytes),idempotentTarget:true,phase1Authorization:false},unexpectedAnomalies:[]};
  return { target, targetBytes, audit:{schemaVersion:'gridly.lp2013.promotion-whatif.v1',runtimeActivation:false,records:audit}, result, sourceHashes:{whatif:sha256(whatifBytes),summary:sha256(summaryBytes),certification:sha256(certBytes)} };
}

export function writeWhatIf({root=ROOT}={}) { const built=buildPromotionTarget({root}); fs.mkdirSync(path.join(root,'reports/lp2013'),{recursive:true}); fs.writeFileSync(path.join(root,PATHS.audit),stableBytes(built.audit)); fs.writeFileSync(path.join(root,PATHS.result),stableBytes(built.result)); fs.writeFileSync(path.join(root,PATHS.target),built.targetBytes); return built; }
export function verifyTracked({root=ROOT}={}) { const built=buildPromotionTarget({root}); for(const [p,b] of [[PATHS.audit,stableBytes(built.audit)],[PATHS.result,stableBytes(built.result)],[PATHS.target,built.targetBytes]]) if(!readBytes(root,p).equals(b)) fail(`${p} is stale`); return built; }

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) { try { const mode=process.argv[2]; if(mode==='--apply') fail('Apply is not implemented or authorized in Phase 1'); const built=mode==='--whatif'?writeWhatIf():mode==='--verify'?verifyTracked():fail('usage: --whatif or --verify (Apply is disabled)'); console.log(`LP201.3 ${mode.slice(2)} PASS: ${built.result.counts.coordinateChangeCount} coordinate changes; target ${built.result.artifactIdentity.proposed.sha256}`); } catch(e) { console.error(e.message); process.exitCode=1; } }
