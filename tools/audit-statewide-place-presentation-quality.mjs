#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const REQUIRED_GEOIDS=Object.freeze(['4824000','4865000','4819000','4841464','4854708','4842568','4805000','4835000','4817000','4828068','4872392','4802272']);
export const VIEWPORTS=Object.freeze([{id:'portrait',width:390,height:844},{id:'wide',width:1440,height:900}]);
export const THRESHOLDS=Object.freeze({failBoundsVisibleRatioBelow:.10,reviewBoundsVisibleRatioBelow:.50,reviewTargetEdgeInset:.10,pixelTolerance:2});
const DEFAULTS={geometry:path.join(ROOT,'reports/statewide-place-presentation-geometry-audit.json'),focus:path.join(ROOT,'data/generated/gridly-statewide-place-presentation-v1.json'),json:path.join(ROOT,'reports/statewide-place-presentation-quality-audit.json'),markdown:path.join(ROOT,'reports/statewide-place-presentation-quality-audit.md'),evidence:path.join(ROOT,'evidence/statewide-place-presentation-quality')};
const fail=m=>{throw new Error(`Statewide PLACE presentation-quality audit failed closed: ${m}`)};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.keys(value).sort().reduce((o,k)=>(o[k]=stable(value[k]),o),{}):value;
export const stableJson=value=>`${JSON.stringify(stable(value),null,2)}\n`;
const disagreement=r=>Math.max(...Object.values(r.distancesMeters||{}).map(Number).filter(Number.isFinite),0);
const hashOrder=(seed,row)=>crypto.createHash('sha256').update(`${seed}:${row.geoid}`).digest('hex');
const pick=(rows,count,seed)=>[...rows].sort((a,b)=>hashOrder(seed,a).localeCompare(hashOrder(seed,b))||a.geoid.localeCompare(b.geoid)).slice(0,count);
const stratified=(rows,fields,perCell,seed)=>{
  const groups=new Map();
  for(const row of rows){const k=fields.map(f=>String(f(row))).join('|');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row)}
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).flatMap(([key,values])=>pick(values,perCell,`${seed}:${key}`));
};

export function constructSample(geometry){
  if(geometry?.schemaVersion!=='gridly.statewide-place-presentation-geometry-audit.v1'||!Array.isArray(geometry.places))fail('governed geometry audit is missing or invalid');
  const byId=new Map(geometry.places.map(r=>[r.geoid,r]));
  for(const id of REQUIRED_GEOIDS)if(!byId.has(id))fail(`required PLACE ${id} is absent`);
  const topIds=(geometry.summary?.largestCandidateDisagreements||[]).slice(0,25).map(r=>r.geoid);
  if(topIds.length<25)fail('largestCandidateDisagreements must contain at least 25 records');
  const cohorts={
    required:REQUIRED_GEOIDS.map(id=>byId.get(id)),
    topDisagreement:topIds.map(id=>byId.get(id)),
    exteriorCentroid:stratified(geometry.places.filter(r=>r.centroid?.contained===false),[r=>r.governedType,r=>r.areaBand,r=>r.multipart?'multipart':'singlepart',r=>r.multiCounty?'multi':'single'],1,'exterior'),
    multipart:stratified(geometry.places.filter(r=>r.multipart),[r=>r.areaBand,r=>Math.min(Number(r.componentCount),5)],1,'multipart'),
    multiCounty:stratified(geometry.places.filter(r=>r.multiCounty),[r=>r.governedType,r=>r.areaBand,r=>r.multipart?'multipart':'singlepart'],2,'multi-county'),
    largeArea:geometry.places.filter(r=>r.areaBand==='100_plus_square_miles').sort((a,b)=>a.geoid.localeCompare(b.geoid)),
    ordinaryControls:stratified(geometry.places.filter(r=>!r.multipart&&!r.multiCounty&&r.centroid?.contained===true&&disagreement(r)<=100),[r=>r.governedType,r=>r.areaBand],3,'ordinary')
  };
  const membership=new Map();
  for(const [name,rows] of Object.entries(cohorts))for(const row of rows){if(!row)fail(`${name} references an absent PLACE`);if(!membership.has(row.geoid))membership.set(row.geoid,[]);membership.get(row.geoid).push(name)}
  const records=[...membership].sort(([a],[b])=>a.localeCompare(b)).map(([geoid,names])=>({...byId.get(geoid),sampleCohorts:names.sort()}));
  if(records.length<75||records.length>150)fail(`deduplicated sample must contain 75-150 PLACEs; found ${records.length}`);
  return {algorithm:'union required 12; first 25 governed disagreement records; SHA-256 GEOID sampling of one record per exterior-centroid type/area/part/county cell; one per multipart area/component-count-capped-at-5 cell; two per multi-county type/area/part cell; all 100+ sq mi; and three low-disagreement (<=100 m), contained, singlepart, single-county controls per type/area cell; deduplicate and order by GEOID',cohortCountsBeforeDedupe:Object.fromEntries(Object.entries(cohorts).map(([k,v])=>[k,v.length])),count:records.length,geoids:records.map(r=>r.geoid),records};
}

