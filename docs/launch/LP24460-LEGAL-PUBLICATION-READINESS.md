# LP244.60 — Legal / publication readiness

Date: 2026-09-26. Branch: `LP244.60-legal-publication-readiness`. Starting/main reference: `093d79316a54cd2030648cc119fb4931ab32af49`. Initial working tree clean.

**Current owner clarification:** 18+ is authoritative; historical 16+ records are superseded and need not be rewritten. Reporting is required for launch and intentionally disabled now. The launch sequence is legal/publication closure → remaining operator/candidate/store gates → separately authorized production reporting activation → launch. Disabled admission itself is not a legal/publication defect; public availability copy must remain truthful while launch policy covers the future enabled feature.

## Decision

**Legal text and owner publication approval CLOSED / PASS; LP244.60 overall remains OPEN / NO-GO pending live served-page, mailbox/operator and store configuration evidence.** Existing static website routes provide the publication path; no new infrastructure is needed. This audit prepares publication and repairs a misleading omission in homepage copy. It does not publish, activate reporting, certify legal compliance or establish that live services are down.

Production reporting remains OFF by task requirement and the latest recorded LP244.58 observation (`reporting_enabled=false`, protocol 2, guard consumed/unlaunched). This expected disabled state is not the reason for legal/publication NO-GO. LP244.60 did not query or change production admission. LP244.58 cleanup alerting and LP244.54 physical acceptance remain CLOSED/PASS; historical LP244.22 reset/repair must not be replayed.

## Authoritative files and status

| Document/surface | Authority and publication readiness |
|---|---|
| [Privacy Policy](../LEGAL/GRIDLY-PRIVACY-POLICY.md) | Current complete publication candidate; effective date September 17, 2026. Full text mirrored in `public-site/privacy/index.html`; source parity protected by existing tests. Final approval/operative date and live served text remain unverified. |
| [Terms of Use](../LEGAL/GRIDLY-TERMS-OF-USE.md) | Current complete publication candidate; effective date September 17, 2026; community acceptance version `gridly-ugc-2026-09-17-v2`. Full public mirror under `/terms`. Not proof of final legal approval or publication. |
| [Community Guidelines](../LEGAL/GRIDLY-COMMUNITY-GUIDELINES.md) | Current reporting terms candidate; same effective date and acceptance version. Full public mirror under `/community-guidelines`; explicit Terms/Guidelines acceptance implemented in `js/gridly-ugc-compliance.js`. |
| [Community-report disclaimer](../LEGAL/GRIDLY-COMMUNITY-REPORTING-DISCLAIMER.md) | Approved policy position retained. Standalone source now has effective date September 17, 2026 and no separate acceptance version and no standalone public route. Its core safety/authority limitations are incorporated into Terms and Guidelines; do not fabricate a disclaimer URL. Owner must confirm this incorporated placement is sufficient before publication; standalone public publication would require a separately agreed route. |
| `legal/privacy.html`, `legal/terms.html`, `legal/community-guidelines.html` | Current abbreviated bundled in-app documents, dated September 17, 2026 and 18+. They are not the complete canonical public policies. App module links these local files; no native/app behavior changed. Owner must approve abbreviated disclosures alongside full canonical text. |
| `public-site/delete-data/index.html`, `public-site/support/index.html` | Static request/support pages with working source links and contact instructions. They are not newly established policies needing an invented effective date. Live routes/mailbox handling remain unverified. |
| `legal/drafts/privacy-policy.md`, `legal/drafts/terms-of-service.md` | Explicitly unapproved historical drafts with deferred dates and stale implementation/payment statements; not publication inputs. Do not copy their claims of absent deletion infrastructure into current policy. |
| [LP244.21 policy-owner review](../LEGAL/LP24421-POLICY-OWNER-REVIEW.md) | Historical September 8 proposals and copied 16+ text, not current public policy. Does not establish approval of September 17 texts. |
| Store metadata/checklists under `docs/STORE/` | Planning material, not proof of live legal links or actual store-console entries. Community-report capability descriptions are prospective launch claims, not evidence that reporting is currently enabled. |

