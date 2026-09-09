(function (root) {
  'use strict';
  const KEY = 'gridlyPendingCommunityOperationV1';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const MAX_AGE = 24 * 60 * 60 * 1000;
  const PROTOCOL_VERSION = 2;
  const REPORT_FIELDS = ['id','created_at','crossing_id','crossing_name','railroad','lat','lng','report_type','severity','detail','source','confidence','expires_at'];
  const TERMINAL = new Set(['accepted','already_processed','gone','forbidden','invalid_request','cancelled']);
  function uuid(crypto = root.crypto) {
    if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
    if (typeof crypto?.getRandomValues !== 'function') throw new Error('Secure submission identity unavailable');
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  function outcome(status) {
    if (status === 'maintenance') return {message:'Community reporting is temporarily unavailable. Your pending operation has not been confirmed. Try again after reporting reopens.',success:false};
    if (status === 'stale_client') return {message:'This Gridly client cannot use the current reporting protocol. Update or reload Gridly before retrying.',success:false};
    if (status === 'retryable_failure') return {message:'Report still pending. Retry when connected.',success:false};
    if (status === 'already_processed') return {message:'This operation was already processed. Refreshing reports; no new report was created.',success:true};
    if (status === 'accepted') return {message:'Report update confirmed.',success:true};
    if (status === 'cancelled') return {message:'Pending operation cancelled.',success:true};
    return {message:'This operation was not accepted. Refresh reports before trying again.',success:false};
  }
  function create({storage=root.localStorage,crypto=root.crypto,now=Date.now,protocol_version=PROTOCOL_VERSION} = {}) {
    let flight = null;
    function read() {
      const raw = storage.getItem(KEY);
      if (!raw) return null;
      let p;
      try { p = JSON.parse(raw); } catch { throw new Error('Pending report storage needs recovery'); }
      if (!UUID.test(p.id) || !Number.isFinite(p.startedAt) || !['create','confirm','edit','clear','cancel'].includes(p.kind)) {
        throw new Error('Pending report storage needs recovery');
      }
      // Never extend age on restart. Keep only the operation identity for terminal
      // server cancellation after 24h; no old condition/device payload is reloaded.
      if (p.kind!=='cancel' && now()-p.startedAt>=MAX_AGE) {
        p={id:p.id,startedAt:p.startedAt,kind:'cancel'};
        storage.setItem(KEY,JSON.stringify(p));
      }
      return p;
    }
    function pending() { const p=read(); return p ? {kind:p.kind,pending:true} : null; }
    function begin(kind,payload) {
      if (!['create','confirm','edit','clear','cancel'].includes(kind)) throw new Error('Invalid report operation');
      if (read()) { const error=new Error('A report is pending. Use Retry pending report before starting a new observation.'); error.code='PENDING_OPERATION'; throw error; }
      const encoded=JSON.stringify(payload);
      if (encoded.length>12000 || /"(?:device_id|deviceId|submission_token|operation_id)"\s*:/.test(encoded)) throw new Error('Invalid pending report payload');
      const p={id:uuid(crypto),startedAt:now(),kind,payload:JSON.parse(encoded)};
      // Write before network. Storage failure prevents submission and token loss.
      storage.setItem(KEY,JSON.stringify(p));
      return p;
    }
    function transmit(client,device) {
      if (protocol_version !== PROTOCOL_VERSION) return Promise.resolve({status:'stale_client'});
      if (flight) return flight;
      flight=(async()=>{
        const p=read(); if (!p) return {status:'nothing_pending'};
        let rpc,args;
        if(p.kind==='cancel'){rpc='cancel_community_operation';args={operation_id:p.id};}
        else if(p.kind==='create'){rpc='submit_community_observation';args={submission_token:p.id,report:p.payload,reporter_device_id:device};}
        else {rpc='mutate_community_observation';args={operation_id:p.id,observation_id:p.payload.observation_id,action:p.kind,changes:p.payload.changes||{},reporter_device_id:device};}
        try {
          const response=await client.rpc(rpc,args);
          if(response?.error) return {status:['PGRST202','42883'].includes(response.error.code)?'stale_client':'retryable_failure'};
          const result=response?.data;
          // Maintenance is fail-closed but retryable. Preserve the operation and
          // its UUID so reopening cannot manufacture a second submission.
          if(result?.status==='maintenance') return {status:'maintenance'};
          if(!TERMINAL.has(result?.status)) return {status:'retryable_failure'};
          // Never return raw transport errors/arguments, token, or device to diagnostics.
          storage.removeItem(KEY);
          const report = result.report && Object.fromEntries(REPORT_FIELDS.filter(key =>
            Object.hasOwn(result.report,key) && !(typeof result.report[key]==='string' && device && result.report[key].includes(device)))
            .map(key=>[key,result.report[key]]));
          return {status:result.status,report:report||null};
        } catch { return {status:'retryable_failure'}; }
      })().finally(()=>{flight=null;});
      return flight;
    }
    function submit(kind,payload,client,device) {
      if (protocol_version !== PROTOCOL_VERSION) return Promise.resolve({status:'stale_client'});
      if(flight) return flight; // synchronous double tap shares one in-flight operation
      begin(kind,payload); return transmit(client,device);
    }
    function cancel(client,device) {
      if (flight) return Promise.resolve({status:'retryable_failure'});
      const p=read();
      if (!p) return Promise.resolve({status:'nothing_pending'});
      storage.setItem(KEY,JSON.stringify({id:p.id,startedAt:p.startedAt,kind:'cancel'}));
      return transmit(client,device);
    }
    return Object.freeze({submit,retry:transmit,cancel,pending});
  }
  const api=Object.freeze({create,uuid,KEY,MAX_AGE,protocol_version:PROTOCOL_VERSION,outcome});
  root.gridlyReportProtocol=api;
  if(typeof module!=='undefined' && module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
