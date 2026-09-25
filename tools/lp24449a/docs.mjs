import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {root,out,artifacts,read,write} from './inventory.mjs';
const decision=read('reports/lp24449a/decision.json'),browser=read('reports/lp24449a/browser-summary.json'),replay=read('reports/lp24449a/replay-results.json'),integrity=read('reports/lp24449a/integrity.json'),tests=read('reports/lp24449a/test-comparison.json');
const baseline=read('reports/lp24449a/starting-baseline.json'),backend=read('reports/lp24449a/backend-safety.json');
const walk=dir=>fs.readdirSync(`${root}/${dir}`,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(`${dir}/${d.name}`):[`${dir}/${d.name}`]);
const managedTests=['tests/lp196-multi-county-place-identity-resolution.test.mjs','tests/multi-county-exit-transition.test.mjs','tests/lp24445-unified-awareness-context.test.cjs','tests/lp24449a-home-cache.test.cjs','tests/lp24449a-search-publication.test.cjs','tests/lp24449a-canonical-home-resolution-cache.test.cjs'];
const manifest={product:['js/app.js'],tests:managedTests,tools:walk('tools/lp24449a'),reports:[...new Set([...walk('reports/lp24449a'),'reports/lp24449a/file-manifest.json','reports/lp24449a/artifact-index.json'])].sort(),docs:['docs/launch/LP24449A-STATEWIDE-IDENTITY-CLOSURE.md']};
write(`${out}/file-manifest.json`,manifest);
write(`${out}/artifact-index.json`,walk('.artifacts/lp24449a').filter(file=>/\.(png|log)$/.test(file)).map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(`${root}/${file}`)).digest('hex')})));
const family=Object.entries(Object.groupBy(replay.records,r=>r.code)).map(([code,rows])=>`| ${code} | ${rows.length} | ${rows.filter(r=>r.status==='FIXED').length} | ${rows.filter(r=>r.status!=='FIXED').length} |`).join('\n');
const sourceFiles=Object.entries(manifest).map(([kind,files])=>`### ${kind}\n\n${files.map(f=>'- `'+f+'`').join('\n')}`).join('\n\n');
const status=execFileSync('git',['status','--short'],{cwd:root,encoding:'utf8'});
const text=`# Gridly LP244.49A — statewide identity closure

Decision: **${decision.decision}**. This gate covers locally certifiable Home, Search, explicit membership and downstream identity. It does not certify live provider availability or resolve LP244.49B findings.

Branch: \`${baseline.branch}\`. Starting HEAD: \`${baseline.head}\`. Tracked working tree was clean before the repair. Existing LP244.49 untracked evidence was preserved. The commit containing this report is the final local repair commit if approved; its hash is reported separately because a commit cannot embed its own hash.

## Root causes and repair

1. County-filtered Home choices carried a PLACE and county in their source row but lost those fields at the name-only apply path. All governed choices now carry the existing canonical resolution payload and an explicit operational county, including 27 legacy aliases resolved uniquely inside their own county.
2. Legacy Home save and restore round-tripped through nonunique labels. Stable keys and persisted county authority now survive the transaction. Existing storage keys/schema remain in use. The established canonical record path now supports both single- and multi-county PLACEs.
3. A normalized Settings default was being mistaken for saved county authority. Unique legacy names recover deterministically; ambiguous names without a governed county remain unselected and the existing chooser remains available. The 19 startup profiles include Palestine, both Cleveland spellings, county-specific legacy keys, conflicting stale Settings, Work-only and malformed records.
4. Exact governed Search candidates could be removed by address/business relevance and publication stages, including the renderer's second relevance filter. Verified canonical candidates now keep their publication slot and exact county metadata. County-qualified names resolve locally; distinct same-name GEOIDs remain separate choices. An unattempted external request is no longer labeled a failed request when a canonical local result answers the query.
5. Restored Home identity reached Weather with the wrong PLACE in the original failures. The upstream identity repair fixes those inputs. Canonical presentation coordinates feed restored Home and its context cache. Repeated Home reads keep a stable area object until identity or coordinates change. There is no weather exception table or county-centroid substitution.

The only changed product file is \`js/app.js\`. There are no CSS, marker, data package, crossing package, route-logic, backend, schema, auth or native-build changes.

## Original failure reconciliation

| Original family | Original | Fixed | Remaining |
|---|---:|---:|---:|
${family}

Every original assertion retains its original failure ID and links to proof in \`replay-results.json\`. No original assertion was dropped. The 17 Nueces baseline assertions have a separate Agua Dulce Home → Search → Return Home replay.

## Coverage

| Check | Result |
|---|---|
| Home option and serialization/deserialization contracts | 2,058 memberships |
| Visible Home save, real reload and Return Home | ${browser.home.passed}/${browser.home.required}; ${browser.home.counties} counties |
| Multi-county Home | ${browser.home.multiMemberships}/362 memberships; 163 communities |
| Final-source Search with canonical Home preserved | ${browser.search.passed}/${browser.search.tested} memberships |
| Visible Search failures/collisions | ${browser.visibleSearch.passed}/${browser.visibleSearch.required} identities |
| Collision audit | 22 normalized groups / 45 identities |
| Startup profiles | ${browser.profiles.passed}/${browser.profiles.tested} |
| Return Home | ${browser.returnHome.passed}/${browser.returnHome.tested} |
| Same-county transitions | ${browser.sameCounty.passed}/${browser.sameCounty.tested}, across ${browser.sameCounty.counties} counties |
| Cross-county ring | ${browser.crossCounty.passed}/254 |

Lakeview (Hall) and Lake View (Val Verde) belong to one punctuation-free audit group but have distinct word boundaries. Each exact spelling and county-qualified query is tested independently. The other exact-name ambiguities expose distinct governed choices. The initial overly broad expectation and its browser evidence remain in the local diagnostic artifacts.

Home browser coverage is the union of every county representative, all multi-county memberships, every original in-scope failure, every normalized collision identity and the frozen edge cohort. The production chooser's rendered controls execute their real handlers; no fabricated result county is injected. The first pilot also used Playwright pointer clicks. Every final-source Home case performs an actual page reload. Search uses the county metadata returned by the production query itself.

Early Home batches used fresh contexts between counties. Later batches reused each isolated worker session and alternated membership indices to balance the slower metropolitan counties. Every case retained the same save/reload/Search/Return Home assertions; only final-source completed checkpoints count. Ring checks reuse isolated sessions and alternate the 254 county representatives.

## Consumers and frozen UI

Home, active county, Weather point, crossing owner and DriveTexas owner are recorded for every Home browser case. Search records exact PLACE, county, canonical coordinates, Weather locality and byte-for-byte preservation of Home storage. Location Context, Community Pulse, KBYG and Alerts retain their three-hazard projection.

Reload and Return Home also check the actual weather connector point and both NWS point URLs, Location Context and KBYG labels, and all three Alerts source-owner identities. Per-consumer totals are recorded in \`browser-summary.json\`; full request and ownership proof remains in \`home-browser-results.json\`.

The frozen inventory contains misencoded community labels. The unchanged starting-source display cleanup removes encoding-artifact characters, so raw inventory text is not the exact visible-label oracle. The report uses that independently captured baseline formatter and records both raw and expected labels, while PLACE, county, coordinates and owner assertions remain separate. For example, the frozen CÃ©sar ChÃ¡vez label renders as C©sar Ch¡vez. This existing data/presentation defect is disclosed in \`label-baseline.json\` and is not repaired by LP244.49A; no data package or display cleanup was changed.

The required Flood/Debris/Power Line scenario checks three markers and three items in every consumer, separate freshness, no \`undefinedm\`, and disclosure state across background refresh and reopen. Expected streets are Cook/Church, Winfree/Flowers and Hope/Nancy. Result: ${browser.freeze.threeHazards&&browser.freeze.combined?'PASS':'FAIL'}.

Settings persistence, reload, arrow/Home/End/Space keyboard operation and 12 width/text combinations are checked at 320/360/390/440px. Map Style retains \`standard/satellite\`; Theme retains \`system/light/dark\`. Geometry checks cover KBYG dead space and control containment, popup bounds, map pan, marker taps and local tile failure/recovery. Settings: ${browser.freeze.settings?'PASS':'FAIL'}; geometry: ${browser.freeze.geometry?'PASS':'FAIL'}.

The wider historical H1 harness hit Playwright pointer/navigation waiting timeouts on both the starting app and repaired app. Its diagnostic records are retained. Deterministic state checks invoke rendered control click events and wait for the actual sheet state; Settings measurements wait for the entrance animation to settle. The targeted three-hazard suite is the LP244.49A freeze gate. No physical Android/iOS testing is claimed. Standard DOM buttons/radio semantics are the compatibility assumption, not device certification.

The disclosure diagnostic is consistent with a locator retaining an obsolete node during a background render: the earlier locator click did not change the mounted state, while the atomic current-node click did. Resolving and clicking the currently mounted summary in one browser task preserves the real production click/default action; collapse, refresh, close/reopen and expansion then pass without an Alerts code change. Saved Home/Work Search layout at all four widths: ${browser.freeze.savedPlaces?'PASS':'FAIL'}.

Visual review confirmed the choice groups, saved-place rows and popup containment. The existing Text Size group clips labels at 320 px in large-text mode. A paired starting/repaired-source browser comparison confirms identical control metrics and appearance. No CSS changed in this milestone; this baseline presentation limitation remains disclosed. See \`visual-review.json\` and \`text-size-baseline.json\`.

The wider historical harness also timed out waiting for the crossing-cleared count to settle. The focused starting/repaired replay classifies that diagnostic as **${browser.freeze.historicalClearComparison.classification}**; full stages and failure reasons are in \`freeze-clear-comparison.json\`. This does not certify or repair the deferred statewide stale-after-clear finding.

## Tests, runtime and safety

Repaired suite: ${tests.runs.find(r=>!r.baseline).summary.join('; ')}. Starting suite: ${tests.runs.find(r=>r.baseline).summary.join('; ')}. The same ten pre-existing failures remain: isolated fixture dependencies and existing asset metadata assertions. New failures: ${browser.tests.newFailures.length}. Seven new behavioral tests cover stable Home caching, exact canonical address/business relevance, explicit county authority, ordinary-address protection, and canonical resolution cache validation/invalidation.

Profiling exposed repeated registry scans in canonical Home resolution: 1,000 reads took 582.3 ms before the final cache repair. The final-source diagnostic took 11.3 ms and retained the explicitly selected Harris County Houston identity. The starting source took 26.7 ms but selected Montgomery County, so full-save timings are not comparable. The cache key includes PLACE, supplied memberships and current presentation focus, and requires the same registry reference. Malformed authority still fails closed; coordinate hydration invalidates the cached result. Before-cache evidence is archived locally and excluded from final certification totals.

Headless timings include map rendering, settlement, reload and concurrent local audit work. They do not measure human tap latency. Home accumulated case time: ${(browser.runtime.homeTotalMs/60000).toFixed(1)} minutes; Search: ${(browser.runtime.searchTotalMs/60000).toFixed(1)} minutes. Slow cases are enumerated in \`browser-summary.json\`.

Production writes: ${backend.allowedProductionWrites}. Browser routes reject mutation-capable methods before network continuation, block service workers and close WebSockets. External providers are blocked or locally fulfilled. Controlled NWS/report fixtures prove request geography and local identity; they do not prove live external geocoding, DriveTexas or weather availability.

Protected integrity: ${integrity.protectedCount} baseline files checked; only \`js/app.js\` changed. All ${integrity.markerCount} marker PNGs and all ${integrity.priorEvidenceCount} prior audit files are unchanged. Source SHA-256: \`${decision.sourceHash}\`.

## Deferred LP244.49B findings

${Object.entries(decision.deferred).map(([code,count])=>'- '+code+': '+count+' original assertions, not repaired here.').join('\n')}

No push, merge or deployment was performed. ${decision.decision==='APPROVE'?'The identity repair is suitable for review as one local commit; broader statewide launch remains subject to the deferred findings and live/device certification.':'Do not commit or merge: '+decision.blockers.join('; ')+'.'}

## Exact managed files

${sourceFiles}

## Pre-commit status snapshot

\`\`\`text
${status.trimEnd()}
\`\`\`

Final post-commit HEAD/status are reported in the task response. Screenshot and diagnostic log paths/hashes are in \`artifact-index.json\`; local bulky artifacts remain under \`.artifacts/lp24449a\`.
`;
fs.writeFileSync(`${root}/docs/launch/LP24449A-STATEWIDE-IDENTITY-CLOSURE.md`,text);
console.log(JSON.stringify({decision:decision.decision,managedFiles:Object.values(manifest).reduce((n,a)=>n+a.length,0)}));
