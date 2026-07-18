const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('js/app.js', 'utf8');

assert(source.includes('function gridlyResolveAuthoritativeLocationPresentation(record = {}, options = {})'), 'shared authoritative resolver exists');
assert(source.includes('window.gridlyLp022AuthoritativeLocationAudit = gridlyLp022AuthoritativeLocationAudit;'), 'LP022 browser audit is exposed');

const auditStart = source.indexOf('function gridlyLp022AuthoritativeLocationAudit');
const auditEnd = source.indexOf('window.gridlyLp022AuthoritativeLocationAudit = gridlyLp022AuthoritativeLocationAudit;', auditStart);
const auditBody = source.slice(auditStart, auditEnd);
assert(!auditBody.includes('buildAlertsSurfaceHtml'), 'LP022 audit does not depend on private Alerts renderer');
assert(auditBody.includes('auditErrors'), 'LP022 audit reports auditErrors');
assert(auditBody.includes('inspectSection'), 'LP022 audit wraps optional runtime inspections independently');

const resolverStart = source.indexOf('function gridlyResolveAuthoritativeLocationPresentation');
const resolverEnd = source.indexOf('function gridlyLp022InvalidLocationCompositionFlags', resolverStart);
const resolverBody = source.slice(resolverStart, resolverEnd);
[
  'canonicalDisplayLocation',
  'authoritativeLocationLabel',
  'strongestLocationLabel',
  'resolvedLocationLabel',
  'displayLocation',
  'knownLocation',
  'locationLabel',
].forEach((field) => assert(resolverBody.includes(`["${field}"`), `${field} participates in ordered resolver priority`));
assert(resolverBody.indexOf('["canonicalDisplayLocation"') < resolverBody.indexOf('["authoritativeLocationLabel"'), 'canonicalDisplayLocation outranks authoritativeLocationLabel');
assert(resolverBody.indexOf('["authoritativeLocationLabel"') < resolverBody.indexOf('["strongestLocationLabel"'), 'authoritativeLocationLabel outranks strongestLocationLabel');
assert(resolverBody.indexOf('["strongestLocationLabel"') < resolverBody.indexOf('["resolvedLocationLabel"'), 'strongestLocationLabel outranks resolvedLocationLabel');
assert(resolverBody.indexOf('["resolvedLocationLabel"') < resolverBody.indexOf('["displayLocation"'), 'resolvedLocationLabel outranks displayLocation');
assert(!/record\?\.(?:title|description|summary|hazard)|raw\?\.(?:title|description|summary|hazard)|source\?\.(?:title|description|summary|hazard)/.test(resolverBody), 'resolver does not read title, description, summary, or hazard fields as locations');
assert(resolverBody.includes('!gridlyLp022SameRoad(road, cross)'), 'resolver blocks road + same road compositions');

const lp021Start = source.indexOf('function gridlyLp021ResolvedLocationPresentation');
const lp021End = source.indexOf('function gridlyLp021RecordLocationTrace', lp021Start);
assert(source.slice(lp021Start, lp021End).includes('gridlyResolveAuthoritativeLocationPresentation(record, options)'), 'LP021 presentation adapter delegates to LP022 resolver');

assert(source.includes('const authoritativeLocation = gridlyResolveAuthoritativeLocationPresentation(incident);'), 'community popup consumes shared resolver');
assert(source.includes('gridlyLp021ResolvedLocationPresentation(alert'), 'alert cards consume shared resolver adapter');
assert(source.includes('const lp021LocationPresentation = gridlyLp021ResolvedLocationPresentation(record'), 'official popups consume shared resolver adapter');
assert(source.includes('travelBrief: typeof gridlyResolveAuthoritativeLocationPresentation === "function"'), 'audit tracks Travel Brief resolver availability');

console.log('LP022 authoritative location repair static checks passed');
