# LP119 — Texas County Expansion Program

## 1. Program charter

The Texas County Expansion Program is the governed, repeatable process for preparing a Texas county as an **inactive candidate** with the LP114–LP118 manufacturing pipeline. Its purpose is to expand Gridly's awareness coverage deliberately while preserving every production and runtime control.

The program operates in this priority order:

1. **Awareness platform first:** establish trustworthy county identity, boundary, communities, ZIP relationships, curated destinations, and search evidence.
2. **Route intelligence second:** manufacture and certify crossings and roadway geometry only from authoritative sources.
3. **Audit first:** record evidence, gaps, provenance, hashes, counts, review decisions, and regressions before considering a change.
4. **Patch second:** correct a demonstrated manufacturing limitation only after an audit identifies it. A missing owner source, review decision, or authorization is not a tooling defect.

LP119 is documentation-only. It does not authorize county activation, production uploads, Storage mutation, deployment, selector expansion, production-manifest changes, or changes to governed address, roadway, crossing, certificate, or consumer logic.

## 2. Roles and separation of duties

| Role | Responsibility | May not substitute for |
| --- | --- | --- |
| Program owner | Selects a wave, assigns reviewers, accepts residual risk, and issues separately recorded production authorization | Technical certification |
| Manufacturing operator | Runs the existing candidate-only commands, preserves logs/checkpoints, and reports exact statuses | Source ownership or approval |
| Source custodian | Supplies and identifies authoritative TxGIO, FRA, TIGER, boundary, community, ZIP, and destination inputs | Candidate review |
| Community reviewer | Confirms locality names, coordinates, relevance, omissions, and community-facing awareness coverage | Search certification |
| Destination curator | Reviews destination identity, address, coordinates, category, public relevance, and duplicates | Runtime authorization |
| Search certifier | Exercises representative queries and records result quality, ranking, locality coverage, and failure cases | Community/destination approval |
| Candidate approver | Confirms all candidate evidence and exceptions are complete and recommends or rejects promotion | Production authorization |
| Production authorizer | Makes a separate, explicit promotion decision after candidate approval and regression review | Manufacturing or certification |

One person may hold multiple roles, but the evidence must show each decision separately. Manufacturing success never implies review, approval, authorization, or activation.

## 3. Program records and status vocabulary

Create one immutable review record per county and wave. It must identify county name/FIPS, adjacency rationale, source versions, command/commit, output paths, evidence hashes, reviewers, gate decisions, exceptions, and timestamps. Preserve the LP114–LP118 status vocabulary exactly:

- `GENERATED`, `RESUMED`, and `VERIFIED_EXISTING` describe successfully produced or integrity-verified evidence.
- `NOT_APPLICABLE` is allowed only when an authoritative query proves the asset does not apply.
- `REQUIRES_OWNER_SOURCE` means the governed input is unavailable.
- `REVIEW_REQUIRED` means a human-governed decision remains open.
- `FAILED` means an attempted operation or certification failed.
- `NOT_AUTHORIZED` preserves a production boundary.
- `NO_EXISTING_PIPELINE` remains historical/diagnostic and must trigger a limitation audit if it reappears; LP117 connected the currently governed asset families.

Never translate missing input into `NOT_APPLICABLE`, an empty candidate into approved coverage, or a passing certificate into production authorization.

## 4. Standard county manufacturing workflow

### Phase 0 — Intake and adjacency nomination

1. Nominate a county through the adjacent-county strategy in section 8.
2. Record Texas identity, five-digit FIPS, shared-border parent county/counties, user-awareness need, corridor continuity, and source availability.
3. Confirm it exists in the maintained 254-county inventory and that the request contains no duplicate FIPS.
4. Define success and stop conditions before manufacture. Stop for disputed identity, unclear adjacency, or an instruction to change production state.

**Exit:** program owner accepts the county into a named candidate wave. No asset has been activated.

### Phase 1 — Source and environment preflight

1. Pin the repository commit and keep production/runtime files clean.
2. Inventory authoritative inputs without modifying them:
   - Census county boundary;
   - TxGIO address geodatabase/package and metadata sidecar;
   - statewide FRA crossing source;
   - county TIGER/Line roads (or a governed equivalent accepted by LP116);
   - governed community/locality inventory;
   - HUD/USPS ZIP/county evidence;
   - curated destination source;
   - required GDAL tooling.
3. Record source owner, vintage, path, size, and SHA-256 where the pipeline reports it.
4. Classify unavailable inputs as `REQUIRES_OWNER_SOURCE`; do not redesign tooling merely to bypass them.
5. Choose candidate report directories only. Do not point output at `data/`, runtime assets, production package directories, manifests, or Storage.

**Exit:** inputs are ready or gaps are explicitly recorded. Unresolved required inputs block the affected asset and later gates, not unrelated counties in the wave.

