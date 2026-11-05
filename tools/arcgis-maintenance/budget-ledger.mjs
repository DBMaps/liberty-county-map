// Private host ledger: reserves before dispatch, survives restart, refuses stale locks.
import {open,readFile,rename,rm,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {assertPlainPath,assertOutsideRepository} from './staging.mjs';
const fail=()=>{throw Error('DIAGNOSTIC_BUDGET_UNAVAILABLE');};
const validScope=scope=>/^(android|ios):(synthetic-[a-z0-9-]{1,60}|owner-[a-f0-9]{32})$/.test(scope);
export async function createFileBudgetLedger({directory,verifyPrivateDirectory}={}) {
  const root=await assertPlainPath(directory);await assertOutsideRepository(root);
  if(typeof verifyPrivateDirectory!=='function'||await verifyPrivateDirectory(root)!==true)fail();
  const file=scope=>join(root,createHash('sha256').update(scope).digest('hex')+'.json');
  async function transaction(scope,change) {
    if(!validScope(scope))fail();
    const target=file(scope),lock=target+'.lock',pending=target+'.'+randomUUID()+'.tmp';let held;
    try {
      await assertPlainPath(root);held=await open(lock,'wx',0o600);
      await assertPlainPath(target);
      const state=JSON.parse(await readFile(target,'utf8'));
      if(!state||Object.keys(state).sort().join(',')!=='count,scope,stopped'||state.scope!==scope||!Number.isInteger(state.count)||state.count<0||state.count>2||typeof state.stopped!=='boolean')fail();
      const result=change(state);
      if(result.write){const stream=await open(pending,'wx',0o600);try{await stream.writeFile(JSON.stringify(state));await stream.sync();}finally{await stream.close();}await rename(pending,target);}
      return result.value;
    }catch{fail();}
    finally {
      if(held){await held.close().catch(()=>{});await rm(lock,{force:true}).catch(()=>{});}
      await rm(pending,{force:true}).catch(()=>{});
    }
  }
  return Object.freeze({capability:'gridly.durable-atomic-label-budget.v1',
    // Explicit host authorization step. Existing/corrupt budgets are NEVER reset.
    async initialize(scope){if(!validScope(scope))fail();try{await assertPlainPath(root);const target=file(scope);try{await lstat(target+'.lock');fail();}catch(e){if(e.code!=='ENOENT')fail();}
      const stream=await open(target,'wx',0o600);try{await stream.writeFile(JSON.stringify({scope,count:0,stopped:false}));await stream.sync();}finally{await stream.close();}
      return Object.freeze({status:'BUDGET_INITIALIZED'});}catch{fail();}},
    read:scope=>transaction(scope,s=>({write:false,value:Object.freeze({...s})})),
    reserve:(scope,limit)=>transaction(scope,s=>{
      if(limit!==2||s.stopped||s.count>=2)return {write:false,value:Object.freeze({allowed:false})};
      s.count+=1;return {write:true,value:Object.freeze({allowed:true,ordinal:s.count})};}),
    stop:scope=>transaction(scope,s=>{s.stopped=true;return {write:true,value:Object.freeze({status:'STOPPED'})};})
  });
}
