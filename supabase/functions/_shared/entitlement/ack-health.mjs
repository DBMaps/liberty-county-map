const bounded=value=>Number.isInteger(value)&&value>=0&&value<=1000000;
const categories=new Set(['none','provider_unavailable','credential_unavailable','configuration_unavailable','reconciliation_retry','invalid_purchase','subscription_expired','purchase_canceled','provider_denial','cipher_invalid','key_version_unavailable','retry_deadline']);
export function acknowledgmentHealth(row,{now=Date.now()}={}) {
 if(!Number.isFinite(now))throw Error('health_unavailable');
 const unavailable=()=>Object.freeze({environment:'production',subsystem:'google_ack',health_state:'monitor_error',checked_at:new Date(now).toISOString(),error_category:'health_unavailable'});
 if(!row||!['production','sandbox_test'].includes(row.environment)||row.subsystem!=='google_ack'||!categories.has(row.error_category))return unavailable();
 for(const name of ['pending_count','due_count','failed_count','stale_count','overdue_count','expired_count','terminal_count'])if(!bounded(row[name]))return unavailable();
 if(!Number.isInteger(row.oldest_pending_age_seconds)||row.oldest_pending_age_seconds<0||row.oldest_pending_age_seconds>3600)return unavailable();
 const complete=Date.parse(row.last_completed_at),purge=Date.parse(row.last_purge_at);
 let state='healthy',category='none';
 if(!Number.isFinite(complete)||complete>now||now-complete>90000){state='monitor_error';category='worker_stale';}
 else if(!Number.isFinite(purge)||purge>now||now-purge>120000){state='monitor_error';category='housekeeping_stale';}
 else if(row.overdue_count||row.expired_count){state='overdue';category='retry_deadline';}
 else if(row.terminal_count){state='failed';category='terminal_failure';}
 else if(row.failed_count||['credential_unavailable','configuration_unavailable','provider_unavailable','reconciliation_retry'].includes(row.error_category)){state='failed';category=row.error_category==='none'?'retry_pending':row.error_category;}
 else if(row.stale_count){state='stale';category='ack_pending';}
 return Object.freeze({environment:row.environment,subsystem:'google_ack',health_state:state,checked_at:new Date(now).toISOString(),last_completed_at:Number.isFinite(complete)?new Date(complete).toISOString():null,last_purge_at:Number.isFinite(purge)?new Date(purge).toISOString():null,pending_count:row.pending_count,due_count:row.due_count,failed_count:row.failed_count,stale_count:row.stale_count,overdue_count:row.overdue_count,terminal_count:row.terminal_count,expired_count:row.expired_count,oldest_pending_age_seconds:row.oldest_pending_age_seconds,error_category:category});
}
