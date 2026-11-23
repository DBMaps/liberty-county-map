import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export const root=fileURLToPath(new URL('../',import.meta.url));
export function sourcePaths(){
 const result=[];
 function walk(dir,prefix=''){for(const entry of readdirSync(dir,{withFileTypes:true})){
  const path=prefix+entry.name;if(path==='.scratch'||path==='certification/source.sha256')continue;
  if(path==='evidence'){for(const file of ['source-copies.json','stage4c/github-provenance.json','stage4c/stage4b-inventory.json'])result.push('evidence/'+file);continue;}
  if(entry.isDirectory())walk(resolve(dir,entry.name),path+'/');else result.push(path);
 }}walk(root);return result.sort();
}
if(process.argv.includes('--write')){
 const lines=sourcePaths().map(path=>createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex')+'  '+path);
 writeFileSync(resolve(root,'certification/source.sha256'),lines.join('\n')+'\n');console.log(`${lines.length} portable source entries pinned.`);
}