### Phase 2 — Candidate manufacture using LP114–LP118

Use LP114 as the bundle orchestrator. It coordinates existing county identity, boundary, address/certificate, crossing, roadway, community, ZIP, destination, search, candidate identity, and promotion-prerequisite evidence. Use:

- LP115 for authoritative FRA-derived crossing candidates and crossing certification;
- LP118 for read-only TIGER source discovery/extraction and boundary containment;
- LP116 for roadway normalization, deterministic identity, adaptive partitioning, manifests, and certification;
- LP117 for generalized boundary, ZIP, community, destination, search, and promotion metadata integration;
- the LP104/LP107/LP113 paths already invoked by LP114 for address packages and candidate certificates.

Representative owner execution (paths are examples and must be replaced with governed local sources):

```powershell
$ErrorActionPreference = 'Stop'
node .\tools\lp114\manufacture-county-bundle.mjs `
  --fips '<FIPS>[,<FIPS>...]' `
  --resume `
  --gdb 'C:\GridlyOwnerSources\TxGIO\Texas-2026.gdb' `
  --crossing-source 'C:\GridlyOwnerSources\FRA\fra-crossings-tx.geojson' `
  --tiger-road-root 'C:\GridlyOwnerSources\Census\TIGER2025' `
  --tiger-gdal 'C:\Program Files\QGIS 3.44.11\bin' `
  --roadway-boundaries '.\assets\boundaries\texas-counties-boundaries.geojson' `
  --reports '.\reports\<wave-id>\lp114'
if ($LASTEXITCODE -ne 0) { throw "Candidate manufacture failed: $LASTEXITCODE" }
```

Before owner execution, confirm the installed LP114 CLI help because the orchestrator contract is authoritative. Use `--resume` only when checkpoint bindings match; use `--force` only for a deliberate candidate rebuild supported by the tool. Never edit generated evidence to manufacture a pass.

**Exit:** every asset has a truthful terminal status and locally retained candidate evidence. `FAILED`, `REQUIRES_OWNER_SOURCE`, or `REVIEW_REQUIRED` remains visible.

### Phase 3 — Evidence audit and technical certification

1. Review aggregate and per-FIPS checkpoints/manifests.
2. Verify county/FIPS agreement, source hashes and provenance, EPSG:4326 output, geometry types, boundary containment, duplicate/rejected counts, stable IDs, deterministic ordering, partition limits, ZIP relationships, and package hashes/sizes.
3. Confirm zero-result decisions carry authoritative query evidence.
4. Confirm all candidate metadata remains `activated: false`, `productionAuthorization: false`, with upload/deployment disabled where represented.
5. Diff governed production/runtime files against the pinned commit.
6. Rerun relevant LP112–LP118 tests and governed runtime regressions. A candidate failure must remain isolated from other counties/assets.

**Exit:** technical evidence is complete and passing, or the county returns to source resolution/manufacture. Certification alone does not pass human review gates.

### Phase 4 — Human review gates

Run the five gates in section 6 in order: community review, curated destination review, search certification, candidate approval, and production authorization. Record reviewer, date, evidence, exceptions, decision, and expiration/re-review trigger for each.

**Exit:** the candidate is either rejected, held with explicit blockers, or separately authorized for a future promotion milestone. LP119 and ordinary candidate manufacture stop before promotion.

### Phase 5 — Controlled promotion (separate milestone only)

Promotion is outside LP119. A later, explicitly scoped milestone may use existing guarded promotion tooling only after all criteria in section 7 pass. It must independently plan rollback, protect runtime manifests/selectors, verify production hashes, and obtain production authorization. Candidate artifacts must never be copied into production ad hoc.

## 5. Reusable county readiness checklist

Copy this section into each county review record and replace placeholders.

### Identity and nomination

- [ ] County: `<name>`; FIPS: `<five digits>`; wave: `<id>`.
- [ ] Texas inventory identity is unique and verified.
- [ ] Shared-border relationship and parent coverage county/counties are recorded.
- [ ] Awareness/corridor rationale and expected user benefit are documented.
- [ ] Program owner, operator, source custodians, and reviewers are assigned.

### Safety and workspace

- [ ] Repository commit and command versions are recorded.
- [ ] Baseline worktree and production/runtime hashes are recorded.
- [ ] Outputs target candidate report directories only.
- [ ] No production upload, Storage mutation, deployment, activation, selector expansion, or production-manifest change is requested.
- [ ] Rollback/cleanup removes candidate reports only, never owner sources or production assets.

### Authoritative inputs

