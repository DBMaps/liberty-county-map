import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const geojson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/liberty-county-road-segments.geojson'), 'utf8'));
const features = Array.isArray(geojson.features) ? geojson.features : [];
const milesPerMeter = 0.000621371;
const importantRoads = ['US 90', 'Waco Street', 'Sawmill Road', 'TX 321', 'TX 146', 'FM 1960', 'FM 1409', 'Stilson Road'];

function normalizeRoad(value = '') {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  return raw
    .replace(/^(?:United States Highway|US Highway)\s+(\d+)\s*(?:East|West)?$/i, 'US $1')
    .replace(/^State Highway\s+(\d+)$/i, 'TX $1')
    .replace(/^Farm(?: to Market)? Road\s+(\d+)$/i, 'FM $1')
    .replace(/\bWaco Street\b/i, 'Waco Street')
    .replace(/\bSawmill Road\b/i, 'Sawmill Road')
    .replace(/\bStilson Road\b/i, 'Stilson Road')
    .replace(/\bSH\s+(\d+)\b/i, 'TX $1');
}
function label(f) { return normalizeRoad(f.properties?.name || f.properties?.ref || f.properties?.highway || f.properties?.['tiger:name_base'] || ''); }
function matches(f, road) {
  const p = f.properties || {};
  const hay = [p.ref, p.name, p['tiger:name_base'], p['tiger:name_base_1']].map(String).join(' | ');
  return road === 'US 90' ? /\bUS 90\b|United States Highway 90/i.test(hay)
    : road === 'TX 321' ? /\bTX 321\b|State Highway 321/i.test(hay)
    : road === 'TX 146' ? /\bTX 146\b|State Highway 146/i.test(hay)
    : road === 'FM 1960' ? /\bFM 1960\b|Farm.*1960/i.test(hay)
    : road === 'FM 1409' ? /\bFM 1409\b|Farm.*1409/i.test(hay)
    : new RegExp(road.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(hay);
}
function flatten(coords) { return typeof coords?.[0] === 'number' ? [coords] : (coords || []).flatMap(flatten); }
function mid(f) { const pts = flatten(f.geometry?.coordinates); return pts[Math.floor(pts.length / 2)] || null; }
function distM(a,b){const R=6371000;const toRad=x=>x*Math.PI/180;const dLat=toRad(b[1]-a[1]);const dLon=toRad(b[0]-a[0]);const la1=toRad(a[1]);const la2=toRad(b[1]);const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(h));}
function candidatesAt(point, limit=8){return features.map((f)=>({road: label(f), rawName:f.properties?.name||'', rawRef:f.properties?.ref||'', meters: distM(point, mid(f)||point)})).filter(c=>c.road).sort((a,b)=>a.meters-b.meters).slice(0,limit).map(c=>({...c, meters:Number(c.meters.toFixed(1))}));}
function sampleFor(road){const matched=features.filter(f=>matches(f, road));const f=matched[Math.floor(matched.length/2)] || matched[0];const point=mid(f);const candidates=point?candidatesAt(point):[];return {road, featureCount:matched.length, sampleCoordinate: point ? {lat:Number(point[1].toFixed(6)), lng:Number(point[0].toFixed(6))}:null, selectedPrimaryRoad:candidates[0]?.road||'', selectedReferenceRoad:candidates.find(c=>c.road!==candidates[0]?.road)?.road||'', nearestRoadCandidates:candidates};}
const regressionTable = importantRoads.map(sampleFor);
const wacoFeatures=features.filter(f=>matches(f,'Waco Street')).filter(f => { const p = mid(f); return p && p[0] > -95; });
const wacoPoint=mid(wacoFeatures[0]);
const wacoAnalysis={focus:'US 90 / Waco Street / Sawmill Road', sampleCoordinate:wacoPoint?{lat:Number(wacoPoint[1].toFixed(6)),lng:Number(wacoPoint[0].toFixed(6))}:null, nearestRoadCandidates:wacoPoint?candidatesAt(wacoPoint,12):[], finding:'Current nearest-first evidence can rank Sawmill Road ahead of Waco Street for nearby points if the sampled coordinate is closer to Sawmill geometry, even when Waco Street is the more useful human rail-crossing reference.'};
const report={auditVersion:'V311', productionBehaviorChanged:false, regressionTable, wacoAnalysis, formatterPaths:[
  {surface:'alert cards', path:'buildGridlyAlertCardConsumerModel -> buildRoadHazardDisplay/shared lookup', risk:'May consume normalized alert fields and resolver output.'},
  {surface:'awareness headline', path:'resolveGridlyTopStatusCorridorDiagnostics / inferCorridorLabel', risk:'Can prefer explicit corridor fields over nearest geometry.'},
  {surface:'hazard popups', path:'renderUnifiedIncidents -> buildUnifiedIncidentPopup', risk:'Uses unified incident fields plus road display helper for road incidents.'},
  {surface:'crossing popups', path:'renderCrossings/build crossing popup family', risk:'Crossing inventory fields can differ from unified incident road fields.'},
  {surface:'route impact/details', path:'buildLocalizedLocationPhrase/inferCorridorLabel/route details summaries', risk:'Route text may use corridor inference rather than nearest road.'},
  {surface:'rendered marker metadata', path:'renderUnifiedIncidents marker options/dataset from unified incident', risk:'Marker lat/lng remains source of resolver candidate choice.'}
]};
console.log(JSON.stringify(report,null,2));
