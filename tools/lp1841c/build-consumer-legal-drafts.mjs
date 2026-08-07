import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const header = "DRAFT — NOT LEGALLY APPROVED\n\nEffective Date: [TO BE SET AT LEGAL APPROVAL]\n\n";
const common = { schemaVersion: "LP184.1C-1", milestone: "LP184.1C", generatedAt: null, draftOnly: true, sources: ["reports/lp1841a/*", "reports/lp1841b/*"] };

const privacy = `${header}# Gridly Privacy Policy

This draft describes the currently proven behavior of Gridly, operated by [GRIDLY LEGAL OPERATOR]. It is not legal approval. Questions may be directed to [GRIDLY PRIVACY CONTACT]; general support is available at [GRIDLY SUPPORT CONTACT]. No operational consumer privacy-request or deletion process is currently proven. The process, if adopted, will be: [PRIVACY REQUEST PROCESS].

## Information and uses

- **Precise foreground location.** Gridly may use precise location while the app is in the foreground for map centering, nearby context, reporting, routing, and Route Watch. Route Watch uses and updates foreground location while active; its monitoring stops when Route Watch stops. No background-location implementation is currently proven.
- **Community reports.** When you submit a report, its category, details, coordinates, time/lifecycle fields, and other report fields may be stored in Supabase for shared community-report functionality. Gridly creates a persistent pseudonymous device identifier, stores it on your device, and sends it with reports for association and duplicate suppression. Reporting is pseudonymous, not anonymous.
- **On-device data.** Preferences and settings, including saved places, home/work labels, map style, and alert preferences, may be stored locally on your device. Clearing app or site data may remove local data.
- **Service requests.** OSRM may receive route, origin/destination, or candidate coordinates for routing and road snapping. Nominatim may receive searches or coordinates for geocoding. Map/tile providers receive normal map requests, such as tile coordinates, IP address, and ordinary HTTP metadata. Other functional providers may receive the request parameters needed to return roadway, weather, ZIP, or crossing information.

## Current implementation boundaries

No consumer account or login is currently implemented, and no email collection is currently proven. No payment or subscription implementation currently exists. No analytics or advertising stack was found. No current user-specific data-sale implementation was found. These statements describe the governed current implementation and are not promises about future features; material future practices require updated disclosures.

## Retention and requests

Community reports can have an expiry time affecting visibility. Report expiry does not prove server deletion. Actual server/provider retention is unresolved: [SERVER DATA RETENTION POLICY]. Do not infer a retention period from this draft. Report removal is unresolved: [REPORT REMOVAL PROCESS]. Consumer privacy requests are unresolved: [PRIVACY REQUEST PROCESS].

Any future use of aggregated data remains unresolved: [FUTURE AGGREGATED DATA POLICY]. The minimum age is unresolved: [MINIMUM AGE].
`;

const terms = `${header}# Gridly Terms of Service

These draft terms are between you and [GRIDLY LEGAL OPERATOR]. Support: [GRIDLY SUPPORT CONTACT]. You must meet [MINIMUM AGE] or any legally required consent standard.

## Travel-awareness service

Gridly is a travel-awareness product. It is not an emergency service, TxDOT or DriveTexas, a railroad authority, or a weather authority. In an emergency, contact the appropriate emergency services. Always obey posted signs, closures, gates, law-enforcement instructions, and applicable traffic laws. Do not view, operate, or submit information through Gridly while driving when doing so would be unsafe or unlawful.

Routes, conditions, alerts, and other information may be incomplete, delayed, unavailable, or inaccurate. Gridly cannot guarantee that every condition will be detected. Live railroad operational status is not guaranteed. Service availability is not guaranteed. Official controls and instructions take priority over Gridly.

## Community information

Community reports are user-submitted and may be wrong, incomplete, expired, suppressed, or removed. They are not official evidence. Weather-like community reports are not automatically authoritative weather evidence. Submit only lawful, truthful observations without personal or sensitive information.

## Subscriptions

[SUBSCRIPTION TERMS — OWNER/LEGAL DECISION REQUIRED]

No current billing implementation exists. Price, interval, cancellation, refund, platform billing, and other subscription terms must not be inferred from this draft.

## Legal terms requiring decision

Governing law: [GOVERNING LAW]. Venue and dispute process: [VENUE / DISPUTE TERMS]. Privacy and report requests: [PRIVACY REQUEST PROCESS] and [REPORT REMOVAL PROCESS]. These terms, including limitations of liability and disclaimers, require final legal review before use.
`;

