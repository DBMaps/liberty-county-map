# Phase 28 final regression matrix

| Phase | Tests | Pass | Known historical failure |
|---|---:|---:|---:|
| 21 | 10 | 10 | 0 |
| 22 | 15 | 15 | 0 |
| 23 | 11 | 11 | 0 |
| 24 | 14 | 14 | 0 |
| 25 | 4 | 3 | 1 |
| 26 | 5 | 5 | 0 |
| 27 frozen contracts | 2 | 2 | 0 |
| 28 | 23 | 23 | 0 |

84 tests; 83 pass; 1 known historical Phase 25 hash failure; 0 new regressions; 0 unexplained failures; 0 skipped. Phase 27 uses two explicit frozen-contract checks because no standalone Phase 27 runner exists. Real-Auth runtime suites contain additional individually asserted vectors; those are not inflated into Node test counts.

Security catalog: schemas=4, tables=36, views=3, functions=92, rlsPolicies=20, roles=5, permissions=29, capabilities=5, enumTypes=27, commands=40. Fingerprint: cbfefacd1cf7470131227d65a393c3e7444ca505e6a29c60b1bbaf04c64ded35.

Compared with Phase 26: tables 22→36, functions 64→92, policies 17→20, enum types 23→27, commands 26→40, permissions 26→29. Four schemas, three views, five role templates and five capability keys remain. The unused legacy view is replaced by the separate internal-share projection. Added tables implement units, sharing, governed pilot state, scoped identity conversion and bound approval/offboarding evidence. The dedicated command-owner database role is additional to the five application role templates. No role gains implicit police authority.

Local installation, rollback/reapply, evidence-bearing rollback refusal, postflight ACL/RLS/definer checks and teardown passed. Only Phase 28 paths changed; historical artifacts and consumer/public-site code remain untouched.
