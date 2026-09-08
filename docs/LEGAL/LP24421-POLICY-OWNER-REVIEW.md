# LP244.21 revised policy owner-review report

> LP244.21A update: Local certification is BLOCKED by a reproduced ordinary-client replay that recreates erased device linkage with a new clock. See [the retention certification outcome](LP24421-REPORT-RETENTION.md). Earlier scope/test statements below record their original policy-only checkpoint and are not a current certification. Policies remain proposed and unpublished.

PROPOSED — NOT APPROVED, NOT PUBLISHED. September 8, 2026. This report supersedes the earlier review report. Owner-approved decisions do not approve the complete policy wording. No legal completeness, enforceability, store acceptance or implemented compliance is certified. The owner elected not to obtain external counsel.

Branch: `LP244.21-privacy-terms-destinations`. Starting/unchanged HEAD: `cd29c35207952efe2c8c5f1c4a5896d13bb7dcb1`. The two policies and this report were already uncommitted; they were the only changed files at that earlier review checkpoint. The subsequent authorized retention implementation adds code, SQL, tests, and a runbook; see the retention report for current scope. Earlier LP244.20/LP244.20A ancestry checks passed. No branch change occurred.

## Owner decisions and publication gate

Identity remains DJ Burns Collective LLC, doing business as Gridly App; consumer brand Gridly; domain gridlygo.com; proposed effective date September 8, 2026; support@gridlygo.com, privacy@gridlygo.com and legal@gridlygo.com. Owner attests Cloudflare forwards these to verified owner Gmail, catch-all disabled. No email was sent or account accessed. Delivery is not proof of monitored requests, secure replies or deletion capability.

New decisions incorporated: 16+ general audience, not directed under 16; initial United States offering with Texas-focused coverage; maximum 180-day report/device linkage; subsequent event retention only after removing device linkage and other reporter-identifying information; historical condition intelligence, safety analysis, source-quality evaluation and product improvement, not permanent reporter tracking; no anonymity claim without demonstrated resistance to reasonable relinking; no new commercial sale or targeted advertising.

The production 180-day control is NOT DEPLOYED. The subsequent implementation block is documented in [LP24421-REPORT-RETENTION.md](LP24421-REPORT-RETENTION.md), including local PostgreSQL tests and unresolved backup/log/offline-copy gates. Historical ingestion sanitization exists but does not enforce this deadline across reports/copies. Privacy now expressly blocks publication pending implementation/testing and a working request process. Additional schedules remain proposals. Do not publish, mark approved or remove review banners. Reconfirm effective date if publication occurs later; do not silently backdate applicability.

## Exact changes from the immediately preceding versions

1. Privacy banner retained; added the PUBLICATION BLOCKED paragraph naming the absent control, future launch commitments and unapproved other schedules.
2. Privacy §1 replaces the Texas-focus-only coverage sentences with initial United States availability and an explicit warning that this is not nationwide condition coverage.
3. Privacy §4 replaces the former no-ad-feature/no-sale-authorization paragraph with the launch commitment against sale of personal information or targeted-advertising use/sharing, no new commercial condition-data sale, continued operational sharing and no technical deidentification claim.
4. Privacy §6 removes “no fixed, verified deletion schedule” for device linkage and the old unbounded historical-asset paragraph. Inserts 180 days from original submission, no reset by update/confirmation/copy/restore, removal of other identifying information, four historical purposes, delete-if-not-removable, relinking assessment, controlled-copy/backup requirements and unresolved other schedules. Existing local-storage paragraph remains unchanged.
5. Privacy §7 replaces intake-only wording with launch logging/acknowledgment/proportional verification/review; adds no account requirement, public report clues insufficient as ownership proof, action/refusal/appeal, withdrawal and no automatic erasure of prior submissions. Conditional statutory-rights paragraph remains.
6. Privacy §9 replaces “not directed to children under 13” with general-audience 16+ / not directed under 16 and an under-16 use/submission prohibition. No age-verification or parental-consent system is claimed.
7. Terms §2 makes eligibility explicit as “You must be at least 16 years old to use Gridly” and adds US initial offering and Texas-focused coverage qualification. Terms submissions section adds the 180-day ceiling and purpose/removal restrictions to the content permission.
8. The owner-approved “Gridly Is Not a Government or Emergency Agency” two paragraphs remain VERBATIM; the heading is now numbered Section 3 and the redundant community-report disclaimer sentence in Section 4 was removed. Existing safe-driving and 911 instructions remain. No background-warning, notification-delivery or turn-by-turn promise; no operative price/subscription, arbitration, venue, liability cap, refund or cancellation term was added.
9. All other clauses remain from the preceding proposals: identity, precise-location distinctions, providers/email, rights protections, limited liability wording, previously directed Texas law and non-operative future-purchase reservation. These remain subject to whole-document approval.

The two existing `docs/LEGAL` policy paths remain proposed authorities named by the store-content plan. Older `legal/drafts/*`, LP184.1C/D evidence and the separate community disclaimer remain untouched historical material. Copies below are a synchronized review snapshot, not another operative authority.

## Source findings relevant to retention

`js/app.js` initializes `gridlyDeviceId` around 46737; report rows use `device_id` (89729, 89979, 93477), and `hazard-cleared-${deviceId}-${Date.now()}` around 90596 embeds identity in another field. Normalization copies `deviceId` and source/report/incident IDs. Removing one SQL column is insufficient.

`startGridlyRouteWatchPositionUpdates` around 54479 uses repeated high-accuracy foreground positions. Live position memory is distinct from saved-place addresses/coordinates (`saveSavedPlaces`, 93676), report coordinates, route-provider endpoints, reverse geocoding, remote service logs and geocoding caches. Those distinctions remain in Privacy. No consumer account/checkout or advertising feature was established; internal condition analytics and technical/provider collection still exist.

