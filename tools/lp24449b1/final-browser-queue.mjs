import fs from 'node:fs';
import {spawn} from 'node:child_process';
const dir='.artifacts/lp24449b1';
for(const task of [
  {name:'provider-official-retention.mjs'},
  ...[360,390,440].map(width=>({name:'freeze-verify-browser.cjs',width}))
]){
  const log=fs.openSync(`${dir}/final-browser-${task.width||'official-retention'}.log`,'a');
  const startedAt=new Date().toISOString();
  const code=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[`tools/lp24449b1/${task.name}`],{stdio:['ignore',log,log],env:{...process.env,...(task.width?{GRIDLY_H1_WIDTH:String(task.width),GRIDLY_49A_COMBINED_ONLY:'1'}:{})}});
    child.on('error',reject);child.on('exit',resolve);
  });
  fs.closeSync(log);
  const result={...task,startedAt,finishedAt:new Date().toISOString(),code};
  fs.appendFileSync(`${dir}/final-browser-queue.jsonl`,JSON.stringify(result)+'\n');
  console.log(JSON.stringify(result));
  if(code!==0)throw Error(`Final browser check failed: ${task.name} ${task.width||''}`);
}
