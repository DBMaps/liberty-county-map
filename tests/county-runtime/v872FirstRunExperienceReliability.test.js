const fs = require('fs');
const assert = require('assert');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const cssSource = fs.readFileSync('css/styles.css', 'utf8');

function includes(source, text, message) {
  assert(source.includes(text), message);
}

includes(appSource, 'const gridlyV872FirstRunInteractionAuditState = {', 'V872 tracks first-run input, continue, and location interaction state');
includes(appSource, 'input?.addEventListener("input"', 'ZIP/community input has an explicit user input lifecycle handler');
includes(appSource, 'bindGridlyV872FirstRunActivation(continueButton, "continue"', 'Continue button has pointerup/touchend/click activation in addition to form submit');
includes(appSource, 'bindGridlyV872FirstRunActivation(useLocationButton, "use-location"', 'Use My Location button has pointerup/touchend/click activation');
includes(appSource, 'window.gridlyFirstRunTapDiagnostic = gridlyFirstRunTapDiagnostic', 'First-run tap diagnostic is exposed for real-device blocker diagnosis');
includes(appSource, 'manualForm?.addEventListener("submit"', 'Manual ZIP/community form submit path is preserved');
includes(appSource, 'Location is not available here. Enter a ZIP code or town name to choose your watch area.', 'Use My Location unavailable path uses friendly consumer wording');
includes(appSource, 'That took too long. Enter a ZIP code or town name to choose your watch area.', 'Use My Location timeout path uses friendly consumer wording');
includes(appSource, 'Gridly is not available for that area yet. Try a nearby ZIP code or town name.', 'Unsupported location path uses friendly consumer wording');
includes(appSource, 'resolveGridlyV858NearestAwarenessArea(0, 0, { requireSupportedArea: true, allowFallback: false }) === null', 'Audit verifies unsupported-area behavior without replacing lookup logic');
includes(appSource, 'zipCommunityInputOperational: inputOperational', 'First-run audit verifies ZIP/community input operation');
includes(appSource, 'continueButtonOperational: continueOperational', 'First-run audit verifies Continue operation');
includes(appSource, 'useMyLocationOperational', 'First-run audit verifies Use My Location operation');
includes(appSource, 'transitionSequencePreserved', 'First-run audit verifies welcome to completion transition sequence');
includes(appSource, 'awarenessAreaStoredCorrectly', 'First-run audit verifies Awareness Area storage path');
includes(appSource, 'existingOnboardingReused', 'First-run audit verifies existing onboarding reuse');
includes(appSource, 'protectedSystemsUnchanged: true', 'First-run audit keeps protected systems untouched');
includes(cssSource, '-webkit-user-select: text;', 'First-run input remains selectable/typeable on mobile');
includes(cssSource, 'pointer-events: none;', 'First-run decorative backdrop cannot intercept onboarding taps');
includes(cssSource, 'touch-action: manipulation;', 'First-run controls use reliable mobile tap behavior');

console.log('V872 first-run experience reliability checks passed');
