# Gridly Google Play Compliance Closure

**Milestone:** LP244.33

**Prepared:** September 16, 2026

**Scope:** Local implementation and certification only

## Closure summary

This package closes the locally solvable Google Play UGC, legal-access, moderation, and deletion gaps without enabling production reporting or changing the existing fail-closed admission state.

| Control | Local implementation | Production dependency |
|---|---|---|
| Terms before UGC | Versioned, explicit checkbox acceptance before `create`; acceptance stored locally; version change requires reacceptance | Owner approves final copy and ships the matching app assets |
| Community Guidelines | Full bundled document plus concise pre-submit summary | Owner legal/content approval |
| Report / Hide | Complaint RPC and device-local hide on public community reports | Apply migration and deploy assets |
| Source blocking | Moderator-only suppression using a private one-way device digest | Owner moderation staffing and migration deployment |
| Moderation operations | Private complaint queue, action log, quarantine/remove/suppress operations | Owner credentials, schedule, escalation ownership |
| Deletion | Device-possession-verified request and owner completion workflow | Owner request handling and production deployment |
| Legal access | Privacy, Terms, and Guidelines in Settings and reporting flow, bundled for native/offline use | Owner approval/publication |
| Review state | Reporting remains disabled; UI explains that paused reporting queues nothing | Play Console review and owner activation decision |

## Safety decisions

- No stable source identifier is added to the public report projection. End-user “block source” would create correlation and tracking risk in the no-account product. Per-report Hide is immediate and local; repeated abuse is handled by private moderator source suppression.
- A rejected or cancelled terms prompt occurs before the protocol client begins a new operation. It cannot create a pending submission.
- Existing pending retry/cancellation semantics are unchanged and do not demand a second consent during recovery.
- Moderation does not extend report retention. Reports remain scheduled for deletion at day 149 and no linkage may survive day 180.
- Production reporting stays disabled. This package contains no deployment, release, Play upload, or activation action.

## Implementation inventory

- Browser control: `js/gridly-ugc-compliance.js`
- Legal runtime pages: `legal/privacy.html`, `legal/terms.html`, `legal/community-guidelines.html`
- Final-draft sources: `docs/LEGAL/GRIDLY-PRIVACY-POLICY.md`, `docs/LEGAL/GRIDLY-TERMS-OF-USE.md`, `docs/LEGAL/GRIDLY-COMMUNITY-GUIDELINES.md`
- Database change: `supabase/migrations/20260916183911_google_play_compliance_closure.sql`
- Operations: moderation and deletion runbooks in this directory
- Certification: LP244.33 application tests and disposable PostgreSQL tests

## Release gates

Before owner activation, all of the following must be true: legal approval recorded; hosted policy URLs published; migration applied and certified in a non-production environment; moderator and privacy-request owners named; cleanup scheduled and monitored; current native assets released; Play declarations/review notes updated; store listing policy URL matches the approved copy; and reporting remains disabled until the owner explicitly completes postflight.

## Local versus owner-controlled status

Local engineering can prove source behavior, migration behavior in disposable PostgreSQL, native packaging, and regression results. It cannot prove production deployment, backup/log expiry, external provider behavior, legal approval, Google Play review acceptance, staffing, or a production endpoint state. Those remain owner actions and are not represented as complete by this document.
