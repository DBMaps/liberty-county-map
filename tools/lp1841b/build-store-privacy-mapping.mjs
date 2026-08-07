import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, "reports/lp1841b");
const sourcePath = name => path.join(root, "reports/lp1841a", name);
const readJson = async name => JSON.parse(await readFile(sourcePath(name), "utf8"));
const ref = (report, path, finding) => ({ sourceAudit: "LP184.1A", report: `reports/lp1841a/${report}`, path, finding });
const common = { schemaVersion: "LP184.1B-1", milestone: "LP184.1B", sourceAudit: "LP184.1A", draftOnly: true, generatedAt: null };
const noApple = (dataCategory, dataSubcategory, evidence) => ({ dataCategory, dataSubcategory, collected: "NO", linkedToUser: "NOT_APPLICABLE", usedForTracking: "NO", purposes: ["NOT_APPLICABLE"], requiredOrOptional: "UNKNOWN", evidence: [evidence], storeInterpretationReviewRequired: false });
const noGoogle = (dataCategory, dataType, evidence) => ({ dataCategory, dataType, collected: "NO", shared: "NO", ephemeral: "UNKNOWN", requiredOrOptional: "UNKNOWN", purposes: ["NOT_APPLICABLE"], encryptedInTransit: "UNKNOWN", deletionRequestSupported: "NOT_APPLICABLE", evidence: [evidence], platformReviewRequired: false });