- [ ] Census boundary identity and vintage are verified.
- [ ] TxGIO address source/package and matching sidecar are available and traceable.
- [ ] FRA crossing source is available and traceable.
- [ ] TIGER roadway source and GDAL requirements are available and traceable.
- [ ] Governed community/locality evidence is available; names/coordinates are not inferred.
- [ ] ZIP/county relationships are preserved from governed evidence.
- [ ] Curated destination source and ownership are recorded.
- [ ] Every missing source is `REQUIRES_OWNER_SOURCE`, not `NOT_APPLICABLE`.

### Manufactured evidence

- [ ] LP114 aggregate report and per-FIPS checkpoint/manifest are retained.
- [ ] Boundary candidate passes identity/containment review.
- [ ] Address package, sidecar, certification, and inactive candidate certificate pass.
- [ ] Crossing source/package/certification passes, including classification and zero-result evidence.
- [ ] LP118 extraction passes source selection, CRS conversion, boundary containment, and rejection accounting.
- [ ] LP116 roadway packages/manifest/certification pass stable-ID, duplicate, determinism, and partition limits.
- [ ] Community, ZIP, destination, search, and promotion-prerequisite evidence have truthful statuses.
- [ ] No unexplained `FAILED`, `REVIEW_REQUIRED`, `REQUIRES_OWNER_SOURCE`, or `NO_EXISTING_PIPELINE` remains.

### Review and regression

- [ ] Community review gate passes with named reviewer/evidence.
- [ ] Curated destination review gate passes with named reviewer/evidence.
- [ ] Search certification passes representative county/locality/address/destination and negative queries.
- [ ] Candidate approval is explicit and exception-free (or exceptions are accepted in writing).
- [ ] Relevant manufacturing and runtime regression tests pass.
- [ ] Production/runtime diff is empty.
- [ ] Candidate evidence remains inactive and unauthorized.

### Promotion readiness (does not perform promotion)

- [ ] Source/evidence age is within the wave's accepted window.
- [ ] Open blockers, rejected records, and residual risks are dispositioned.
- [ ] Rollback owner, monitoring owner, and rollback triggers are defined.
- [ ] A production authorizer separate from manufacturing has signed a time-bounded decision.
- [ ] Promotion is assigned to a separate milestone/change set.

**Readiness decision:** `HOLD | REJECT | CANDIDATE_APPROVED | PRODUCTION_AUTHORIZED`

**Decision owner/date:** `<name> / <UTC date>`

**Evidence record:** `<path or governed record ID>`

## 6. Review gate definitions

| Gate | Required evidence | Pass condition | Blocking outcomes |
| --- | --- | --- | --- |
| G1 Community review | Boundary map, governed locality inventory, names/aliases, coordinates, omissions, reviewer notes | Localities are source-backed, correctly located, relevant to awareness, and approved; no inferred placeholders | Missing source, disputed locality, coverage gap, `REVIEW_REQUIRED` |
| G2 Curated destination review | Destination source/provenance, identity, category, address/coordinate, duplicate and relevance review | Each included destination is accurate, useful, county-contained, source-backed, and explicitly accepted; omissions are documented | Fabricated/unverified entry, duplicate, wrong county, unresolved address |
| G3 Search certification | Fixed query set, expected/actual results, rank/relevance notes, negative and boundary cases, address/community/destination coverage | Representative queries resolve to correct county entities with acceptable relevance; wrong-county leakage and critical false positives are absent | Unresolved critical query, leakage, stale evidence, dependency on unapproved content |
| G4 Candidate approval | Completed checklist, technical certifications, G1–G3 decisions, regression results, production diff, exception register | Evidence is complete, blockers are closed, regressions pass, production state is unchanged, and approver signs the inactive candidate | Any failed/held gate, unexplained status, runtime change, expired source/review |
| G5 Production authorization | G4 approval, risk/rollback/monitoring plan, exact promotion scope, artifact hashes, authorizer and validity window | Authorized owner approves only the identified hashes/scope for a separate controlled promotion | Implicit approval, changed artifact, expired window, absent rollback/monitoring |

A failed or held gate sends the county back to the earliest affected phase. Corrections produce new evidence and require downstream gates to be repeated. Review records are append-only; do not overwrite a rejection with a pass.

## 7. Promotion authorization criteria

A county may be marked `PRODUCTION_AUTHORIZED`—but not promoted by this program document—only when all of the following are true:

1. G1–G4 passed against the same candidate artifact hashes and current governed sources.
2. All required asset statuses are successful/verified or have an explicitly accepted, authoritative `NOT_APPLICABLE` result.
3. Address, crossing, roadway, boundary, community, ZIP, destination, and search evidence meets its existing certificate/review contract.
4. Candidate identity is inactive; production authorization was not pre-populated by manufacturing.
5. Relevant LP112–LP118 and governed consumer/runtime regressions pass, and production/runtime files remain unchanged during candidate work.
6. The exact artifacts, target environment, authorized action, authorizer, issue/expiry time, rollback plan, monitoring, and stop conditions are recorded.
7. Any artifact/source/code change after approval invalidates authorization and returns the county to the applicable gate.
8. Promotion occurs in a separate reviewed change with no unrelated county or selector expansion.

