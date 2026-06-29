# V795 — County Promotion Writer Replace Fix Certification

## Scope

V795 fixes the county promotion writer path after actual promotion reached write mode. The change keeps the V793/V794 deterministic safety gates intact while correcting PowerShell replacement handling in the `js/app.js` boundary overlay update and normalizing comma-separated county input.

## Implemented Controls

- Changed `-County` binding to accept one or more string tokens and split every token on commas, so both `-County Jefferson,Polk,Harris` and `-County "Jefferson,Polk,Harris"` normalize to three counties.
- Added a single-use regex replacement helper that passes exactly one regex pattern and one replacement string into `[regex]::Replace`.
- Updated the boundary overlay county-id replacement to build the replacement string before calling the helper, avoiding the PowerShell `-ireplace`/`-replace` operand parsing bug.
- Kept readiness gating unchanged: counties must still return `READY FOR CONTROLLED PROMOTION`.
- Kept deterministic metadata gating unchanged: incomplete V794 metadata still blocks write mode.
- Preserved all-or-nothing write behavior by staging registry/app content in memory and restoring both files if either write fails.
- Updated the command-center menu text that still described actual promotion as blocked by V792 safety rules.

## Protected-System Statement

V795 does not modify production package contents, community package contents, crossing package contents, Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, or Supabase Sync.

## Validation Status

PowerShell is not installed in this Linux container, so the requested PowerShell runtime validations could not be executed here. Static script inspection, JSON evidence validation, and protected package-content diff checks were executed. Required runtime handoff commands are captured in the machine-readable evidence.
