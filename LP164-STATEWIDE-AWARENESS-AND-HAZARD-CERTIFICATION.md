# LP164 — Statewide Awareness and Hazard Certification

## Purpose and decision boundary

LP164 certifies the governed, consumer-visible awareness evidence contract under the mission **Know Before You Go**. It audits what happened, where, freshness, supporting report count, uncertainty, lifecycle state, geographic relevance, and agreement among awareness surfaces. It does not certify that live hazards exist in every Texas county, redesign trust or lifecycle policy, ingest a new source, activate a county, deploy software, or manufacture data.

## Authoritative baseline

The audited baseline includes completed LP160 destination manufacturing, LP161 integration, LP161.1 reconciliation, LP162 consumer search, and LP163 destination routing evidence. LP163's provider-failure rule remains intact: missing provider geometry cannot produce an interpolated route, metrics, or Route Watch activation. The container checkout lacked `origin/main`, was on branch `work`, and contained pre-existing untracked dependency/build directories; LP164 did not switch, merge, push, deploy, or activate.

## Awareness architecture inventory

The authoritative production implementation is `js/app.js`. Governed runtime state is normalized, filtered by the selected awareness context, ranked, and rendered through Awareness Brief, Community Pulse, Know Before You Go, alert cards, hazard and crossing popups, destination awareness, route intelligence, and Route Watch. Current production-path audits include awareness intelligence and area context, Community Pulse intelligence, destination awareness, Know Before You Go, popup/crossing rendering, route intelligence/Route Watch, lifecycle, and cleared-hazard persistence. Numerous older audit helpers overlap these concerns; their presence alone is not certification. LP164 requires the named current-path contracts and executes its own evidence transformations and selection assertions.

Freshness is derived from governed evidence timestamps and expressed as `Checked just now` or `Updated … minutes ago`. Report counts come from active supporting evidence. Existing trust language distinguishes awaiting additional reports, community confirmation, changed conditions, conflicts where supported, and recently cleared evidence. Consumer output is checked for raw identifiers, enums, provider/source diagnostics, confidence numbers, timestamps, and geometry terminology.

## Hazard architecture and source inventory

The live pipeline combines normalized community reports from Supabase, roadway observations from TxDOT/DriveTexas, and runtime public/weather inputs. Active hazards and active reports feed lifecycle classification and consumer selection. The existing cleared-hazard rehydration guard prevents cleared observations from returning to active markers, alerts, counts, and summaries without new active evidence. Awareness-area filtering owns community/county inclusion; destination identity and active-route identity own those narrower relevance decisions. County coincidence, centroid proximity, or locality-name similarity is not treated as sufficient destination or route evidence.

Supabase, TxDOT/DriveTexas, weather, public routing, and live community reports are network-dependent. Default LP164 generation and verification make no network calls. Governed synthetic fixtures are explicitly labeled certification fixtures and are never represented as real incidents. Consequently, live owner validation remains required and the result does not claim live statewide incident coverage.

## Consumer-language and trust boundary

The certified model presents: situation, useful road/crossing location, freshness, active report count, and qualified confidence. Quiet output says that no active **local reports** are available and advises continued awareness; it does not promise safety. One report awaits support, multiple fresh reports may be community confirmed, stale evidence says conditions may have changed, supported conflicting evidence says reports conflict, and cleared evidence is recently cleared. LP164 does not add scores, reputation, badges, official-source supremacy, automatic GPS confirmation/clearing, or a new weighting engine.

## State methodologies

### Quiet state

Each representative county has a quiet fixture. Tests require zero invented hazards, local scope, current check wording, retained area context, no absolute safety claim, and no stale active remnant.

### Active state

Each county has an active road or crossing fixture. Tests require a consumer title, useful road/crossing location, deterministic freshness, exact count, evidence-compatible uncertainty, correct context inclusion, cross-county exclusion, and semantic consistency across Community Pulse and Know Before You Go. Fixtures cover fresh/stale, one/multiple reports, crossing/road hazards, conflict, destination relevance, and route relevance.

### Cleared state

Each county has a cleared fixture. Tests require zero active count, recently-cleared uncertainty, no active presentation, and no rehydration after simulated refresh or area change. Runtime lifecycle code is not modified.

## Geographic, destination, and route methodology

