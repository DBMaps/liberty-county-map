import fs from 'node:fs';
const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const doc = fs.readFileSync('docs/LP051-7-ZIP-PERSONALIZATION-PRODUCTION-INTEGRATION.md', 'utf8');
const checks = [
  ['canonical storage key', app.includes('gridlyHomePersonalizationV1')],
  ['schema version', app.includes('LP051.7.home-personalization.v1')],
  ['production apply function', app.includes('function gridlyApplyConfirmedHomePersonalization')],
  ['no prototype primary action', !app.includes("btn('Preview selection','preview',true)")],
  ['use area action', app.includes("'Use ' + label")],
  ['audit helper', app.includes('gridlyLp0517ZipPersonalizationProductionIntegrationAudit')],
  ['settings home zip', html.includes('settingsHomeZipValue')],
  ['change home zip copy', html.includes('Change home ZIP')],
  ['documentation contract', doc.includes('Canonical home-personalization contract')],
  ['route intelligence untouched diagnostic', app.includes('routeIntelligenceTouched: false')]
];
const failures = checks.filter(([, pass]) => !pass);
if (failures.length) {
  console.error('LP051.7 static check failures:', failures.map(([name]) => name).join(', '));
  process.exit(1);
}
console.log(`LP051.7 static checks passed (${checks.length})`);