const intersect=(a,b)=>({left:Math.max(a.left,b.left),top:Math.max(a.top,b.top),right:Math.min(a.right,b.right),bottom:Math.min(a.bottom,b.bottom)});
const area=r=>Math.max(0,r.right-r.left)*Math.max(0,r.bottom-r.top);
export function calculateUsableViewport(mapRect,occluders=[]){
  if(!mapRect||area(mapRect)<=0)return null;
  const clipped=occluders.map(r=>intersect(mapRect,r)).filter(r=>area(r)>0);
  const xs=[mapRect.left,mapRect.right,...clipped.flatMap(r=>[r.left,r.right])].sort((a,b)=>a-b);
  const ys=[mapRect.top,mapRect.bottom,...clipped.flatMap(r=>[r.top,r.bottom])].sort((a,b)=>a-b);
  let best=null;
  for(let i=0;i<xs.length-1;i++)for(let j=i+1;j<xs.length;j++)for(let k=0;k<ys.length-1;k++)for(let l=k+1;l<ys.length;l++){
    const r={left:xs[i],top:ys[k],right:xs[j],bottom:ys[l]};if(clipped.some(o=>area(intersect(r,o))>0))continue;
    if(!best||area(r)>area(best)||(area(r)===area(best)&&(r.top<best.top||r.top===best.top&&r.left<best.left)))best=r;
  }
  return best?{...best,width:best.right-best.left,height:best.bottom-best.top,approximation:'largest unobscured axis-aligned rectangle derived from live map and visible overlay DOM rectangles'}:null;
}
export const pointInside=(point,rect,tolerance=THRESHOLDS.pixelTolerance)=>Boolean(point&&rect&&point.x>=rect.left-tolerance&&point.x<=rect.right+tolerance&&point.y>=rect.top-tolerance&&point.y<=rect.bottom+tolerance);
export function classifyMeasurement(m){
  const required=['usableViewport','targetPixel','geometryBoundsPixel','finalCenter','finalZoom'];
  const missing=required.filter(k=>m?.[k]===null||m?.[k]===undefined);
  if(missing.length)return {classification:'UNAVAILABLE',reasons:missing.map(k=>`missing_${k}`)};
  const reasons=[];if(!m.targetInsideUsableViewport)reasons.push('target_outside_usable_viewport');if(!m.geometryIntersectsUsableViewport)reasons.push('geometry_bounds_do_not_intersect_usable_viewport');if(m.geometryBoundsVisibleRatio<THRESHOLDS.failBoundsVisibleRatioBelow)reasons.push('geometry_bounds_visible_ratio_below_0.10');
  if(reasons.length)return {classification:'FAIL',reasons};
  const edge=m.normalizedTargetPosition.x<THRESHOLDS.reviewTargetEdgeInset||m.normalizedTargetPosition.x>1-THRESHOLDS.reviewTargetEdgeInset||m.normalizedTargetPosition.y<THRESHOLDS.reviewTargetEdgeInset||m.normalizedTargetPosition.y>1-THRESHOLDS.reviewTargetEdgeInset;
  if(m.geometryBoundsVisibleRatio<THRESHOLDS.reviewBoundsVisibleRatioBelow)reasons.push('geometry_bounds_visible_ratio_below_0.50');if(edge)reasons.push('target_within_10_percent_of_usable_edge');
  return {classification:reasons.length?'REVIEW':'PASS',reasons};
}

