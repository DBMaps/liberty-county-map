#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import geometryAuthority from '../../js/gridlyDriveTexasGeometryAuthority.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const paths = {
  inventory: path.join(root, 'data/generated/lp214-county-community-inventory.json'),
  focus: path.join(root, 'data/generated/gridly-statewide-place-presentation-v1.json'),
  output: path.join(root, 'data/generated/lp214-drivetexas-statewide-community-certification.json')
};
const DEFAULT_RADIUS_MILES = 7;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const stable = value => `${JSON.stringify(value, null, 2)}\n`;
export const canonicalRepositoryPath = relativePath => relativePath.replaceAll('\\', '/');
const repositoryRelative = file => canonicalRepositoryPath(path.relative(root, file));
const fail = message => { throw new Error(`LP214 DriveTexas statewide certification: ${message}`); };
const milesLatitude = miles => miles / 69;

export function buildCertification() {
  const inventory = read(paths.inventory);
  const presentations = read(paths.focus);
  const unique = new Map();
  for (const county of inventory.counties) for (const row of county.communities) unique.set(row.canonicalKey, row);
  if (unique.size !== 1859 || inventory.summary?.countyCount !== 254) fail('authoritative denominator mismatch');

  const communities = [...unique.values()].sort((a,b) => a.canonicalKey.localeCompare(b.canonicalKey)).map(row => {
    const focus = presentations.places?.[row.placeGeoid];
    const latitude = Number(focus?.lat), longitude = Number(focus?.lon);
    const validFocus = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= 25.5 && latitude <= 36.6 && longitude >= -106.7 && longitude <= -93.2;
    const explicitRadius = Number.isFinite(Number(focus?.radiusMiles));
    const radiusMiles = explicitRadius ? Number(focus.radiusMiles) : DEFAULT_RADIUS_MILES;
    const validRadius = radiusMiles > 0 && radiusMiles <= 100;
    const area = { communityId: row.placeGeoid, key: row.canonicalKey, label: row.consumerLabel, lat: latitude, lng: longitude, radiusMiles };
    let checks = { insidePoint:false, outsidePoint:false, insideLine:false, outsideLine:false, geoJsonOrder:false, malformedFailsClosed:false, swappedFailsClosed:false };
    if (validFocus && validRadius) {
      const qualify = record => geometryAuthority.qualify(record, { selectedAwarenessArea: area });
      const insideLat = latitude + milesLatitude(radiusMiles * .4);
      const outsideLat = latitude + milesLatitude(radiusMiles * 1.6);
      checks = {
        insidePoint: qualify({ sourceGeometry:{ type:'Point', coordinates:[longitude, insideLat] } }).geometryQualified === true,
        outsidePoint: qualify({ sourceGeometry:{ type:'Point', coordinates:[longitude, outsideLat] } }).geometryQualified === false,
        insideLine: qualify({ sourceGeometry:{ type:'LineString', coordinates:[[longitude-.01, insideLat],[longitude+.01, insideLat]] } }).geometryQualified === true,
        outsideLine: qualify({ sourceGeometry:{ type:'LineString', coordinates:[[longitude-.01, outsideLat],[longitude+.01, outsideLat]] } }).geometryQualified === false,
        geoJsonOrder: qualify({ sourceGeometry:{ type:'Point', coordinates:[longitude, insideLat] } }).representativeLongitude === longitude,
        malformedFailsClosed: qualify({ sourceGeometry:{ type:'LineString', coordinates:[[null,'bad']] } }).geometryQualified === false,
        swappedFailsClosed: qualify({ sourceGeometry:{ type:'Point', coordinates:[latitude, longitude] } }).geometryQualified === false
      };
    }
    const authorityValid = validFocus && validRadius && Object.values(checks).every(Boolean);
    const classification = !validFocus ? 'INVALID_AWARENESS_FOCUS' : !validRadius ? 'INVALID_RADIUS' : !authorityValid ? 'AUTHORITY_SHAPE_FAILURE' : explicitRadius ? 'EXPLICIT_RADIUS_VALID' : 'GOVERNED_DEFAULT_RADIUS_VALID';
    return { canonicalKey:row.canonicalKey, focusLatitude:latitude, focusLongitude:longitude, explicitRadiusPresent:explicitRadius, defaultRadiusRequired:!explicitRadius, effectiveRadiusMiles:radiusMiles, classification, authorityShapeValid:authorityValid, geometryAuthorityCallable:true, radiusPropagationValid:authorityValid, communitySpecificOverride:false, multiCountyIdentityPreserved:row.multiCounty, memberCountyFips:row.memberCountyFips, syntheticChecks:checks };
  });
  const count = key => communities.filter(row => row.classification === key).length;
  const checkTotals = Object.fromEntries(Object.keys(communities[0].syntheticChecks).map(key => [key, communities.filter(row => row.syntheticChecks[key]).length]));
  const artifact = { schemaVersion:'gridly.lp214.drivetexas-statewide-community-certification.v1', generatedFrom:[repositoryRelative(paths.inventory),repositoryRelative(paths.focus)], contract:{ defaultRadiusMiles:DEFAULT_RADIUS_MILES, geoJsonCoordinateOrder:'longitude_latitude', geometryAuthority:'js/gridlyDriveTexasGeometryAuthority.js:gridlyQualifyDriveTexasGeometryAuthority' }, summary:{ countyCount:254, communityCount:communities.length, membershipCount:inventory.summary.countyCommunityMembershipCount, multiCountyCommunityCount:communities.filter(x=>x.multiCountyIdentityPreserved).length, explicitRadiusCount:count('EXPLICIT_RADIUS_VALID'), defaultRadiusCount:count('GOVERNED_DEFAULT_RADIUS_VALID'), invalidFocusCount:count('INVALID_AWARENESS_FOCUS'), invalidRadiusCount:count('INVALID_RADIUS'), authorityFailureCount:count('AUTHORITY_SHAPE_FAILURE'), ownerReviewRequiredCount:count('OWNER_REVIEW_REQUIRED'), radiusPropagationFailureCount:communities.filter(x=>!x.radiusPropagationValid).length, syntheticCheckTotals:checkTotals }, controls:{ dallas:communities.find(x=>x.canonicalKey==='place-4819000'), houston:communities.find(x=>x.canonicalKey==='place-4835000') }, communities };
  if (artifact.summary.communityCount !== 1859 || artifact.summary.multiCountyCommunityCount !== 163 || Object.values(checkTotals).some(n=>n!==1859) || artifact.summary.radiusPropagationFailureCount) fail('statewide authority certification failed');
  return artifact;
}
export function run({verify=false}={}) { const bytes=Buffer.from(stable(buildCertification())); if(verify){ if(!fs.existsSync(paths.output)||!fs.readFileSync(paths.output).equals(bytes)) fail('generated artifact is stale'); } else fs.writeFileSync(paths.output,bytes); return JSON.parse(bytes); }
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){ try { const verify=process.argv.includes('--verify'); if(process.argv.slice(2).some(x=>x!=='--verify')) fail('usage: build-drivetexas-statewide-community-certification.mjs [--verify]'); const out=run({verify}); console.log(`${verify?'Verified':'Wrote'} statewide certification for ${out.summary.communityCount} communities`); } catch(e){console.error(e.message);process.exitCode=1;} }
