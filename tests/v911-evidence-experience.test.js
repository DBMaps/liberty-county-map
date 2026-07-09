const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');
const doc = fs.readFileSync('docs/architecture/GRIDLY-EVIDENCE-EXPERIENCE-V1.md', 'utf8');

assert.match(app, /GRIDLY_EVIDENCE_EXPERIENCE_VERSION\s*=\s*"V911"/, 'V911 evidence experience version is declared');
assert.match(app, /window\.gridlyEvidenceExperienceAudit\s*=\s*gridlyEvidenceExperienceAudit/, 'V911 audit helper is exposed');
assert.match(app, /gridlyBuildEvidenceExperienceModel\(storyAudit\?\.story\)/, 'Evidence experience consumes the Story Engine story output');
assert.match(app, /providerNamesExposed/, 'Audit reports provider-name exposure');
assert.match(app, /technicalTermsDetected/, 'Audit reports technical term exposure');
assert.match(app, /protectedSystemsUnchanged:\s*true/, 'Audit preserves protected-system declaration');

assert.match(html, /data-gridly-evidence-experience/, 'Evidence experience is present in Know Before You Go markup');
assert.match(html, /Why Gridly says this/, 'Consumer evidence title is present');
assert.match(css, /V911 — Evidence Experience/, 'Evidence experience styling is present');

for (const forbidden of ['NOAA', 'TxDOT', 'FRA', 'Supabase']) {
  assert(!html.includes(forbidden), `HTML does not expose provider name ${forbidden}`);
}

for (const section of ['Mission', 'Purpose', 'Evidence model', 'Consumer examples', 'Confidence wording', 'Evidence categories', 'Future expansion', 'Testing checklist', 'Merge recommendation placeholder']) {
  assert(doc.includes(`## ${section}`), `Documentation includes ${section}`);
}

console.log('V911 evidence experience static audit passed');
