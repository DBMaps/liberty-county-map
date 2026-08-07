import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const header = "DRAFT — NOT LEGALLY APPROVED\n\nEffective Date: [DEFERRED UNTIL FINAL LEGAL APPROVAL]\n\n";
const common = { schemaVersion: "LP184.1D-1", milestone: "LP184.1D", generatedAt: null, draftOnly: true, sources: ["reports/lp1841a/*", "reports/lp1841b/*", "reports/lp1841c/*"] };

const privacy = `${header}# Gridly Privacy Policy

This unapproved draft describes Gridly, operated by DJ Burns Collective LLC. The planned privacy contact is privacy@gridlygo.com and the planned support contact is support@gridlygo.com. Neither mailbox is yet proven operational. Privacy-request processing is not currently operational.

## Information and uses

- **Precise foreground location.** Gridly may use precise location while the app is in the foreground for map centering, nearby context, reporting, routing, and Route Watch. Route Watch uses and updates foreground location while active; its monitoring stops when Route Watch stops. No background-location implementation is currently proven.
- **Community reports.** Submitted category, details, event coordinates, timestamps, severity, road or crossing, community, county, hazard-location-derived ZIP/geographic area, confirmations, clear/resolution events, duration, recurrence, official-source relationships, and other condition facts may be stored. Gridly creates a persistent pseudonymous device identifier and sends it with reports for association, trust, duplicate suppression, and abuse functions. Reporting is pseudonymous, not anonymous.
- **On-device data.** Preferences and settings, including saved places, home/work labels, map style, and alert preferences, may be stored locally on your device.
- **Service requests.** Routing, geocoding, map/tile, roadway, weather, ZIP, and crossing providers may receive request parameters needed to provide their functions.

## Current implementation boundaries

No consumer account or login is currently implemented. No payment or subscription implementation currently exists. No analytics or advertising stack was found. No current user-specific data-sale implementation was found.

## Retention, historical intelligence, and requests

Gridly intends to retain historical hazard and condition information long-term, potentially indefinitely, as condition intelligence about what happened, where, when, severity, duration, confirmation/resolution, and recurrence. Hazard coordinates and hazard-location-derived ZIP/geographic information may remain with an event. Gridly does not intend this asset to be a permanent reporter history or to include persistent reporter/device linkage permanently. Current records are not represented as already deidentified: a future lifecycle must define when device linkage can be removed, separated, or otherwise deidentified after its operational purpose. Report expiry does not prove server deletion, and removal from consumer display does not prove deletion from every historical record or backup.

Consumers are intended to be able to contact privacy@gridlygo.com for applicable requests, including removal of submitted reports where applicable. Because there is no consumer account system, verification and identification of applicable report/device data, request handling, report removal, and the retention/deidentification lifecycle still require implementation; these processes are not currently operational.

Gridly may retain and potentially commercialize aggregated or deidentified historical condition intelligence about occurrences, locations, roads/corridors, crossings, frequency, timing, duration, severity, confirmation/resolution, recurrence, and regional patterns. Gridly does not intend to sell or commercialize personal information, persistent reporter/device identities, individual movement histories, or reporter-specific histories. Reporter residential ZIP is not an approved replacement identifier and is not introduced by this policy.

The owner-selected product eligibility minimum age is 16; this is not a statement that 16 is a universal legal driving age and remains subject to legal review.
`;

const terms = `${header}# Gridly Terms of Service

These unapproved draft terms are between you and DJ Burns Collective LLC. Planned support: support@gridlygo.com (not yet proven operational). The owner-selected minimum product eligibility age is 16, subject to final legal review and any applicable consent requirements; 16 is not characterized as a universal legal driving age.

## Informational awareness and safety

Gridly is an informational awareness service. It is not an emergency service, TxDOT or DriveTexas, a railroad, a weather authority, or an official traffic-control authority. Gridly does not guarantee accuracy, completeness, current conditions, route availability, route safety, hazard accuracy, or uninterrupted service. Community reports and community-confirmed status are community evidence, are not guaranteed truth, and are not official evidence. Weather-like community reports are not automatically authoritative weather evidence.

Users remain responsible for safe driving and for obeying railroad signals, traffic controls, road closures, law enforcement, signs, and applicable law. Official controls take priority. Do not use Gridly in a manner that distracts from safe driving. Exact warranty disclaimers, damages limitations, indemnification, and enforceability language remain subject to attorney review.

## Community information and removal direction

Gridly intends to permit applicable requests to remove a submitter's reports. Gridly may remove or restrict false, fraudulent, abusive, threatening, unlawful, spam, privacy-invasive, unsafe, or guideline-violating reports. The exact process and lifecycle are not implemented or legally approved. Removal from consumer display does not necessarily delete every historical record or backup.

## Intended subscription model — not binding final terms

The owner-approved launch intent is $2.99 per month, with no free version and no initial free trial, as a monthly auto-renewing subscription. Intended cancellation is through the applicable billing platform, with access through the already-paid billing period after cancellation. Billing, entitlement, platform configurations, taxes, and final refund terms do not currently exist and are not promised by this draft.

## Legal terms requiring attorney approval

The owner directs Texas law, subject to attorney review. No final venue is stated. Mandatory arbitration, class-action waiver, jury-trial waiver, mandatory venue, and indemnification terms have not been adopted here. Dispute terms, liability language, final subscription terms, and enforceability require attorney review.
`;

