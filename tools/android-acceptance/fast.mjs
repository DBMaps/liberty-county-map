import { spawnSync } from "node:child_process";

const suites = [
  "tests/lp2444-2-native-search-geolocation-runtime.test.mjs",
  "tests/lp238-community-report-submission-location-capture.test.mjs",
  "tests/lp243d-location-context-count-and-kbyg-labels.test.cjs",
  "tests/location-context-count-authority-parity.test.cjs",
  "tests/lp2354a-alerts-source-semantics.test.mjs"
];
console.log("Local Android fast authority (no device, build, provider credential, or native staging required)");
const result = spawnSync(process.execPath, ["--test", ...suites], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