`gridly_feedback` payload at 102984 includes message/category, area/county context, platform, version and page origin/path. Direct Gmail fallback at 102805 is unchanged. Supabase geocoding handles query/address/context/request ID and response caches. Weather uses selected-area points; DriveTexas default fetch retrieves roadway conditions for local filtering. Live configuration, provider contracts, database access, logs/backups and actual deployed records were NOT queried.

`js/history-capture/historyCaptureEnvelope.js` excludes raw device aliases, free-form detail and unsafe synthetic hazard IDs and generalizes coordinates in its allowlist. `historyCaptureWriter.js:137–157` writes source IDs, envelope/payload/metadata and idempotency key to `history_capture.historical_events`; default capture/writes are enabled in `historyCaptureFlags.js`. This is not proof of legacy cleanup, deployed behavior, absence of joins or anonymous data. Three-decimal coordinates can still be identifying in context.

## Proposed additional retention schedules — owner approval required

Only the 180-day report-linkage maximum is approved. Every other period below is a recommendation, not an operative term/current fact. Earlier applicable rights/duties prevail. A category change never extends report-linkage retention.

| Category | Recommended period/clock | Operational reason and privacy tradeoff | Implementation / who controls deletion |
|---|---|---|---|
| Feedback | Raw submissions: 90 days after closure, capped at 180 days from receipt; scrubbed issue counts afterward | Diagnosis/retest versus accumulating identifying free text | Purge `gridly_feedback`, issue copies, attachments/exports; Gridly controls its copies, provider backups require verification. |
| Support email | 180 days after last substantive response; review still-open cases at 180 days from receipt | Follow-up versus persistent sender identity/content | Mailbox, trash, attachments and exports cleanup; minimize unresolved issue facts. Gridly controls owner-account copies, not sender copies/provider logs. Report attachments obey original report deadline. |
| Privacy-request records | Minimized accountability record: 24 months after closure; raw verification evidence target ≤30 days after verification or earlier report deadline | Evidence of rights handling versus another identity dataset | Restricted register and minimal outcome record; remove report/device joins by original 180 days. Confirm jurisdiction-specific requirements before approval. |
| Routine diagnostics | 14 days from log event | Short debugging window versus reduced historic diagnostics | Redact identifiers/query bodies at collection, TTL and export cleanup per sink; deployed settings unknown. |
| Security logs | Routine logs 30 days; relevant minimized incident evidence up to 180 days after case closure, subject to specific legal necessity | Abuse investigation versus longitudinal tracking risk | Restricted reviewed cases; cannot use security label to bypass report ceiling. Actual conflicting legal duty requires escalation, not an invented exception. |
| Local saved information | Until user deletion/reset; propose annual review reminder, no automatic upload | Home/Work utility versus long-lived sensitive addresses | Available controls and tested clearing/device-backup behavior; reminder not implemented. Remove raw shared-report linkage from client storage/distribution; offline legacy-copy limits must be resolved. |
| Backend backups | Seven-day rolling recovery window for ordinary data; independent guarantee report linkage is unrecoverable by original day 180 | Recovery versus additional identifying copies | Inventory snapshots/PITR/WAL/replicas/dumps/keys; segregate linkage, sanitize/expire copies or verifiably destroy keys before deadline. Seven-day backup TTL alone is insufficient. Provider controls unverified. |
| Provider-controlled logs/caches | No unilateral deadline; seek ≤30 days for necessary technical logs and no unnecessary personal-request retention | Service/security needs versus outside control | Obtain vendor-specific contract/settings evidence. Do not promise unavailable deletion; reject incompatible report-linkage paths rather than invent a grace period. |
| Gridly geocoding cache | Purge at `expires_at`; approve necessity of existing source freshness windows: 6h address success, 24h business success, 60s no result in inspected path | Fewer upstream requests versus stored address/coordinate exposure | Existing expiry gates reads, not proven physical deletion. Separate purge/backup controls required. |
| Reports before de-linking | Structured facts while useful up to approved linkage limit; propose free-text detail removal after 30 days if no longer necessary | Correction/trust review versus identifying narrative | Earlier valid deletion requests remain available; content sanitizer and original timestamps required. Not an entitlement to keep all text 180 days. |
| Events after de-linking | Propose five years from event with annual necessity/relinkability review; earlier aggregation/deletion where detail unnecessary | Seasonal/recurrence insight versus time/location inference risk | Event-only allowlist and join/text/location review; delete if removal cannot succeed. No anonymity or sale permission. |

## Separate required implementation specification: 180-day de-linking

SPECIFICATION ONLY. No execution, migration, deletion, runtime change or deployment is authorized here. New design concepts below are not claims of existing tables/jobs.

### Exact known inventory and required discovery