No bracketed approval/date placeholder was found in the current complete Privacy/Terms/Guidelines publication candidates. Dates in source are candidate dates, not evidence of when users were actually notified or accepted terms. Do not silently backdate an operative publication.

## Policy reconciliation

### Age

The request's prior 16+ baseline is superseded by tracked evidence: commit `00c89dac4ef699d59a798360fcffc311c2c69bc3` (September 17), **Add Play data deletion page and align 18+ policy**; LP244.36 explicitly records LP244.34A 18+ alignment in certified lineage; LP244.38 records the approved adults-18-and-over launch posture. Current complete policies, bundled pages, public legal pages and homepage consistently use **18+** and the Google-determined-minor restriction. Existing age contract passes. Preserve 18+; changing back to 16+ would require a new owner decision and consistency review. Historical 16+ review snapshots remain historical.

### Geography and product authority

Privacy/Terms state initial United States offering with Texas-focused condition coverage; no nationwide-condition coverage promise. Homepage emphasizes Texas. Community reporting remains required for the eventual launch, while availability before release remains disabled.

Terms section 3 disclaims government, railroad, law-enforcement, emergency-management, transportation and emergency-response authority. Official instructions take priority; U.S. emergencies use 911 when safe. Terms/Guidelines forbid unsafe driving interaction. Route previews and apparent absence of reports do not prove safety, accessibility or completeness. Bundled Terms explicitly disclaim navigation-safety/dispatch service; homepage states awareness, not authority and does not replace navigation services. Store metadata says awareness, not turn-by-turn navigation. No emergency/government/dispatch/safety-authority service claim was identified in these launch policy surfaces.

### Retention, deletion and rights

Current complete policies, public deletion page and bundled summary reconcile day-149 report cleanup with the **180-day original-submission linkage ceiling**, without restarting clocks on edits, confirmations, copies, exports, restores or moderation. Complaint/deletion linkages clear by day 149; completed deletion requests use a no-more-than-90-day completion window; suppressions remain bounded by the source deadline/180 days. Replay digests and permitted monthly aggregate counts are distinguished from reporter linkage; de-linking is not represented as proof of anonymity.

Privacy explains precise foreground location, provider requests, saved coordinates and local pending payload limits. Privacy/deletion pages distinguish local hiding, local data clearing, shared deletion, provider records and backups. No provider erasure schedule is invented. Backups/logs/controlled copies and operator procedures still need owner operational evidence; LP244.58 healthy live cleanup does not certify every retained copy.

There is no consumer account registration portal. Instructions include **Delete mine**, Settings → Support → Privacy & deletion and `privacy@gridlygo.com`; approximate report time/place helps locate records but does not prove ownership. No initial passwords/government ID requested. Appeals and applicable legal rights are not limited by the policy. Support/legal contacts are `support@gridlygo.com` and `legal@gridlygo.com`. Presence of mailto links does not prove mailbox routing, staffing or request processing; owner must verify those.

### Reporting-disabled truthfulness and bounded repair

The homepage previously invited users to see community reports and help keep information current without a disabled-state statement. LP244.38's older readiness text described a notice no longer present in the current redesign. Added adjacent copy: **“Community reporting is currently disabled and is not activated for public use.”** The existing homepage contract now asserts that sentence. No reporting runtime, protocol, retention deadline, policy position or native asset changed. Existing policy descriptions of reporting describe the service contract; this visible availability notice prevents interpreting them as current activation evidence.

## Publication path and canonical store references

The existing `public-site/` static bundle contains the full public policies; `_redirects` maps the clean routes to their `index.html` files. Root canonical is `https://gridlygo.com/`. Source uses no login, JavaScript, form, storage or location runtime. Static metadata, viewport, local assets, responsive stylesheet and reduced-motion handling are tested. These are source readiness facts, not a visual certification of a live mobile deployment.

