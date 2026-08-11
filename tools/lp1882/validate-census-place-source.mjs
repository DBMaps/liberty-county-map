#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mode = process.argv[2] || 'verify';
if (!['build', 'verify'].includes(mode)) throw new Error('usage: build|verify');

const ownerPath = 'C:\\GitHub\\Gridly-Source-Data\\Census\\TIGER2025\\PLACE\\original\\tl_2025_48_place.zip';
const accessibleCandidates = [
  path.join(root, 'Gridly-Source-Data/Census/TIGER2025/PLACE/original/tl_2025_48_place.zip'),
  '/workspace/Gridly-Source-Data/Census/TIGER2025/PLACE/original/tl_2025_48_place.zip',
  '/mnt/c/GitHub/Gridly-Source-Data/Census/TIGER2025/PLACE/original/tl_2025_48_place.zip'
];
const matches = accessibleCandidates.filter(candidate => fs.existsSync(candidate));

// LP188.2 must never manufacture from a substitute or claim a source lock when the
// owner archive is not visible. This report intentionally contains no inferred hash.
const report = {
  milestone: 'LP188.2',
  title: 'Census Source Validation and Provenance Lock',
  finalClassification: matches.length === 1
    ? 'SOURCE_PRESENT_REQUIRES_VALIDATION_RUN'
    : 'SOURCE_ACQUISITION_BLOCKED_OWNER_ACTION_REQUIRED',
  expectedSource: {
    publisher: 'U.S. Census Bureau',
    dataset: '2025 TIGER/Line Shapefiles — Places — Texas',
    stateFips: '48',
    filename: 'tl_2025_48_place.zip',
    ownerAbsolutePath: ownerPath
  },
  environmentObservation: {
    accessibleCandidates,
    matchingFiles: matches,
    exactFileExists: matches.length === 1,
    blocker: matches.length === 1 ? null : 'OWNER_ARCHIVE_NOT_VISIBLE_IN_EXECUTION_ENVIRONMENT'
  },
  provenance: {
    byteSize: null,
    sha256: null,
    zipReadable: null,
    originalModified: false
  },
  validation: {
    extractedFiles: [],
    schemaValidated: false,
    geoidValidated: false,
    classificationValidated: false,
    geometryValidated: false,
    countyMembershipValidated: false
  },
  downstream: {
    lp1883Ready: false,
    manufacturingStarted: false,
    expensiveAllCountyJobRun: false
  },
  safety: {
    countyActivation: false,
    deployment: false,
    packageManufacturing: false,
    supabaseMutation: false,
    restrictionRemoval: false,
    addressOrRoadwayOrCrossingRebuild: false
  }
};

const output = path.join(root, 'reports/lp1882/census-place-source-lock.json');
const content = `${JSON.stringify(report, null, 2)}\n`;
if (mode === 'build') {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, content);
} else if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== content) {
  throw new Error('reports/lp1882/census-place-source-lock.json is missing or stale');
}
console.log(`LP188.2 ${mode} PASS: ${report.finalClassification}`);