| Store/path | Known fields or structures affected | Required handling / qualification |
|---|---|---|
| `public.reports` | `id`, `device_id`, `crossing_id`, `crossing_name`, `detail`, `confidence`, `source`, `lat`, `lng`, `created_at`, `expires_at`, type/severity/county metadata; aliases `deviceId`, `reportId`, `sourceReportId`, `originalReportId`, `incidentId`, nested `rawPayload`/`canonicalSourceRecord` | Remove direct/embedded identity, personal free text and reporter joins. Preserve actual fixed crossing identifiers only when safe. Obtain deployed schema/constraints/triggers/RLS/grants/indexes through separately authorized inventory; client writes are evidence, not complete live schema. |
| `history_capture.historical_events` | `source_report_id`, `idempotency_key`, `envelope`, `payload`, `metadata`, `observed_at`, `received_at`, `retained_until`, `hook_name`; nested report/identity objects | Scan old versions and joined source IDs. Migration `202606170410_history_capture_storage.sql` has an 18-month target and draft origin; current writer exists. Neither establishes deployment; 18 months cannot extend reporter linkage. |
| `history_capture.writer_monitoring_events`, `history_capture.retention_runs` | `idempotency_key`, `detail`, `reason`, timestamps, retention detail | No personal cleanup payloads/old-new identity maps in logs. Deployed existence/settings unknown. |
| Draft `public.historical_incidents`, `public.incident_events`, `public.incident_recurrence_index` | `source_report_ids`, `source_report_id`, `device_hash`, `recurrence_key`, labels, coordinates/buckets, timestamps/counts | Names from `202606160001_add_historical_incident_tables_draft.sql`; not assumed live. If deployed, remove stable hashes/join paths; event-only recurrence must not encode reporter identity. |
| Local `gridlyEventHistoryV1`, `gridlyMovementIntelligenceV1`; source fallback names `gridly_event_history_v1`, `gridlyHistoricalIntelligence` | Report snapshots/source IDs, text, timestamps, event/route-derived state and memory arrays | Enumerate actual versions/keys. Stop distributing raw linkage; purge/migrate before rehydration. Offline copies cannot be remotely erased by a server job. |
| `public.gridly_feedback` and mail/request copies | `message`, `awareness_area`, `page_url`, optional schema `user_agent` (current client omits), category/platform/version/status and attachments/quoted IDs | Moving reports into email/feedback does not restart their deadline. Minimize accountability record separately. |
| `public.gridly_geocode_cache`, `public.gridly_geocode_provider_state` | `cache_key`, `response`, `provider_namespace`, `expires_at`, `created_at`; state `next_allowed_at`, `cooldown_until` | Not proven to contain report linkage; do not purge unrelated data indiscriminately. Inspect correlation logs/joins; query hashing is not anonymity. Apply approved separate schedule. |
| Backups/exports/derived records | Managed snapshots, PITR/WAL, replicas, dumps, CSV/JSON extracts, object versions, evidence downloads, mail attachments; history episodes, patterns, observations, aggregates and lookup tables | Exact deployed backup names, bucket/object paths, recipients and settings UNKNOWN. Inventory is a release blocker; repository inspection is not a complete production inventory. Independent user copies differ from Gridly-controlled processors. |

### Algorithm and controls required before publication

1. Use original trusted submission/acceptance time in UTC and 180 × 24 hours. Never restart on close/update/import/restore. Reconcile offline/client timestamps conservatively: a later upload cannot extend a known earlier submission. Missing/invalid/future/conflicting dates do not get a fresh window; resolve or remove identifying material before use. Clock mapping requires implementation review.
2. Isolate reporter linkage from event-only facts, with server-owned expiry and no client ability to extend it. Inventory direct fields, synthetic identifiers, stable hashes, crosswalks and indirect joins. Rotating/hashing a device ID is not de-linking if association survives.
3. Allowlist only necessary event facts for the four approved purposes. Remove device aliases, contacts, personal text/labels, synthetic device-containing IDs, reporter foreign keys, retained tokens and metadata mappings. Assess combined location/time/text/joins. Generalize or delete if reporter-identifying information cannot be removed. Existing sanitizer is reusable evidence, not proof of lifecycle completeness.
4. Enforce deadlines on reads, processing, writes, exports and retention jobs. Proposed day-179 lead permits completion before day 180. A nightly job completing after 180 days fails the maximum. A failed job must not extend retention; prevent distribution and remove linkage by deadline. Restricted access alone is insufficient. Existing fail-open history behavior must not bypass privacy enforcement.
5. Backfill legacy data in idempotent transactional batches with version/lock checks. Confirmations and clears do not renew the original report. A new report gets its own clock but cannot recreate expired association to an older report. Recompute/invalidate derived records and downstream caches.
6. Backups must not preserve recoverable linkage past deadline: separately segregated linkage with verified key destruction, or timely backup expiry/sanitization, are proposed options. Include copies of keys/WAL/replicas. Inaccessible storage plus restore-time replay ALONE is not de-linking. If provider capabilities cannot meet the maximum, block publication and return the conflict; no backup grace period is authorized.
7. Before restored data is exposed, apply current expiry/removal decisions. Use a minimized non-reconstructive completion ledger. Never roll back to expired linkage. Test restoration, exports, replica lag and removed keys. Logs carry counts/run version/status/nonidentifying reasons, not personal values.
8. Eliminate raw linkage from new client payloads and migrate supported legacy caches before reading. A server cannot erase an offline device or another user's screenshot. Evaluate whether existing distributed copies prevent the controlled-copy promise; resolve with owner before launch. Do not silently claim universal remote deletion.
9. Privacy/security case material obeys original report deadline. An actual conflicting legal preservation duty requires documented escalation and policy resolution; no generic exception or unlawful destruction is authorized. A 24-month request register must not become a reporter crosswalk.
10. Require completed inventory, backfill, end-to-end tests, operator alerts and processor/restore evidence before publication. Future schema/RLS/jobs/indexes/API changes require separate authorization. Operational alerting here is for the operator, not a consumer notification feature.

Acceptance tests for the future mission: just-before/exactly-at/after 180 days; UTC/DST/leap handling; old imports/invalid clocks; retries/concurrency; all aliases, embedded IDs, hashes, nested JSON and personal free text; indirect source-ID joins; sanitizer bypass/legacy schema; caches/exports/derived records; backup restore/key destruction; failed jobs and deadlines; offline/unsupported clients; earlier deletion requests; no reassociation through later reports; preserved event counts/source attribution. Require zero recoverable expired reporter linkage in controlled systems and documented limits. Do not infer anonymity from a field scan.

## Privacy-request operating procedure — implement before launch

Operational specification only; no account portal or mailbox automation created.