| Use | Established canonical URL | Source |
|---|---|---|
| Privacy Policy | https://gridlygo.com/privacy | `public-site/privacy/index.html` |
| Terms / proposed terms reference | https://gridlygo.com/terms | `public-site/terms/index.html` |
| Reporting terms / Guidelines | https://gridlygo.com/community-guidelines | `public-site/community-guidelines/index.html` |
| Support | https://gridlygo.com/support | `public-site/support/index.html` |
| Data deletion instructions | https://gridlygo.com/delete-data | `public-site/delete-data/index.html` |

Homepage footer links all five routes; public policies/support link the appropriate related routes and mailboxes. No new `/disclaimer` or account-deletion route is invented. Terms are not represented as an approved custom Apple EULA; standard versus custom EULA selection and actual store-console entries require owner confirmation.

Publication target is the existing Cloudflare public website resource `gridly-public`, identified in [production services inventory](GRIDLY-PRODUCTION-SERVICES-INVENTORY.md). `gridly-preview` and `gridly-cleanup-alert-production` are distinct resources and are not publication targets here. Repository documentation does not establish a currently authorized automatic deploy workflow/account configuration, so **no external deployment was performed**.

## Live reachability evidence and limitations

On September 26, 2026, web-tool HTTPS reads of the five legal/support routes returned “not accessible via this tool.” A second bounded PowerShell HTTPS attempt for root and all five routes returned `HttpRequestException` without retrieved content. No HTTP status/body was available to establish publication, served-text parity, redirects, mobile layout or anonymous access. This is an access limitation, not a proven website outage. File existence and source tests cannot close the live publication gate.

## Exact owner/external actions remaining

1. Approve the complete current Privacy/Terms/Guidelines texts, the 18+ superseding posture, incorporated reporting disclaimer placement and abbreviated in-app copies. Confirm operative date/version treatment; if a new date/text is selected, synchronize source/public copies and obtain required acceptance rather than backdating.
2. In the existing Cloudflare account, select **gridly-public** and confirm its existing website deployment configuration serves `public-site/` at `gridlygo.com`. Publish the reviewed static bundle through that established workflow after owner approval. Do not change DNS, preview, alert Worker or application infrastructure as part of this step. Exact dashboard deployment mode/permissions must be confirmed by the owner; none is invented here.
3. From a logged-out browser/network that can reach the site, open root and each URL in the table over HTTPS. Record UTC time, deployment identity, status/final URL and served text/date/version. Confirm no authentication prompt, valid TLS, all footer links, mobile portrait readability and the disabled reporting notice. Compare complete served legal text with the approved source.
4. Verify support/privacy/legal mailbox routing and named operator handling, including receipt, verification, deletion/appeal procedure and response ownership. This phase does not send email or test a real deletion request.
5. Enter the verified canonical URLs into the applicable store fields; confirm standard/custom EULA decision, data-deletion URL placement and truthful review notes explaining reporting is currently disabled pending owner release. Do not submit prospective reporting capability copy as a claim of current activation.
6. Record approval/publication/mailbox/store evidence here. Only then reconsider legal/publication GO. Remaining backup/recovery/operator and final release gates stay separate; enabling reporting requires separate owner authorization and a fresh checkpoint.

## Bounded verification

