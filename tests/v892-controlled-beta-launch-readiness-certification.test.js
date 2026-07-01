const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.readFileSync('docs/certifications/GRIDLY-V892-CONTROLLED-BETA-LAUNCH-READINESS-CERTIFICATION.md', 'utf8');

assert(app.includes('gridlyControlledBetaLaunchCertification'), 'V892 launch certification helper is exposed');
assert(app.includes('V892-controlled-beta-launch-readiness-certification'), 'V892 certification version is present');
assert(app.includes('certificationOnly: true'), 'V892 helper is marked certification-only');
assert(app.includes('recommendation: "GO WITH OBSERVATIONS"'), 'V892 recommendation is GO WITH OBSERVATIONS');
assert(app.includes('protectedSystemsCertified: true'), 'V892 protected systems certification flag is true');
assert(app.includes('supportedRegionalCounties: Array.from(supportedRegionalCounties)'), 'V892 helper returns a copied county list');
assert(app.includes('knownBetaLimitations: Array.from(knownBetaLimitations)'), 'V892 helper returns a copied limitations list');

[
  'Liberty',
  'Montgomery',
  'San Jacinto',
  'Chambers',
  'Jefferson',
  'Hardin',
  'Orange',
  'Polk',
  'Tyler',
  'Walker',
  'Harris',
  'Jasper',
  'Newton',
  'Galveston',
  'Brazoria',
  'Fort Bend',
  'Waller',
  'Austin',
  'Washington',
  'Brazos',
  'Grimes',
  'Wharton',
  'Colorado',
  'Fayette',
  'Lavaca',
  'Jackson',
  'Matagorda',
  'Calhoun'
].forEach((county) => {
  assert(app.includes(`"${county}"`), `V892 helper includes ${county}`);
  assert(doc.includes(county), `V892 certification document includes ${county}`);
});

assert(doc.includes('Controlled Southeast Texas Beta'), 'V892 document states controlled regional beta scope');
assert(doc.includes('GO WITH OBSERVATIONS'), 'V892 document includes final recommendation');
assert(doc.includes('Protected Systems'), 'V892 document includes protected systems certification');
assert(doc.includes('Push notifications are not implemented'), 'V892 document documents push notification limitation');
assert(doc.includes('PWA/App Store packaging is deferred'), 'V892 document documents packaging limitation');

console.log('v892-controlled-beta-launch-readiness-certification.test.js passed');