1. Owner checks privacy@gridlygo.com each business day, assigns a case ID/handler and logs receipt time, reply contact, right requested, minimal scope, applicable residence if needed, due dates and status in a restricted register. Test forwarding/spam review and safe alias replies before launch. Do not put raw device IDs/report bodies in a general spreadsheet.
2. Proposed acknowledgment target: two business days. Explain next steps; ask only for missing scope. No passwords, ID scans, payment details or new account by default. Never ask users to email their entire local storage or run console scripts.
3. Privately locate candidates using approximate date/place/category or voluntarily supplied report reference. Public facts are clues, not proof. Do not disclose candidate lists, someone else's identifiers or whether an unverified person submitted a report.
4. Verification must be proportional. General policy questions need none; access/correction/deletion need reasonable evidence of authority. A forgeable device string or public report details alone are insufficient. A secure accountless possession/ownership route is not currently proven; design/test one separately. If unavailable, explain and escalate rather than disclose data or silently deny. Assess agents/guardians as applicable; collect identity documents only when necessary, through a secure channel with prompt disposal.
5. Access: disclose verified in-scope data only, redact others and use protected delivery. Correction: distinguish observation from assertion and avoid falsifying historical facts. Deletion: separately authorized operators/processors must remove applicable copies and verify outcome; hidden/expired is not deleted. Withdrawal: stop consent-dependent processing and assess related removal; device permission revocation does not erase prior submissions.
6. Record decision, searched categories, nonidentifying execution evidence and response date. Explain lawful refusal/partial fulfillment and appeal route through the same email with case ID. Do not say completed until actual scope is verified. Preserve statutory deadlines despite absent automation.
7. Appeal requires a distinct documented review; use another authorized reviewer if one exists, otherwise a fresh owner review, not an invented independent department. Recheck search/verification/exceptions. Explain outcome and applicable regulator complaint mechanism.
8. Proposed internal resolution target: 30 calendar days for requests/appeals; escalate by day 20 and before any legal deadline. Use shorter applicable requirements. Where Texas Chapter 541 applies: respond without undue delay and within 45 days; one additional 45-day extension requires timely reasons/notice; appeal decision within 60 days. Do not pause clocks while verifying or presume extensions. For businesses covered by California CCPA, current §7021 requires confirmation within 10 business days for delete/correct/know requests and response within 45 calendar days from receipt (verification does not delay the start); a necessary extension can add 45 days with explanation/notice. §7101 requires request/outcome records for at least 24 months. Other applicable rights and states need their own deadline matrix before launch; no universal national 45-day rule is asserted.
9. Escalate immediately for suspected breach, children under 16 (including under-13 actual knowledge), disputed authorization, processor inability, preservation orders or missing tools. Inability does not waive duties. Avoid collecting more identity data merely to compensate for a missing verification design.
10. Secure the minimal case register/inbox with MFA, least access, device protection and tested recovery. Remove raw verification evidence promptly; use the proposed request-record schedule only after approval. Remove report-identifying attachments/joins by original deadline. These safeguards/staffing are pre-launch requirements, not verified current facts.

## Public physical-address assessment

No address/telephone was supplied, invented or exposed. US launch removes the intended EU distribution trigger, not all address obligations.

| Surface | Mandatory/public/optional/unresolved status | Required owner action |
|---|---|---|
| Privacy Policy | No universal public street-address requirement established solely by reviewed Texas notice, CalOPPA, Apple privacy or Google User Data provisions. Email-only intake is conditional; optional pending broader applicability review, not a national exemption conclusion. If COPPA notice applies, operator address/telephone are expressly required by 16 CFR 312.4(d). | Assess applicable US rules and actual-knowledge child handling; do not assume 16+ positioning eliminates duties. |
| Terms | CONDITIONAL MANDATORY consumer-visible address/telephone/email if these Terms are used as Apple's custom EULA; not established universally for standalone service Terms. | Choose standard Apple EULA plus compatible service Terms, or supply approved address/phone and all minimum clauses for custom EULA. Current proposals are not certified as a custom Apple EULA. |
| Apple seller information | Legal entity name is public seller name; DBA alone cannot enroll as organization. Organization/D-U-N-S verification needs legal/headquarters/mailing address. No general US public seller-address rule established by inspected enrollment guidance. EU trader address/phone/email publication applies if later distributing there. | Verify actual account/US presentation; provide legitimate verification address privately where required. No EU launch implied. |
| Google Play developer information | MANDATORY and PUBLIC legal address for organization account; monetized personal accounts also show full address. Organization developer email/phone are public. | Supply verifiable business details consistent with payments/D-U-N-S; do not assume arbitrary PO box is sufficient. |
| Subscription disclosures | No independent universal physical-address field established by reviewed Apple subscription/Google billing/ROSCA disclosures. EULA/developer-profile obligations still apply; final state/platform requirements unresolved until billing selected. | Resolve checkout/EULA/platform model before final legal publication; do not invent a cancellation/refund mailing address. |

## Official sources and scope of conclusions

Checked September 8, 2026. Only official primary sources support requirements below. The 180-day maximum is the OWNER'S decision, not a statutory period.

