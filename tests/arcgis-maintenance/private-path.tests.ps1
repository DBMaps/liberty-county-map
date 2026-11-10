$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$root=[IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) ('gridly-arcgis-acl-'+[guid]::NewGuid().ToString('N'))))
$guard=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\tools\arcgis-maintenance\Assert-GridlyPrivatePath.ps1'))
$count=0
function Protect-TestPath([string]$Target,[bool]$Directory) {
    $owner=[Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl=if($Directory){New-Object Security.AccessControl.DirectorySecurity}else{New-Object Security.AccessControl.FileSecurity}
    $acl.SetOwner($owner);$acl.SetAccessRuleProtection($true,$false)
    foreach($sid in @($owner.Value,'S-1-5-18','S-1-5-32-544')) {
        $identity=New-Object Security.Principal.SecurityIdentifier($sid)
        $inherit=if($Directory){[Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'}else{[Security.AccessControl.InheritanceFlags]::None}
        $rule=New-Object Security.AccessControl.FileSystemAccessRule($identity,[Security.AccessControl.FileSystemRights]::FullControl,$inherit,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow)
        [void]$acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Target -AclObject $acl
}
function Check-TestPath([string]$Target,[string]$Kind,[bool]$Expected) {
    $result= & powershell.exe -NoProfile -NonInteractive -File $guard -Path $Target -Kind $Kind 2>$null
    $ok=($LASTEXITCODE -eq 0 -and $result -ceq 'PRIVATE_PATH_VALID')
    if($ok -ne $Expected){throw 'SYNTHETIC_ACL_TEST_FAILED'}
    $script:count++
}
try {
    [void][IO.Directory]::CreateDirectory($root);Protect-TestPath $root $true
    $file=Join-Path $root 'synthetic.json';[IO.File]::WriteAllText($file,'SYNTHETIC_ONLY');Protect-TestPath $file $false
    Check-TestPath $root 'Directory' $true;Check-TestPath $file 'File' $true
    $acl=New-Object Security.AccessControl.FileSecurity
    $owner=[Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl.SetOwner($owner);$acl.SetAccessRuleProtection($true,$false)
    [void]$acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($owner,[Security.AccessControl.FileSystemRights]::FullControl,[Security.AccessControl.AccessControlType]::Allow)))
    $everyone=New-Object Security.Principal.SecurityIdentifier('S-1-1-0')
    $rule=New-Object Security.AccessControl.FileSystemAccessRule($everyone,[Security.AccessControl.FileSystemRights]::Read,[Security.AccessControl.AccessControlType]::Allow)
    [void]$acl.AddAccessRule($rule)
    Import-Module ([IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\tools\arcgis-maintenance\PrivatePathContract.psm1'))) -Force -DisableNameChecking
    # Test the unsafe descriptor in memory; never grant broader filesystem access.
    if(Test-GridlyPrivateAcl -Acl $acl -OwnerSid $owner.Value){throw 'SYNTHETIC_ACL_TEST_FAILED'}
    $count++
    $inherited=Join-Path $root 'inherited.json';[IO.File]::WriteAllText($inherited,'SYNTHETIC_ONLY');Check-TestPath $inherited 'File' $false
    $sync=Join-Path $root 'OneDrive';[void][IO.Directory]::CreateDirectory($sync);Protect-TestPath $sync $true;Check-TestPath $sync 'Directory' $false
    $repo=Join-Path $root 'repo';[void][IO.Directory]::CreateDirectory($repo);Protect-TestPath $repo $true;[IO.File]::WriteAllText((Join-Path $repo '.git'),'SYNTHETIC_ONLY');Check-TestPath $repo 'Directory' $false
    Check-TestPath (Join-Path $root 'missing.json') 'File' $false
    Write-Output ('SYNTHETIC_PRIVATE_PATH_PASS count='+$count)
}catch {Write-Output ('SYNTHETIC_PRIVATE_PATH_FAIL completed='+$count+' exception='+$_.Exception.GetType().Name);exit 1}
finally {
    $tmp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
    if([IO.Path]::GetDirectoryName($root).TrimEnd('\') -cne $tmp -or ![IO.Path]::GetFileName($root).StartsWith('gridly-arcgis-acl-')){throw 'FIXTURE_CLEANUP_REJECTED'}
    if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse -Force}
}
