#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyVisual, json } from './core.mjs';

const copy = [
  ['Welcome to Gridly', 'Know Before You Go.', 'Local conditions, official signals, and community reports in one awareness-first view.', 'Gridly logo'],
  ['Know Before You Go', 'Current conditions before you leave.', "Illustration of Gridly's travel brief and current conditions experience"],
  ["See what's happening nearby", 'Nearby reports and roadway conditions.', "Illustration of Gridly's nearby map and local roadway context"],
  ['Stay informed with important updates', 'Important changes when conditions shift.', "Illustration of Gridly's important condition and community alerts"],
  ['Your report helps everyone nearby', 'Share what you see when it is safe.', "Illustration of Gridly's community hazard reporting choices"],
  ['Make Gridly yours', 'Choose your area and preferences.', "Illustration of Gridly's awareness area and personalization settings"],
  ['Set your awareness area', 'Use your location or enter a ZIP code or town', 'Location is optional. Choose a watch area now, or finish and set it later.'],
];
function flatten(node) { return node ? [node, ...(node.children || []).flatMap(flatten)] : []; }
function valid(rect) { return rect && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(rect[k])) && rect.width > 0 && rect.height > 0; }
function inside(rect, screen) {
  return valid(rect) && valid(screen) && rect.x + rect.width / 2 >= screen.x && rect.x + rect.width / 2 <= screen.x + screen.width && rect.y + rect.height / 2 >= screen.y && rect.y + rect.height / 2 <= screen.y + screen.height;
}
function union(rects) {
  if (!rects.length) return null;
  const x = Math.min(...rects.map(r => r.x)), y = Math.min(...rects.map(r => r.y));
  return { x, y, width: Math.max(...rects.map(r => r.x + r.width)) - x, height: Math.max(...rects.map(r => r.y + r.height)) - y };
}
export function measurePage(page) {
  const nodes = flatten(page.accessibility), visible = nodes.filter(n => inside(n.frame, page.appFramePoints));
  const required = copy[page.page - 1] || [];
  const exact = label => visible.filter(n => n.label === label);
  const observedCopy = required.map(label => ({ label, frames: exact(label).map(n => n.frame), observed: exact(label).length > 0 }));
  const content = union(observedCopy.flatMap(c => c.frames));
  const navigation = visible.filter(n => ['Next', 'Back', 'Finish', 'Skip walkthrough'].includes(n.label)).map(n => ({ label: n.label, enabled: n.enabled, frame: n.frame }));
  const regions = visible.filter(n => ['Quick Tour cards and setup', 'Quick Tour cards and setup, region'].includes(n.label));
  // This observed region includes the pager/navigation. It is NOT relabelled as
  // a card, safe area, or CSS layout box merely to produce a passing metric.
  const region = regions.length === 1 ? regions[0].frame : null;
  const metric = content && region ? { contentCenterY: content.y + content.height / 2, regionCenterY: region.y + region.height / 2,
    centerOffsetFraction: (content.y + content.height / 2 - region.y - region.height / 2) / region.height,
    unusedUpperPoints: content.y - region.y, unusedLowerPoints: region.y + region.height - content.y - content.height } : null;
  return { page: page.page, title: page.visibleTitle, screenPixels: page.screenPixels, appFramePoints: page.appFramePoints,
    observedCopy, contentBoundsFromAccessibleCopy: content, navigation, logoFrames: exact('Gridly logo').map(n => n.frame),
    observedPagerRegion: region, pagerRelativeMeasurements: metric,
    safeAreaBounds: null, cardBounds: null, classification: 'INCONCLUSIVE — HUMAN VISUAL CONFIRMATION REQUIRED',
    limitation: 'Metrics compare accessible copy/images with an observed named pager region, not true card/safe-area bounds. Hidden AX nodes and omitted decorative content require screenshot corroboration.' };
}