Authorization is deny-by-default, county-specific, artifact-hash-specific, environment-specific, time-bounded, revocable, and non-transitive across adjacent counties.

## 8. Adjacent-county expansion strategy

Adjacency is the default nomination mechanism because it extends an existing awareness footprint and route context incrementally. It is a prioritization rule, not evidence of readiness and not permission to activate.

### Selection method

1. Build the frontier of Texas counties sharing a land boundary with currently governed coverage. Record the authoritative boundary relationship; near proximity or corridor connection alone is not adjacency.
2. Exclude already governed/active counties and counties already assigned to another wave.
3. Score the remaining frontier with documented evidence:
   - **Awareness continuity:** communities and users connect to existing coverage.
   - **Route continuity:** major road/rail corridors cross the shared boundary.
   - **Source completeness:** governed boundary, address, crossing, TIGER, community, ZIP, and destination inputs are obtainable.
   - **Review capacity:** community, curation, and search reviewers are available.
   - **Operational size/risk:** feature volume, partitions, metro complexity, border ambiguity, and known data-quality issues.
4. Prefer the smallest coherent wave that maximizes continuity and source/reviewer readiness while limiting correlated risk. Do not select solely by population or data convenience.
5. Keep each county independently checkpointed, reviewed, approved, authorized, and reversible. A passing neighbor cannot waive another county's gates.
6. After a wave is candidate-approved, recompute the frontier for planning only. Do not treat candidate or authorized-but-inactive counties as active anchors unless the program owner explicitly defines a planning-only frontier.

### Exceptions

A non-adjacent county requires a written rationale (urgent awareness need, isolated source opportunity, or strategic corridor), program-owner approval, and the same gates. Adjacency never overrides authoritative-source, containment, review, or production controls.

## 9. Genuine manufacturing limitation protocol

Do not modify architecture during normal county work. A limitation exists only when authoritative inputs satisfy the documented contract but LP114–LP118 cannot truthfully manufacture or certify them. Missing sources, unavailable reviewers, failed quality, authorization absence, or a malformed input are not limitations.

When a suspected limitation appears:

1. Stop the affected asset/county and preserve the failing command, inputs' identities/hashes, logs, checkpoint, and expected contract.
2. Reproduce with the smallest authentic or controlled non-production case.
3. Audit the responsible LP114–LP118 boundary and confirm existing options cannot handle it.
4. Write a limitation record with impact, counties affected, safety constraints, and alternatives.
5. Obtain a separately scoped engineering milestone before patching.
6. Make the smallest backward-compatible change, add regression coverage, and repeat all affected gates.

No limitation was discovered by LP119's documentation review; no manufacturing or runtime code change is proposed.

## 10. LP120 — Adjacent County Manufacturing Wave 1 recommendation

LP120 should be an **inactive candidate manufacturing and review wave**, not an activation milestone.

1. At kickoff, derive the current adjacent frontier from authoritative county boundaries and the then-current governed coverage; do not hard-code candidates in LP119.
2. Select a small wave (recommended: two or three counties) using the section 8 scorecard. Prefer counties with complete owner sources and named community/destination/search reviewers over a larger or more visible wave.
3. Freeze the county/FIPS list, source vintages, repository commit, reviewers, acceptance thresholds, and candidate report root in the LP120 plan.
4. Run preflight, then LP114 with LP115/LP118/LP116/LP117 integration; preserve per-county isolation and exact statuses.
5. Complete G1–G4 for each county independently. Report blocked counties without delaying evidence completion for successful peers.
6. Validate deterministic resume/rebuild behavior, candidate safety flags, production/runtime clean diff, and the existing LP112–LP118 regression suite.
7. End LP120 with `HOLD`, `REJECT`, or `CANDIDATE_APPROVED` recommendations. Defer G5 and all promotion, upload, Storage, deployment, manifest, selector, and activation work to a separately authorized milestone.
8. Open an infrastructure follow-up only if the limitation protocol proves a genuine pipeline gap.

## 11. LP119 completion and merge recommendation

LP119 formalizes one program, one reusable workflow/checklist, adjacency-first selection, five explicit review gates, and deny-by-default promotion criteria while retaining the LP114–LP118 pipeline and production boundary. It requires no additional infrastructure change.

**Merge recommendation:** merge this documentation-only change after document checks confirm all required subjects are present and the diff contains no runtime, production manifest, selector, Storage, deployment, or generated report changes. Merging LP119 authorizes use of the process only; it does not authorize any county or production action.