function markdown(report){return `# Statewide PLACE Presentation-quality Audit\n\nAudit-only owner browser evidence. No production target, runtime change, or presentation v2 is authorized.\n\n## Execution\n\n- Sample: ${report.sample.finalUniqueSampleCount} PLACEs.\n- Viewports: ${report.inputs.viewports.map(v=>`${v.id} ${v.width}x${v.height}`).join('; ')}.\n- Polygon-visible percentage: unavailable; the controlled proxy is the visible fraction of projected geometry bounds.\n\n## Results\n\n| Viewport | Tested | PASS | REVIEW | FAIL | Unavailable |\n|---|---:|---:|---:|---:|---:|\n${Object.entries(report.results).map(([k,v])=>`| ${k} | ${v.tested} | ${v.PASS} | ${v.REVIEW} | ${v.FAIL} | ${v.UNAVAILABLE} |`).join('\n')}\n\nFull metrics, segmentation, required-place detail, failure ordering, camera contract, and limitations are in the companion JSON.\n`;}

async function browserMeasure(page,row){
  return page.evaluate(async input=>{
    const area=(typeof GRIDLY_AWARENESS_AREA_DEFINITIONS!=='undefined'&&typeof gridlyResolveCanonicalPlaceGeoid==='function')?(GRIDLY_AWARENESS_AREA_DEFINITIONS||[]).find(candidate=>gridlyResolveCanonicalPlaceGeoid(candidate)===input.geoid):null;
    if(!area)return {error:'runtime_awareness_area_unresolved'};
    const issued=gridlyDispatchSemanticCamera(area,input.countyId,{source:'statewide_presentation_quality_audit',animate:false});if(!issued)return {error:'semantic_camera_not_issued'};
    const map=window.gridlyMapInstance;await new Promise(resolve=>{let done=false;const finish=()=>{if(!done){done=true;resolve()}};map.once('moveend',finish);requestAnimationFrame(()=>requestAnimationFrame(finish));setTimeout(finish,1500)});
    const mapRect=map.getContainer().getBoundingClientRect(),target=map.latLngToContainerPoint([input.intpt.lat,input.intpt.lon]);
    const absolute=p=>({x:mapRect.left+p.x,y:mapRect.top+p.y});
    const selectors=['.app-header','.gridly-v2-topbar','.gridly-v2-status-pill','.gridly-v2-segments','.mobile-location-chip','.mobile-floating-action-dock','.mobile-bottom-dock','.mobile-bottom-nav','.mobile-dock','#gridlyPortraitV2Sheet','.gridly-v2-sheet','[role="dialog"]','[aria-modal="true"]'];
    const nodes=[...new Set(selectors.flatMap(s=>[...document.querySelectorAll(s)]))];
    const occluders=nodes.filter(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0&&n!==map.getContainer()}).map(n=>{const r=n.getBoundingClientRect();return {selector:n.id?`#${n.id}`:n.classList.length?`.${[...n.classList].join('.')}`:n.tagName.toLowerCase(),left:r.left,top:r.top,right:r.right,bottom:r.bottom}});
    const bounds=input.bounds,corners=[[bounds.minLat,bounds.minLon],[bounds.maxLat,bounds.maxLon]].map(x=>absolute(map.latLngToContainerPoint(x)));
    const b={left:Math.min(corners[0].x,corners[1].x),top:Math.min(corners[0].y,corners[1].y),right:Math.max(corners[0].x,corners[1].x),bottom:Math.max(corners[0].y,corners[1].y)};
    const center=map.getCenter(),leafletBounds=map.getBounds();return {mapRect:{left:mapRect.left,top:mapRect.top,right:mapRect.right,bottom:mapRect.bottom},occluders,targetPixel:absolute(target),geometryBoundsPixel:b,finalCenter:{lat:center.lat,lon:center.lng},finalZoom:map.getZoom(),finalMapBounds:{minLat:leafletBounds.getSouth(),minLon:leafletBounds.getWest(),maxLat:leafletBounds.getNorth(),maxLon:leafletBounds.getEast()},committedCamera:typeof gridlyCommittedSemanticCamera!=='undefined'?gridlyCommittedSemanticCamera:null};
  },{geoid:row.geoid,intpt:row.existingPresentationFocus?.point||row.intpt,bounds:row.bounds});
}

