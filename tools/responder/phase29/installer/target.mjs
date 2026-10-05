import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const PROJECT_REF='cmrrvwgkgjhmdugzhnrh';
export function validateTarget({host,port,database,user,ssl,projectRef,settingsApproved}) {
 if(Object.keys(ssl??{}).some(k=>!['rejectUnauthorized','ca','minVersion','servername'].includes(k))||host!=='db.'+PROJECT_REF+'.supabase.co'||port!==5432||database!=='postgres'||user!=='postgres'||projectRef!==PROJECT_REF||settingsApproved!==true||ssl?.rejectUnauthorized!==true||typeof ssl.ca!=='string'||!ssl.ca||ssl.minVersion!=='TLSv1.2'||ssl.servername!==host)throw Error('TARGET_REFUSED');
 return {host,port,database,user,ssl};
}
// No command-line entry and no credentials in SQL. Call only under separate remote authority.
// The actual socket uses the validated host and verifies its certificate; SQL does not prove project ref.
export async function installDedicated({password,...packet}) {
 const sql=readFileSync(new URL('./install.sql',import.meta.url),'utf8').replaceAll('\r\n','\n');const manifest=JSON.parse(readFileSync(new URL('./inventory.json',import.meta.url),'utf8'));if(createHash('sha256').update(sql).digest('hex')!==manifest.installSha256)throw Error('PACKAGE_HASH_REFUSED');
 const config=validateTarget(packet);if(typeof password!=='string'||!password)throw Error('TARGET_REFUSED');
 const require=createRequire(new URL('../worker/package.json',import.meta.url));const {Client}=require('pg');
 const client=new Client({...config,password,connectionTimeoutMillis:10000});
 try {await client.connect();await client.query("SELECT set_config('dispatch_install.bound_project_ref',$1,false)",[PROJECT_REF]);await client.query(sql);}
 finally {await client.end();}
}
