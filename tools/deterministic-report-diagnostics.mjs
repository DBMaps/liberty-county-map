import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function locationAt(bytes, offset) {
  const before = bytes.subarray(0, offset).toString('utf8');
  const lines = before.split('\n');
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

function firstByteDifference(actual, expected) {
  const limit = Math.min(actual.length, expected.length);
  let offset = 0;
  while (offset < limit && actual[offset] === expected[offset]) offset += 1;
  return offset === limit && actual.length === expected.length ? null : offset;
}

function firstValueDifference(actual, expected, pointer = '') {
  if (Object.is(actual, expected)) return null;
  if (Array.isArray(actual) && Array.isArray(expected)) {
    const limit = Math.min(actual.length, expected.length);
    for (let i = 0; i < limit; i += 1) {
      const difference = firstValueDifference(actual[i], expected[i], `${pointer}/${i}`);
      if (difference) return difference;
    }
    return { pointer: `${pointer}/length`, actual: actual.length, expected: expected.length };
  }
  if (actual && expected && typeof actual === 'object' && typeof expected === 'object' && !Array.isArray(actual) && !Array.isArray(expected)) {
    const keys = [...new Set([...Object.keys(actual), ...Object.keys(expected)])].sort();
    for (const key of keys) {
      const escaped = key.replaceAll('~', '~0').replaceAll('/', '~1');
      if (!Object.hasOwn(actual, key)) return { pointer: `${pointer}/${escaped}`, actual: '<missing>', expected: expected[key] };
      if (!Object.hasOwn(expected, key)) return { pointer: `${pointer}/${escaped}`, actual: actual[key], expected: '<missing>' };
      const difference = firstValueDifference(actual[key], expected[key], `${pointer}/${escaped}`);
      if (difference) return difference;
    }
    return null;
  }
  return { pointer: pointer || '/', actual, expected };
}

function display(value) {
  const rendered = typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value);
  if (rendered === undefined) return String(value);
  return rendered.length <= 240 ? rendered : `${rendered.slice(0, 237)}...`;
}

/** Returns a stable, bounded explanation of why a governed report differs. */
export function deterministicReportMismatch(path, actualText, expectedText) {
  if (actualText === expectedText) return null;
  const actualBytes = Buffer.from(actualText);
  const expectedBytes = Buffer.from(expectedText);
  const byteOffset = firstByteDifference(actualBytes, expectedBytes);
  const location = locationAt(actualBytes, Math.min(byteOffset, actualBytes.length));
  const fields = [
    `path=${path}`,
    `actualSha256=${sha256(actualBytes)}`,
    `expectedSha256=${sha256(expectedBytes)}`,
    `actualBytes=${actualBytes.length}`,
    `expectedBytes=${expectedBytes.length}`,
    `firstDifferingByte=${byteOffset}`,
    `actualLine=${location.line}`,
    `actualColumn=${location.column}`
  ];
  try {
    const actual = JSON.parse(actualText);
    const expected = JSON.parse(expectedText);
    const difference = firstValueDifference(actual, expected);
    if (difference) fields.push('mismatch=JSON_VALUE', `jsonPointer=${difference.pointer}`, `actual=${display(difference.actual)}`, `expected=${display(difference.expected)}`);
    else fields.push('mismatch=SERIALIZATION_ONLY');
  } catch (error) {
    fields.push('mismatch=INVALID_ACTUAL_JSON', `parseError=${JSON.stringify(error.message)}`);
  }
  return fields.join('; ');
}

export function assertDeterministicReport(path, actualText, expectedText, milestone, description) {
  const diagnostic = deterministicReportMismatch(path, actualText, expectedText);
  if (diagnostic) throw new Error(`[${milestone}] ${description}; ${diagnostic}`);
}
