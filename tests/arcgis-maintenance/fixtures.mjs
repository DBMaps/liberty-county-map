import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename,resolve} from 'node:path';
import {deflateSync} from 'node:zlib';
export const originalBytes=Buffer.from(JSON.stringify({arcgisStaticBasemapApiKey:'SYNTHETIC_ORIGINAL_LABELS',driveTexas:{apiKey:'SYNTHETIC_DRIVETEXAS'}}));
export const candidateBytes=Buffer.from(JSON.stringify({arcgisStaticBasemapApiKey:'SYNTHETIC_REPLACEMENT_LABELS',driveTexas:{apiKey:'SYNTHETIC_DRIVETEXAS'}}));
export async function fixture() {
  const root=await mkdtemp(join(tmpdir(),'gridly-arcgis-prep-'));
  const originalFile=join(root,'original.json'),candidateFile=join(root,'candidate.json');
  await writeFile(originalFile,originalBytes);await writeFile(candidateFile,candidateBytes);
  return {root,originalFile,candidateFile,async dispose(){
    const absolute=resolve(root);if(dirname(absolute).toLowerCase()!==resolve(tmpdir()).toLowerCase()||!basename(absolute).startsWith('gridly-arcgis-prep-'))throw Error('FIXTURE_CLEANUP_REJECTED');
    await rm(absolute,{recursive:true,force:true});
  }};
}
function chunk(name,data) {
  const type=Buffer.from(name),body=Buffer.concat([type,data]);let crc=0xffffffff;
  for(const n of body){crc^=n;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  const length=Buffer.alloc(4),tail=Buffer.alloc(4);length.writeUInt32BE(data.length);tail.writeUInt32BE((crc^0xffffffff)>>>0);
  return Buffer.concat([length,body,tail]);
}
export function png() {
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(512);ihdr.writeUInt32BE(512,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(Buffer.alloc(512*(1+512*4)))),chunk('IEND',Buffer.alloc(0))]);
}
