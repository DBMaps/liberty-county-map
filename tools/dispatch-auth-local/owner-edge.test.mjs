import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
test('actual Edge cleanup stops only the owned temporary profile and preserves another browser',()=>{
 const runtime=join(tmpdir(),'gridly-dispatch-auth-'+randomBytes(6).toString('hex'));mkdirSync(runtime);
 const launcher=fileURLToPath(new URL('./owner.ps1',import.meta.url));
 const ps=join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
 const script="$x=[Console]::In.ReadToEnd() | ConvertFrom-Json;$runtime=$x.runtime;$edge=Join-Path ${env:ProgramFiles(x86)} 'Microsoft\\Edge\\Application\\msedge.exe';$profile=Join-Path $runtime 'edge-profile';$otherProfile=Join-Path $runtime 'control-profile';$cleanupErrors=New-Object 'System.Collections.Generic.List[string]';$edgeProcess=$null;$control=$null;try{$edgeProcess=Start-Process $edge -ArgumentList ('--headless --disable-gpu --no-first-run --disable-background-networking --user-data-dir=\"'+$profile+'\" about:blank') -WindowStyle Hidden -PassThru;$null=$edgeProcess.Handle;$control=Start-Process $edge -ArgumentList ('--headless --disable-gpu --no-first-run --disable-background-networking --user-data-dir=\"'+$otherProfile+'\" about:blank') -WindowStyle Hidden -PassThru;$null=$control.Handle;Start-Sleep -Seconds 4;$source=[IO.File]::ReadAllText($x.launcher);$a=$source.IndexOf(' if($edgeProcess){try{');$b=$source.IndexOf(' if(Test-Path -LiteralPath (Join-Path $runtime ''credentials.dpapi''))',$a);if($a -lt 0 -or $b -lt 0){throw 'Cleanup block unavailable'};& ([scriptblock]::Create($source.Substring($a,$b-$a)));if($cleanupErrors.Count){throw 'Owned Edge cleanup failed'};if(-not $edgeProcess.WaitForExit(5000)){throw 'Owned Edge remained'};$control.Refresh();if($control.HasExited){throw 'Unrelated profile was stopped'}}finally{foreach($p in @($edgeProcess,$control)){if($p){$all=@(Get-CimInstance Win32_Process);$ids=@($p.Id);for($i=0;$i -lt 8;$i++){$ids+=@($all | Where-Object {$ids -contains $_.ParentProcessId -and $ids -notcontains $_.ProcessId} | Select-Object -ExpandProperty ProcessId)};foreach($idToStop in ($ids | Select-Object -Unique)){Stop-Process -Id $idToStop -Force -ErrorAction SilentlyContinue};$p.WaitForExit(5000) | Out-Null}};Start-Sleep -Seconds 2}";
 try{const result=spawnSync(ps,['-NoProfile','-NonInteractive','-Command',script],{input:JSON.stringify({runtime,launcher}),encoding:'utf8',windowsHide:true,env:{...process.env,PSModulePath:join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','Modules')}});assert.equal(result.status,0,'Real owned Edge cleanup failed: '+result.stderr)}finally{rmSync(runtime,{recursive:true,force:true})}
});
