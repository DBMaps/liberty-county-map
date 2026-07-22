const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const outPath = path.join('data', 'gridly-zip-awareness-index-v2.json');
const sourceDir = path.join('data', 'source', 'zip');
const sourceFiles = fs.existsSync(sourceDir) ? fs.readdirSync(sourceDir).filter((name) => !name.endsWith('.json')).sort() : [];
const sourceArtifacts = sourceFiles.map((name) => {
  const p = path.join(sourceDir, name);
  const bytes = fs.readFileSync(p);
  return { path: p.replace(/\\/g, '/'), originalFilename: name, fileSize: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
});
const sourceDetected = sourceArtifacts.length > 0;
const records = [
  ['77535','standard_geographic','resolved','liberty-tx','Liberty County','dayton','Dayton','dayton','Dayton','directly_zip_resolvable'],
  ['77575','standard_geographic','resolved','liberty-tx','Liberty County','liberty','Liberty','liberty','Liberty','directly_zip_resolvable'],
  ['77327','standard_geographic','resolved_by_governance','liberty-tx','Liberty County','cleveland','Cleveland','cleveland','Cleveland','resolved_by_governance'],
  ['77351','standard_geographic','resolved','polk-tx','Polk County','livingston','Livingston','polk-tx-livingston','Livingston','directly_zip_resolvable'],
  ['77002','standard_geographic','resolved','harris-tx','Harris County','houston-downtown-midtown','Downtown / Midtown','houston-downtown-midtown','Downtown / Midtown','directly_zip_resolvable'],
  ['77022','standard_geographic','resolved_by_governance','harris-tx','Harris County','houston-north','North Houston / Greenspoint','houston-north','North Houston / Greenspoint','resolved_by_governance'],
  ['77075','standard_geographic','resolved_by_governance','harris-tx','Harris County','houston-southeast-hobby','Southeast Houston / Hobby','houston-southeast-hobby','Southeast Houston / Hobby','resolved_by_governance'],
  ['77520','standard_geographic','resolved_by_governance','harris-tx','Harris County','baytown','Baytown','harris-tx-baytown','Baytown','resolved_by_governance'],
  ['77084','standard_geographic','ambiguous','harris-tx','Harris County','katy','Katy','harris-tx-katy','Katy','requires_disambiguation'],
  ['77201','po_box_only','po_box_not_supported','harris-tx','Harris County','houston-downtown-midtown','Downtown / Midtown','houston-downtown-midtown','Downtown / Midtown','unsupported_zip_type'],
  ['77210','unique','unique_zip_not_supported','harris-tx','Harris County','houston-downtown-midtown','Downtown / Midtown','houston-downtown-midtown','Downtown / Midtown','unsupported_zip_type']
].map(([zip, zipType, status, countyId, countyName, communityKey, communityLabel, awarenessAreaKey, consumerLabel, resolutionMethod]) => ({
  zip, zipType, status, countyId, countyName, communityKey, communityLabel, awarenessAreaKey, consumerLabel, resolutionMethod,
  authority: sourceDetected ? 'LP051.3 source artifact detected; Gridly governance preserved pending reviewed assignment expansion.' : 'LP051.3 blocked: no usable authoritative USPS ZIP source artifact is locally present.',
  confidence: status === 'ambiguous' ? 'shared_zip_candidate' : (status.includes('not_supported') ? 'insufficient_evidence' : 'governed_override'),
  candidates: status === 'ambiguous' ? [{ countyId, countyName, communityKey, awarenessAreaKey, consumerLabel, candidateStatus: 'requires_disambiguation', candidateConfidence: 'shared_zip_candidate' }] : [],
  governanceNotes: 'Preserved LP051/LP051.1/LP051.2 governed behavior; no ZIP-first UI activation.',
  sourceVersion: sourceDetected ? 'owner_supplied_source_artifact' : null
}));
const output = { version: 'LP051.3.authoritative-zip-source-import.v1', milestone: 'LP051.3', sourceImportStatus: sourceDetected ? 'partial' : 'blocked', sourceName: sourceDetected ? 'Owner-supplied ZIP/ZCTA source artifact' : null, sourceArtifacts, zipVsZctaDistinction: 'USPS ZIP, Census ZCTA, ZIP-county relationship, locality evidence, and Gridly awareness assignment are separate evidence layers.', records };
fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`wrote ${outPath} (${records.length} records, sourceImportStatus=${output.sourceImportStatus})`);
