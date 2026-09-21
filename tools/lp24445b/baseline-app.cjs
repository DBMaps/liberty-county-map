// Read-only baseline substitution for existing source-extraction tests.
const fs=require('node:fs');
const path=require('node:path');
const {fileURLToPath}=require('node:url');
const {execFileSync}=require('node:child_process');
const {syncBuiltinESMExports}=require('node:module');
const original=fs.readFileSync;
const baseline=execFileSync('git',['show','a3218de7fd0b1a4de40768df7e631ead473ec60e:js/app.js'],{maxBuffer:30e6});
fs.readFileSync=function(file,options){const name=file instanceof URL?fileURLToPath(file):file;if(typeof name==='string'&&path.resolve(name)===path.resolve('js/app.js')){const encoding=typeof options==='string'?options:options?.encoding;return encoding?baseline.toString(encoding):Buffer.from(baseline);}return original.apply(this,arguments);};
syncBuiltinESMExports();