export async function runAudit({geometryPath=DEFAULTS.geometry,origin=process.env.GRIDLY_AUDIT_URL,jsonPath=DEFAULTS.json,markdownPath=DEFAULTS.markdown,evidencePath=DEFAULTS.evidence}={}){
  if(!origin)fail('GRIDLY_AUDIT_URL is required');
  const geometryBytes=fs.readFileSync(geometryPath),geometry=JSON.parse(geometryBytes),sample=constructSample(geometry);const focusBytes=fs.readFileSync(DEFAULTS.focus);
  const {chromium}=await import('playwright');const browser=await chromium.launch({channel:'chromium',headless:true});const placeRecords=[];
  try{for(const viewport of VIEWPORTS)for(const row of sample.records){const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},serviceWorkers:'block'});const page=await context.newPage();await page.route('**/*',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort('blockedbyclient'));await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.gridlyMapInstance?.getCenter?.()&&typeof gridlyDispatchSemanticCamera==='function',{timeout:30000});const raw=await browserMeasure(page,row);let measurement;
    if(raw.error)measurement={...raw,classification:'UNAVAILABLE',classificationReasons:[raw.error]};else{const usable=calculateUsableViewport(raw.mapRect,raw.occluders);const gi=intersect(raw.geometryBoundsPixel,usable||{left:0,top:0,right:0,bottom:0});measurement={...raw,usableViewport:usable,targetInsideUsableViewport:pointInside(raw.targetPixel,usable),geometryIntersectsUsableViewport:area(gi)>0,geometryBoundsVisibleRatio:area(raw.geometryBoundsPixel)>0?area(gi)/area(raw.geometryBoundsPixel):0,normalizedTargetPosition:usable?{x:(raw.targetPixel.x-usable.left)/usable.width,y:(raw.targetPixel.y-usable.top)/usable.height}:null,polygonVisiblePercentage:null,polygonVisiblePercentageAvailability:'UNAVAILABLE_NO_GOVERNED_BROWSER_POLYGON_CLIPPING_DEPENDENCY'};const c=classifyMeasurement(measurement);measurement.classification=c.classification;measurement.classificationReasons=c.reasons}
    placeRecords.push({geoid:row.geoid,name:row.name,governedType:row.governedType,multiCounty:row.multiCounty,multipart:row.multipart,componentCount:row.componentCount,areaSquareMeters:row.areaSquareMeters,areaBand:row.areaBand,centroidContained:row.centroid.contained,candidateDisagreementMeters:disagreement(row),presentationTarget:row.existingPresentationFocus?.point||row.intpt,centroid:row.centroid,pointOnSurface:row.pointOnSurface,bboxMidpoint:row.bboxMidpoint,polygonBounds:row.bounds,viewportClass:viewport.id,measurement});
    const required=REQUIRED_GEOIDS.includes(row.geoid),control=row.sampleCohorts.includes('ordinaryControls');if(required||measurement.classification==='FAIL'||(control&&placeRecords.filter(x=>x.viewportClass===viewport.id&&x.measurement?.screenshot).length<3)){fs.mkdirSync(evidencePath,{recursive:true});const slug=row.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');const name=`${row.geoid}-${slug}-${viewport.id}.png`;await page.screenshot({path:path.join(evidencePath,name),fullPage:false});measurement.screenshot=name}await context.close()}}
  finally{await browser.close()}
  const results=Object.fromEntries(VIEWPORTS.map(v=>{const rs=placeRecords.filter(r=>r.viewportClass===v.id);return [v.id,{tested:rs.length,...Object.fromEntries(['PASS','REVIEW','FAIL','UNAVAILABLE'].map(c=>[c,rs.filter(r=>r.measurement.classification===c).length]))}]}));
  const report={schemaVersion:'gridly.statewide-place-presentation-quality-audit.v1',governance:{auditOnly:true,productionTargetSelected:false,runtimeChangeAuthorized:false,presentationV2Authorized:false},inputs:{geometryAudit:{path:path.relative(ROOT,geometryPath),sha256:crypto.createHash('sha256').update(geometryBytes).digest('hex'),source:geometry.source},v1PresentationArtifact:{path:path.relative(ROOT,DEFAULTS.focus),sha256:crypto.createHash('sha256').update(focusBytes).digest('hex')},appRuntime:{origin,identity:'owner-served current checkout'},browser:{name:'Chromium',playwrightVersion:'1.54.2',ownerExecutionRequired:true},viewports:VIEWPORTS},cameraContract:{functions:['gridlyDispatchSemanticCamera','gridlyResolveCanonicalPlaceGeoid','gridlyLoadStatewidePlacePresentation','setGridlyAwarenessView'],target:'governed gridly-statewide-place-presentation-v1 PLACE entry (Census INTPTLAT/INTPTLON)',placeZoom:13,movement:'map.setView(target, 13, {animate: options.animate === true})',chromeCompensation:'explicitly disabled for PLACE dispatch; no panBy correction',responsiveBranch:'none in PLACE dispatch; identical target and zoom',startupProtection:'presentation artifact validates schema/count and is loaded before startup finalization; monotonic semantic sequence protects deferred county fits; PLACE dispatch fails closed when target is unavailable',finalCenter:'Leaflet setView target, subject to later independent runtime movements',finalZoom:'constant GRIDLY_TOWN_STARTUP_ZOOM (13)',selectedPosition:'map-container center after setView; consumer-usable position depends on measured UI occlusion because PLACE chrome compensation is disabled',diagnostics:'gridlyCommittedSemanticCamera records sequence, semantic level, GEOID, target, zoom, and source'},sample:{constructionAlgorithm:sample.algorithm,cohortCountsBeforeDedupe:sample.cohortCountsBeforeDedupe,finalUniqueSampleCount:sample.count,sampledGeoids:sample.geoids},classification:{thresholds:THRESHOLDS,metric:'projected polygon-bounds visibility proxy plus target placement in largest live-DOM-derived usable rectangle',fail:'target outside usable rectangle, polygon bounds do not intersect it, or projected bounds visible ratio < 0.10',review:'otherwise, projected bounds visible ratio < 0.50 or target is within 10% of a usable edge',pass:'none of the FAIL or REVIEW conditions',unavailable:'any required runtime measurement missing; fails closed as explicit UNAVAILABLE',subjectivityBoundary:'bbox visibility is an exposed proxy, not polygon-visible percentage or a production presentation rule'},results,segmentation:buildSegmentation(placeRecords),placeRecords,requiredKnownPlaceDetail:placeRecords.filter(r=>REQUIRED_GEOIDS.includes(r.geoid)),failureRanking:placeRecords.filter(r=>r.measurement.classification==='FAIL').sort((a,b)=>a.measurement.geometryBoundsVisibleRatio-b.measurement.geometryBoundsVisibleRatio||a.geoid.localeCompare(b.geoid)||a.viewportClass.localeCompare(b.viewportClass)),determination:'OWNER_BROWSER_EVIDENCE_REQUIRED',limitations:['Exact polygon-visible percentage is unavailable without a governed polygon-clipping dependency in the browser.','The largest unobscured axis-aligned rectangle is a deterministic approximation when floating surfaces make the usable region non-rectangular.','Browser pixels have a 2 px containment tolerance and are inherently visual evidence; derived sample/order and serialization are deterministic.']};
  fs.mkdirSync(path.dirname(jsonPath),{recursive:true});fs.writeFileSync(jsonPath,stableJson(report));fs.writeFileSync(markdownPath,markdown(report));return report;
}
function buildSegmentation(records){const dimensions={governedType:r=>r.governedType,areaBand:r=>r.areaBand,multipartStatus:r=>r.multipart?'multipart':'singlepart',multiCountyStatus:r=>r.multiCounty?'multi_county':'single_county',centroidContainment:r=>r.centroidContained?'contained':'outside',candidateDisagreementBand:r=>r.candidateDisagreementMeters<100?'under_100m':r.candidateDisagreementMeters<1000?'100_to_under_1000m':'1000m_plus'};return Object.fromEntries(Object.entries(dimensions).map(([name,key])=>[name,Object.fromEntries([...Map.groupBy(records,key)].sort(([a],[b])=>a.localeCompare(b)).map(([k,rs])=>[k,Object.fromEntries(['PASS','REVIEW','FAIL','UNAVAILABLE'].map(c=>[c,rs.filter(r=>r.measurement.classification===c).length]))]))]));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){runAudit().then(r=>console.log(`Wrote owner-local audit for ${r.sample.finalUniqueSampleCount} PLACEs.`)).catch(e=>{console.error(e.message);process.exitCode=1})}
