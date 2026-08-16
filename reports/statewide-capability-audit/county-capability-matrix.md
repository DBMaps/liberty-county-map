# 254-county capability matrix summary

The authoritative row-level matrix is `county-capability-matrix.json`; it contains all 254 counties and every taxonomy capability with status, source evidence, runtime path, blocker, repair class and priority.

| Capability | Available | Partial/not activated | Missing/blocked | Primary blocker |
|---|---:|---:|---:|---|
| County identity/operational registry | 254 | 0 | 0 | — |
| Authoritative polygon geometry | 254 | 0 | 0 | — |
| Runtime county bounds / containment | 28 | 0 | 226 | Hard-coded legacy bounds registry |
| Governed road runtime | 28 | 0 | 226 | No runtime artifact/manifest entry |
| FRA source evidence | 200 positive | 54 authoritative zero | 0 source-missing | Packages not manufactured outside cohort |
| Certified crossing package | 28 | 226 | 0 source acquisition | Governance/manufacturing |
| Crossing runtime active | 28 | 0 | 226 | Runtime not claimed |
| Consumer-visible positive crossing county | 27 | 1 active-empty (Tyler) | 226 | Tyler has zero records; others inactive |
| Hazard placement | 28 | 0 | 226 | Bounds prefilter |
| Report persistence | 0 live-certified | 28 client-reachable | 226 placement-blocked | Remote RLS unverified; bounds |
| Fully supported | 0 | 254 | 0 identity-missing | Remote/ZIP/capability completeness not certified |
