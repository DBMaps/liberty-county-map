import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename,resolve} from 'node:path';
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
