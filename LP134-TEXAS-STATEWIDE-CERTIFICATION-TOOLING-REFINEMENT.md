# LP134 — Texas statewide certification tooling refinement

## Scope and refinements

LP134 changes only the read-only address certifier and its tests. It does not activate a county or change manufacturing, packages, sidecars, runtime, deployment, Storage, Supabase, Edge Functions, or LP132 gates.

Three bounded corrections implement the LP133 findings:

1. **Internal-space house numbers.** Exact-sample eligibility now validates the house field independently with the same grammar accepted by the query parser (`digits` with an optional attached letter). Values such as `100306 A` and `14073 1/2` are not silently admitted and then reparsed as roads. They remain valid package records; they are merely outside this exact-query test's grammar.
2. **Numbered-road aliases.** Alias sampling requires `CR`, `FM`, `SH`, or `US` followed by a governed numeric designator (including a bounded attached letter, hyphen, or fraction). Ordinary names such as `Cr Moore Road` and `Us Marshal Road` are not alias evidence. Approved numeric normalizations remain tested.
3. **Deterministic load gate.** A single wall-clock threshold is no longer a certification result. Duration remains reported for diagnostics. The gate is now the immutable package's indexed record count, capped at 1,100,000 records. This covers Dallas's LP133 count of 1,028,372 while retaining a deterministic resource-volume guard. A future change to this governed cap requires tooling review.

## Before/after evidence and validation

The machine-readable authority is `evidence/lp134/certification-results.json`; complete new reports are under `evidence/lp134/rerun/`. The three LP133-blocked packages available in this checkout were recertified directly against their existing sidecars. Bandera, Bell, and Brewster changed from FAIL to PASS. Each retained exactly the same package SHA-256, package size, and sidecar SHA-256. The reruns had zero remaining failures.

The other eleven blocked package bytes are not present in this checkout. LP134 does not infer PASS from historical counters: Cameron, Cherokee, Dallas, Denton, Ector, Hudspeth, Midland, Presidio, Rusk, Somervell, and Taylor remain blocked with deterministic reason `LOCAL_PACKAGE_UNAVAILABLE` until their exact LP130 bytes can be supplied to this refined certifier. This is an execution-evidence limitation, not a rebuild recommendation or newly discovered content defect.

Regression tests lock the internal-space predicate, positive and negative alias scenarios, deterministic record-count gate, statewide arithmetic, unchanged identities and sizes, and explicit blocker reasons. Existing LP104.6 tests demonstrate that previously passing fixture behavior, exact rejection, integrity checks, and approved aliases remain passing.

## Required summary

| Measure | Previous (LP131/LP133) | Current LP134 |
| --- | ---: | ---: |
| Certified | 240 | 243 |
| Blocked | 14 | 11 |
| Total | 254 | 254 |
| Certification percentage | 94.49% | 95.67% |
| Resolved | — | 3 |
| Remaining | — | 11 |

**Readiness impact:** three Gate 2 certification blockers are now closed in repository evidence. No activation status or any other LP131/LP132 readiness gate changes.

**Risks:** the eligibility rule intentionally does not claim support for spaced/fractional house queries; the numeric alias grammar may require governed extension for a newly evidenced Texas designator; the deterministic record ceiling measures workload volume rather than elapsed latency; and eleven outcomes cannot be established without their immutable package bytes. These risks are controlled by narrow tests, preserved timing telemetry, hash checks, and retaining rather than projecting unavailable results.

**LP135 recommendation:** restore or securely mount the eleven byte-identical LP130 packages, verify their recorded hashes and sizes before execution, rerun the refined certifier twice, compare status and non-timing fields, and publish the remaining before/after reports. Do not rebuild, activate, deploy, upload, or alter governance as part of that evidence-completion milestone.
