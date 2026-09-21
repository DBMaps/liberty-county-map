// LOCAL DISPOSABLE REHEARSAL ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
import {readFileSync} from 'node:fs';
export const pilot=JSON.parse(readFileSync(new URL('./dayton-pilot.json',import.meta.url)));
// Engineering schedule calculator only. No automated deletion or legal approval.
export function disposition({category,terminalAt,active,legalHold,now}) {
 const years=pilot.retention.years[category];
 if(!years)throw new Error('Unknown retention category');
 if(active||legalHold||!terminalAt)return {eligible:false,reason:legalHold?'LEGAL_HOLD':'ACTIVE_OR_NO_TERMINAL_ANCHOR'};
 const anchor=new Date(terminalAt),clock=new Date(now);
 if(!Number.isFinite(+anchor)||!Number.isFinite(+clock))throw new Error('Invalid date');
 // Calendar anniversaries; clamp February 29 to February 28 in a non-leap year.
 const year=anchor.getUTCFullYear()+years,month=anchor.getUTCMonth();
 const day=Math.min(anchor.getUTCDate(),new Date(Date.UTC(year,month+1,0)).getUTCDate());
 const expiresAt=new Date(Date.UTC(year,month,day,anchor.getUTCHours(),anchor.getUTCMinutes(),anchor.getUTCSeconds(),anchor.getUTCMilliseconds()));
 return {eligible:+clock>=+expiresAt,expiresAt:expiresAt.toISOString(),legalApprovalRequired:true};
}
export function consumerVisible({receivedAt,expiresAt,lastValidatedAt,online,now}) {
 const values=[receivedAt,expiresAt,lastValidatedAt,now].map(x=>new Date(x).getTime());
 if(values.some(x=>!Number.isFinite(x)))return false;
 const [received,expiry,validated,clock]=values;
 if(clock<received||clock<validated)return false;
 // Display adapter contract: never extend an existing lease on reconnect or cached read.
 return clock<Math.min(expiry,received+300000,validated+300000);
}
