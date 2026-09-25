import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=[
 'tests/lp028-8-drivetexas-area-retention-refresh.test.js',
 'tests/lp042-drivetexas-connector-awareness-filter-certification.test.js',
 'tests/lp043-drivetexas-geometry-preservation-and-authority-repair.test.js',
 'tests/lp003-official-provider-refresh-performance-repair.test.js',
 'tests/lp214-drivetexas-source-health-repair.test.mjs',
 'tests/lp214-fresh-start-provider-convergence.test.mjs',
 'tests/lp2401g-bounded-nws-point-weather.test.cjs',
 'tests/lp2401g2-safe-startup-weather.test.cjs',
 'tests/lp2401g3-alerts-weather-handoff.test.cjs',
 'tests/lp2413-weather-startup-authority.test.cjs',
 'tests/lp24428-weather-kbyg-consistency.test.mjs',
 'tests/native-weather-pipeline-acceptance.test.cjs',
 'tests/lp24449b-source-truth-and-filter.test.cjs',
 'tests/lp24449b1-pulse-community-revision.test.cjs'
];
const start=Date.now(),run=spawnSync(process.execPath,['--test','--test-reporter=spec',...files],{encoding:'utf8',maxBuffer:20e6});
const log=run.stdout+'\n'+run.stderr;
const out=process.env.GRIDLY_CERTIFICATION_OUT||'reports/lp24450a';fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(`${out}/contracts.log`,log);
const result={files,exitCode:run.status,elapsedMs:Date.now()-start,scope:'Existing production-adapter/source-authority tests; controlled responses. No live success or physical-device claim.',summary:log.split(/\r?\n/).filter(l=>/^ℹ (tests|pass|fail|duration)/.test(l)),failures:log.split(/\r?\n/).filter(l=>l.startsWith('✖'))};
fs.writeFileSync(`${out}/contracts.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=run.status;
