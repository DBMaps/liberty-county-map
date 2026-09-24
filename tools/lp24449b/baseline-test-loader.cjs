// Test-only comparison against the exact captured starting app; no workspace swap.
const fs=require('node:fs');
const path=require('node:path');
const {syncBuiltinESMExports}=require('node:module');
const read=fs.readFileSync;
const target=path.resolve('js/app.js');
fs.readFileSync=function(file,...args){
  const resolved=typeof file==='string'?path.resolve(file):file instanceof URL?require('node:url').fileURLToPath(file):null;
  return read.call(this,resolved===target?path.resolve('.artifacts/lp24449b/baseline-app.js'):resolved===path.resolve('js/gridlyWeatherLiveConnector.js')?path.resolve('.artifacts/lp24449b/baseline-weather.js'):file,...args);
};
syncBuiltinESMExports();
