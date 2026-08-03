#!/usr/bin/env node
import { readFile } from 'node:fs/promises';import { join } from 'node:path';
import { buildSidecar,verifySidecar } from './harris-sidecar-core.mjs';
const root=process.cwd(),dir=join(root,'data/generated/lp104/txgio-addresses'),source=join(dir,'harris-48201.addresses.jsonl.gz'),sourceCertPath=join(dir,'harris-48201.runtime-certificate.json'),outDir=join(root,'.artifacts/lp108');
const output=join(outDir,'harris-48201.certified-lookup.bin'),certificatePath=join(outDir,'harris-48201.certified-lookup-certificate.json');const command=process.argv[2]||'build';
const json=async p=>JSON.parse(await readFile(p,'utf8'));const sourceCertificate=await json(sourceCertPath);
if(command==='build'){console.log(JSON.stringify(await buildSidecar({sourcePath:source,sourceCertificate,outputPath:output,certificatePath}),null,2));}
else if(command==='verify-local'){console.log(await verifySidecar(output,await json(certificatePath),sourceCertificate));}
else if(['upload','verify-remote'].includes(command)){console.error(`Use sync tool with private bucket: node tools/lp108/sync-harris-sidecar.mjs ${command}`);process.exitCode=2}else{throw new Error('usage: build|verify-local|upload|verify-remote')}
