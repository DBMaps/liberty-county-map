# Run in the owner's local PowerShell outside Codex. Never paste the token in chat.
param([switch]$ContractOnly)
$ErrorActionPreference = 'Stop'
function Assert-GridlyHealthResponse {
  param([int]$Status,[string]$ContentType,[string]$CacheControl,[string]$Json)
  if ($Status -ne 200) { throw 'http_status' }
  if ($ContentType -notmatch '^application/json(?:\s*;.*)?$') { throw 'content_type' }
  if ($CacheControl -ne 'no-store') { throw 'cache_control' }
  if ($Json.Length -gt 8192 -or $Json.TrimStart()[0] -ne '[') { throw 'json_top_level' }
  try { $parsed = ConvertFrom-Json -InputObject $Json -ErrorAction Stop } catch { throw 'json_parse' }
  # PS5.1 writes a JSON array as ONE pipeline object. Assign, then enumerate explicitly.
  if ($parsed -isnot [System.Array]) { throw 'json_top_level' }
  $rows = @($parsed | ForEach-Object { $_ })
  if ($rows.Count -ne 2) { throw 'row_count' }
  if ((@($rows.subsystem | Sort-Object) -join ',') -cne 'compliance_cleanup,report_retention') { throw 'subsystems' }
  $fields = @('subsystem','job_state','latest_run_state','latest_run_at','last_success_at','retention_state','compliance_health_state','report_overdue_count','report_breached_count','compliance_late_processed_count','compliance_late_processed_at')
  foreach ($row in $rows) {
    if ($null -eq $row -or $row -isnot [pscustomobject]) { throw 'row_type' }
    if ((@($row.PSObject.Properties.Name | Sort-Object) -join ',') -cne (@($fields | Sort-Object) -join ',')) { throw 'fields' }
    if ($row.job_state -cnotin @('active','missing','inactive','misconfigured') -or $row.latest_run_state -cnotin @('succeeded','running','failed','none') -or $row.retention_state -cnotin @('succeeded','failed','none') -or $row.compliance_health_state -cnotin @('succeeded','pending','missing','none')) { throw 'enum' }
    foreach ($key in @('report_overdue_count','report_breached_count','compliance_late_processed_count')) {
      $value=$row.$key
      if ($value -isnot [int] -and $value -isnot [long]) { throw 'count_type' }
      if ($value -lt 0 -or $value -gt 1000000) { throw 'count_range' }
    }
    foreach ($key in @('latest_run_at','last_success_at','compliance_late_processed_at')) {
      $value=$row.$key
      if ($null -ne $value) {
        if ($value -isnot [string] -or $value -cnotmatch '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|\+00:00)$') { throw 'timestamp_format' }
        try { $date=[DateTimeOffset]::Parse($value,[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::None) } catch { throw 'timestamp_parse' }
        if ($date.Offset -ne [TimeSpan]::Zero) { throw 'timestamp_utc' }
      }
    }
    if ($row.subsystem -ceq 'report_retention' -and ($row.compliance_health_state -cne 'none' -or $row.compliance_late_processed_count -ne 0 -or $null -ne $row.compliance_late_processed_at)) { throw 'subsystem_contract' }
    if ($row.subsystem -ceq 'compliance_cleanup' -and ($row.retention_state -cne 'none' -or $row.report_overdue_count -ne 0 -or $row.report_breached_count -ne 0 -or (($row.compliance_late_processed_count -gt 0) -ne ($null -ne $row.compliance_late_processed_at)))) { throw 'subsystem_contract' }
  }
}
if ($ContractOnly) { return }
$monitorSecret = Read-Host 'Dedicated GRIDLY_MONITOR_TOKEN (hidden)' -AsSecureString
$monitorPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($monitorSecret)
try {
  $monitorToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($monitorPointer)
  if ($monitorToken -cnotmatch '^[a-f0-9]{64}$') { throw 'Token format invalid' }
  $monitorFields = @('subsystem','job_state','latest_run_state','latest_run_at','last_success_at','retention_state','compliance_health_state','report_overdue_count','report_breached_count','compliance_late_processed_count','compliance_late_processed_at')
  try {
    $null=Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'https://nhwhkbkludzkuyxmkkcj.supabase.co/functions/v1/gridly-cleanup-health' -Headers @{'X-Gridly-Monitor-Token'=$monitorToken} -Body '{}' -ContentType 'application/json'
    Write-Output 'Authorized non-empty body FAILED: unexpectedly accepted.'
  } catch {
    if ([int]$_.Exception.Response.StatusCode -eq 400) { Write-Output 'Authorized non-empty body PASS: HTTP400.' }
    else { Write-Output 'Authorized non-empty body FAILED (details suppressed).' }
  }
  for ($monitorAttempt = 1; $monitorAttempt -le 2; $monitorAttempt++) {
    try {
      $monitorResponse = Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'https://nhwhkbkludzkuyxmkkcj.supabase.co/functions/v1/gridly-cleanup-health' -Headers @{'X-Gridly-Monitor-Token'=$monitorToken}
      Assert-GridlyHealthResponse -Status $monitorResponse.StatusCode -ContentType $monitorResponse.Headers['Content-Type'] -CacheControl $monitorResponse.Headers['Cache-Control'] -Json $monitorResponse.Content
      Write-Output "Authorized attempt $monitorAttempt PASS: HTTP200; application/json; no-store; JSON array; exactly two rows; exact 11 fields; valid enums/integer counts/nulls/UTC timestamp strings. $([DateTime]::UtcNow.ToString('o'))"
    } catch {
      $category = $_.Exception.Message
      if ($category -notin @('http_status','content_type','cache_control','json_top_level','json_parse','row_count','subsystems','row_type','fields','enum','count_type','count_range','timestamp_format','timestamp_parse','timestamp_utc','subsystem_contract')) { $category='request_failed' }
      Write-Output "Authorized attempt $monitorAttempt FAILED: $category (no body/header printed)."
      break
    }
  }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($monitorPointer)
  $monitorToken=$null; $monitorSecret.Dispose(); $monitorResponse=$null; $monitorRows=$null
}