export function onboardingFailures(pages, events, screens, screenshotCount) {
  const errors = [];
  const evidence = name => screens.some(s => s.name === name && s.accessibility && s.screenPixels?.width > 0 && s.screenPixels?.height > 0);
  if (pages.length !== 7 || pages.some((p, i) => p.page !== i + 1 || !p.accessibility || !evidence('onboarding-' + (i + 1)))) errors.push('Missing ordered seven-page screenshot/accessibility coverage');
  if (screenshotCount < screens.length || !screens.length) errors.push('Missing physical screenshot attachments');
  if (!events.some(e => e.action === 'page-1-start' && evidence(e.evidence))) errors.push('Page-1 start not proven');
  const transition = (control, from, to) => events.some(e => e.action === 'transition' && e.control === control && e.from === from && e.to === to && evidence(e.evidence));
  for (let from = 1; from < 7; from++) if (!transition('Next', from, from + 1)) errors.push('Missing Next transition ' + from);
  if (!transition('Back', 2, 1) || !events.some(e => e.action === 'transition' && e.control === 'Next' && e.from === 1 && e.to === 2 && e.evidence === 'forward-restored-page-2' && evidence(e.evidence))) errors.push('Back/forward restoration not proven');
  for (const [label, identifier, state] of [['Finish', 'gridlyV894C2FirstRunFinishBtn', 'after-Finish'], ['Skip walkthrough', 'gridlyV894CFirstRunSkipBtn', 'after-Skip']]) {
    const tap = events.findIndex(e => e.action === 'required-tap' && e.label === label && e.identifier === identifier);
    const result = events.findIndex(e => e.action === 'post-onboarding' && e.control === state && evidence(e.evidence));
    if (tap < 0 || result <= tap) errors.push('Missing actionable control/result: ' + label);
  }
  if (!events.some(e => e.action === 'onboarding-complete' && e.journeyStarted === false) || events.some(e => e.status === 'BLOCKED')) errors.push('Onboarding incomplete or blocked');
  if (events.some(e => e.gate === 'R1-real-geolocation' || e.label === 'Around Me — use my location')) errors.push('Journey must be separate');
  return errors;
}

// Journey evidence is independent of the already accepted onboarding sequence.
export const journeyStates = ['home', 'search-open', 'search-results', 'destination-selected', 'destination', 'destination-return-home', 'kbyg-expanded', 'weather',
  'alerts-open', 'map-zoom-in', 'map-zoom-restored', 'road-awareness', 'layers-open', 'around-me', 'return-home', 'resume', 'relaunch'];
