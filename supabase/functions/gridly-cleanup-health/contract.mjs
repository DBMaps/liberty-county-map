export const FIELDS = ['subsystem','job_state','latest_run_state','latest_run_at','last_success_at','retention_state','compliance_health_state','report_overdue_count','report_breached_count','compliance_late_processed_count','compliance_late_processed_at'];
export function projectHealth(rows) {
  if (!Array.isArray(rows) || rows.length!==2 || new Set(rows.map(r=>r?.subsystem)).size!==2) throw Error('invalid_health_projection');
  return rows.map(r=>{
    if (!r || Object.keys(r).length!==FIELDS.length || FIELDS.some(k=>!Object.hasOwn(r,k))) throw Error('invalid_health_projection');
    for (const [key,allowed] of Object.entries({subsystem:['report_retention','compliance_cleanup'],job_state:['active','missing','inactive','misconfigured'],latest_run_state:['succeeded','running','failed','none'],retention_state:['succeeded','failed','none'],compliance_health_state:['succeeded','pending','missing','none']})) if(!allowed.includes(r[key])) throw Error('invalid_health_projection');
    for(const k of ['report_overdue_count','report_breached_count','compliance_late_processed_count']) if(!Number.isSafeInteger(r[k])||r[k]<0||r[k]>1000000) throw Error('invalid_health_projection');
    for(const k of ['latest_run_at','last_success_at','compliance_late_processed_at']) if(r[k]!==null && (typeof r[k]!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|\+00:00)$/.test(r[k])||!Number.isFinite(Date.parse(r[k])))) throw Error('invalid_health_projection');
    if(r.subsystem==='report_retention' && (r.compliance_health_state!=='none'||r.compliance_late_processed_count!==0||r.compliance_late_processed_at!==null)) throw Error('invalid_health_projection');
    if(r.subsystem==='compliance_cleanup' && (r.retention_state!=='none'||r.report_overdue_count!==0||r.report_breached_count!==0||((r.compliance_late_processed_count>0)!==(r.compliance_late_processed_at!==null)))) throw Error('invalid_health_projection');
    return Object.fromEntries(FIELDS.map(k=>[k,r[k]]));
  });
}
