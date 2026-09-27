export function acknowledgmentHealth(row,{now=Date.now()}={}) {
 const unavailable=()=>Object.freeze({environment:'production',subsystem:'google_ack',health_state:'monitor_error',checked_at:new Date(now).toISOString(),error_category:'health_unavailable'});
 if(!Number.isFinite(now))throw Error('health_unavailable');
 if(!row||!['production','sandbox_test'].includes(row.environment)||row.subsystem!=='google_ack')return unavailable();
 for(const name of ['pending_count','failed_count','stale_count','overdue_count','expired_count'])if(!Number.isInteger(row[name])||row[name]<0||row[name]>1000000)return unavailable();
 const tick=row.last_tick_at===null?NaN:Date.parse(row.last_tick_at);
 let state='healthy',category='none';
 if(!Number.isFinite(tick)||tick>now||now-tick>90000){state='monitor_error';category='worker_stale';}
 else if(row.overdue_count||row.expired_count){state='overdue';category='ack_expired';}
 else if(row.failed_count){state='failed';category='retry_pending';}
 else if(row.stale_count){state='stale';category='ack_pending';}
 return Object.freeze({environment:row.environment,subsystem:'google_ack',health_state:state,checked_at:new Date(now).toISOString(),last_tick_at:Number.isFinite(tick)?new Date(tick).toISOString():null,pending_count:row.pending_count,failed_count:row.failed_count,stale_count:row.stale_count,overdue_count:row.overdue_count,expired_count:row.expired_count,error_category:category});
}
