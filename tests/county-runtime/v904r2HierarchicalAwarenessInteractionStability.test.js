const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

assert(
  source.includes('function gridlyRefreshSettingsAwarenessDisplayOnly(saved = "")'),
  'settings community save uses a display-only refresh helper'
);

const saveFunction = source.match(/function selectGridlySettingsAwarenessArea\([\s\S]*?\n\}/)?.[0] || '';
assert(saveFunction.includes('gridlyRefreshSettingsAwarenessDisplayOnly(saved);'), 'community save refreshes labels without rebuilding selector');
assert(!saveFunction.includes('renderGridlySettingsAwarenessControl();'), 'community save must not rebuild/replace the selector');
assert(!saveFunction.includes('setGridlySettingsAwarenessChooserOpen(false);'), 'community save must not immediately collapse the chooser');

const settingsBinding = source.match(/els\.settingsAwarenessAreaChooser\.addEventListener\("change", \(event\) => \{[\s\S]*?\n    \}\);\n  \}/)?.[0] || '';
assert(settingsBinding.includes('updateGridlySettingsAwarenessCommunityOptions(els.settingsAwarenessAreaChooser, target.value);'), 'county changes may rebuild community options');
assert(settingsBinding.includes('selectGridlySettingsAwarenessArea(target.value || "", "legacy_settings_awareness_area");'), 'community changes persist the selected community');
assert(!settingsBinding.includes('focus'), 'community focus/open path is not bound to selector rebuilds');
assert(!settingsBinding.includes('click'), 'community click/tap path is not bound to selector rebuilds');

[
  'communitySelectStableElement',
  'communitySelectNotReplacedOnFocus',
  'communitySelectNotHiddenOnInteraction',
  'communitySelectPointerTargetClear',
  'noOverlayInterceptingCommunitySelect',
  'interactionStabilityPasses'
].forEach((field) => {
  assert(source.includes(field), `${field} is reported by the V904 audit helper`);
});
assert(
  source.includes('visibleBehaviorMatchesAudit && interactionStabilityPasses'),
  'safeForBeta requires interaction stability to pass'
);

console.log('v904r2HierarchicalAwarenessInteractionStability.test.js passed');