const community = `${header}# Community Reporting Guidelines

- Report only what you actually observe; do not knowingly submit false or misleading information.
- Do not include personal, sensitive, or identifying information about another person.
- Reports are community-submitted and are not official evidence.
- Reports may be incomplete, expire, be cleared, suppressed, or removed. Expiry or clearing does not necessarily mean server deletion.
- Reports use a persistent pseudonymous device identifier. Reporting is pseudonymous, not anonymous.
- Official traffic controls, signs, closures, gates, law enforcement, and traffic laws always take priority.
- Do not report while driving when doing so would be unsafe or unlawful.
- Report-removal requests remain subject to [REPORT REMOVAL PROCESS]; support remains [GRIDLY SUPPORT CONTACT].
`;

const location = `${header}# Location & Route Intelligence Disclosure

- Gridly may use precise foreground location for location-aware features.
- Route Watch may update foreground location while it is active. Monitoring stops when Route Watch stops.
- No background-location implementation is currently proven.
- Route or location coordinates may be sent to routing and geocoding services, including OSRM and Nominatim. Map providers also receive normal map requests.
- Report coordinates and a persistent pseudonymous device identifier may be stored through Supabase when a community report is submitted; reporting is not anonymous.
- Gridly cannot guarantee that every route, hazard, crossing, weather, or traffic condition is detected or accurate.
- Official signs, closures, gates, law-enforcement instructions, and traffic controls always take priority.
`;

const decisionSpecs = [
  ["LEGAL_OPERATOR", "No governed legal operator identity is present.", "Identify the legal entity or person operating Gridly.", true, true],
  ["SUPPORT_CONTACT", "No governed consumer support contact is present.", "Provide and operationally validate the support contact.", true, true],
  ["PRIVACY_CONTACT", "No governed privacy contact is present.", "Provide and operationally validate the privacy contact.", true, true],
  ["MINIMUM_AGE", "No governed minimum-age decision is present.", "Set an age rule appropriate to applicable law and product distribution.", true, true],
  ["SERVER_RETENTION", "LP184.1A says server deletion after report expiry and provider retention are unknown.", "Approve documented server/provider retention and deletion practices.", true, true],
  ["PRIVACY_REQUEST_PROCESS", "LP184.1A proves no operational consumer privacy-request/deletion mechanism.", "Establish, document, and validate a privacy-request process.", true, true],
  ["REPORT_REMOVAL", "LP184.1A proves no consumer self-service report-removal mechanism.", "Establish and validate the report-removal process.", true, true],
  ["SUBSCRIPTION_TERMS", "LP184.1A finds billing absent; no commercial terms are governed.", "Decide whether subscriptions apply and approve all applicable commercial terms.", true, true],
  ["GOVERNING_LAW", "No governed-law selection is present.", "Legal must select applicable governing law.", true, true],
  ["DISPUTE_TERMS", "No governed venue or dispute terms are present.", "Legal must approve venue and dispute terms.", true, true],
  ["LIABILITY_REVIEW", "Consumer limitations and disclaimers have not received legal approval.", "Legal must review liability, warranty, safety, and disclaimer language.", true, true],
  ["FUTURE_AGGREGATED_DATA_POLICY", "No current user-specific data-sale implementation was found; future aggregated-data treatment is not governed.", "Decide whether and how any future aggregated data may be used.", false, true],
  ["FINAL_EFFECTIVE_DATE", "Legal approval has not occurred, so no effective date is set.", "Set the effective date only at final legal approval.", true, true]
];
const decisions = decisionSpecs.map(([id, currentEvidence, _decisionDescription, blocksStoreSubmission, blocksPublicLaunch]) => ({ id, currentEvidence, ownerDecisionRequired: true, legalReviewRequired: true, blocksStoreSubmission, blocksPublicLaunch, blocksScopedPreviewValidation: false }));

