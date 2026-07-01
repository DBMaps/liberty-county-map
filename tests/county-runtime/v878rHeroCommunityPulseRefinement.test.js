const fs = require('fs');
const assert = require('assert');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function includes(text, message) {
  assert(appSource.includes(text), message);
}

includes('return { headline: "Community is quiet.", subline: "Travel normally today.", state: "quiet" };', 'quiet hero pulse gives calm travel guidance');
includes('return { headline: "Travel issue nearby.", subline: "Stay aware while traveling.", state: "one_issue" };', 'single issue hero pulse gives response guidance without incident details');
includes('return { headline: "Travel impacts nearby.", subline: "Allow extra travel time.", state: "multiple_issues" };', 'multiple issue hero pulse gives extra-time guidance');
includes('return { headline: "Community activity increasing.", subline: "Use extra caution today.", state: "high" };', 'high activity hero pulse stays general and action-oriented');
includes('ownershipPulse?.headline || model.renderedPulseHeadline', 'hero pulse rendering does not reuse Awareness Brief display summaries');
includes('heroProvidesResponseGuidance: heroHasIssueCountWhenApplicable', 'ownership audit verifies response guidance');
includes('heroDoesNotExposeIncidentDetails: heroAvoidsIncidentDetails', 'ownership audit verifies incident details stay out of Hero');
includes('const loadingCleared = !/checking nearby conditions|finding your awareness area|loading local reports/i.test(heroCombined);', 'loading-language audit is scoped to Hero copy after awareness availability');
includes('version: "V880-home-language-presentation-polish"', 'V880 audit version is exposed');

console.log('V878R Hero Community Pulse refinement checks passed');
