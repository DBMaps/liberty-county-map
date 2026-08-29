import fs from 'node:fs';
import path from 'node:path';
import {validateD4MeasuredEnvelope} from './manufacture.mjs';

const root=path.resolve(import.meta.dirname,'../..');
const source=path.join(root,'owner-local/lp24111/phase-d4-certified-measurements.json');
const destination=path.join(root,'data/lp24111/phase-d4-certified-measurements.json');

if(!fs.existsSync(source))throw Error(`Missing certified D.4 envelope: ${source}`);
const envelope=validateD4MeasuredEnvelope(JSON.parse(fs.readFileSync(source,'utf8')));
fs.mkdirSync(path.dirname(destination),{recursive:true});
fs.writeFileSync(destination,`${JSON.stringify(envelope,null,2)}\n`);
console.log('published data/lp24111/phase-d4-certified-measurements.json (JSON envelope only)');
