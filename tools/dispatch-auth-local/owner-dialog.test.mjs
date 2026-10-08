import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID} from 'node:crypto';
test('private Windows credential form masks password, is read-only, and reveals only on explicit toggle',()=>{
 const runtime=join(tmpdir(),'gridly-dispatch-auth-'+randomBytes(6).toString('hex'));mkdirSync(runtime);
 const helper=fileURLToPath(new URL('./owner-credentials.ps1',import.meta.url)),path=join(runtime,'credentials.dpapi');
 const ps=join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),env={...process.env,PSModulePath:join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','Modules')};
 const account={email:'local-owner-'+randomUUID()+'@dispatch.invalid',password:randomBytes(32).toString('base64url')};
 try{
  const seal=spawnSync(ps,['-NoProfile','-NonInteractive','-File',helper,'-Mode','Seal','-Path',path],{input:JSON.stringify(account),encoding:'utf8',windowsHide:true,env});assert.equal(seal.status,0,'Private form fixture failed');
  // Execute the real helper and instantiate its real controls, replacing only the modal wait.
  const code="$x=[Console]::In.ReadToEnd() | ConvertFrom-Json;$source=[IO.File]::ReadAllText($x.helper);$probe='if(-not $password.UseSystemPasswordChar -or -not $password.ReadOnly -or -not $email.ReadOnly){throw ''Private form contract failed''};$show.Checked=$true;if($password.UseSystemPasswordChar){throw ''Explicit reveal failed''};$show.Checked=$false;if(-not $password.UseSystemPasswordChar){throw ''Mask restore failed''}';$source=$source.Replace('[void]$dialog.ShowDialog()',$probe);& ([scriptblock]::Create($source)) -Mode Show -Path $x.path";
  const result=spawnSync(ps,['-NoProfile','-NonInteractive','-STA','-Command',code],{input:JSON.stringify({helper,path}),encoding:'utf8',windowsHide:true,env});
  if((result.stdout+result.stderr).includes(account.password))throw Error('Private form leaked credentials');assert.equal(result.status,0,'Real credential-form controls failed');
 }finally{rmSync(runtime,{recursive:true,force:true})}
});
