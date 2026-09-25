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
  const regions = exact('Quick Tour cards and setup');
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

export function analyzeAttachments(directory) {
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
  if (summaries.length !== 1) failures.push(`Expected one onboarding summary, observed ${summaries.length}; do not combine separate runs or infer missing pages.`);
  const pages = summaries.length === 1 ? summaries[0].pages : [];
  failures.push(...onboardingFailures(pages, events, screens, screenshotCount));
  return { status: failures.length ? 'INCOMPLETE_EVIDENCE' : 'EVIDENCE_EXTRACTED', failures,
    pages: pages.map(measurePage), visual: classifyVisual(pages), events,
    R1: 'INCONCLUSIVE', R3: 'INCONCLUSIVE', productionDefects: [],
    reason: 'UI automation observations alone do not prove geolocation coordinates/provider origin. Failure to expose semantics is a harness observability blocker, not automatically a production defect.' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) { console.error('Usage: node tools/lp24454/analyze.mjs <single-run exported attachments directory>'); process.exit(2); }
  console.log(json(analyzeAttachments(path.resolve(process.argv[2]))));
}
