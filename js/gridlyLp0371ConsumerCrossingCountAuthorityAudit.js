(function installGridlyLp0371ConsumerCrossingCountAuthorityAudit() {
  "use strict";

  const candidateAuthorities = Object.freeze({
    optionA: {
      id: "runtime-selected-crossings",
      label: "Runtime-selected crossings",
      recommendation: "not_recommended_as_product_authority",
      reason: "Runtime selection is observable but can be an implementation detail that diverges from awareness ownership and consumer visibility policy."
    },
    optionB: {
      id: "consumer-visible-after-production-visibility-policy",
      label: "Consumer-visible crossings after production visibility policy",
      recommendation: "recommended_counting_rule",
      reason: "This is the clearest consumer interpretation of watched coverage when paired with certified inventory and awareness geometry."
    },
    optionC: {
      id: "awareness-brief-count-owner",
      label: "Awareness Brief count owner",
      recommendation: "not_recommended_as_product_authority",
      reason: "The Awareness Brief is a presentation owner and should consume the authority rather than define it."
    },
    optionD: {
      id: "certified-inventory-plus-production-consumer-policy",
      label: "Existing certified inventory owner plus production consumer policy",
      recommendation: "recommended_product_authority",
      reason: "It preserves the existing data owner while making consumer-visible policy and selected awareness geometry the count contract."
    }
  });

  const recommendedDefinition = Object.freeze({
    counted: "Unique certified active-county crossing records that are reportable, consumer-visible under production crossing visibility policy, and geographically owned by the selected awareness area or county/community region.",
    excluded: [
      "duplicate crossing IDs",
      "hidden review records",
      "non-reportable grade-separated or non-highway records",
      "private-only crossings unless production policy explicitly marks them consumer-reportable",
      "industrial-only crossings unless public-roadway-facing and policy-visible",
      "rail-yard-only crossings",
      "temporary-access crossings unless certified active, reportable, public-roadway-facing, policy-visible, and inside the awareness geometry",
      "crossings outside selected awareness geometry",
      "fallback-selected crossings that do not independently satisfy the authority"
    ],
    watchedWhen: "A crossing is watched only after certified inventory ownership, production consumer visibility eligibility, and selected awareness geometry ownership all pass.",
    privateCrossingsCount: "no_unless_existing_policy_marks_consumer_reportable",
    industrialCrossingsCount: "only_if_reportable_public_roadway_and_policy_visible",
    railYardCrossingsCount: "no_unless_separately_policy_visible_public_roadway_crossing",
    temporaryAccessCrossingsCount: "no_by_default_only_if_certified_active_policy_visible_and_geometry_owned",
    outsideAwarenessGeometryCount: "no",
    fallbackSelectedCrossingsCount: "no_not_by_fallback_alone"
  });

  function audit() {
    return {
      available: true,
      milestone: "LP037.1",
      candidateAuthorities,
      currentRuntimeOwner: "loadCrossings() normalizes certified package features, applies shouldShowCrossingInLaunchMode(), and assigns the active runtime crossings inventory.",
      currentConsumerOwner: "Awareness summary uses selected awareness area, county/community anchor, town/radius logic, and fallback behavior to derive crossingsInArea.",
      currentUiOwner: "Bottom panel and awareness summary copy format the consumer-facing watched crossing line from the display summary count.",
      currentAwarenessBriefOwner: "Awareness Brief/mobile awareness models can use a separate crossing-context count for briefing metadata.",
      ownershipDivergenceStage: "Divergence begins after certified package normalization, when runtime inventory, consumer awareness selection, UI display count, and Awareness Brief context follow separate ownership paths.",
      recommendedAuthority: candidateAuthorities.optionD,
      recommendedCountingRule: candidateAuthorities.optionB,
      recommendedDefinition,
      visibilityPolicyRelationship: "Production visibility policy is an eligibility gate for the consumer count, not a separate owner; marker rendering, viewport optimization, and fallback selection must not redefine watched coverage.",
      futureRepairStrategy: [
        "Freeze the product definition before count repair.",
        "Build a passive shared selector from certified inventory, production visibility policy, and selected awareness geometry.",
        "Certify the selector across operational counties, configured communities, Houston child regions, county mode, and community mode.",
        "Compare runtime, consumer, UI, and Awareness Brief counts against the selector.",
        "Migrate surfaces to the selector only after certification; do not make Spring Branch-specific repairs."
      ],
      SpringBranchExample: {
        purpose: "certification_example_only",
        observedRuntimeUniqueCrossings: 46,
        harrisInventoryCrossings: 1159,
        productInterpretation: "46 crossings watched should be accepted only if those 46 records also satisfy certified inventory, production consumer visibility policy, and Spring Branch awareness geometry ownership.",
        discrepancyCanRepeatElsewhere: true
      },
      regionalApplicability: {
        operationalCounties: true,
        configuredCommunities: true,
        houstonChildRegions: true,
        countyMode: true,
        communityMode: true,
        futureTexasCounties: true,
        futureStateExpansion: true
      },
      passive: true,
      noWrites: true,
      noRuntimeActivation: true,
      noMapMovement: true,
      noNetworkMutations: true
    };
  }

  if (typeof window !== "undefined") {
    window.gridlyLp0371ConsumerCrossingCountAuthorityAudit = audit;
  }
})();
