(function initializeGridlySavedPlaceRevalidationOwnership(global) {
  "use strict";

  const CONTRACT_NAME = "GRIDLY_SAVED_PLACE_REVALIDATION_OWNERSHIP_CONTRACT";
  const SLOTS = Object.freeze(["home", "work"]);

  function stableSerialize(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }

  function fingerprintSerialized(serialized = "") {
    let hash = 2166136261;
    for (let index = 0; index < serialized.length; index += 1) {
      hash ^= serialized.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `saved-place-${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function fingerprint(place) {
    return fingerprintSerialized(stableSerialize(place ?? null));
  }

  function createController({ getState, saveState, shouldRevalidate, revalidatePlace, onResolution } = {}) {
    if (typeof getState !== "function" || typeof saveState !== "function"
        || typeof shouldRevalidate !== "function" || typeof revalidatePlace !== "function") {
      throw new TypeError("Saved-place revalidation ownership requires state, persistence, and revalidation functions.");
    }

    const diagnostics = {
      revalidationRunCount: 0,
      slotAttempts: { home: [], work: [] },
      staleCompletionSuppressionCount: 0
    };

    async function runSlot(slot, startingPlace) {
      const startingSerialized = stableSerialize(startingPlace);
      const attempt = {
        slot,
        startingIdentity: fingerprintSerialized(startingSerialized),
        completionResult: "pending",
        ownershipStillCurrent: null,
        commitApplied: false,
        commitSuppressed: false,
        suppressionReason: null,
        crossSlotPreserved: null
      };
      diagnostics.slotAttempts[slot].push(attempt);

      const outcome = await revalidatePlace({ slot, place: startingPlace });
      attempt.completionResult = String(outcome?.result || (outcome?.attempted === false ? "not_required" : "completed"));
      if (typeof onResolution === "function") onResolution(outcome, slot);

      const currentState = getState();
      const currentPlace = currentState?.[slot] ?? null;
      const ownershipStillCurrent = stableSerialize(currentPlace) === startingSerialized;
      attempt.ownershipStillCurrent = ownershipStillCurrent;
      if (!ownershipStillCurrent) {
        attempt.commitSuppressed = true;
        attempt.suppressionReason = currentPlace == null ? "slot_deleted" : "slot_replaced";
        diagnostics.staleCompletionSuppressionCount += 1;
        return { slot, outcome, commitApplied: false, suppressionReason: attempt.suppressionReason };
      }

      const otherSlotsBefore = Object.fromEntries(Object.entries(currentState).filter(([key]) => key !== slot));
      saveState({ ...currentState, [slot]: outcome.place });
      const publishedState = getState();
      const otherSlotsAfter = Object.fromEntries(Object.entries(publishedState).filter(([key]) => key !== slot));
      attempt.crossSlotPreserved = stableSerialize(otherSlotsAfter) === stableSerialize(otherSlotsBefore);
      attempt.commitApplied = true;
      return { slot, outcome, commitApplied: true, suppressionReason: null };
    }

    async function revalidateSlots() {
      diagnostics.revalidationRunCount += 1;
      const startingState = getState();
      const attempts = SLOTS
        .filter((slot) => shouldRevalidate(startingState?.[slot], slot))
        .map((slot) => runSlot(slot, startingState[slot]));
      return Promise.all(attempts);
    }

    function audit() {
      const slotAttempts = Object.freeze(Object.fromEntries(SLOTS.map((slot) => [
        slot,
        Object.freeze(diagnostics.slotAttempts[slot].map((attempt) => Object.freeze({ ...attempt })))
      ])));
      const attempts = SLOTS.flatMap((slot) => slotAttempts[slot]);
      const staleCommitApplied = attempts.some((attempt) => attempt.ownershipStillCurrent === false && attempt.commitApplied);
      const deletionRecreated = attempts.some((attempt) => attempt.suppressionReason === "slot_deleted" && attempt.commitApplied);
      const crossSlotPreservationPass = !attempts.some((attempt) => attempt.crossSlotPreserved === false);
      const sameSlotReplacementProtectionPass = !staleCommitApplied;
      const deletionProtectionPass = !deletionRecreated;
      return Object.freeze({
        available: true,
        revalidationRunCount: diagnostics.revalidationRunCount,
        slotAttempts,
        staleCompletionSuppressionCount: diagnostics.staleCompletionSuppressionCount,
        crossSlotPreservationPass,
        sameSlotReplacementProtectionPass,
        deletionProtectionPass,
        overallPass: crossSlotPreservationPass && sameSlotReplacementProtectionPass && deletionProtectionPass
      });
    }

    return Object.freeze({ revalidateSlots, audit });
  }

  global.GRIDLY_SAVED_PLACE_REVALIDATION_OWNERSHIP_CONTRACT = Object.freeze({
    name: CONTRACT_NAME,
    version: "LP244.7",
    slots: SLOTS,
    fingerprint,
    createController
  });
})(typeof window !== "undefined" ? window : globalThis);
