const platforms=new Set(['apple','google']);
const stages=new Set(['request_validation','native_authorization','provider_verification','provider_credentials',
  'provider_http','cache_reconciliation','acknowledgment','proof_signing','unexpected']);
const statuses=new Set([400,401,409,422,502,504]);

// Only fixed vocabulary reaches logs. Never serialize an exception, request or evidence.
export function recordVerifierStageDiagnostic({platform,stage,http_status},sink=console.info){
  if(!platforms.has(platform)||!stages.has(stage)||!statuses.has(http_status))return;
  try{sink(JSON.stringify({event:'gridly_verifier_stage',platform,stage,http_status}));}catch{}
}

