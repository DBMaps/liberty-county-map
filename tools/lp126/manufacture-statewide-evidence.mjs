#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_OUTPUT, EVIDENCE_CLASSES, manufacture } from './lib.mjs';

const args = process.argv.slice(2); const value = flag => { const index = args.indexOf(flag); return index < 0 ? undefined : args[index + 1]; };
const requested = value('--classes')?.split(',') ?? (value('--class') ? [value('--class')] : EVIDENCE_CLASSES);
if (requested.some(c => !EVIDENCE_CLASSES.includes(c))) throw new Error(`Unknown evidence class; valid classes: ${EVIDENCE_CLASSES.join(', ')}`);
const root = path.resolve(value('--source-root') ?? '.'); const output = path.resolve(value('--output') ?? path.join(root, DEFAULT_OUTPUT));
const result = await manufacture({ root, classes: requested }); const serialized = `${JSON.stringify(result, null, 2)}\n`;
if (args.includes('--dry-run')) { console.log(JSON.stringify({ countyCount: result.countyCount, evidenceClasses: result.evidenceClasses.length, matrixCellCount: result.matrixCellCount, seal: result.seal.value })); process.exit(0); }
if (args.includes('--resume') && !args.includes('--force')) { try { if (await readFile(output, 'utf8') === serialized) { console.log(`LP126 checkpoint already sealed: ${result.seal.value}`); process.exit(0); } } catch {} }
await mkdir(path.dirname(output), { recursive: true }); const temporary = `${output}.tmp`; await writeFile(temporary, serialized); await rename(temporary, output);
console.log(`Manufactured ${result.matrixCellCount} county/class cells; seal ${result.seal.value}`);
