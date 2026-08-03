# LP123 — Texas Authoritative Evidence Acquisition Framework

## 1. Charter and production boundary

Gridly is **Know Before You Go**: Awareness Platform First, Route Intelligence Second, Audit First, Patch Second. LP123 defines a reusable, statewide evidence-acquisition control plane. It does not acquire a statewide inventory, activate a county, create a candidate asset, or change runtime.

The framework is deliberately separated from production manifests, county selectors, search, address, roadway, and crossing runtimes. Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, and Supabase Sync remain protected and unchanged. An acquisition result is evidence, not permission to publish it.

## 2. Statewide source catalog

Discovery begins with the entity legally or operationally accountable for the assertion. A source is evaluated per assertion, not trusted for every fact merely because its publisher is authoritative.

| Source class | Authoritative publishers | Typical supported assertions | Important limit |
| --- | --- | --- | --- |
| Government | county government, county clerk, sheriff, emergency management, incorporated municipality, state or federal agency | official names, offices, public-safety facilities, jurisdictional facts | a directory does not prove completeness unless it says so |
| Healthcare | public hospital or hospital district, government health authority, licensed public emergency facility | facility identity, service type, official address | commercial provider directories are not primary evidence |
| Education | public school district, public college/university, Texas education agency | campus identity, governance, official address | district attendance areas do not establish county containment by themselves |
| Transportation | government-owned airport, transit agency, TxDOT, relevant federal agency | facility identity, public service, official location | schedules and third-party map pins are volatile or derivative |
| Parks | Texas Parks and Wildlife, county or municipal parks department | official park identity, managing authority, address/entrance | recreation aggregators are discovery aids only |
| Public services | courthouse, public library system, government office or special district | official service identity, public status, address | shared mailing addresses require separate facility confirmation |

No automated run may scrape or download statewide source content merely because it is listed in the catalog. Robots rules, terms, access constraints, and an approved acquisition method apply to every pass.

## 3. Source priority matrix

| Priority | Definition | Permitted use | Review consequence |
| --- | --- | --- | --- |
| `PRIMARY` | first-party government or accountable public institution asserting a fact within its remit | may substantiate the assertion directly | still requires containment and human review |
| `SECONDARY` | another authoritative government/public body reproducing or corroborating the fact | corroboration, or direct support when it owns the relevant registry | reviewer records why primary was unavailable or insufficient |
| `FALLBACK` | stable, attributable non-government source with an identifiable methodology | discovery or provisional support only | cannot receive `HIGH`; normally `REVIEW_REQUIRED` |
| `UNSUPPORTED` | anonymous, unverifiable, user-generated, stale without qualification, inaccessible, or authority-mismatched material | must not substantiate a candidate | record the gap; do not infer the fact |

Conflicts do not resolve by majority vote. Prefer the source accountable for the specific assertion, retain conflicting citations, and require human adjudication. Search snippets, AI output, and an unverified map pin are unsupported evidence.

## 4. Evidence classification standard

Every record has exactly one reusable `evidenceClass`:

- `COMMUNITY`: an officially recognized populated place or locality assertion.
- `DESTINATION`: a public-interest place not more specifically governed below.
- `PUBLIC_SAFETY`: sheriff, police, fire, emergency-management, or other official response facility.
- `HEALTHCARE`: authoritative public hospital, emergency, or government health facility.
- `EDUCATION`: public district, school, college, university, or campus.
- `TRANSPORTATION`: public airport, transit facility, or accountable transportation facility.
- `PARK`: state, county, or municipal park/recreation property.
- `GOVERNMENT`: courthouse, library, government office, or other public-service facility.

Classification describes the assertion; it does not imply eligibility, completeness, runtime type, search indexing, or production approval. When a place plausibly fits two classes, use the most specific class and capture other claims as separately reviewed evidence rather than duplicating a record.

## 5. Provenance specification

Each future acquired record must carry all fields below. Dates use ISO 8601 `YYYY-MM-DD`; FIPS is the five-character state-plus-county code; URLs are the exact pages used rather than a generic home page where possible.

| Field | Requirement |
| --- | --- |
| `county` | canonical Texas county name |
| `countyFips` | five digits, preserving leading zeroes |
| `source` | human-readable publisher and page/dataset title |
| `sourceUrl` | absolute `https` evidence URL |
| `observationDate` | required date the evidence was observed |
| `evidenceDate` | source publication/effective date, or `null` when absent |
| `confidence` | `HIGH`, `MEDIUM`, `LOW`, or `REVIEW_REQUIRED` |
| `reviewStatus` | governed lifecycle value; initially `PENDING_REVIEW` |
| `reviewer` | accountable reviewer identifier, or `null` before review |
| `countyContainment` | structured status and method showing whether the assertion lies in the named county |
| `acquisitionMethod` | approved method such as `MANUAL_WEB_OBSERVATION`, `OFFICIAL_API`, or `OFFICIAL_DOWNLOAD` |