export const journeyIdentities = {
  home: ['LOCATION CONTEXT • DAYTON', 'Open Alerts', 'Know Before You Go'],
  'search-open': ['Where are you going?, web dialog', 'Search addresses and places'],
  'destination-selected': ['SELECTED DESTINATION', 'Austin', 'Ready to preview.'],
  'destination-return-home': ['LOCATION CONTEXT • DAYTON', 'Search'],
  'road-awareness': ['Official Roadways', 'No active official roadway conditions.'],
  'layers-open': ['Map Layers, web dialog', 'Standard', 'Satellite', 'Close Layers'],
  destination: ['LOCATION CONTEXT • AUSTIN', 'Return Home'],
  'search-results': ['Where are you going?, web dialog', 'Austin Multi-county Community · Bastrop County · Hays County · Travis County · Williamson County Place'],
  'alerts-open': ['No Active Alerts, web dialog', 'Close Alerts', 'Official Roadways, 0 active conditions, application status', 'Weather, 0 active conditions, application status'],
  'kbyg-expanded': ['Know Before You Go, region', 'Official Roadways'],
  weather: ['Know Before You Go, region', 'Weather', 'No active weather alerts.'],
  'map-zoom-in': ['Interactive travel conditions map. Use arrow keys to pan., region'],
  'map-zoom-restored': ['Interactive travel conditions map. Use arrow keys to pan., region'],
  'around-me': ['LOCATION CONTEXT • AROUND ME', 'Return Home'],
  'return-home': ['LOCATION CONTEXT • DAYTON', 'Search'],
  resume: ['LOCATION CONTEXT • DAYTON', 'Search'],
  relaunch: ['LOCATION CONTEXT • DAYTON', 'Search'],
};
export const journeyRenderedIdentities = Object.fromEntries(journeyStates.map(name => [name, ({
  'search-open': ['where are you going', 'search'],
  'search-results': ['best matches', 'austin', 'multi-county'],
  'destination-selected': ['selected destination', 'austin', 'ready to preview'],
  destination: ['location context', 'austin', 'return home'],
  'kbyg-expanded': ['official roadways', 'no active official roadway conditions'],
  'road-awareness': ['official roadways', 'no active official roadway conditions'],
  weather: ['weather', 'no active weather alerts'],
  'alerts-open': ['no active alerts', '0 active conditions', 'no active community reports', 'no active weather alerts'],
  'layers-open': ['map layers', 'standard', 'satellite'],
  'around-me': ['location context', 'around me', 'return home'],
})[name] || ['location context', 'dayton', 'search']]));
export const journeyControls = {
  'search-open': ['Search', 1],
  'search-results': ['Search addresses and places', 9],
  'destination-selected': ['Austin Multi-county Community · Bastrop County · Hays County · Travis County · Williamson County Place', 9],
  destination: ['Close destination search', 9],
  'destination-return-home': ['Return Home', 9],
  'kbyg-expanded': ['Know Before You Go', 9],
  'alerts-open': ['Open Alerts', 1],
  'map-zoom-in': ['Zoom in', 9],
  'map-zoom-restored': ['Zoom out', 9],
  'layers-open': ['Layers', 1],
  'around-me': ['Around Me — use my location', 9],
  'return-home': ['Return Home', 9],
};
export function journeyFailures(events, screens, screenshotNames) {
  const failures = [];
  for (const name of journeyStates) {
    const matches = screens.filter(s => s.name === name);
    const screen = matches[0];
    if (matches.length !== 1 || !screen?.accessibility || !(screen.screenPixels?.width > 0)
        || !(screen.screenPixels?.height > screen.screenPixels?.width) || !screenshotNames.includes(name)) {
      failures.push('Missing unique portrait screenshot/AX: ' + name); continue;
    }
    const settled = events.filter(e => e.action === 'settled' && e.evidence === name && e.stableFrames >= 3);
    if (settled.length !== 1 || !settled[0].required?.length) { failures.push('Missing settled state identity: ' + name); continue; }
    if (typeof settled[0].rawRenderedText !== 'string' || settled[0].renderedText !== settled[0].rawRenderedText.replaceAll(' o active conditions', ' 0 active conditions') || typeof settled[0].renderedText !== 'string' || !journeyRenderedIdentities[name].every(text => settled[0].renderedText.includes(text))) failures.push('Rendered screenshot identity not proven: ' + name);
    const tail = settled[0].samples?.slice(-2);
    if (!tail || tail.length !== 2 || tail.some(s => s.ready !== true || s.sameAX !== true || !Number.isFinite(s.meanPixelDelta)
        || s.meanPixelDelta < 0 || s.meanPixelDelta > 1 || !Number.isFinite(s.changedChannelFraction)
        || s.changedChannelFraction < 0 || s.changedChannelFraction > 0.005)) failures.push('Missing measured render stability: ' + name);
    const nodes = flatten(screen.accessibility).filter(n => inside(n.frame, screen.appFramePoints));
    if (name === 'weather') {
      const regions = nodes.filter(n => n.label === 'Know Before You Go, region');
      const weather = nodes.filter(n => n.type === 48 && ['Weather', 'No active weather alerts.'].includes(n.label));
      const within = (r, p) => valid(r) && valid(p) && r.x >= p.x && r.y >= p.y && r.x + r.width <= p.x + p.width && r.y + r.height <= p.y + p.height;
      if (regions.length !== 1 || weather.length !== 2 || !weather.every(n => within(n.frame, regions[0].frame))) failures.push('Weather not uniquely visible inside KBYG viewport');
    }
    if (![...settled[0].required, ...(journeyIdentities[name] || [])].every(label => nodes.some(n => n.label === label))) failures.push('Settled identity absent in AX: ' + name);
  }
  for (const [name, [label, role]] of Object.entries(journeyControls)) {
    const end = events.findIndex(e => e.action === 'settled' && e.evidence === name);
    const prior = events.slice(0, end).findLastIndex(e => e.action === 'settled');
    if (end < 0 || !events.slice(prior + 1, end).some(e => e.action === 'journey-tap' && e.label === label && e.role === role)) failures.push('Missing physical control before state: ' + name);
  }
  for (const [state, evidence] of [['background', 'resume'], ['terminated', 'relaunch']]) {
    const action = events.findIndex(e => e.action === 'lifecycle' && e.state === state);
    const result = events.findIndex(e => e.action === 'settled' && e.evidence === evidence);
    if (action < 0 || result <= action) failures.push('Missing lifecycle transition: ' + state);
  }
  if (!events.some(e => e.action === 'journey-type' && e.text === 'Austin, Texas')) failures.push('Exact destination search not proven');
  const contextOrder = ['home', 'search-results', 'destination-selected', 'destination', 'destination-return-home', 'around-me', 'return-home', 'resume', 'relaunch']
    .map(name => events.findIndex(e => e.action === 'settled' && e.evidence === name));
  if (contextOrder.some((index, i) => index < 0 || (i > 0 && index <= contextOrder[i - 1]))) failures.push('Context/lifecycle evidence order invalid');
  if (!events.some(e => e.action === 'journey-complete') || events.some(e => e.status === 'BLOCKED')) failures.push('Journey incomplete or blocked');
  if (screens.some(s => s.name === 'permission-or-security-prompt')) failures.push('Native dialog requires owner review');
  if (events.some(e => e.action === 'onboarding-complete' || e.action === 'page-1-start')) failures.push('Onboarding must not run during journey');
  return failures;
}