const community = `${header}# Community Reporting Guidelines

- Report only what you actually observe; community reports and confirmations are evidence, not guaranteed truth, and not official evidence.
- Do not submit false, fraudulent, abusive, threatening, unlawful, spam, privacy-invasive, unsafe, or misleading information, or personal or sensitive information about another person.
- Reports use a persistent pseudonymous device identifier. Reporting is pseudonymous, not anonymous; no device-link deidentification lifecycle currently exists.
- Gridly intends to accept applicable submitter removal requests through the planned privacy@gridlygo.com contact, but the mailbox and removal process are not yet proven operational.
- A report may expire, be cleared, restricted, or removed from display without deletion from every historical record or backup.
- Official traffic controls, signs, closures, gates, railroad signals, law enforcement, and applicable law always take priority.
- Do not report while driving when doing so would be distracting, unsafe, or unlawful.
`;

const location = `${header}# Location & Route Intelligence Disclosure

- Gridly may use precise foreground location for location-aware features; no background-location implementation is currently proven.
- Route or location coordinates may be sent to routing, geocoding, map, and other functional providers.
- Event coordinates and hazard-location-derived ZIP/geographic areas may be retained long-term, potentially indefinitely, as historical condition intelligence.
- Report coordinates and a persistent pseudonymous device identifier may be stored through Supabase. Current stored reports are not represented as already deidentified, and no device-link removal/separation lifecycle currently exists.
- Reporter home or residential ZIP is not an approved replacement identifier and is not introduced by this policy.
- Gridly cannot guarantee route, hazard, crossing, weather, traffic, accuracy, completeness, currency, availability, safety, or uninterrupted service. Official controls always take priority.
`;

