# Wave 3A.1 FRA reconciliation evidence

## Certified exception baseline

`certified-exception-baseline.json` is the immutable historical input authority
for Wave 3A.1's original containment exception set. It preserves the certified
351 cross-county mismatches and two outside-Texas identities produced by the
original Wave 3A containment calculation in commit
`352bd1356416c01e56ecc8d316c0bb111f18c505` (`Add Wave 3A crossing activation
readiness preflight`). The extracted file is byte-for-byte identical to
`evidence/wave3a-crossing-readiness/containment-reconciliation.json` at that
commit; its SHA-256 is
`f34e8035084711708bc6569c2d3d42edf01a75dd7f59d5bd52996cc3e1cca8e6`.

The baseline is a governed historical/certified input. The Wave 3A.1 build reads
it but does not include it among generated output files and must not rewrite it.
Current Wave 3A readiness evidence has different Architecture A semantics and
is deliberately not an exception authority for Wave 3A.1.