async function createReports() {
  const [inventory, location, community, thirdParty, native, sourceSummary] = await Promise.all([
    readJson("data-inventory.json"), readJson("location-privacy-audit.json"), readJson("community-reporting-privacy-audit.json"),
    readJson("third-party-service-inventory.json"), readJson("native-permission-audit.json"), readJson("lp1841a-summary.json")
  ]);
  if (sourceSummary.classification !== "PRIVACY_ARCHITECTURE_AUDIT_COMPLETE_WITH_UNKNOWNS") throw new Error("LP184.1A is not the expected authoritative audit");
  const absent = ref("data-inventory.json", "accounts/payments/analytics/dataSaleSharing", "LP184.1A found no accounts, payments, analytics, advertising, tracking, or sale implementation.");
  const locEvidence = ref("location-privacy-audit.json", "preciseLocation/routeWatch/providerTransmission", "Precise foreground location and provider transmission are proven; background location is false.");
  const reportEvidence = ref("community-reporting-privacy-audit.json", "submittedFields/lifecycle", "Supabase report rows contain user content, coordinates, timestamps/lifecycle fields, and persistent device_id; deletion is not proven.");
  const idEvidence = ref("data-inventory.json", "dataClasses[persistent_device_identifier]", "device_id is persistent, transmitted, pseudonymous, and not anonymous.");
  const localEvidence = ref("data-inventory.json", "dataClasses[saved_places_and_preferences]/localStorage", "Saved places and preferences stay local; searches may be transmitted to Nominatim but server persistence is unknown.");

  const appleCategories = [
    noApple("Contact Info", "Name", absent), noApple("Contact Info", "Email Address", absent), noApple("Contact Info", "Phone Number", absent), noApple("Contact Info", "Physical Address", absent), noApple("Contact Info", "Other User Contact Info", absent),
    noApple("Health & Fitness", "Health", absent), noApple("Health & Fitness", "Fitness", absent),
    noApple("Financial Info", "Payment Info", absent), noApple("Financial Info", "Credit Info", absent), noApple("Financial Info", "Other Financial Info", absent),
    { dataCategory: "Location", dataSubcategory: "Precise Location", collected: "UNKNOWN", classification: "UNKNOWN_REQUIRES_APPLE_POLICY_REVIEW", linkedToUser: "UNKNOWN", usedForTracking: "NO", purposes: ["APP_FUNCTIONALITY"], requiredOrOptional: "OPTIONAL", evidence: [locEvidence, reportEvidence], storeInterpretationReviewRequired: true },
    { dataCategory: "Location", dataSubcategory: "Coarse Location", collected: "UNKNOWN", classification: "UNKNOWN_REQUIRES_APPLE_POLICY_REVIEW", linkedToUser: "UNKNOWN", usedForTracking: "NO", purposes: ["APP_FUNCTIONALITY"], requiredOrOptional: "OPTIONAL", evidence: [locEvidence], storeInterpretationReviewRequired: true },
    noApple("Sensitive Info", "Sensitive Information", absent), noApple("Contacts", "Contacts", absent),
    { dataCategory: "User Content", dataSubcategory: "Other User Content", collected: "YES", linkedToUser: "UNKNOWN", usedForTracking: "NO", purposes: ["APP_FUNCTIONALITY"], requiredOrOptional: "OPTIONAL", evidence: [reportEvidence], storeInterpretationReviewRequired: true },
    noApple("Browsing History", "Browsing History", absent),
    { dataCategory: "Search History", dataSubcategory: "Search History", collected: "UNKNOWN", classification: "UNKNOWN_REQUIRES_APPLE_POLICY_REVIEW", linkedToUser: "UNKNOWN", usedForTracking: "NO", purposes: ["APP_FUNCTIONALITY"], requiredOrOptional: "OPTIONAL", evidence: [localEvidence, ref("third-party-service-inventory.json", "services[OpenStreetMap Nominatim]", "Search queries are sent to Nominatim; local/server persistence is not proven by LP184.1A.")], storeInterpretationReviewRequired: true },
    { dataCategory: "Identifiers", dataSubcategory: "Device ID", collected: "YES", linkedToUser: "UNKNOWN", usedForTracking: "NO", purposes: ["APP_FUNCTIONALITY"], requiredOrOptional: "OPTIONAL", evidence: [idEvidence], storeInterpretationReviewRequired: true },
    noApple("Identifiers", "User ID", absent), noApple("Purchases", "Purchase History", absent),
    noApple("Usage Data", "Product Interaction", absent), noApple("Usage Data", "Advertising Data", absent), noApple("Usage Data", "Other Usage Data", absent),
    noApple("Diagnostics", "Crash Data", absent), noApple("Diagnostics", "Performance Data", absent), noApple("Diagnostics", "Other Diagnostic Data", absent),
    { dataCategory: "Other Data", dataSubcategory: "Other Data Types", collected: "UNKNOWN", linkedToUser: "UNKNOWN", usedForTracking: "NO", purposes: ["APP_FUNCTIONALITY", "UNKNOWN"], requiredOrOptional: "UNKNOWN", evidence: [localEvidence], storeInterpretationReviewRequired: true }
  ];
  const apple = { ...common, status: "DRAFT_COMPLETE_APPLE_POLICY_REVIEW_REQUIRED", policyDecision: "APPLE_POLICY_REVIEW_REQUIRED", backgroundLocationCollected: "NO_IMPLEMENTATION_PROVEN", categories: appleCategories };

  const googleCategories = [
    { dataCategory: "Location", dataType: "Precise location — Supabase community report coordinates", collected: "YES", shared: "UNKNOWN", ephemeral: "NO", requiredOrOptional: "OPTIONAL", purposes: ["APP_FUNCTIONALITY"], encryptedInTransit: "UNKNOWN", deletionRequestSupported: "NO", evidence: [reportEvidence], platformReviewRequired: true },
    { dataCategory: "Location", dataType: "Precise location — transient OSRM/Nominatim requests", collected: "YES", shared: "UNKNOWN", ephemeral: "UNKNOWN", requiredOrOptional: "OPTIONAL", purposes: ["APP_FUNCTIONALITY"], encryptedInTransit: "UNKNOWN", deletionRequestSupported: "UNKNOWN", evidence: [locEvidence], platformReviewRequired: true },
    { dataCategory: "Location", dataType: "Approximate location", collected: "UNKNOWN", shared: "UNKNOWN", ephemeral: "UNKNOWN", requiredOrOptional: "OPTIONAL", purposes: ["APP_FUNCTIONALITY"], encryptedInTransit: "UNKNOWN", deletionRequestSupported: "UNKNOWN", evidence: [locEvidence], platformReviewRequired: true },
    noGoogle("Personal Info", "Name/email/address/phone/user IDs", absent), noGoogle("Financial Info", "Payment and purchase information", absent), noGoogle("Health and Fitness", "Health and fitness information", absent),
    noGoogle("Messages", "Emails/SMS/other in-app messages", absent), noGoogle("Photos and Videos", "Photos/videos", absent), noGoogle("Audio", "Voice/music/other audio", absent), noGoogle("Files and Documents", "Files/documents", absent), noGoogle("Calendar", "Calendar events", absent), noGoogle("Contacts", "Contacts", absent),
    { dataCategory: "App Activity", dataType: "Other user-generated content / community report activity", collected: "YES", shared: "UNKNOWN", ephemeral: "NO", requiredOrOptional: "OPTIONAL", purposes: ["APP_FUNCTIONALITY"], encryptedInTransit: "UNKNOWN", deletionRequestSupported: "NO", evidence: [reportEvidence], platformReviewRequired: true },
    { dataCategory: "App Activity", dataType: "App interactions / searches", collected: "UNKNOWN", shared: "UNKNOWN", ephemeral: "UNKNOWN", requiredOrOptional: "OPTIONAL", purposes: ["APP_FUNCTIONALITY"], encryptedInTransit: "UNKNOWN", deletionRequestSupported: "UNKNOWN", evidence: [localEvidence], platformReviewRequired: true },
    noGoogle("Web Browsing", "Web browsing history", absent), noGoogle("App Info and Performance", "Crash logs/diagnostics/performance", absent),
    { dataCategory: "Device or Other IDs", dataType: "Persistent pseudonymous device_id", collected: "YES", shared: "UNKNOWN", ephemeral: "NO", requiredOrOptional: "OPTIONAL", purposes: ["APP_FUNCTIONALITY"], encryptedInTransit: "UNKNOWN", deletionRequestSupported: "NO", evidence: [idEvidence], platformReviewRequired: true }
  ];
  const flows = thirdParty.services.map(service => ({
    provider: service.provider, dataCategory: service.provider === "Supabase" ? ["Location", "User Content", "Device or Other IDs"] : service.locationSent === true ? ["Location"] : service.provider.includes("Nominatim") ? ["Location", "Search History"] : ["Ordinary request metadata / inbound official data"],
    dataSent: service.dataSent, purpose: service.purpose, serverPersistenceKnown: "UNKNOWN", storeDisclosureImplication: ["DriveTexas/TxDOT", "Weather provider configured by runtime"].includes(service.provider) ? "DO_NOT_LABEL_INBOUND_OFFICIAL_OR_WEATHER_DATA_AS_USER_DATA_SHARING; review only actual request parameters" : "GOOGLE_POLICY_REVIEW_REQUIRED_FOR_SHARED; APPLE_POLICY_REVIEW_REQUIRED_FOR_COLLECTED", classificationConfidence: service.provider === "Supabase" || service.provider.startsWith("OSRM") || service.provider.includes("Nominatim") ? "HIGH_FLOW_CONFIDENCE_POLICY_CLASSIFICATION_UNRESOLVED" : "MEDIUM_OR_UNKNOWN"
  }));
  const google = { ...common, status: "DRAFT_COMPLETE_GOOGLE_POLICY_REVIEW_REQUIRED", policyDecision: "GOOGLE_POLICY_REVIEW_REQUIRED", backgroundLocationCollected: "NO_IMPLEMENTATION_PROVEN", categories: googleCategories, thirdPartyDataFlows: flows };

  const uncertaintyItems = [
    ["APPLE-LOCATION-001", "APPLE", "Does Apple's applicable collection definition include transient precise coordinates sent to routing/geocoding providers and report coordinates stored by Supabase?", "Apple store classification cannot be derived from network behavior alone.", true, true],
    ["APPLE-CONTENT-002", "APPLE", "Which Apple User Content and Location subcategories apply to community report category, detail, coordinates, timestamps, and lifecycle fields?", "Apple taxonomy interpretation is external to the repository.", true, true],
    ["APPLE-ID-003", "APPLE", "Is persistent pseudonymous device_id linked to the user under Apple's definition?", "Pseudonymous linkage is proven, but Apple's store meaning of linked is a policy question.", true, true],
    ["APPLE-SEARCH-004", "APPLE", "Does transmission of searches to Nominatim constitute collected Search History?", "Transmission is proven; storage and Apple classification are not.", true, true],
    ["GOOGLE-SHARING-001", "GOOGLE", "Are Supabase, OSRM, Nominatim, and tile-provider product-function transmissions shared under Google exclusions?", "Recipient flows are proven; service-provider/exclusion status is not.", true, true],
    ["GOOGLE-CONTENT-002", "GOOGLE", "Should community report fields map to App Activity, other user-generated content, or another Google type?", "Google taxonomy interpretation is external to the repository.", true, true],
    ["GOOGLE-ID-003", "GOOGLE", "How must persistent pseudonymous device_id be declared and is its transfer shared?", "Persistence and transmission are proven; platform classification is not.", true, true],
    ["BOTH-RETENTION-001", "BOTH", "What are actual provider/server retention periods and valid deletion declarations?", "Report expiry does not prove deletion; provider retention and deployed policy are unknown.", true, true],
    ["GOOGLE-DELETION-002", "GOOGLE", "Does store readiness require a consumer deletion request mechanism for this collected data?", "No operational consumer mechanism is proven; store/legal obligations are external.", true, true],
    ["BOTH-NATIVE-001", "BOTH", "Do absent native foreground-location declarations block native validation and store submission?", "Runtime/declaration mismatch is proven but native packaging outcome requires engineering/platform validation.", true, false]
  ].map(([id, platform, question, insufficient, blocks, legal]) => ({ id, platform, question, repositoryEvidence: [locEvidence, reportEvidence, idEvidence], whyRepositoryEvidenceIsInsufficient: insufficient, ownerDecisionRequired: true, platformPolicyReviewRequired: true, legalReviewRequired: legal, blocksStoreSubmission: blocks, blocksPublicLaunch: blocks, recommendedNextAction: "Obtain owner, platform-policy, native-engineering, and legal review as applicable; update the draft without guessing." }));
  const uncertainty = { ...common, status: "OPEN_POLICY_AND_OWNER_DECISIONS", items: uncertaintyItems };
  const permission = { ...common, classification: "NATIVE_PERMISSION_DISCLOSURE_MISMATCH_REVIEW_REQUIRED", android: { finding: "ANDROID_LOCATION_DECLARATION_REVIEW_REQUIRED", disposition: "UNKNOWN_REQUIRES_NATIVE_ENGINEERING_REVIEW", candidateImpacts: ["BLOCKS_NATIVE_BUILD_VALIDATION", "BLOCKS_STORE_SUBMISSION"], evidence: [ref("native-permission-audit.json", "android", native.android.result)] }, ios: { finding: "IOS_LOCATION_USAGE_DESCRIPTION_REVIEW_REQUIRED", disposition: "UNKNOWN_REQUIRES_NATIVE_ENGINEERING_REVIEW", candidateImpacts: ["BLOCKS_NATIVE_BUILD_VALIDATION", "BLOCKS_STORE_SUBMISSION"], evidence: [ref("native-permission-audit.json", "ios", native.ios.result)] }, nativeProjectsModified: false };
  const summary = { ...common, classification: "STORE_PRIVACY_MAPPING_COMPLETE_WITH_POLICY_REVIEW_REQUIRED", appleMappingStatus: apple.status, googleMappingStatus: google.status, preciseLocationMappingStatus: "PROVEN_FOREGROUND; APPLE_COLLECTION_POLICY_REVIEW_REQUIRED; GOOGLE_COLLECTION_YES_WITH_SHARING_REVIEW", backgroundLocationMappingStatus: "NO_IMPLEMENTATION_PROVEN", deviceIdentifierMappingStatus: "PERSISTENT_PSEUDONYMOUS_NOT_ANONYMOUS; PLATFORM_REVIEW_REQUIRED", communityContentMappingStatus: "COLLECTED_BY_SUPABASE; TAXONOMY_REVIEW_REQUIRED", thirdPartyDataFlowStatus: "PROVEN_FLOWS_MAPPED; SHARING/COLLECTION_POLICY_REVIEW_REQUIRED", retentionDisclosureStatus: "UNKNOWN", deletionMechanismStatus: "NOT_PROVEN_STORE_READINESS_BLOCKER", analyticsStatus: "ABSENT_NOT_INVENTED", advertisingTrackingStatus: "ABSENT_NOT_INVENTED", purchasePaymentStatus: "ABSENT_NOT_INVENTED", androidPermissionGap: permission.android.finding, iosPermissionGap: permission.ios.finding, storeSubmissionBlockers: uncertaintyItems.filter(x => x.blocksStoreSubmission).map(x => x.id), ownerDecisionsRequired: uncertaintyItems.map(x => x.id), platformPolicyReviewsRequired: uncertaintyItems.filter(x => x.platformPolicyReviewRequired).map(x => x.id), legalReviewRequired: uncertaintyItems.filter(x => x.legalReviewRequired).map(x => x.id), runtimeModified: false, nativeConfigModified: false, performsStoreSubmission: false, performsDeployment: false, performsDistribution: false, authorizationsChanged: false, scopedPreviewGovernancePreserved: true, secretSafety: "PASS_NO_SECRETS_EMITTED", sourceAuditClassification: sourceSummary.classification };
  return { "apple-app-privacy-draft.json": apple, "google-play-data-safety-draft.json": google, "store-privacy-uncertainty-register.json": uncertainty, "native-store-permission-gap.json": permission, "lp1841b-summary.json": summary };
}

const canonical = value => `${JSON.stringify(value, null, 2)}\n`;
export async function run(mode = "verify") {
  const expected = await createReports();
  if (mode === "build") { await mkdir(out, { recursive: true }); for (const [name, value] of Object.entries(expected)) await writeFile(path.join(out, name), canonical(value), "utf8"); }
  const mismatches = [];
  for (const [name, value] of Object.entries(expected)) { let actual = ""; try { actual = await readFile(path.join(out, name), "utf8"); } catch {} if (actual !== canonical(value)) mismatches.push(name); }
  if (mismatches.length) throw new Error(`LP184.1B deterministic verification failed: ${mismatches.join(", ")}`);
  console.log(`LP184.1B ${mode} passed (${Object.keys(expected).length} canonical reports).`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await run(process.argv[2] || "verify");
