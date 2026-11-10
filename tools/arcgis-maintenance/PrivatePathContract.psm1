function Test-GridlyPrivateAcl {
    param([Parameter(Mandatory=$true)]$Acl,[Parameter(Mandatory=$true)][string]$OwnerSid)
    try {
        if ($Acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $OwnerSid -or !$Acl.AreAccessRulesProtected) { return $false }
        $ownerFull=$false
        foreach ($rule in $Acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])) {
            if ($rule.IsInherited -or $rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or $rule.IdentityReference.Value -cnotin @($OwnerSid,'S-1-5-18','S-1-5-32-544')) { return $false }
            if ($rule.IdentityReference.Value -ceq $OwnerSid -and ($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -eq [Security.AccessControl.FileSystemRights]::FullControl) { $ownerFull=$true }
        }
        return $ownerFull
    }catch {return $false}
}
Export-ModuleMember -Function Test-GridlyPrivateAcl