Selection is tested in county, community, destination, and route modes. A county mismatch always excludes; community identity, destination identity, and route identity must match in their respective modes. Tests explicitly reject Hull in a Liberty-only community context, unrelated destination/route identities, and cross-county promotion. Destination and route cases use governed fixture identities, not county-centroid inference. Community Pulse and Know Before You Go must reflect the same selected evidence. Alert cards and popups must remain semantically compatible, while wording may differ. Route Watch compatibility and the LP163 truthful provider-failure behavior remain protected.

## Representative county and case methodology

Sixteen counties cover Liberty, large and dense metros, medium and small rural counties, the Panhandle, West/Central/North/South Texas, border, Gulf Coast, East Texas, and high/low destination and crossing-density contexts: Brewster, Cameron, Dallas, El Paso, Fort Bend, Galveston, Harris, Jefferson, Liberty, Loving, Lubbock, Montgomery, Potter, Tarrant, Travis, and Webb. The final order uses ascending FIPS. Each selection reason is governed in the representative-county report.

The 48 cases comprise 16 quiet, 16 active, and 16 cleared fixtures. Ordering is county FIPS, awareness mode, incident type, normalized location, fixture identifier, then stable coordinate tie-breaker. Negative contract tests separately exercise malformed incidents, missing freshness, vague location, technical metadata, cross-area identity, unrelated route/destination identity, and byte drift. Missing evidence is classified honestly rather than counted as a pass.

## Determinism and protected artifacts

Reports use the fixed timestamp `1970-01-01T00:00:00.000Z`, recursively stable keys, stable arrays, UTF-8 canonical LF, relative paths, and no random or network-derived values. Certification is the intentional write command. Verification is read-only: it creates two isolated temporary outputs, compares every governed byte to both runs and repository bytes, reports both SHA-256 hashes and first differing byte, checks LF, detects repository rewrites, and exercises repeated in-process generation for state leakage.

Protected SHA-256 evidence covers the production application, runtime/address/destination/crossing manifests where present, and LP160.1M through LP163 summaries. The governed status additionally protects Shared Reports, Route Watch, awareness filtering, lifecycle, alert generation, Supabase sync, address matching/packages, destination manufacturing/routing, crossings, runtime membership, deployment, and activation.

## Results

| Measure | Result |
|---|---:|
| Representative counties | 16 |
| Awareness cases | 48 |
| Quiet / active / cleared | 16 / 16 / 16 PASS |
| Destination-awareness / route-awareness | 8 / 8 PASS |
| Community Pulse / Know Before You Go | 48 / 48 PASS each |
| Consumer language | 48 / 48 PASS |
| Geographic inclusion / cross-area exclusion | 48 / 48 PASS each |
| Freshness / report count / confidence | 48 / 48 PASS each |
| Technical metadata failures | 0 |
| Cross-area contamination failures | 0 |
| Cleared rehydration failures | 0 |
| Liberty preservation | PASS |
| Deterministic governed artifacts | 10 byte-identical PASS |

## Defects, patches, and blockers

No production awareness defect was proven by deterministic evidence, so no runtime patch was applied. The only additions are certification tooling, tests, reports, package commands, and this document. Live Supabase, TxDOT/DriveTexas, weather/public inputs, community-report behavior, and network route execution remain owner-required; this is an evidence boundary, not a deterministic failure.

## Final classification and authorization statements

**Final classification: `CONDITIONALLY_CERTIFIED_LIVE_AWARENESS_VALIDATION_REQUIRED`.**

- Runtime: **UNCHANGED**
- Deployment: **UNAUTHORIZED**
- Activation: **UNAUTHORIZED**
- Manufacturing: **UNCHANGED**
- Directional intelligence: **PAUSED / UNCHANGED**

## Owner validation commands (Windows PowerShell 5.1)

```powershell
Set-Location C:\GitHub\liberty-county-map
git branch --show-current
git status --short
npm run certify:lp164
npm run verify:lp164
npm run test:lp164
npm run certify:lp163
npm run verify:lp163
npm run test:lp163
npm run verify:lp160
npm run test:lp160
npm run verify:lp161
npm run test:lp161
npm run verify:lp1611
npm run test:lp1611
npm run verify:lp162
npm run test:lp162
npm run test:lp1601m
git diff --check
git status --short
git --no-pager log --oneline -5
```
