#!/usr/bin/env node
import { readFile } from 'node:fs/promises';import { join } from 'node:path';
import { buildBuckets,verifyBuckets } from './harris-sidecar-core.mjs';
const root=process.cwd(),dir=join(root,'data/generated/lp104/txgio-addresses'),source=join(dir,'harris-48201.addresses.jsonl.gz'),sourceCertPath=join(dir,'harris-48201.runtime-certificate.json'),outDir=join(root,'.artifacts/lp108'),bucketDir=join(outDir,'harris-48201/buckets'),manifestPath=join(outDir,'harris-48201.certified-lookup-manifest.json');
const command=process.argv[2]||'build',json=async p=>JSON.parse(await readFile(p,'utf8')),sourceCertificate=await json(sourceCertPath);
if(command==='build')console.log(JSON.stringify(await buildBuckets({sourcePath:source,sourceCertificate,outputDirectory:bucketDir,manifestPath}),null,2));
else if(command==='verify-local')console.log(JSON.stringify(await verifyBuckets({outputDirectory:bucketDir,manifest:await json(manifestPath),sourceCertificate}),null,2));
else if(['upload','verify-remote'].includes(command)){const {run}=await import('./sync-harris-sidecar.mjs');await run(process.argv.slice(2));}
else throw new Error('usage: build|verify-local|upload|verify-remote');
