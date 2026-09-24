import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
const files=['tests/lp2413-weather-startup-authority.test.cjs','tests/lp24428-weather-kbyg-consistency.test.mjs','tests/lp2401g2-safe-startup-weather.test.cjs'];
const result=spawnSync(process.execPath,['--test',...files],{encoding:'utf8'}),log=result.stdout+'\n'+result.stderr;
const weatherHash=crypto.createHash('sha256').update(fs.readFileSync('js/gridlyWeatherLiveConnector.js')).digest('hex');
fs.writeFileSync('.artifacts/lp24449b1/final-weather-tests.log',log);
fs.writeFileSync('reports/lp24449b1/final-weather-tests.json',JSON.stringify({files,weatherHash,exitCode:result.status,log},null,2)+'\n');
console.log(JSON.stringify({weatherHash,exitCode:result.status,summary:log.split('\n').filter(line=>/ℹ (tests|pass|fail)/.test(line))}));process.exitCode=result.status||0;
