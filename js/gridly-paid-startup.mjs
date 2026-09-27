// Execute only the manifest-governed stack after current proof admission.
// Legacy classic modules register DOMContentLoaded; admission happens after the
// real event, so replay ONLY handlers registered during this admitted load.
export async function loadPaidRuntime({document, window, allowed, timeoutMs=15000}) {
  if(!allowed()) throw Error('verification_required');
  const callbacks=[];
  const targets=[document,window];
  const originals=targets.map(target=>({target,add:target.addEventListener,remove:target.removeEventListener}));
  for(const {target,add,remove} of originals) {
    target.addEventListener=function(type,fn,options) {
      if(type!=='DOMContentLoaded') return add.call(this,type,fn,options);
      const capture=typeof options==='boolean'?options:!!options?.capture;
      if(!callbacks.some(item=>item.target===this&&item.fn===fn&&item.capture===capture)) callbacks.push({target:this,fn,options,capture});
    };
    target.removeEventListener=function(type,fn,options) {
      if(type!=='DOMContentLoaded') return remove.call(this,type,fn,options);
      const capture=typeof options==='boolean'?options:!!options?.capture;
      const index=callbacks.findIndex(item=>item.target===this&&item.fn===fn&&item.capture===capture);
      if(index>=0) callbacks.splice(index,1);
    };
  }
  try {
    for(const inert of document.querySelectorAll('script[type="application/gridly-protected"]')) {
      if(!allowed()) throw Error('verification_required');
      const script=document.createElement('script');
      const source=inert.getAttribute('data-gridly-source');
      if(source) {
        await new Promise((resolve,reject)=>{
          const timer=window.setTimeout(()=>{script.remove();reject(Error('runtime_unavailable'));},timeoutMs);
          script.async=false;script.src=source;
          script.onload=()=>{window.clearTimeout(timer);resolve();};
          script.onerror=()=>{window.clearTimeout(timer);reject(Error('runtime_unavailable'));};
          document.head.append(script);
        });
      } else {script.textContent=inert.textContent;document.head.append(script);}
    }
  } finally {
    for(const {target,add,remove} of originals) {target.addEventListener=add;target.removeEventListener=remove;}
  }
  if(!allowed()) throw Error('verification_required');
  const event=new window.Event('DOMContentLoaded');
  for(const {target,fn,options} of callbacks) {
    if(options?.signal?.aborted) continue;
    try {
      const result=typeof fn==='function'?fn.call(target,event):fn?.handleEvent(event);
      // Match browser event dispatch: other listeners do not wait for async work.
      if(result?.catch) result.catch(()=>{});
    } catch { /* Legacy listener isolation matches normal browser dispatch. */ }
  }
}
