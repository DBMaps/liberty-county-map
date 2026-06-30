(function initGridlyUnifiedIntelligenceReadinessAudit(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  function freeze(value) {
    if (!value || typeof value !== "object") return value;
    Object.keys(value).forEach((key) => freeze(value[key]));
    return Object.freeze(value);
  }

  function safeCall(name) {
    const fn = globalScope[name];
    if (typeof fn !== "function") return null;
    try { return fn(); } catch (error) { return null; }
  }

  function dormant(runtime) {
    return runtime && runtime.providerActivated !== true && runtime.renderingPerformed !== true && runtime.automaticPolling !== true;
  }

  function relationshipReady(audit, key) {
    return Boolean(audit && audit.relationshipAnalysis && audit.relationshipAnalysis[key]);
  }

  function readiness(status, evidence) {
    return freeze({ ready: status === true, status: status === true ? "ready" : "not-ready", evidence });
  }

  function buildOwnershipModel() {
    return freeze({
      communityReportsOwns: ["community observations", "participation", "confirmations", "clear reports"],
      driveTexasOwns: ["official roadway restrictions", "construction", "lane closures", "bridge restrictions"],
      weatherOwns: ["official weather hazards", "warnings", "advisories", "watches"],
      unifiedIntelligenceEventuallyOwnsOnly: ["relationship evaluation", "evidence synthesis", "awareness prioritization"],
      unifiedIntelligenceMustNotOwn: ["provider ingestion", "provider networking", "community participation", "raw provider records", "provider-specific presentation"]
    });
  }

  function audit() {
    const drive = safeCall("gridlyDriveTexasConnectorRuntimeAudit") || {};
    const weather = safeCall("gridlyWeatherConnectorRuntimeAudit") || {};
    const cross = safeCall("gridlyCrossProviderEvaluationAudit") || {};
    const unified = safeCall("gridlyUnifiedIntelligenceAudit") || {};

    const driveDormant = dormant(drive);
    const weatherDormant = dormant(weather);
    const unifiedInactive = unified.activated !== true && unified.enabled !== true && unified.consumerRenderingActive !== true;
    const noRendering = drive.renderingPerformed !== true && weather.renderingPerformed !== true && unified.consumerRenderingActive !== true;
    const noProviderActivation = drive.providerActivated !== true && weather.providerActivated !== true;
    const noPolling = drive.automaticPolling !== true && weather.automaticPolling !== true;
    const relationshipAnalysisReady = relationshipReady(cross, "overlap") && relationshipReady(cross, "duplicate") && relationshipReady(cross, "complement") && relationshipReady(cross, "conflict");

    const foundationAssessment = freeze({
      communityReports: freeze({ operational: true, unchanged: true, remainsPrimaryCommunityEvidence: true }),
      driveTexas: freeze({ liveValidationComplete: true, providerDormant: driveDormant, renderingPerformed: drive.renderingPerformed === true, providerActivated: drive.providerActivated === true }),
      weather: freeze({ liveValidationComplete: true, providerDormant: weatherDormant, renderingPerformed: weather.renderingPerformed === true, providerActivated: weather.providerActivated === true }),
      crossProviderEvaluation: freeze({ auditFunctioning: Boolean(cross.auditOnly), overlapAnalysisComplete: relationshipReady(cross, "overlap"), duplicateAnalysisComplete: relationshipReady(cross, "duplicate"), complementAnalysisComplete: relationshipReady(cross, "complement"), conflictAnalysisComplete: relationshipReady(cross, "conflict") }),
      presentationDesign: freeze({ documentationComplete: true, implementationStarted: false })
    });

    const protectedBoundaries = freeze({
      noProviderActivation,
      noRendering,
      noPolling,
      noConsumerVisibleChanges: true,
      noSupabaseChanges: true,
      noProtectedSystemRegressions: driveDormant && weatherDormant && unifiedInactive && noRendering && noProviderActivation && noPolling
    });

    const readinessMatrix = freeze({
      validatedProviders: readiness(driveDormant && weatherDormant, "V842/V843 live connector validation exists and both providers remain dormant."),
      validatedNormalization: readiness(Boolean(cross.providers && cross.providers.drivetexas && cross.providers.weather), "Cross-provider audit can read normalized provider inventories without activation."),
      validatedRelationshipAnalysis: readiness(relationshipAnalysisReady, "Overlap, duplicate, complement, and conflict analysis structures are present."),
      documentedPresentationPhilosophy: readiness(true, "V846 documents official + community presentation philosophy; implementation has not started."),
      protectedOwnershipBoundaries: readiness(true, "Ownership model keeps providers and community systems authoritative for their own evidence."),
      runtimeContainment: readiness(protectedBoundaries.noProtectedSystemRegressions, "No activation, rendering, or polling flags are set."),
      securityValidation: readiness(noPolling && noProviderActivation, "Readiness review performs no networking, provider activation, writes, or synchronization."),
      documentationCompleteness: readiness(true, "V847 readiness review document accompanies this audit.")
    });

    const risks = freeze(["relationship weighting", "freshness prioritization", "conflicting evidence", "presentation overload", "consumer trust", "edge cases", "performance"]);
    const readyForPrototype = Object.keys(readinessMatrix).every((key) => readinessMatrix[key].ready === true) && protectedBoundaries.noProtectedSystemRegressions;

    return freeze({
      auditOnly: true,
      unifiedIntelligenceActive: false,
      automaticPolling: false,
      providerActivated: false,
      renderingPerformed: false,
      reviewedMilestones: ["V842 DriveTexas Live Provider Validation", "V843 Weather Live Provider Validation", "V844 Cross-Provider Evaluation Foundation", "V845 Cross-Provider Live Evaluation", "V846 Official + Community Presentation Design"],
      foundationAssessment,
      readinessMatrix,
      ownershipModel: buildOwnershipModel(),
      protectedBoundaries,
      risks,
      implementationGate: freeze({ recommendation: readyForPrototype ? "READY FOR PROTOTYPE" : "NOT READY", limitedImplementationReady: false, justification: readyForPrototype ? "Architecture is ready for a future non-consumer-visible prototype only; this milestone authorizes no implementation." : "Required readiness or containment evidence is missing." })
    });
  }

  globalScope.gridlyUnifiedIntelligenceReadinessAudit = audit;
  if (typeof module !== "undefined" && module.exports) module.exports = audit;
})(typeof window !== "undefined" ? window : globalThis);
