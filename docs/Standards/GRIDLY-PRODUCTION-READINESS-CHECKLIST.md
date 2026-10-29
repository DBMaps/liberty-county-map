# GRIDLY Production Readiness Checklist

## Git

- [ ] Working tree clean
- [ ] Correct branch
- [ ] Latest changes pushed

---

## Runtime

- [ ] Runtime Validation PASS
- [ ] Smoke Test PASS
- [ ] No JavaScript errors
- [ ] No missing assets

---

## Data

- [ ] Community Packages validated
- [ ] Crossing Packages validated
- [ ] Production manifests validated

---

## Application

- [ ] Search works
- [ ] Reporting works
- [ ] Alerts work
- [ ] Crossings render
- [ ] Community Pulse works

---

## Documentation

- [ ] Certification created
- [ ] Release Notes created
- [ ] Handoff created

---

## Final Decision

- [ ] READY TO SHIP

or

- [ ] BLOCKED

## LP244.65 — Paid-access continuity foundation status

2026-09-27 LP244.65J: **CLOSED / PASS**. Android native continuity A–H PASS; iOS signed simulator A–F/H PASS. iOS Case G was not separately runtime-induced because that would require a Mac host reboot; implementation and focused contract coverage remain in place. See [bounded certification evidence](../launch/LP24465C-NATIVE-CONTINUITY-CERTIFICATION.md#lp24465j--paid-access-continuity-foundation-closure). This status closes only the continuity foundation. Existing readiness checkboxes are unchanged; real purchase/restore, production verifier/provider/acknowledgment operations, store/candidate/release gates and separately authorized reporting activation remain open. No ship, merge or deployment authorization is implied.

## Future Development — Supabase Data API Table Grants (effective 2026-10-30)

**Status:** Pending future migration compatibility review. Existing production tables keep their current access; this is not a current release blocker.

- [ ] Audit migrations and tooling that create or recreate new tables in the `public` schema, including preview branches, new projects, and local resets.
- [ ] Identify which new tables actually require Data API access through `supabase-js`, PostgREST, or GraphQL; leave internal tables unexposed.
- [ ] Add only the required role-specific, least-privilege `GRANT` statements in the same migration as table creation; include required sequence privileges when applicable.
- [ ] Verify RLS and appropriate policies for any exposed tables, preserving Gridly reporting controls. Never blindly grant public roles full CRUD access or expose service-role credentials.
- [ ] Test a clean schema rebuild and expected API operations for applicable roles; detect SQLSTATE `42501` / permission-denied errors.
- [ ] Obtain separate authorization before touching production schema or existing grants; document audit results and testing evidence.

Reference: https://github.com/orgs/supabase/discussions/45329
Owner policy: Audit first, patch second. No production database change is authorized by this checklist entry.
