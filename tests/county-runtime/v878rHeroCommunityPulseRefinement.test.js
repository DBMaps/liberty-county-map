const fs = require('fs');
const assert = require('assert');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function includes(text, message) {
  assert(appSource.includes(text), message);
}

includes('return { headline: "Community is quiet.", subline: "No significant travel concerns.", state: "quiet" };', 'quiet hero pulse communicates overall community state');
includes('return { headline: "Travel issue nearby.", subline: "1 active issue reported.", state: "one_issue" };', 'single issue hero pulse includes count without incident details');
includes('return { headline: "Travel impacts nearby.", subline: `${count} active issues reported.`, state: "multiple_issues" };', 'multiple issue hero pulse includes issue-count awareness');
includes('return { headline: "Community conditions changing.", subline: "Multiple impacts reported nearby.", state: "high" };', 'high activity hero pulse stays general');
includes('ownershipPulse?.headline || model.renderedPulseHeadline', 'hero pulse rendering does not reuse Awareness Brief display summaries');
includes('heroIncludesIssueCountAwareness: heroHasIssueCountWhenApplicable', 'ownership audit verifies issue-count awareness');
includes('heroDoesNotExposeIncidentDetails: heroAvoidsIncidentDetails', 'ownership audit verifies incident details stay out of Hero');
includes('const loadingCleared = !/checking nearby conditions|finding your awareness area|loading local reports/i.test(heroCombined);', 'loading-language audit is scoped to Hero copy after awareness availability');
includes('version: "V878R-hero-community-pulse-refinement"', 'V878R audit version is exposed');

console.log('V878R Hero Community Pulse refinement checks passed');
