param([Parameter(Mandatory=$true)][string]$CaptureScriptPath)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Tokens = $null
$ParseErrors = $null
$Ast = [System.Management.Automation.Language.Parser]::ParseFile($CaptureScriptPath, [ref]$Tokens, [ref]$ParseErrors)
if ($ParseErrors.Count -ne 0) { throw 'Capture script is not valid Windows PowerShell syntax.' }
$FunctionAst = $Ast.Find({ param($Node) $Node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $Node.Name -eq 'Get-NormalizedInventoryNames' }, $true)
if ($null -eq $FunctionAst) { throw 'Normalization helper was not found.' }
& ([scriptblock]::Create($FunctionAst.Extent.Text))

function Assert-Equal([string]$Expected, [string]$Actual, [string]$Label) {
  if ($Expected -cne $Actual) { throw "$Label assertion failed." }
}
function Assert-Rejected([AllowNull()][AllowEmptyString()][string]$JsonText, [string[]]$AllowedProperties, [string[]]$WrapperProperties, [string]$ForbiddenValue, [switch]$AllowEmpty) {
  try {
    Get-NormalizedInventoryNames -SourceCommand 'test source command' -JsonText $JsonText -AllowedProperties $AllowedProperties -WrapperProperties $WrapperProperties -AllowEmpty:$AllowEmpty | Out-Null
    throw 'Malformed inventory was accepted.'
  } catch {
    if ($_.Exception.Message -eq 'Malformed inventory was accepted.') { throw }
    if (-not $_.Exception.Message.Contains('test source command') -or -not $_.Exception.Message.Contains('observed properties only')) { throw 'Safe schema diagnostic was not emitted.' }
    if ($ForbiddenValue -and $_.Exception.Message.Contains($ForbiddenValue)) { throw 'A captured value escaped into a diagnostic.' }
  }
}

Assert-Equal '' ((Get-NormalizedInventoryNames -SourceCommand 'allowed empty' -JsonText '[]' -AllowedProperties @('name') -AllowEmpty) -join ',') 'allowed empty array'
Assert-Rejected '[]' @('name') @() ''
Assert-Rejected '' @('name') @() '' -AllowEmpty
Assert-Rejected $null @('name') @() '' -AllowEmpty
Assert-Rejected 'null' @('name') @() '' -AllowEmpty
Assert-Rejected '[{}]' @('name') @() '' -AllowEmpty
Assert-Equal 'ALPHA,ZETA' ((Get-NormalizedInventoryNames -SourceCommand 'gh secret list' -JsonText '[{"name":"ZETA"},{"name":"ALPHA"},{"name":"ALPHA"}]' -AllowedProperties @('name')) -join ',') 'GitHub name array'
Assert-Equal 'FIRST,SECOND' ((Get-NormalizedInventoryNames -SourceCommand 'supabase secrets list' -JsonText '{"secrets":[{"name":"SECOND"},{"name":"FIRST"}]}' -AllowedProperties @('name') -WrapperProperties @('secrets')) -join ',') 'explicit Supabase wrapper'
Assert-Rejected '{"secrets":[{"name":"VALUE"}]}' @('name') @() 'VALUE'
Assert-Rejected '{"status":"SECRET_VALUE"}' @('name') @() 'SECRET_VALUE'
Assert-Rejected '"SECRET_SCALAR"' @('name') @() 'SECRET_SCALAR'
Assert-Rejected '[{"name":"VALID"},{"status":"SECRET_INVALID"}]' @('name') @() 'SECRET_INVALID'
Assert-Rejected '{"name":"ONE","slug":"TWO"}' @('name','slug') @() 'ONE'

Write-Output 'inventory normalization regression tests passed'
