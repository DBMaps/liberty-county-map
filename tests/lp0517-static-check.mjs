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
  // LP051.7 Settings moved from the legacy static shell to the current dynamic
  // Settings renderer. Keep the consumer-copy contract, but assert it at its
  // lifecycle owner instead of requiring obsolete index.html placeholders.
  ['settings home zip', app.includes('data-gridly-settings-home-zip') && app.includes('Home ZIP')],
  ['change home zip copy', app.includes('Change home ZIP') && app.includes('settings-change-home-zip')],
  ['documentation contract', doc.includes('Canonical home-personalization contract')],
  ['route intelligence untouched diagnostic', app.includes('routeIntelligenceTouched: false')]
];
const failures = checks.filter(([, pass]) => !pass);
if (failures.length) {
  console.error('LP051.7 static check failures:', failures.map(([name]) => name).join(', '));
  process.exit(1);
}
console.log(`LP051.7 static checks passed (${checks.length})`);
