[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Path,[ValidateSet('File','Directory')][string]$Kind='File')
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
try {
    if ($PSVersionTable.PSEdition -eq 'Core' -or $PSVersionTable.PSVersion.Major -lt 5) { throw 'FAIL' }
    if (![IO.Path]::IsPathRooted($Path) -or $Path.StartsWith('\\') -or $Path -match '[\x00-\x1f]' -or $Path -match '(?i)(^|[\\/])(OneDrive[^\\/]*|Dropbox|Google Drive|GoogleDrive|iCloudDrive|Box)([\\/]|$)') { throw 'FAIL' }
    $item=Get-Item -LiteralPath $Path -Force
    if (($Kind -eq 'Directory') -ne ($item -is [IO.DirectoryInfo])) { throw 'FAIL' }
    $cursor=$item
    while ($null -ne $cursor) {
        if (($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'FAIL' }
        $container=if ($cursor -is [IO.FileInfo]) { $cursor.Directory } else { $cursor }
        if (Test-Path -LiteralPath (Join-Path $container.FullName '.git')) { throw 'FAIL' }
        $cursor=if ($cursor -is [IO.FileInfo]) { $cursor.Directory } else { $cursor.Parent }
    }
    $owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    Import-Module (Join-Path $PSScriptRoot 'PrivatePathContract.psm1') -Force -DisableNameChecking
    $targets=@($item)
    if ($Kind -eq 'File') { $targets+=@($item.Directory) }
    foreach ($target in $targets) {
        $acl=Get-Acl -LiteralPath $target.FullName
        if (!(Test-GridlyPrivateAcl -Acl $acl -OwnerSid $owner)) { throw 'FAIL' }
    }
    Write-Output 'PRIVATE_PATH_VALID'
    exit 0
} catch {
    Write-Output 'PRIVATE_PATH_INVALID'
    exit 1
}