const specs = [
["LEGAL_OPERATOR","DJ Burns Collective LLC","OWNER_DECISION_COMPLETE"],
["SUPPORT_CONTACT","support@gridlygo.com; planned mailbox not proven operational","OWNER_DECISION_COMPLETE_OPERATIONAL_SETUP_REQUIRED"],
["PRIVACY_CONTACT","privacy@gridlygo.com; planned mailbox not proven operational","OWNER_DECISION_COMPLETE_OPERATIONAL_SETUP_REQUIRED"],
["MINIMUM_AGE","Owner-selected product eligibility age 16; not a universal legal driving age","OWNER_POLICY_DECISION_COMPLETE_LEGAL_REVIEW_REQUIRED"],
["SERVER_HISTORICAL_RETENTION","Long-term, potentially indefinite event intelligence; persistent reporter/device linkage excluded from intended permanent asset; lifecycle unresolved","OWNER_POLICY_DECISION_COMPLETE_IMPLEMENTATION_AND_LEGAL_REVIEW_REQUIRED"],
["HAZARD_ZIP_VS_REPORTER_ZIP","Hazard-location ZIP may be event intelligence; reporter residential ZIP is not an approved replacement identifier","OWNER_POLICY_DECISION_COMPLETE"],
["PRIVACY_REQUEST_PROCESS","Planned privacy contact; accountless verification and identification process not operational","OWNER_POLICY_DECISION_COMPLETE_IMPLEMENTATION_REQUIRED"],
["REPORT_REMOVAL","Applicable submitter requests and moderation directed; display removal is not necessarily universal deletion; lifecycle unresolved","OWNER_POLICY_DECISION_COMPLETE_IMPLEMENTATION_AND_LEGAL_REVIEW_REQUIRED"],
["SUBSCRIPTION_INTENT","$2.99/month auto-renewing; no free version or initial trial; platform cancellation; paid-period access; billing absent","OWNER_INTENT_APPROVED_PENDING_BILLING_IMPLEMENTATION_AND_LEGAL_REVIEW"],
["GOVERNING_LAW","Texas law direction; no final venue language","OWNER_DIRECTION_COMPLETE_ATTORNEY_REVIEW_REQUIRED"],
["DISPUTE_TERMS","No arbitration, class waiver, jury waiver, mandatory venue, or indemnification invented","ATTORNEY_REVIEW_REQUIRED"],
["LIABILITY_SAFETY_POLICY","Informational-awareness limitations and user safety responsibilities directed; exact legal language unresolved","OWNER_POLICY_DIRECTION_COMPLETE_ATTORNEY_REVIEW_REQUIRED"],
["FUTURE_COMMERCIAL_INTELLIGENCE","Potential aggregated/deidentified historical condition commercialization; personal and reporter/device intelligence excluded; current data not claimed deidentified","OWNER_POLICY_DECISION_COMPLETE_IMPLEMENTATION_AND_LEGAL_REVIEW_REQUIRED"],
["FINAL_EFFECTIVE_DATE","Set only after final documents are approved for publication","DEFERRED_UNTIL_FINAL_LEGAL_APPROVAL"]
];
const records = specs.map(([id, decision, status]) => ({id, decision, status, blocksScopedPreviewValidation:false}));
const attorneyReviewItems = ["minimum-age policy and applicable consent requirements","historical retention and device-link lifecycle","report-removal/deletion lifecycle","subscription terms and billing disclosures","Texas governing-law language and any venue language","dispute terms, including any arbitration, waiver, venue, or indemnification decision","warranty disclaimers, damages limitations, indemnification, safety language, and enforceability","commercial historical-intelligence policy and deidentification representations","final legal documents, effective date, and final owner approval"];
const implementationRequiredItems = ["prove support@gridlygo.com operational","prove privacy@gridlygo.com operational","implement accountless privacy-request verification and report/device-data identification","implement report removal and define deletion/historical-record/backup lifecycle","define and implement device-link retention, separation, removal, or deidentification lifecycle","implement billing, platform subscription configuration, cancellation, entitlements, and paid-period access","review or repair native location permission declarations","complete final Apple App Privacy mapping","complete final Google Play Data Safety mapping"];
const storeSubmissionBlockers = ["FINAL_ATTORNEY_LEGAL_APPROVAL","OPERATIONAL_SUPPORT_AND_PRIVACY_CONTACTS","PRIVACY_REQUEST_IMPLEMENTATION","REPORT_REMOVAL_DELETION_LIFECYCLE","DEVICE_LINK_RETENTION_DEIDENTIFICATION_LIFECYCLE","NATIVE_LOCATION_PERMISSION_REVIEW_REPAIR","FINAL_APPLE_PRIVACY_MAPPING_DECISIONS","FINAL_GOOGLE_DATA_SAFETY_DECISIONS","BILLING_SUBSCRIPTION_IMPLEMENTATION","FINAL_EFFECTIVE_DATE","FINAL_OWNER_APPROVAL"];
async function outputs(){
 const c=JSON.parse(await readFile(path.join(root,"reports/lp1841c/lp1841c-summary.json"),"utf8")); if(c.classification!=="DRAFTS_COMPLETE_OWNER_LEGAL_REVIEW_REQUIRED") throw new Error("LP184.1C baseline mismatch");
 const register={...common,classification:"OWNER_DECISIONS_RECORDED_REVIEW_AND_IMPLEMENTATION_OPEN",records};
 const reassessment={...common,prerequisiteId:"LP167-B012",status:"LEGAL_OWNER_DECISIONS_SUBSTANTIALLY_COMPLETE_FINAL_APPROVAL_REQUIRED",pass:false,closed:false,classification:"LEGAL_OWNER_DECISIONS_SUBSTANTIALLY_COMPLETE_FINAL_APPROVAL_REQUIRED",attorneyReviewItems,implementationRequiredItems,blocksScopedPreviewValidation:false,blocksStoreSubmission:true,blocksPublicLaunch:true};
 const summary={...common,classification:"LEGAL_OWNER_DECISIONS_SUBSTANTIALLY_COMPLETE_FINAL_APPROVAL_REQUIRED",lp167B012Status:reassessment.status,ownerDecisionStatuses:Object.fromEntries(records.map(x=>[x.id,x.status])),attorneyReviewItems,implementationRequiredItems,scopedPreviewImpact:"NO_NEW_BLOCKER",storeSubmissionBlockers,draftStatus:"DRAFT_NOT_LEGALLY_APPROVED",runtimeModified:false,nativeFilesModified:false,authorizationsChanged:false,authorizationsGranted:[],deploymentOccurred:false,publicationOccurred:false,distributionOccurred:false,activationOccurred:false,storeSubmissionOccurred:false,deterministic:true};
 return {drafts:{"privacy-policy.md":privacy,"terms-of-service.md":terms,"community-reporting-guidelines.md":community,"location-route-intelligence-disclosure.md":location},reports:{"owner-decision-register.json":register,"legal-readiness-reassessment.json":reassessment,"lp1841d-summary.json":summary}};
}
const json=v=>`${JSON.stringify(v,null,2)}\n`; const lf=v=>v.replace(/\r\n/g,"\n");
export async function run(mode="verify"){const expected=await outputs(); const entries=[...Object.entries(expected.drafts).map(([n,v])=>[path.join(root,"legal/drafts",n),v]),...Object.entries(expected.reports).map(([n,v])=>[path.join(root,"reports/lp1841d",n),json(v)])]; if(mode==="build"){await mkdir(path.join(root,"legal/drafts"),{recursive:true});await mkdir(path.join(root,"reports/lp1841d"),{recursive:true});for(const[f,v]of entries)await writeFile(f,v,"utf8");}const bad=[];for(const[f,v]of entries){let a="";try{a=await readFile(f,"utf8")}catch{}if(lf(a)!==lf(v))bad.push(path.relative(root,f));}if(bad.length)throw new Error(`LP184.1D deterministic verification failed: ${bad.join(", ")}`);console.log(`LP184.1D ${mode} passed (${entries.length} canonical artifacts).`)}
if(process.argv[1]===fileURLToPath(import.meta.url))await run(process.argv[2]||"verify");
