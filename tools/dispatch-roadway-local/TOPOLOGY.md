# Dispatch topology milestone 2A

LOCAL, BOUNDED, SOURCE-EVIDENCE ONLY. No UI wiring, database, authority, publication,
consumer imports, downloads, statewide extraction or new dependencies.

Run from this repository root:

    node tools/dispatch-roadway-local/validate-topology.mjs
    node --test tests/dispatch-roadway-topology.test.mjs

The validator writes no files and permits no CLI overrides. The reviewed manifest
pins the existing October 6, 2026 OSM API context JSON, its exact bytes, provenance,
bounds, counts, attribution and ODbL license. Raw node lon/lat becomes CRS84 [lon,lat].
Only highway-tagged ways enter the graph. Contributor names/IDs, changesets and
unrelated raw metadata never enter derived packages. The existing context provenance
originally described cartographic extraction, not roadway certification: this new
manifest explicitly governs the separate node-evidence interpretation.

## Evidence, not surveyed correctness

Junction lookup uses original node IDs; geometric crossings, coincident coordinates,
road names and route references never create graph edges. All way node references
must resolve. Missing incident-way nodes mark shared evidence MISSING_SOURCE_EVIDENCE.
Unsupported highways/grade tags, bridge+tunnel contradictions, ambiguous repeated
nodes and conflicting interior grades are BLOCKED_AMBIGUITY. Shared nodes with
missing explicit layer evidence remain CANDIDATE_REVIEW, even when source mapping
suggests connectivity. No implicit layer zero is assumed.

Explicit compatible layers and structures can establish VERIFIED_EVIDENCE for a
source-supported junction. A same-layer bridge/tunnel-to-ground transition is allowed
only at all incident way endpoints; a differing-layer endpoint transition remains
review-only. Extraction-edge/outside-bound junctions remain review-only. VERIFIED
means these implemented source rules pass, not independent field verification.

Ordinary way endpoints remain candidates, never asserted real dead ends. Rings retain
ordered closure; nonclosure repeated nodes are blocked. Divided roads, ramps, loops
and parallel ways retain independent identities. Access, motor_vehicle, oneway and
junction raw tags are retained; no legal traversal/routing permission is granted.
Relations are not interpreted as turn restrictions. This is not a routing engine.

## Candidate segments and versions

Only VERIFIED_EVIDENCE interior junctions split ordered ways. Candidate/blocked shared
nodes are retained with reasons; they cannot silently become certified cuts. Each
segment is an exact contiguous node slice, with parent way/node element versions,
source and parent-geometry hashes, endpoint evidence and slice indices. Missing-node
ways emit explicit missing-reference evidence and no manufactured segment geometry.
Zero-length edges and invalid coordinates reject the package.

Source way identity is osm:way:<id>; junction identity is osm:node:<id>. Segment ID is
[osm, way ID, ordered endpoint IDs, repeated endpoint-pair occurrence ordinal]. County
and labels do not enter identity. Geometry version hashes ordered nodes and coordinates.
Topology version hashes pinned source/provenance, construction rules and derived
records. Stable endpoint IDs survive an intermediate coordinate edit, but references
still invalidate. Splits/merges/changed endpoint ordering are new identities, never
remapped. Source replacement requires a separately reviewed manifest. There is no
historical storage or draft integration yet; retained old references must be reviewed.

Exact reference validation uses indexed segment/way/node lookup and binds package,
source, topology and geometry versions. Review/blocked/missing segments cannot pass
operational selection. Search scans bounded alias metadata and returns at most 40;
no statewide or repeated geometry graph traversal occurs. Indexes are private and
output records/coordinates are frozen.

## Bounds and memory

Hard limits: 20 MiB input/output, 45,000 source elements, 1,000,000 positions,
100,000 expanded edges, 50,000 segment candidates, 200,000 way-node adjacency entries,
256 incident ways per node, 50 selected references and 40 search results.
A conservative accounted graph budget is 64 MiB: serialized output x16 plus position,
adjacency and source-node allowances. Check incremental segment allocation and final
package size; fail closed on excess. This is an explicit accounting budget, not a
portable measurement of JavaScript engine heap. The validator additionally reports
observed heap delta, RSS and elapsed time; GC/runtime overhead is separate.

## Certification and preserved sources

Synthetic adversarial fixtures are labeled separately from REAL source tests. The
real tests independently compare each segment coordinate and node slice to original
source data and verify repeat-build digests, complete references, denied review
selection, budgets and attribution. Node completeness does not certify every actual
junction. All output authority is UNVERIFIED and publication DISABLED.

No May Liberty geometry is used to construct October segments. The audit found 226
preview/context identity overlaps, 105 missing preview identities and five differing
full Liberty/context geometries. These are unresolved compatibility findings, not a
permission to substitute newer geometry. The certified registry/picker/composer,
authentication and source integrity remain unchanged and import no topology module.

## License and next gates

Keep © OpenStreetMap contributors attribution, ODbL notices and source digest/lineage:
https://www.openstreetmap.org/copyright
https://opendatacommons.org/licenses/odbl/1-0/
Review applicable redistribution/share-alike obligations before publishing derived
packages. No derived package is written or distributed by this validator.

Remaining gates: independent grade review, extraction completeness, reviewed dead-end
classification, direction/turn/access semantics, whole-edge boundaries and multi-county
seams, node-preserving statewide PBF extraction, historical versions, path selection
and UI integration. Municipal maintenance/restriction/issuing authority requires
separate certification and cannot follow from this topology or geography.
