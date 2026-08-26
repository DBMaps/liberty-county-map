// LP239 CSV repository artifacts use LF. Verification tolerates only the
// checkout-level CRLF representation of those same CSV bytes.
export function canonicalizeCsvNewlines(csv) {
  return csv.replaceAll('\r\n', '\n');
}

export function csvArtifactMatches(actual, expected) {
  return canonicalizeCsvNewlines(actual) === canonicalizeCsvNewlines(expected);
}

export function lp239ArtifactMatches(name, actual, expected) {
  return name.endsWith('.csv') ? csvArtifactMatches(actual, expected) : actual === expected;
}