The record also carries a stable evidence ID, evidence class, asserted name/fact, source priority, and notes. Missing facts remain `null`; acquisition must not manufacture dates, aliases, coordinates, addresses, or containment. Source snapshots or hashes may supplement provenance but do not replace the URL and dates. Personally identifying reviewer data should not be embedded when an organizational identifier suffices.

Containment statuses are `CONFIRMED`, `CONFLICT`, and `UNRESOLVED`. Confirmation requires an authoritative boundary relationship, accountable source statement, or documented geospatial point-in-polygon check against an approved county boundary. A postal city, ZIP, mailing address, or publisher name alone is insufficient.

## 6. Confidence classification

Confidence measures **only evidence quality**, never business desirability, coverage, runtime readiness, or reviewer preference.

- `HIGH`: a primary source directly and unambiguously supports the assertion, is sufficiently current for it, and containment is independently confirmed or directly asserted by the accountable authority.
- `MEDIUM`: authoritative evidence supports the assertion but is indirect, has a material date/precision limitation, or relies on mutually consistent secondary sources; containment is confirmed.
- `LOW`: fallback evidence is attributable but weak, incomplete, stale, or imprecise. It can preserve a lead but cannot establish approval.
- `REVIEW_REQUIRED`: evidence conflicts, authority is unclear, containment is unresolved, a required provenance element is missing, or quality cannot yet be classified. This is not a numerical confidence tier.

Automation may reduce confidence or route to review; it must not promote evidence to `HIGH`. Conflicting sources and unresolved containment always produce `REVIEW_REQUIRED`, regardless of source count.

## 7. Acquisition and human-review workflow

The mandatory state progression is:

`SOURCE_DISCOVERY → EVIDENCE_ACQUISITION → NORMALIZATION → COUNTY_CONTAINMENT → PROVENANCE_ATTACHMENT → HUMAN_REVIEW → CANDIDATE_APPROVAL → PRODUCTION_AUTHORIZATION`

1. **Source discovery:** register publisher, source class, authority, priority, scope, access method, and terms; do not collect inventory records.
2. **Evidence acquisition:** capture only assertions authorized by the batch charter, preserving exact provenance and raw-to-normalized traceability.
3. **Normalization:** normalize formatting without inventing facts; retain original text.
4. **County containment:** set confirmed, conflict, or unresolved with a recorded method.
5. **Provenance attachment:** validate every required field before review.
6. **Human review:** a named reviewer checks authority, assertion fidelity, classification, date, duplicates/conflicts, containment, and confidence. The acquirer must not self-approve where separation of duties is required by the batch charter.
7. **Candidate approval:** a separate, explicit decision may admit a reviewed record to a candidate package. Rejection or return-for-correction preserves the audit trail.
8. **Production authorization:** a distinct authorized decision after candidate approval; never inferred from confidence or review. LP123 grants no such authorization.

Corrections create a new revision linked to the prior record. Review outcomes are `APPROVED`, `REJECTED`, or `CHANGES_REQUIRED`; pre-review status is `PENDING_REVIEW`. Every transition records actor, date, reason, and prior/new state. Unsupported leads and conflicts are retained as governed gaps, not silently discarded.

## 8. Statewide batch acquisition strategy

Future milestones process **one evidence class across all 254 Texas counties** as a versioned, resumable, runtime-isolated batch:

1. Freeze the batch charter: one class, schema version, approved source catalog version, Texas county/FIPS control list, acquisition methods, reviewer roster, and stop conditions.
2. Create 254 independent county work units keyed by FIPS. A work unit may finish as `COMPLETE`, `NO_EVIDENCE_FOUND`, `REVIEW_REQUIRED`, or `BLOCKED`; an empty result must be explicit.
3. Run discovery and acquisition in bounded waves with deterministic IDs, checkpoints, rate limits, and per-source audit logs. Never bypass publisher access rules.
4. Validate schema, exact county-set coverage, duplicates, containment, provenance, and class scope in a staging evidence store that runtime cannot read.
5. Route all records and explicit no-evidence results through human review. Sample-based review may supplement but never replace record-level approval when approval is claimed.
6. Seal an immutable batch summary containing counts by county/outcome/confidence, unresolved conflicts, input versions, and hashes. Re-running the same inputs must not duplicate records.
7. Hand off only reviewed outputs to a later candidate milestone. Candidate approval and production authorization remain separate gates; no batch edits manifests, selectors, search records, aliases, or runtime assets.

Failures are county-isolated and resumable. Statewide completion means all 254 work units have a terminal acquisition outcome—not that all counties contain evidence, are approved, or are activated. Quality metrics are reported by class and county; quotas must never inflate confidence.

## 9. LP123 decision

The framework definition and regression tests are ready for reuse. No acquisition batch was executed, no records or destination/community inventories were generated, no county was activated, and no production authorization was issued. Production remains unchanged.
