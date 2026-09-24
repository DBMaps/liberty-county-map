import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const files=['tests/lp24449b1-pulse-community-revision.test.cjs','tests/lp214-fredericksburg-alerts-publication-presentation-convergence.test.mjs','tests/lp24449b-source-truth-and-filter.test.cjs'];
const run=spawnSync(process.execPath,['--test',...files],{encoding:'utf8'}),log=run.stdout+'\n'+run.stderr;
fs.writeFileSync('.artifacts/lp24449b1/final-focused-tests.log',log);fs.writeFileSync('reports/lp24449b1/focused-tests.json',JSON.stringify({files,exitCode:run.status,log},null,2)+'\n');console.log(log);process.exitCode=run.status||0;
