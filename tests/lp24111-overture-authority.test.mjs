import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {verify} from '../tools/lp24111/manufacture.mjs';

test('LP241.11 deterministic audit contracts are complete and non-runtime',()=>{
 const a=verify();
 assert.equal(a['overture-release.json'].releaseId,'2026-08-19.0');
 assert.equal(a['county-coverage.json'].accountedCountyCount,254);
 assert.equal(a['community-coverage.json'].canonicalPlaceAccounted,1859);
 assert.equal(a['texas-extraction-summary.json'].executionState,'NOT_EXECUTED');
 assert.equal(a['certification.json'].productionPoiSearch,'NOT_LAUNCHED_NOT_CERTIFIED');
 assert.equal(a['normalized-schema-proposal.json'].zeroQueryCost,true);
 assert.match(fs.readFileSync('tools/lp24111/extract-texas.sql','utf8'),/ST_Intersects/);
 assert.doesNotMatch(fs.readFileSync('js/app.js','utf8'),/lp24111|overture-texas-places/i);
});

test('medical categories cannot absorb veterinary records',()=>{
 const a=verify(), m=a['category-coverage.json'].mapping;
 assert.ok(m.humanMedicalExclusions.includes('veterinarian'));
 assert.ok(m.humanMedicalExclusions.includes('animal_hospital'));
});
