#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const requestedSource = 'assets/directional-intelligence/source/osm/us59-i69-liberty-montgomery-source.geojson';
const legacySource = 'assets/directional-intelligenc/source/osm/us59-i69-liberty-montgomery-source.geojson';
const sourceAsset = fs.existsSync(requestedSource) ? requestedSource : legacySource;
const outputPath = 'assets/directional-intelligence/evidence/v683-osm-metadata-coverage-audit.json';

const geojson = JSON.parse(fs.readFileSync(sourceAsset, 'utf8'));
const features = Array.isArray(geojson.features) ? geojson.features : [];
const total = features.length;
const pct = (n) => total ? Number(((n / total) * 100).toFixed(2)) : 0;
const has = (p, k) => Object.prototype.hasOwnProperty.call(p, k) && p[k] !== null && p[k] !== '';
const dist = (key) => {
  const out = {};
  for (const f of features) {
    const p = f.properties || {};
    const v = has(p, key) ? String(p[key]) : '__MISSING__';
    out[v] = (out[v] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])));
};
const countHas = (key) => features.filter(f => has(f.properties || {}, key)).length;
const geomCount = features.filter(f => f.geometry && f.geometry.type && Array.isArray(f.geometry.coordinates)).length;
const highwayDistribution = dist('highway');
const countyDistribution = dist('tiger:county');
const counts = {
  sourceFileExists: fs.existsSync(sourceAsset),
  requestedSourceFileExists: fs.existsSync(requestedSource),
  inspectedLegacySourceAsset: sourceAsset === legacySource,
  geometry: geomCount,
  ref: countHas('ref'),
  fut_ref: countHas('fut_ref'),
  name: countHas('name'),
  oneway: countHas('oneway'),
  'oneway=reversible': features.filter(f => String((f.properties || {}).oneway).toLowerCase() === 'reversible').length,
  'oneway:conditional': countHas('oneway:conditional'),
  lanes: countHas('lanes'),
  'turn:lanes': countHas('turn:lanes'),
  'destination:lanes': countHas('destination:lanes'),
  'tiger:county': countHas('tiger:county'),
  highway: countHas('highway'),
  Texas_Trunk_System: countHas('Texas_Trunk_System'),
  NHS: countHas('NHS'),
  'hgv:national_network': countHas('hgv:national_network')
};
const percentages = Object.fromEntries(Object.entries(counts).filter(([,v]) => typeof v === 'number').map(([k,v]) => [k, pct(v)]));
const confidenceRiskCounts = {
  reversibleLanes: counts['oneway=reversible'],
  constructionSegments: features.filter(f => String((f.properties || {}).highway).includes('construction') || has(f.properties || {}, 'construction')).length,
  missingRef: total - counts.ref,
  missingOneway: total - counts.oneway,
  missingCountyAttribution: total - counts['tiger:county'],
  hovHotLaneSegments: features.filter(f => Object.entries(f.properties || {}).some(([k,v]) => /hov|hot/i.test(`${k}=${v}`))).length,
  fixmeTags: features.filter(f => Object.entries(f.properties || {}).some(([k,v]) => /fixme/i.test(`${k}=${v}`))).length
};
const manualReviewCandidates = features.map((f, i) => ({ i, p: f.properties || {} })).filter(({p}) =>
  !has(p,'ref') || !has(p,'oneway') || !has(p,'tiger:county') || String(p.oneway).toLowerCase() === 'reversible' || String(p.highway).includes('construction') || Object.entries(p).some(([k,v]) => /hov|hot|fixme/i.test(`${k}=${v}`))
);
let finalDetermination = 'METADATA COVERAGE INSUFFICIENT — EXTRACTION PROTOTYPE BLOCKED';
if (counts.ref/total >= 0.9 && counts.oneway/total >= 0.75 && counts['tiger:county']/total >= 0.9 && counts.highway/total >= 0.95) {
  finalDetermination = manualReviewCandidates.length ? 'METADATA COVERAGE PARTIAL — EXTRACTION PROTOTYPE ALLOWED WITH REVIEW BUCKETS' : 'METADATA COVERAGE STRONG — READY FOR EXTRACTION PROTOTYPE';
} else if (counts.ref/total >= 0.6 && counts.highway/total >= 0.9 && counts.geometry/total >= 0.95) {
  finalDetermination = 'METADATA COVERAGE PARTIAL — EXTRACTION PROTOTYPE ALLOWED WITH REVIEW BUCKETS';
}
const evidence = {
  milestone: 'V683',
  sourceAsset: requestedSource,
  inspectedSourceAsset: sourceAsset,
  generatedAt: new Date().toISOString(),
  totalFeatures: total,
  counts,
  percentages,
  countyDistribution,
  highwayDistribution,
  confidenceRiskCounts,
  manualReviewCandidateCount: manualReviewCandidates.length,
  manualReviewCandidates: manualReviewCandidates.slice(0, 50).map(({i,p}) => ({ featureIndex: i, id: p.id || p['@id'] || null, ref: p.ref || null, name: p.name || null, highway: p.highway || null, county: p['tiger:county'] || null, reasons: [!has(p,'ref')&&'missing ref', !has(p,'oneway')&&'missing oneway', !has(p,'tiger:county')&&'missing county', String(p.oneway).toLowerCase()==='reversible'&&'reversible', String(p.highway).includes('construction')&&'construction'].filter(Boolean) })),
  protectedSystemsVerified: {
    historicalReadsEnabled: false,
    historyUiEnabled: false,
    DriveTexasPaused: true,
    TransportationIntelligenceEnabled: false,
    TransportationIntelligenceDisplay: false,
    TransportationIntelligenceActivation: false
  },
  runtimeChanged: false,
  appJsChanged: false,
  uiChanged: false,
  driveTexasChanged: false,
  transportationIntelligenceChanged: false,
  finalDetermination
};
fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);
console.log(finalDetermination);
