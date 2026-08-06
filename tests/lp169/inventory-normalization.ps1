param([Parameter(Mandatory=$true)][string]$CaptureScriptPath)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Tokens = $null
$ParseErrors = $null
$Ast = [System.Management.Automation.Language.Parser]::ParseFile($CaptureScriptPath, [ref]$Tokens, [ref]$ParseErrors)
$ParseErrors = @($ParseErrors)
if ($ParseErrors.Count -ne 0) { throw 'Capture script is not valid Windows PowerShell syntax.' }
$FunctionAst = $Ast.Find({ param($Node) $Node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $Node.Name -eq 'Get-NormalizedInventoryNames' }, $true)
if ($null -eq $FunctionAst) { throw 'Normalization helper was not found.' }
& ([scriptblock]::Create($FunctionAst.Extent.Text))

function Assert-StableResult([string]$JsonText, [int]$ExpectedCount, [string]$ExpectedNames, [switch]$AllowEmpty) {
  [object[]]$Actual = Get-NormalizedInventoryNames -SourceCommand 'stable result' -JsonText $JsonText -AllowedProperties @('name') -AllowEmpty:$AllowEmpty
  if ($Actual.GetType() -ne [object[]]) { throw 'Valid result was not an explicit Object[].' }
  if ($Actual.Count -ne $ExpectedCount) { throw 'Stable result count assertion failed.' }
  if (($Actual -join ',') -cne $ExpectedNames) { throw 'Stable result value assertion failed.' }
}

function Assert-Rejected([AllowNull()][AllowEmptyString()][string]$JsonText, [string[]]$AllowedProperties, [string[]]$WrapperProperties, [string]$ForbiddenValue, [switch]$AllowEmpty) {
  try {
    Get-NormalizedInventoryNames -SourceCommand 'test source command' -JsonText $JsonText -AllowedProperties $AllowedProperties -WrapperProperties $WrapperProperties -AllowEmpty:$AllowEmpty | Out-Null
    throw 'Malformed inventory was accepted.'
  } catch {
    if ($_.Exception.Message -eq 'Malformed inventory was accepted.') { throw }
    if ($_.Exception.GetType().Name -eq 'PropertyNotFoundException') { throw 'PropertyNotFoundStrict escaped the normalizer.' }
    if (-not $_.Exception.Message.Contains('test source command') -or -not $_.Exception.Message.Contains('observed properties only')) { throw 'Safe schema diagnostic was not emitted.' }
    if ($ForbiddenValue -and $_.Exception.Message.Contains($ForbiddenValue)) { throw 'A captured value escaped into a diagnostic.' }
  }
}

# Complete PS 5.1 strict-mode response/return-cardinality matrix.
Assert-Rejected '' @('name') @() '' -AllowEmpty                         # 1 blank
Assert-Rejected " `t`r`n" @('name') @() '' -AllowEmpty                 # 2 whitespace
Assert-Rejected 'null' @('name') @() '' -AllowEmpty                     # 3 JSON null
Assert-StableResult '[]' 0 '' -AllowEmpty                               # 4 empty array / 14 zero result
Assert-Rejected '[]' @('name') @() ''                                  # empty without opt-in
Assert-Rejected '[{}]' @('name') @() '' -AllowEmpty                     # 5 invalid object
Assert-StableResult '[{"name":"ONLY"}]' 1 'ONLY'                       # 6 / 13 one result
Assert-StableResult '[{"name":"ZETA"},{"name":"ALPHA"},{"name":"ALPHA"}]' 2 'ALPHA,ZETA' # 7 / 15 many, sorted/deduped
Assert-Rejected '"SECRET_SCALAR"' @('name') @() 'SECRET_SCALAR'          # 8 string scalar
Assert-Rejected '42' @('name') @() '42'                                 # 9 numeric scalar
Assert-Rejected '{"status":"SECRET_VALUE"}' @('name') @() 'SECRET_VALUE' # 10 wrapper
Assert-Rejected '[{"name":"VALID"},{"status":"SECRET_INVALID"}]' @('name') @() 'SECRET_INVALID' # 11 atomic mixed array
Assert-Rejected '[{"name":"ONE","slug":"TWO"}]' @('name','slug') @() 'ONE' # 12 conflicts
Assert-Rejected '{not-json}' @('name') @() 'not-json'                   # malformed

# Explicitly supported wrappers must themselves contain JSON arrays.
[object[]]$Wrapped = Get-NormalizedInventoryNames -SourceCommand 'wrapper result' -JsonText '{"secrets":[{"name":"SECOND"},{"name":"FIRST"}]}' -AllowedProperties @('name') -WrapperProperties @('secrets')
if ($Wrapped.GetType() -ne [object[]] -or $Wrapped.Count -ne 2 -or ($Wrapped -join ',') -cne 'FIRST,SECOND') { throw 'Supported wrapper array assertion failed.' }
Assert-Rejected '{"secrets":null}' @('name') @('secrets') '' -AllowEmpty
Assert-Rejected '{"secrets":{"name":"VALUE"}}' @('name') @('secrets') 'VALUE'

Write-Output 'inventory normalization regression tests passed'