- [Texas Chapter 541](https://tcss.legis.texas.gov/resources/BC/htm/BC.541.htm), §§541.052–.055: request/appeal timing and conditional email-only intake; no new-account requirement. [Texas AG overview](https://www.texasattorneygeneral.gov/consumer-protection/file-consumer-complaint/consumer-privacy-rights/texas-data-privacy-and-security-act): applicability/SBA status, sensitive-location and processor responsibilities remain fact-dependent.
- [Apple App Review Guidelines §5.1.1](https://developer.apple.com/app-store/review/guidelines/): retention/deletion, consent withdrawal/deletion requests, accessible policy and third-party safeguards. §1.2 requires UGC controls. Policy disclosure does not implement those controls or establish equal provider protection.
- [Apple minimum custom EULA terms §8](https://www.apple.com/legal/internet-services/itunes/dev/minterms/): developer name/address/telephone/email. Remaining minimum clauses require a separate compatibility decision; no refund provision silently added.
- [Apple enrollment](https://developer.apple.com/help/account/membership/program-enrollment/), [D-U-N-S](https://developer.apple.com/help/account/membership/D-U-N-S/) and [EU trader requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/): verification, public seller identity and territory-specific published contact data.
- [Google developer information](https://support.google.com/googleplay/android-developer/answer/13628312?hl=en): public organization address/contacts, monetized personal address. [Google User Data](https://support.google.com/googleplay/android-developer/answer/10144311): accurate data/retention/deletion policy, public non-PDF/non-geofenced URL and in-app access, still future work.
- [Apple subscriptions](https://developer.apple.com/app-store/subscriptions/), [Google Subscriptions](https://support.google.com/googleplay/android-developer/answer/9900533?hl=en-GB), [Google Payments](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en), [FTC ROSCA](https://www.ftc.gov/legal-library/browse/statutes/restore-online-shoppers-confidence-act): disclosure/consent and platform-dependent billing choices; no current offering is created.
- [California BPC §22575](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=22575.): policy categories/changes and applicable tracking disclosures; US scope includes California consumers. [CPPA regulations effective January 1, 2026](https://cppa.ca.gov/regulations/pdf/ccpa_statute_eff_20260101.pdf), §§7021 and 7101: conditional California acknowledgment/response and minimum 24-month request-record requirements; confirm applicability before launch. No blanket CCPA applicability/exemption finding.
- [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions), [16 CFR §312.4(d)](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.4): child-directed/actual-knowledge issues and operator notice contacts. [FTC data-security guidance](https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business): purpose-based minimization, protection and disposal; extra periods are recommendations for approval.
- [OSMF Privacy](https://osmfoundation.org/wiki/Privacy_Policy), [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/): request logging and personal/confidential-input restrictions; existing address/reverse-location flows require provider suitability review. [NWS API](https://www.weather.gov/documentation/services-web-api), [Supabase Privacy](https://supabase.com/privacy), [Cloudflare Privacy](https://www.cloudflare.com/privacypolicy/): provider context, not proof of project-specific retention or contracts.

## Remaining subscription decisions, uncertainties and placeholders

Proposed $2.99/month auto-renewing paid-consumer intent, no free consumer version, and intended free dispatch/first-responder program remain business intent only. Purchase availability, entitlement, trials, renewal notices, cancellation/refunds, platform billing, receipt validation, family sharing and price-change terms remain unresolved. Later disclosures belong before purchase, in management, in approved Terms, store metadata and platform renewal/cancellation surfaces. No billing is implemented or authorized by these revisions.

Approve/revise the complete texts, extra schedules, request targets and original-submission clock interpretation; implement/test the ceiling separately. Verify deployed schema/backups/exports, processor deletion/contract settings, public API/device-ID exposure, offline copies, legacy history joins, request verification and execution, security, US-state scope/consent/notice obligations, minors/UGC controls, policy-change acceptance and current provider configurations. OSM/Nominatim address-input restrictions and Google/Census fallback activation remain uncertain. The owner-approved no-new-sale posture does not establish off-platform contract history; confirm consistency before launch.

No bracketed insertion tokens remain in either policy. Intentional draft/publication-block banners remain. Missing facts/decisions: actual backup/export names, provider settings, tested lifecycle, secure accountless verification, approved other schedules, business address/phone where required, standard versus custom EULA, policy URLs and final effective-date handling. No value guessed. Direct Gmail fallback remains unchanged. The de-linking specification is a separate section within this authorized report, not a fourth file or executable migration.

## Validation and final scope

Executed `node --test tests/lp1841c/consumer-legal-drafts.test.mjs tests/lp1841d/owner-legal-closure.test.mjs`: **11 passed, 0 failed, 0 skipped**. These invoke the existing legal validators' read-only verify modes and protect historical drafts/evidence; they do not validate legal meaning of the new proposals. No generator build ran and no old test was weakened.

Document checks (in-memory Node assertions): 53 passed, 0 failed; exact identity/US/age/180-day/publication boundaries, verbatim disclaimer, preserved safety instructions, matching full report copies, three-file scope, unchanged HEAD, empty staging area and whitespace verified. git diff --check: exit 0, only LF/CRLF conversion notices. Current diff from HEAD: Privacy +62/-41; Terms +58/-30; report new +331/-0 lines (ordinary git diff omits this untracked file). Combined scope: 3 files, +451/-71 lines. No runtime, Supabase, service worker, packaging or native changes; no staging, commit, push, merge, deletion/de-linking implementation, billing, build, deployment, Python or subagents. Final working tree: two modified policies and this untracked report, all unstaged. HEAD unchanged at cd29c35207952efe2c8c5f1c4a5896d13bb7dcb1. Stop for final owner review.

## Complete revised Privacy Policy

# Gridly Privacy Policy

> PROPOSED FOR OWNER REVIEW — NOT APPROVED OR PUBLISHED. The effective date below is the owner-selected proposed date; it does not make this draft operative.

> PUBLICATION BLOCKED: The launch commitments below require a tested 180-day report de-linking control and a working privacy-request procedure. A local implementation has been prepared and tested, but it has not been deployed or verified across production backups, logs, exports, and legacy offline copies. These commitments describe the proposed launch policy, not completed processing today. Other retention periods remain subject to owner approval in the review report.

**Effective date:** September 8, 2026

## 1. Operator and scope

Gridly is operated by DJ Burns Collective LLC, doing business as Gridly App ("Gridly," "we," "us"). Our domain is gridlygo.com. This policy covers information handled through the Gridly application and communications with us. Gridly 1.0 will initially be offered in the United States, with travel and community-condition coverage focused on Texas. Coverage varies by location and source; United States availability does not mean nationwide condition coverage.

The current application does not provide consumer account registration or a payment or subscription checkout. Local profiles and preferences are not consumer accounts. External websites, operating systems, email services, and app stores also handle information under their own policies.

## 2. Information handled by Gridly

- **Location and searches:** Device coordinates when you allow and use location features; selected areas and ZIP codes; addresses, place names, search text, map areas, and route origins and destinations used to provide requested results.
- **Community reports:** Report category, details, severity, road or crossing identifiers and names, event coordinates, geographic context, timestamps, source and confidence information, confirmations, and clearing or resolution information. Reports carry a persistent, app-generated device identifier. Reporting is pseudonymous, not anonymous or linked to a registered consumer account.
- **Submission integrity:** Each original report and each confirmation, edit, or clearing operation uses a separately generated random identifier. The server retains its SHA-256 digest and first-accepted time to prevent an old request from creating another report or device association. While the report remains, a private receipt connects it to the consumed digest and preserves its original submission time; that receipt is removed with the report. The surviving replay evidence contains no device identifier or device-derived key and is not described as anonymous. It remains while derived historical information is retained and while the corresponding protocol still accepts requests; removing a report alone does not remove this evidence.
- **Saved information and preferences:** Home and work labels, saved-place names, addresses and coordinates, area preferences, app settings, and locally retained condition history and route-related information.
- **Feedback and correspondence:** Submitted messages and categories, selected awareness area and county context, platform label, app version/build, and page origin/path. Email also provides your sender address, message, attachments you choose to send, and associated email metadata.
- **Technical information:** Requests to our infrastructure and external services can expose an IP address, request time, requested resource, and browser/application or device information. The app also uses local diagnostic and performance information. The absence of a separate advertising or analytics SDK does not mean these requests collect no information.

Do not put another person's private information, sensitive personal details, or information unrelated to a condition into a community report.

## 3. Location information

Location permission is used for features such as map centering, nearby context, report placement, route-origin selection, and Route Watch. The app can request precise, high-accuracy location. While Route Watch is active, it requests repeated foreground position updates; stopping Route Watch stops that location watcher. The current app does not implement a background-location tracking service.

Current position is held in app memory for these functions. This does not mean all location information is temporary: a submitted event location is sent with its report, saved places can retain coordinates on the device, route requests send origin and destination coordinates, and geocoding can send addresses or coordinates to external services. Provider requests and caches may retain location-related information separately from the live position in memory.

You can decline or revoke location permission through browser or device settings. Available manual area or destination controls can be used without granting device location; features that need current position may be limited. Revoking permission does not erase information already submitted or retained elsewhere.

## 4. Purposes and disclosures

We use information to provide maps, searches, route and condition awareness, publish and update community reports, preserve preferences, associate reports and confirmations, limit duplicate or abusive submissions, troubleshoot the app, and respond to support and privacy correspondence.

Community report content and event locations are shared with other users. A report identifier is not a confidentiality safeguard: reports can contain identifying information, and stored report records include device linkage. Do not treat a community submission as a private message to Gridly.

Service providers process information needed to deliver these functions. We may disclose information when required by law or reasonably necessary to address fraud, abuse, security incidents, or threats to people's rights or safety. These purposes do not authorize unrestricted use of personal information.

One pending reporting operation is stored on the device so interrupted submissions can retry with the same identifier. A terminal server response removes the pending payload. After 24 hours, the next access discards the payload and retains only the operation identifier and initial pending time until the server acknowledges cancellation or prior processing. An inactive or disconnected installation cannot be remotely guaranteed to perform that local cleanup on schedule. The pending record does not store the persistent device identifier.

Under this launch policy, Gridly will not sell personal information or use or share it for targeted advertising. The current app has no advertising placement or targeted-advertising feature. No new commercial sale of condition information is authorized by this policy. Operational sharing with infrastructure and data providers still occurs as described here. No current report dataset is represented here as already anonymous or technically deidentified.

## 5. Infrastructure and external sources

- **Supabase:** Receives community report records and direct feedback submissions and supports shared updates and data delivery. Destination searches can also pass through a Supabase-hosted geocoding service. That service processes search text, structured addresses, geographic context, and request identifiers, and can cache returned addresses and coordinates.
- **Maps, routing, and geocoding:** Depending on the feature and configured source, requests use OpenStreetMap services, Esri/ArcGIS imagery or labels, OSRM routing, and geocoding services. Routing requests include route endpoints; reverse geocoding includes coordinates; map requests identify the viewed tiles or area. Some place searches use packaged data locally; others contact external services. Configured address fallbacks may use Google geocoding or the U.S. Census Bureau. A listed fallback is not a promise that it is enabled for every request.
- **Weather, roadway, and area data:** National Weather Service requests use the selected area's weather point and related forecast or alert resources. DriveTexas requests retrieve roadway conditions; the app filters those results for local relevance. ZIP lookups may send the entered ZIP to Zippopotam.us. Other map/data and content-delivery requests disclose the resource requested and connection information to the receiving service.
- **Email:** Email sent to our published contacts is routed through Cloudflare Email Routing to an owner-managed Gmail inbox. The app's existing email-feedback fallback also sends to an owner-managed Gmail inbox. Your email service, Cloudflare where used, and Google process message content and email metadata to deliver and store correspondence.

External services may keep their own request logs and process information under their applicable policies. Device platforms and app stores can separately collect installation, device, or diagnostic information. This policy does not represent that those services collect nothing or retain information for a particular period.

## 6. Local storage, retention, and deletion

Gridly uses device storage and caches for its persistent device identifier, preferences, saved places, condition history, and other app state. These may remain between sessions. You can manage saved information through available app controls and clear app/site data through your browser or device. Clearing local data may reset your identifier and preferences; it does not delete backend reports, provider records, or email.

Under this launch policy, a community report will remain linked to its app-generated device identifier for no longer than 180 days from its original submission. Gridly will remove that linkage and other reporter-identifying information no later than that deadline. Updating, confirming, clearing, copying, exporting, or restoring a report will not restart its linkage period. A valid deletion request or other applicable requirement may require earlier action.

After that period, Gridly may retain the underlying condition/event information only after removing device linkage and other reporter-identifying information governed by this policy. The permitted purposes are historical condition intelligence, safety analysis, source-quality evaluation, and product improvement—not permanent reporter tracking. Information that cannot be retained without the prohibited reporter linkage will be deleted rather than kept beyond the limit.

Removing device linkage alone does not prove anonymity or technical deidentification. Gridly will not describe de-linked information as anonymous unless the implementation demonstrates that it cannot reasonably be relinked. Condition locations, times, text, identifiers, and combinations of records must be considered in that assessment. This policy does not authorize a new commercial sale or targeted-advertising use.

Report expiration, clearing, or disappearance from the current map is not itself deletion from databases, condition history, caches, exports, or backups. Copies controlled by Gridly must respect the same linkage deadline; restoration must not reintroduce expired linkage. Clearing local data does not recall copies independently retained by other users or external providers. Such copies are not represented as remotely erasable by Gridly.

The owner-review report separately proposes schedules for report content, feedback, correspondence, request records, logs, local information, and backups. Those additional periods are not yet operative and must be resolved before this draft is published. Provider-controlled records are subject to provider practices and applicable obligations; Gridly will not promise a provider deletion period without evidence. Cache freshness or expiry alone does not establish permanent deletion.

## 7. Choices and privacy requests

You can choose whether to submit reports, send feedback, save places, or grant location access. Contact **privacy@gridlygo.com** to ask about access, correction, deletion, or other privacy concerns. Describe the request and enough context to locate relevant records, such as approximate report time and place. Do not initially send passwords, government identification, or unrelated sensitive documents.

Gridly has no consumer account portal or self-service backend deletion tool. For launch, requests received at privacy@gridlygo.com will be logged, acknowledged, and reviewed by the operator. We may ask for information reasonably necessary to verify your authority and locate the relevant records, without disclosing another person's information. You will not be required to create a new account. Knowing a publicly visible report's time or place alone is not proof of ownership. Clearing a device identifier before a request may make association more difficult.

We will review access, correction, and deletion requests, explain the action taken or any lawful reason we cannot fulfill them, and provide instructions for an appeal. Requests to stop consent-based processing or delete associated information may be sent to the same address. You can also revoke device-location permission as described above. Revocation stops the permission-dependent collection; it does not automatically erase prior submissions. A lack of an automated deletion tool does not excuse applicable duties or deadlines.

Depending on your residence and which laws apply to the processing, you may have rights to access or obtain a copy of personal information, correct it, request deletion, or opt out of certain uses. Applicable Texas rights can also include an appeal of a refusal and protection against discrimination for exercising rights. To request review of a response, email privacy@gridlygo.com and identify the response you are appealing. Applicable legal rights, response deadlines, and complaint rights are not limited by this policy or by the absence of a self-service tool. You may contact your state's privacy regulator, including the Texas Attorney General. Not every right applies to every record or circumstance.

## 8. Security

The app uses HTTPS for its configured remote data requests. No network transmission or storage system is completely secure. Do not submit secrets or sensitive information unnecessary for a report or support request. Report suspected unauthorized access or disclosure to privacy@gridlygo.com. This policy is not a security certification or guarantee against loss or unauthorized access.

## 9. Children and minors

Gridly is a general-audience service for users age 16 and older and is not directed to children under 16. People under 16 must not use Gridly or submit personal information through it. The current app does not verify age or provide a parental-consent system. If you believe a child under 16 has supplied personal information, contact privacy@gridlygo.com so the matter can be reviewed and appropriate action taken. An age statement does not remove protections that apply to children's information.

## 10. Changes and contact

Changes to this policy will identify an updated effective date. Material changes will receive notice and any consent required by applicable law before the affected new processing. Updating this document alone does not supply consent to a materially different use of personal information.

Operator: **DJ Burns Collective LLC, doing business as Gridly App**

Product: **Gridly**

Domain: **gridlygo.com**

Privacy: **privacy@gridlygo.com**

Support: **support@gridlygo.com**

Legal: **legal@gridlygo.com**

## Complete revised Terms of Use

# Gridly Terms of Use

> PROPOSED FOR OWNER REVIEW — NOT APPROVED OR PUBLISHED. The effective date below is the owner-selected proposed date; it does not make this draft operative.

**Effective date:** September 8, 2026

## 1. Operator and agreement

These Terms govern your use of Gridly, operated by DJ Burns Collective LLC, doing business as Gridly App ("Gridly," "we," "us"). Our domain is gridlygo.com. By using Gridly after these Terms are made available as the applicable terms, you agree to them. If you do not agree, do not use the service. Our Privacy Policy separately explains information handling; agreement to these Terms is not a substitute for any legally required privacy consent.

## 2. Eligibility and permitted use

You must be at least 16 years old to use Gridly. If you are below the age of legal majority where you live, use Gridly only with a parent or guardian's permission. The minimum product age is not a statement about legal driving age or permission to drive. Gridly does not currently verify age or provide a parental-consent system.

Subject to these Terms and applicable law, you may use the functions made available in Gridly for their intended awareness and reporting purposes. Gridly 1.0 will initially be offered in the United States, with condition coverage focused on Texas. Information and feature coverage vary; United States availability does not mean nationwide condition coverage. A map or search result does not certify service coverage or suitability in a location.

## 3. Gridly Is Not a Government or Emergency Agency

Community reports are not official government information. Gridly may also display information attributed to official or third-party sources, but Gridly itself is not a government, railroad, law-enforcement, emergency-management, transportation, or emergency-response agency.

Information displayed through Gridly may be delayed, incomplete, unavailable, or changed after publication. Official instructions, posted closures, traffic-control devices, emergency alerts, and directions from authorized personnel always take priority over information displayed in Gridly.

Do not use Gridly to request emergency assistance. In a U.S. emergency, call 911 when safe to do so. Follow railroad signals, gates, road closures, posted signs, law-enforcement directions, and other official instructions even if Gridly shows different information.

Do not interact with the app while doing so would distract you from driving or be unsafe or unlawful. Stop safely, use a passenger, or wait until you are no longer operating a vehicle. Never stop in a hazardous location, trespass, enter a closed road, or approach a hazard to submit or verify a report.

## 4. Information and route limitations

Maps, suggested routes, travel estimates, Route Watch, alerts, and community reports can be delayed, incomplete, inaccurate, unavailable, or out of date. A route preview or apparent absence of reports does not establish that a route is safe, legally accessible, unobstructed, or suitable for your vehicle. Conditions can change after a request or report. Weather information is not a guarantee that all hazards have been identified.

Gridly does not guarantee independent review before a report appears. You remain responsible for travel decisions and for consulting official information and conditions when safe.

## 5. Community submissions and prohibited conduct

Submit only content you are entitled to provide, and describe observations honestly without presenting guesses as verified facts. Do not submit false, fraudulent, threatening, discriminatory, abusive, unlawful, spam, privacy-invasive, or otherwise unsafe content. Do not include another person's sensitive information, impersonate an authority or another user, manipulate confirmations, or knowingly misrepresent a report's location or status.

Do not attempt unauthorized access, interfere with the service or its security, introduce malicious code, evade abuse controls, or extract or redistribute data in violation of applicable law or third-party licenses. These restrictions do not prohibit conduct that applicable law expressly protects.

You retain any rights you have in your submissions. By submitting content, you give Gridly a nonexclusive, royalty-free permission to host, store, reproduce, format, display, and distribute it, and to allow service providers to do those things on our behalf, only as reasonably needed to operate community reporting, condition history, safety review, and support. This permission is not a transfer of ownership, permission to sell your personal information, or an unlimited right to use your content for unrelated advertising. Information remains subject to the Privacy Policy and applicable deletion and other rights.

This permission does not extend a community report's device-linkage period beyond the Privacy Policy's maximum of 180 days from original submission. Any later retention of condition information must meet that policy's removal requirements and permitted historical purposes; it is not permission for permanent reporter tracking, a new commercial sale, or targeted advertising.

We may review or restrict submissions and remove or limit content that violates these Terms or creates safety, privacy, or legal concerns. This does not promise continuous moderation or a particular response time. Contact support@gridlygo.com to report misuse and privacy@gridlygo.com for privacy or personal-data requests. Content disappearing from the map does not mean every database record or backup has been deleted.

## 6. Intellectual property and third-party services

Gridly's software, branding, and original content belong to their respective rights holders. Using Gridly does not transfer ownership of those materials. Third-party software and datasets remain subject to their own applicable licenses, attribution notices, and rights; these Terms do not override those licenses.

Map, imagery, routing, weather, roadway, address, and place information may come from external sources. Source names, business names, and trademarks do not imply endorsement or affiliation. Applicable source attributions and license notices accompany the relevant data or presentation. Links and external services may have their own terms and privacy practices and may change or become unavailable.

## 7. Availability, changes, and ending use

Network conditions, device settings, permissions, maintenance, source outages, and other limitations can affect the service. We may change, suspend, or discontinue functions, or restrict misuse, subject to applicable law and any separately applicable purchase commitments. This does not promise uninterrupted availability, continuing coverage, or a particular future feature.

You may stop using Gridly at any time. Stopping use or uninstalling the app does not itself delete information held by us or other providers. See the Privacy Policy for controls and requests. No provision here authorizes retaining information contrary to applicable law.

## 8. Disclaimers and responsibility

To the extent permitted by applicable law, Gridly and its information are provided "as is" and "as available," without a promise of uninterrupted service, accuracy, completeness, fitness for a particular travel decision, or freedom from error. These limitations do not exclude warranties or consumer protections that cannot lawfully be excluded.

You are responsible for your own conduct and travel decisions. To the extent permitted by applicable law, Gridly is not responsible for losses caused by your unlawful or unsafe use of the service or your disregard of official instructions. Nothing in these Terms excludes or limits liability to the extent it cannot lawfully be excluded or limited, including liability arising from conduct for which such a limitation is prohibited. These Terms do not impose a monetary liability cap, an indemnification obligation, or a waiver of statutory remedies.

## 9. Future paid offerings

The current app does not offer a subscription purchase flow. These Terms do not start a subscription, authorize a charge, or promise that a future offering will be free. If a paid offering is introduced, applicable purchase terms will be presented before purchase. No price, billing interval, renewal, cancellation, trial, refund, or platform-specific purchase terms are established by this section.

## 10. Governing law and disputes

These Terms are governed by Texas law, except where applicable law requires otherwise or provides protections that cannot be displaced by this choice. No exclusive court or venue is selected. These Terms do not require arbitration or waive class proceedings, a jury trial, or other rights available under applicable law.

## 11. Changes and contact

Updates will identify a revised effective date. Material changes will receive notice before they apply, and any acceptance required by applicable law will be obtained. A change to these Terms does not retroactively authorize a charge or supply consent for a new use of personal information.

Operator: **DJ Burns Collective LLC, doing business as Gridly App**

Product: **Gridly**

Domain: **gridlygo.com**

Support and misuse reports: **support@gridlygo.com**

Privacy requests: **privacy@gridlygo.com**

Questions about these Terms: **legal@gridlygo.com**
