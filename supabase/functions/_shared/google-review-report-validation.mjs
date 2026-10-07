// Pure protocol-v2 validation. No database, writer, report cache or payload log.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const keys={submit_community_observation:['submission_token','report','reporter_device_id'],
  mutate_community_observation:['operation_id','observation_id','action','changes','reporter_device_id'],
  cancel_community_operation:['operation_id'],submit_community_moderation_report:['operation_id','target_report_id','reason','reporter_device_id'],
  request_community_report_deletion:['operation_id','target_report_id','reporter_device_id']};
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const device=value=>typeof value==='string'&&value.length>0&&value.length<=128;
const scalar=value=>value===null||typeof value==='string'||typeof value==='number';
const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
export function validateGoogleReviewReport(operation,args,{now=Date.now()}={}) {
  try {
    const allowed=Object.hasOwn(keys,operation)?keys[operation]:null;
    if(!allowed||!object(args)||Object.keys(args).some(key=>!allowed.includes(key)))return false;
    const token=operation==='submit_community_observation'?args.submission_token:args.operation_id;
    if(typeof token!=='string'||!UUID.test(token)||bytes(args)>16000)return false;
    const content=operation==='submit_community_observation'?args.report:operation==='mutate_community_observation'?args.changes:{};
    if(!object(content)||JSON.stringify(content).toLowerCase().includes(token.toLowerCase())||
      (typeof args.reporter_device_id==='string'&&args.reporter_device_id.toLowerCase().includes(token.toLowerCase())))return false;
    if(operation==='cancel_community_operation')return Object.keys(args).length===1;
    if(!device(args.reporter_device_id))return false;
    if(operation==='submit_community_observation') {
      const fields=['crossing_id','crossing_name','railroad','lat','lng','report_type','severity','detail','source','confidence','expires_at'];
      if(Object.keys(content).some(key=>!fields.includes(key)||!scalar(content[key]))||bytes(content)>12000||
        ['crossing_id','crossing_name','report_type','severity'].some(key=>typeof content[key]!=='string'||!content[key].trim())||
        ['cleared','hazard_cleared'].includes(content.report_type)||
        !Number.isFinite(content.lat)||Math.abs(content.lat)>90||!Number.isFinite(content.lng)||Math.abs(content.lng)>180||
        /lifecycle_report_id:/i.test(content.detail||'')||JSON.stringify(content).includes(args.reporter_device_id))return false;
      // The normal writer accepts the UI's 180-minute hazard hint and clamps
      // publication to its own 90-minute retention bound. Review stores nothing.
      if(content.expires_at!==undefined&&(!Number.isFinite(Date.parse(content.expires_at))||Date.parse(content.expires_at)<=now))return false;
      return true;
    }
    if(operation==='mutate_community_observation')return typeof args.observation_id==='string'&&UUID.test(args.observation_id)&&
      ['confirm','edit','clear'].includes(args.action)&&bytes(content)<=8000&&
      Object.keys(content).every(key=>args.action==='edit'&&['detail','severity'].includes(key)&&typeof content[key]==='string')&&
      !/lifecycle_report_id:/i.test(content.detail||'');
    if(typeof args.target_report_id!=='string'||!UUID.test(args.target_report_id))return false;
    return operation==='request_community_report_deletion'||typeof args.reason==='string'&&args.reason.length>0&&args.reason.length<=200;
  }catch{return false;}
}