- Passed **25/25** existing tests: `lp24434-public-legal-site.test.mjs`, `lp24438-apple-organization-website-readiness.test.mjs`, `lp24433-google-play-compliance.test.cjs`. Covers full public policy/source parity, route/assets, contacts, deletion/retention copy, age, static responsive hooks and acceptance/moderation/deletion UI contracts. Rerun after repair includes disabled-notice assertion.
- Attempted retention and reporting availability suites: `lp24421-report-retention.test.cjs`, `lp24429a-reporting-availability.test.cjs`. Could not execute assertions because disposable PostgreSQL fixture at `127.0.0.1:55441` refused connections. These are fixture prerequisite failures, not reported as passes or proof of a source defect. No production connection used and no DB fixture setup/native build performed.
- Public anonymous live reachability/served parity: **UNVERIFIED**, as above. No external publication or native/device acceptance test performed.
- Final `git diff --check` and staged scope check required before the local commit. Intended scope: this report, one homepage notice and its existing regression assertion. No secret values or private account credentials added.

Commit classification: **Prepare legal publication readiness**. Legal/publication NO-GO until the listed owner/external actions are evidenced; reporting remains disabled and not authorized for activation.

## Owner subscription correction — September 26, 2026

Current authoritative launch model: **$2.99/month through Apple App Store / Google Play**, beginning with subscription during initial download/setup. Store billing/renewal/cancellation rules apply; no refund guarantee, trial, annual plan, grace period or direct web billing is invented. Privacy explains store processing, no full payment-card custody by Gridly, and conditional entitlement/status/transaction metadata without claiming receipt of specific unverified fields. This supersedes the earlier no-purchase/future-paid wording. Complete Markdown/public mirrors, bundled Privacy/Terms summaries and normative store metadata were repaired. Historical drafts/audits remain unchanged. Disclaimer effective date now matches September 17, 2026.

These are launch publication candidates; monetization implementation, entitlement metadata actually received, store subscription products/price and purchase disclosures still require owner verification. No billing integration or native behavior was implemented. 18+, retention/privacy safeguards, authority disclaimers and reporting-disabled notice remain unchanged. Reporting is expected OFF now and required ON by separately authorized release before public launch. Publication status remains NO-GO pending final text/date approval, existing-site publication/served-text proof, mailbox handling and applicable store/candidate gates. No deployment or production mutation performed.

