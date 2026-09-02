import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const PACKAGE = "com.gridlygo.gridly";
export const ARTIFACT_DIR = path.resolve(".artifacts/android-acceptance");

export function adb(args, { serial, allowFailure = false } = {}) {
  const command = serial ? ["-s", serial, ...args] : args;
  const sdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
  const executable = process.env.ADB || (sdkRoot ? path.join(sdkRoot, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb") : "adb");
  try {
    return execFileSync(executable, command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    if (allowFailure) return "";
    const detail = String(error.stderr || error.message).trim();
    throw new Error(`adb ${command.join(" ")} failed: ${detail}`);
  }
}

export function parseDevices(output) {
  return output.split(/\r?\n/).slice(1).map(line => line.trim()).filter(Boolean).map(line => {
    const [serial, state] = line.split(/\s+/, 3);
    return { serial, state };
  });
}

export function exactlyOneDevice(output) {
  const rows = parseDevices(output);
  const unauthorized = rows.filter(row => row.state !== "device");
  if (unauthorized.length) throw new Error(`Android target is not authorized/ready: ${unauthorized.map(row => `${row.serial} (${row.state})`).join(", ")}`);
  if (rows.length !== 1) throw new Error(`Expected exactly one authorized Android target; found ${rows.length}. Disconnect extras or set up one target, then retry.`);
  return rows[0].serial;
}

export function bounded(text, max = 12000) {
  const value = String(text || "");
  return value.length <= max ? value : value.slice(-max);
}

export function writeReports(results, metadata, diagnostics = "") {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const report = { generatedAt: new Date().toISOString(), package: PACKAGE, metadata, results, diagnostics: bounded(diagnostics) };
  fs.writeFileSync(path.join(ARTIFACT_DIR, "latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  const lines = ["# Local Android acceptance", "", ...Object.entries(metadata).map(([key, value]) => `- **${key}:** ${value}`), "", "## Assertions", "", ...results.map(item => `- **${item.status}** — ${item.name}${item.detail ? `: ${item.detail}` : ""}`)];
  if (diagnostics) lines.push("", "## Bounded failure diagnostics", "", "```text", bounded(diagnostics), "```");
  fs.writeFileSync(path.join(ARTIFACT_DIR, "latest.md"), `${lines.join("\n")}\n`);
  return report;
}
