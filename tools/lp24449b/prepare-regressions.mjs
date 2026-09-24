import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const files=['contracts.mjs','profiles.mjs','search.mjs','visible-search.mjs','home-browser.mjs','transitions.mjs','freeze-three-hazards.mjs','freeze-verify-settings.cjs','freeze-geometry.cjs','freeze-saved-places.mjs','freeze-clear-compare.cjs','text-size-baseline.mjs','tests.mjs','baseline-test-loader.cjs','home-read-performance.mjs','integrity.mjs','label-baseline.mjs'];
for(const file of files){let source=fs.readFileSync(`tools/lp24449a/${file}`,'utf8').replaceAll('lp24449a','lp24449b');
 source=source.replaceAll('02fe47fd1b76a4bd52d8f8487a96cdc8e5c804e8','5538432be3bfe12c6dc0d3f34dcc9fd97c6edc3c');
 if(file==='home-browser.mjs')source=source.replaceAll("read('reports/lp24449b/original-in-scope-failures.json')","read('reports/lp24449a/original-in-scope-failures.json')").replaceAll("read('reports/lp24449b/certification-cohorts.json')","read('reports/lp24449a/certification-cohorts.json')");
 if(file==='tests.mjs')source=source.replaceAll("'tests/lp24449b-","'tests/lp24449a-");
 if(file==='integrity.mjs')source=source.replace("r.file==='js/app.js'","['js/app.js','js/gridlyWeatherLiveConnector.js'].includes(r.file)");
 fs.writeFileSync(`tools/lp24449b/${file}`,source);
}
fs.writeFileSync('.artifacts/lp24449b/baseline-weather.js',execFileSync('git',['show','5538432be3bfe12c6dc0d3f34dcc9fd97c6edc3c:js/gridlyWeatherLiveConnector.js']));
console.log('Prepared isolated regression tools; original evidence retained.');
