# LP191 input readiness

**Status:** `NOT_CERTIFIED_AUTHORITATIVE_GEOMETRY_INPUTS_UNAVAILABLE`

The repository governs the exact 33 PLACE/CDP identities and the 30-unit SA Tomorrow working-geometry manifest (29 usable), but it does not commit the authoritative Texas PLACE polygon source or the owner-certified SA Tomorrow source. This environment also lacks GDAL 3.13.0. In addition, the checked-in West Northwest artifact is 6,735,560 bytes with SHA-256 `d46219d2f61d26d40111bb375651ec91a6ba286b2331e421d19d35f17d881c16`; its governed manifest requires 427,909 bytes and SHA-256 `1eed04031d6a0ccb13c5749fbcc7af3c829e2bc959db065a2dd7b78c324ec181`. LP191 therefore fails closed: no pair relationship or certification report is fabricated.

All future results must carry `INDEPENDENT_GOVERNED_PLACE_WINS`. Far Southwest remains `INDETERMINATE_FAR_SOUTHWEST_GOVERNANCE_HOLD` unless governed evidence proves it irrelevant. `GOVERNED_ATOMIC_GEOGRAPHY != CONSUMER_REGION_LABEL`.