async function outputs() {
  const a = JSON.parse(await readFile(path.join(root, "reports/lp1841a/lp1841a-summary.json"), "utf8"));
  const b = JSON.parse(await readFile(path.join(root, "reports/lp1841b/lp1841b-summary.json"), "utf8"));
  if (a.classification !== "PRIVACY_ARCHITECTURE_AUDIT_COMPLETE_WITH_UNKNOWNS" || b.sourceAuditClassification !== a.classification) throw new Error("Authoritative LP184.1A/LP184.1B sources are not aligned");
  const register = { ...common, classification: "OPEN_OWNER_AND_LEGAL_DECISIONS", records: decisions };
  const remaining = ["Approve the four consumer legal drafts through authorized legal review.", "Resolve every record in legal-owner-decision-register.json, replace every explicit placeholder, and set the effective date only at approval.", "Operationally validate support, privacy-request, deletion/retention, and report-removal processes.", "Complete applicable Apple/Google policy mapping and native permission review identified by LP184.1B.", "Record dated owner/legal approval of the final publication-ready materials."];
  const reassessment = { ...common, prerequisiteId: "LP167-B012", status: "LEGAL_DRAFTING_COMPLETE_APPROVAL_REQUIRED", pass: false, closed: false, classification: "LEGAL_DRAFTING_COMPLETE_APPROVAL_REQUIRED", whatRemainsBeforeClosure: remaining, blocksScopedPreviewValidation: false, blocksStoreSubmission: true, blocksPublicLaunch: true };
  const summary = { ...common, classification: "DRAFTS_COMPLETE_OWNER_LEGAL_REVIEW_REQUIRED", mergeRecommendation: "MERGE_FOCUSED_DRAFTS_AFTER_REVIEW; DO_NOT_PUBLISH", draftStatuses: { privacyPolicy: "DRAFT_COMPLETE_NOT_LEGALLY_APPROVED", termsOfService: "DRAFT_COMPLETE_NOT_LEGALLY_APPROVED", communityReportingGuidelines: "DRAFT_COMPLETE_NOT_LEGALLY_APPROVED", locationRouteIntelligenceDisclosure: "DRAFT_COMPLETE_NOT_LEGALLY_APPROVED" }, lp167B012Status: reassessment.status, unresolvedDecisionIds: decisions.map(x => x.id), scopedPreviewValidationBlockers: [], storeSubmissionBlockers: ["LP167-B012", ...decisions.filter(x => x.blocksStoreSubmission).map(x => x.id), ...b.storeSubmissionBlockers], runtimeModified: false, nativeFilesModified: false, authorizationsChanged: false, deploymentOccurred: false, publicationOccurred: false, storeSubmissionOccurred: false, deterministic: true, secretSafety: "PASS_NO_SECRETS_EMITTED" };
  return { drafts: { "privacy-policy.md": privacy, "terms-of-service.md": terms, "community-reporting-guidelines.md": community, "location-route-intelligence-disclosure.md": location }, reports: { "legal-owner-decision-register.json": register, "legal-readiness-reassessment.json": reassessment, "lp1841c-summary.json": summary } };
}

const json = value => `${JSON.stringify(value, null, 2)}\n`;
const canonicalLf = value => value.replace(/\r\n/g, "\n");
export async function run(mode = "verify") {
  const expected = await outputs();
  const entries = [...Object.entries(expected.drafts).map(([n,v]) => [path.join(root,"legal/drafts",n),v]), ...Object.entries(expected.reports).map(([n,v]) => [path.join(root,"reports/lp1841c",n),json(v)])];
  if (mode === "build") { await mkdir(path.join(root,"legal/drafts"),{recursive:true}); await mkdir(path.join(root,"reports/lp1841c"),{recursive:true}); for (const [file,value] of entries) await writeFile(file,value,"utf8"); }
  const mismatches=[]; for (const [file,value] of entries) { let actual=""; try { actual=await readFile(file,"utf8"); } catch {} if(canonicalLf(actual)!==canonicalLf(value)) mismatches.push(path.relative(root,file)); }
  if(mismatches.length) throw new Error(`LP184.1C deterministic verification failed: ${mismatches.join(", ")}`);
  console.log(`LP184.1C ${mode} passed (${entries.length} canonical artifacts).`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await run(process.argv[2] || "verify");