Store-rule cross-checks: [Apple cancellation](https://support.apple.com/en-us/118428), [Apple refunds](https://support.apple.com/en-us/118223), [Google Play refunds](https://support.google.com/googleplay/answer/15574908?hl=en). No platform-specific refund or cancellation timing is promised.

Subscription correction verification: 25/25 bounded legal/public-site/compliance tests PASS; additional in-memory assertions PASS for price/store/cancellation wording in all Terms copies, card-data boundary and conditional metadata in all Privacy copies, disclaimer date and unchanged reporting-disabled notice. Targeted current/normative contradiction search returned no matches. Exact full-policy replacement comparison proved all unrelated text unchanged. git diff --check PASS. No runtime/native/billing/production file changed.

## Owner legal publication approval — September 26, 2026

This current decision supersedes earlier approval-pending statements in this report. Earlier audit observations remain chronology; historical records and approved policy bodies were not rewritten. Approved repository versions are those at `01cea4bc2ad2c50d1552e19b916fc13ea6a111f0`, with September 17, 2026 effective dates. Approval recording does not backdate evidence of actual publication or acceptance.

### Exact owner approval statement

> I approve the September 17, 2026 Gridly Privacy Policy, Terms of Use, Community Guidelines, and Community Reporting Disclaimer as the launch publication texts, including the current 18+ policy and the $2.99/month App Store / Google Play subscription model.
>
> Community reporting is intentionally disabled during launch preparation and is required to be enabled through a separately authorized production release before public launch.
>
> These texts are approved for publication and app-store use, subject to verification that the served public pages match the approved repository versions.

Approved document set: `docs/LEGAL/GRIDLY-PRIVACY-POLICY.md`, `docs/LEGAL/GRIDLY-TERMS-OF-USE.md`, `docs/LEGAL/GRIDLY-COMMUNITY-GUIDELINES.md`, `docs/LEGAL/GRIDLY-COMMUNITY-REPORTING-DISCLAIMER.md`.

Approved positions: **18+**; initial US offering with Texas-focused coverage; awareness rather than government/emergency/railroad/law-enforcement/transportation/authoritative safety service; reporting required at launch but intentionally disabled during preparation; day-149 cleanup target and maximum 180-day original-submission device-linkage ceiling; documented deletion/privacy rights and moderation safeguards; **$2.99/month through Apple App Store or Google Play**. No free tier, trial, annual plan, direct web checkout or alternative billing model approved. Apple/Google process payments; Gridly does not receive/store full payment-card details.

### Current gate classification

| Gate | Status |
|---|---|
| Legal text content | CLOSED / PASS |
| Owner publication approval | CLOSED / PASS |
| Live served-page verification | PENDING |
| Mailbox/operator handling | PENDING |
| Store subscription/entitlement configuration | PENDING |
| LP244.60 overall | OPEN / NO-GO; not CLOSED |
| Production reporting | REMAINS DISABLED; separate authorization required before public launch |
| LP244.54 | REMAINS CLOSED / PASS |
| LP244.22 historical reset/repair | DO NOT REPLAY |

### Exact remaining verification plan

| Public URL | Required evidence |
|---|---|
| https://gridlygo.com/privacy | Anonymous HTTPS availability, mobile readability and served complete text/effective date matching approved `docs/LEGAL/GRIDLY-PRIVACY-POLICY.md` and `public-site/privacy/index.html`. |
| https://gridlygo.com/terms | Same verification against approved `docs/LEGAL/GRIDLY-TERMS-OF-USE.md` and `public-site/terms/index.html`, including subscription section. |
| https://gridlygo.com/community-guidelines | Same verification against approved `docs/LEGAL/GRIDLY-COMMUNITY-GUIDELINES.md` and `public-site/community-guidelines/index.html`, including acceptance version. |
| https://gridlygo.com/delete-data | Anonymous HTTPS availability, mobile readability and current deletion/contact/action instructions. |
| https://gridlygo.com/support | Anonymous HTTPS availability, mobile readability and current contact/action instructions. |

Record UTC observation, deployment identity/final URL and served-text comparison. Confirm root/footer legal links and the current reporting-disabled notice. Use the existing public website workflow if approved pages are not yet served; this approval-recording task performs no deployment. Failed retrieval tools are not proof of an unpublished/down site. No new live verification success is claimed here.

Owner-operational verification remains required for **privacy@gridlygo.com**, **support@gridlygo.com** and **legal@gridlygo.com**: establish routing to an owner-monitored inbox, assigned responsibility and ability to act on privacy/deletion/appeal/support/legal correspondence. No test messages sent; any message-based test requires separate owner authorization.

Confirm Apple/Google subscription products, $2.99 monthly price, purchase disclosures, entitlement/status processing, applicable cancellation/refund configuration and actual legal/support/deletion store fields. Approval of the model is not evidence that billing/entitlement implementation is complete. Preserve sequence: legal/publication closure → remaining operator/candidate/store gates → separately authorized production reporting activation → launch.

### Approval-recording checks

25/25 existing bounded public-site/legal/compliance tests PASS. Additional subscription-copy, card-data, conditional-metadata, 18+, disclaimer-date and reporting-disabled source assertions PASS. Route/assets/source parity are covered by the public-site suite. Only this readiness report changed during approval recording; approved policy texts, public pages, runtime, retention and native behavior unchanged. `git diff --check` required before commit. No deployment, email send, production mutation, reporting activation, native/device tests, push or merge.
## Owner-observed live pages and deployment boundary — September 26, 2026

Owner independently checked the five public routes in a browser. This supersedes the earlier absence of live observations, without claiming a new independent Codex retrieval or full byte/text comparison:

| Route | Current owner-observed result |
|---|---|
| `/privacy` | OUTDATED: still says the current application does not provide payment/subscription checkout. |
| `/terms` | OUTDATED: still has “Future paid offerings” and no subscription purchase flow. |
| `/community-guidelines` | PASS as currently served, per owner. |
| `/delete-data` | PASS as currently served, per owner. |
| `/support` | PASS as currently served, per owner. |

Approved corrected files are `public-site/privacy/index.html` and `public-site/terms/index.html`, matching the complete approved policy sources. Their subscription language is already correct; no new content repair is needed. Privacy must replace the stale checkout assertion with store processing, no full-card custody and conditional entitlement/status/transaction metadata. Terms must replace future-paid/no-purchase wording with $2.99/month store subscription, start-at-subscription, renewal/cancellation/access/refund/store-law terms. The three good routes must remain content-identical through any shared publication.

### Deployment mechanism findings

- Existing public host target `gridly-public` and `gridlygo.com` are owner-confirmed in LP244.59/services inventory; exact hosting product mode, production branch, build/output mapping and deployed artifact identity are not established in tracked production evidence.
- `public-site/_redirects` maps the existing legal clean routes to their static index files. No new route or infrastructure is needed.
- `.github/workflows/` contains Capacitor validation, not a public website publisher. `package.json` does not supply a proven `gridly-public` deployment command.
- LP244.38 records source readiness and expressly says no deployment was performed. LP183 Direct Upload commands/configuration target `gridly-preview`; they do not authorize or establish `gridly-public` deployment behavior. The cleanup Worker Wrangler configuration is unrelated.
- Therefore automatic deployment from main/this branch versus explicit upload/workflow is **NOT ESTABLISHED**. A full branch or directory upload cannot be assumed to preserve every other currently served file. No deployment command was run, no artifact uploaded, no credentials requested and no website/runtime/production change made.

**STOP at the owner/dashboard boundary required by this task.** Do not guess a Pages upload command, push/merge the branch, use preview settings or redeploy the whole site without proving scope.

### Exact owner action needed

1. Open Cloudflare dashboard → **Workers & Pages** → the existing **gridly-public** resource. Confirm its custom domain is `gridlygo.com` and its actual product/deployment type. Inspect **Settings / Builds & deployments** (if present) and the current production deployment. Report non-secret configuration only: Git integration versus Direct Upload, linked repository if any, production branch, root directory, build command, output directory and active deployment identifier. Do not paste credentials.
2. If Git-connected, establish whether deploying a reviewed commit will publish only the approved legal change or unrelated changes. Do not change branch mappings or trigger/push/merge until that scope is reviewed. If Direct Upload, identify the existing owner upload workflow and retain its current full deployed artifact; partial-directory upload must not be assumed to patch only two files.
3. Supply/confirm the existing deployment method and preservation evidence. The safe publication candidate must replace only `privacy/index.html` and `terms/index.html` within that established artifact, preserving other site content, assets, headers and routes. A shared publication is acceptable only after no-content-change parity of the other served files is proven. If the existing workflow cannot provide this preservation, report it rather than improvising.
4. After publication through the established reviewed workflow, open the five exact canonical URLs in the earlier table anonymously. For Privacy/Terms compare complete served text and September 17 date against approved source, not keywords alone. Confirm stale phrases gone, $2.99/month and Apple/Google handling present, and all three previously-good routes still correct. Record UTC/deployment evidence and mobile readability. Root reporting-disabled truthfulness remains required; do not enable reporting.

### Current result

Legal text and publication approval remain CLOSED/PASS. Live served-page verification remains PENDING with two known stale pages; the three good routes have owner-observed PASS. Mailbox/operator and store subscription/entitlement verification remain PENDING. LP244.60 remains OPEN / NO-GO. Reporting remains expected disabled by authorization boundary and latest recorded state; no Supabase status query or write was performed. No app-store subscription configuration changed. Only this report changes; no files published. This update records bounded source/workflow inspection and owner observations, not a successful deployment certification.