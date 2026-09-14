# Responder / Agency V1 owner decision register

Contract version: `responder.agency.v1.phase0.1`. `APPROVED` means explicitly supplied in the Phase 0 owner brief and frozen here. `PROVISIONAL` is a planning value that cannot become live policy without a later decision. `DEFERRED` is excluded from V1 or has an unresolved operational prerequisite. This artifact does not record a production or publication approval.

| Decision | State | Frozen value or next requirement | Gate |
| --- | --- | --- | --- |
| One active org per responder | APPROVED | One in V1; schema may allow future multi-org without granting it | Phase 1 |
| Role names and separation | APPROVED | VIEWER, RESPONDER, SUPERVISOR, AGENCY_ADMIN; GRIDLY_ADMIN platform-only | Phase 1 |
| Responder MFA | APPROVED | Authenticator-app TOTP/`aal2` for dashboard and agency mutation | Phase 2 |
| County-first pilot | APPROVED | One county-level agency; no named agency selected | Phase 3/11 |
| Two-person `road_closed` | APPROVED | Immutable draft author Auth ID != approving Supervisor/Admin Auth ID | Phase 5/8 |
| Non-closure review | APPROVED | Supervisor/Admin approval before public activation | Phase 5/8 |
| Condition vocabulary | APPROVED | road_closed, high_water, obstruction, construction, public_works_notice | Phase 5 |
| Expiry | APPROVED | 12h default, 24h maximum; later category policy separate | Phase 5 |
| Agency gate | APPROVED | `agency_publishing_enabled=false`, independent of community gate | Phase 1/5 |
| Public wording | APPROVED | “Verified Agency”; “Agency update”; no Gridly condition confirmation | Phase 9 |
| Responder identity privacy | APPROVED | Organization public; individual employee/Auth identity private | Phase 9 |
| Municipal/district publishing | APPROVED | Closed until full certified polygons; PLACE points/memberships forbidden | Future phase |
| Pilot user cap | PROVISIONAL | 2–6 users | Owner pilot gate |
| Pilot active-post cap | PROVISIONAL | 10 active updates | Owner pilot gate |
| Invite expiry | PROVISIONAL | 7 days | Owner Auth/onboarding gate |
| Resolved/update event retention | PROVISIONAL | 3 years, subject to legal/owner schedule | Before live retention |
| Governance/membership history retention | PROVISIONAL | 7 years, subject to legal/owner schedule | Before live retention |
| Exact pilot agency | DEFERRED | Select and independently verify one county-level agency | Pilot gate |
| County geometry runtime activation | DEFERRED | Current source manifest permits package generation, not runtime deployment; separately approve agency authority use | Phase 3 release |
| Municipality geometry source | DEFERRED | Govern complete polygon and overlaps; no point proxy | Before municipal V2 |
| Production SMTP path | DEFERRED | Verify existing approved SMTP or owner-approve tightly bounded manual pilot onboarding; default Supabase SMTP is unsuitable | Before live invitations |
| Future SSO | DEFERRED | Optional, not V1 dependency | V2 |
| Multi-org memberships / mutual aid | DEFERRED | New acting-context and temporary authority contract | V2 |
| Roadway-segment authority | DEFERRED | Separately governed road geometry and overlap rules | V2 |
| Shelter/evacuation taxonomy | DEFERRED | Separate safety, policy, and source review | V2 |
| Consumer launch and DNS | DEFERRED | Separate owner approval after pilot/security acceptance | Phase 9/11 |

The owner's approved publication defaults do **not** override the existing county geometry manifest's `activateRuntimeAuthorized=false` / `deployAuthorized=false` flags. Phase 0 freezes a proposed source and negative test boundary; it does not certify a live authority grant.