export function analyzeAttachments(directory, phase = 'onboarding') {
  const summaries = [], events = [], failures = [], screens = [];
  let screenshotCount = 0;
  function visit(current) {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) { visit(file); continue; }
      // xcresulttool may export opaque file names. Parse bounded JSON payloads
      // by content, not by a guessed export naming convention.
      if (fs.statSync(file).size > 25 * 1024 * 1024) continue;
      const bytes = fs.readFileSync(file);
      if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) screenshotCount++;
      if (![91, 123].includes(bytes[0])) continue;
      let value; try { value = JSON.parse(bytes.toString()); } catch { continue; }
      if (value?.kind === 'physical-screen') screens.push(value);
      if (value?.kind === 'onboarding' && Array.isArray(value.pages)) summaries.push({ file: path.relative(directory, file), pages: value.pages });
      if (Array.isArray(value) && value.some(row => row?.gate || row?.action)) events.push(...value);
    }
  }
  visit(directory);
  if (phase === 'journey') {
    let manifest = []; try { manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8')); } catch {}
    const screenshots = manifest.filter(row => row.testIdentifier === 'GridlyAcceptance/testPhysicalJourney()')
      .flatMap(row => row.attachments || []).filter(a => {
        if (a.deviceId !== '00008120-000C49A43EC0201E' || !a.exportedFileName?.endsWith('.png') || path.basename(a.exportedFileName) !== a.exportedFileName) return false;
        const file = path.join(directory, a.exportedFileName);
        if (!fs.existsSync(file)) return false;
        const bytes = fs.readFileSync(file);
        return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.length > 24 && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > bytes.readUInt32BE(16);
      });
    const screenshotNames = screens.filter(s => screenshots.some(a => a.suggestedHumanReadableName?.match(/^\d{3}-(.*)_\d+_[A-F0-9-]+\.png$/)?.[1] === s.name)).map(s => s.name);
    failures.push(...journeyFailures(events, screens, screenshotNames));
    return { phase, status: failures.length ? 'INCOMPLETE_EVIDENCE' : 'EVIDENCE_EXTRACTED', failures, events,
      screens: screens.map(s => ({ name: s.name, orientation: s.orientation, screenPixels: s.screenPixels })),
      visual: { classification: 'REQUIRES_SCREENSHOT_REVIEW' }, productionDefects: [],
      reason: 'Journey extraction requires settled portrait screenshot/AX evidence. Human visual review remains required; coordinates/provider internals are not inferred.' };
  }
  if (phase !== 'onboarding') throw Error('Unsupported acceptance phase: ' + phase);
  if (summaries.length !== 1) failures.push(`Expected one onboarding summary, observed ${summaries.length}; do not combine separate runs or infer missing pages.`);
  const pages = summaries.length === 1 ? summaries[0].pages : [];
  failures.push(...onboardingFailures(pages, events, screens, screenshotCount));
  return { status: failures.length ? 'INCOMPLETE_EVIDENCE' : 'EVIDENCE_EXTRACTED', failures,
    pages: pages.map(measurePage), visual: classifyVisual(pages), events,
    R1: 'INCONCLUSIVE', R3: 'INCONCLUSIVE', productionDefects: [],
    reason: 'UI automation observations alone do not prove geolocation coordinates/provider origin. Failure to expose semantics is a harness observability blocker, not automatically a production defect.' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (!(args.length === 1 || (args.length === 3 && args[1] === '--phase' && ['onboarding', 'journey'].includes(args[2])))) {
    console.error('Usage: node tools/lp24454/analyze.mjs <single-run exported attachments directory> [--phase onboarding|journey]'); process.exit(2);
  }
  console.log(json(analyzeAttachments(path.resolve(args[0]), args[2] || 'onboarding')));
}
