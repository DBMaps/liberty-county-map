param([Parameter(Mandatory=$true)][string]$LiteralPath)
$ErrorActionPreference = 'Stop'
try {
  $item = [IO.DirectoryInfo]::new([IO.Path]::GetFullPath($LiteralPath))
  if (-not $item.Exists -or $item.FullName.StartsWith('\\')) { throw 'Local directory required' }
  $ancestor = $item
  while ($null -ne $ancestor) {
    if (($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Reparse path denied' }
    $ancestor = $ancestor.Parent
  }
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $acl = [IO.Directory]::GetAccessControl($item.FullName)
  $owner = $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
  if ($owner -ne $sid) { throw 'Owner mismatch' }
  $ownerFullControl = $false
  foreach ($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])) {
    if ($rule.AccessControlType -eq 'Allow') {
      if ($rule.IdentityReference.Value -notin @($sid,'S-1-5-18')) { throw 'Broad access denied' }
      if ($rule.IdentityReference.Value -eq $sid -and ($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -eq [Security.AccessControl.FileSystemRights]::FullControl) { $ownerFullControl=$true }
    }
  }
  if (-not $ownerFullControl) { throw 'Owner access required' }
  # No path, username, SID, ACL entries or environment values leave this check.
  '{"ownerOnly":true,"local":true,"noReparse":true,"ownerFullControl":true}'
} catch {
  '{"ownerOnly":false,"local":false,"noReparse":false,"ownerFullControl":false}'
  exit 1
}
