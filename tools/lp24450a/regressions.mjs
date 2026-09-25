import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=[
 'tests/lp24450a-alerts-heading.test.cjs','tests/lp24450a-marker-reconciliation.test.cjs',
 'tests/lp214-official-roadway-marker-publication.test.cjs','tests/lp214-shared-summary-publication-convergence.test.mjs','tests/lp214-shared-active-issue-contract.test.mjs',
 'tests/lp214-location-context-drivetexas-count-propagation.test.mjs','tests/lp214-drivetexas-dallas-geographic-authority-repair.test.js',
 'tests/lp045-official-gridly-marker-presentation.test.js','tests/lp045-1-official-marker-live-runtime-repair.test.js','tests/lp045-2-official-marker-construction-repair.test.js',
 'tests/lp236-alerts-information-architecture.test.mjs','tests/lp24447-marker-system.test.cjs',
 'tests/lp24449a-search-publication.test.cjs','tests/lp24449a-home-cache.test.cjs','tests/lp24449a-canonical-home-resolution-cache.test.cjs',
 'tests/lp24411-stable-runtime-source-family-authority.test.cjs','tests/lp24413-incident-render-reconciliation.test.cjs',
 'tests/lp214-main-thread-attribution.test.js'
];
const result=spawnSync(process.execPath,['--test','--test-reporter=spec',...files],{encoding:'utf8',maxBuffer:20e6});
const log=result.stdout+'\n'+result.stderr;
const out=process.env.GRIDLY_CERTIFICATION_OUT||'reports/lp24450a';
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(`${out}/regressions.log`,log);
const report={command:'node tools/lp24450a/regressions.mjs',files,exitCode:result.status,summary:log.split(/\r?\n/).filter(l=>/^ℹ (tests|pass|fail|duration)/.test(l)),failures:log.split(/\r?\n/).filter(l=>l.startsWith('✖'))};
fs.writeFileSync(`${out}/regressions.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));process.exitCode=result.status;
