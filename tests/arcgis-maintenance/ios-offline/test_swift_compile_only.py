from contextlib import redirect_stderr, redirect_stdout
import hashlib
import io
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import swift_compile_only as compile_job


class SwiftCompileOnlyTests(unittest.TestCase):
    sha = "1" * 40
    marker = "SYNTHETIC_PRIVATE_COMPILER_MESSAGE"
    source_path = Path("tools/arcgis-maintenance/native/ios/GridlyLabelDiagnostic.swift")
    branch = "codex/arcgis-maintenance-ios-compile-only"
    xcrun = ("/usr/bin/xcrun", "--sdk", "iphonesimulator")

    def test_workflow_is_one_exact_branch_compile_job(self):
        workflows = compile_job.ROOT / ".github/workflows"
        own = workflows / "gridly-arcgis-ios-compile-only.yml"
        source = own.read_text(encoding="utf-8")
        self.assertIn(f"\non:\n  push:\n    branches:\n      - {self.branch}\n\npermissions:\n  contents: read\n", source)
        for gate in ("github.repository == 'DBMaps/liberty-county-map'", "github.event_name == 'push'",
                     f"github.ref == 'refs/heads/{self.branch}'", "github.event.created == true",
                     "github.event.deleted == false", "github.event.forced == false", "github.run_attempt == 1"):
            self.assertIn(gate, source)
        self.assertIn("runs-on: macos-26", source)
        self.assertIn("ref: ${{ github.sha }}", source)
        self.assertIn("persist-credentials: false", source)
        self.assertEqual(re.findall(r"(?m)^\s+run: (.+)$", source),
                         ["python3 -I -B tests/arcgis-maintenance/ios-offline/swift_compile_only.py"])
        self.assertEqual(re.findall(r"(?m)^\s+uses: (\S+)", source),
                         ["actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683"])
        for workflow in sorted([*workflows.glob("*.yml"), *workflows.glob("*.yaml")]):
            if workflow != own:
                with self.subTest(workflow=workflow.name):
                    other = workflow.read_text(encoding="utf-8")
                    triggers = re.search(r"(?ms)^on:\n(.*?)(?=^[a-z][a-z_-]*:|\Z)", other).group(1)
                    events = set(re.findall(r"(?m)^  (\w+):", triggers))
                    if "push" in events:
                        self.assertEqual(triggers.strip(), "push:\n    branches:\n      - codex/arcgis-maintenance-ios-offline-certification")
                    else:
                        self.assertLessEqual(events, {"pull_request", "workflow_dispatch"})

    def test_adapter_pin_matches_the_guarded_source(self):
        body = (compile_job.ROOT / self.source_path).read_bytes().replace(b"\r\n", b"\n")
        self.assertEqual(hashlib.sha256(body).hexdigest(), compile_job.SOURCE_SHA256)
        self.assertIn(b"#if DEBUG && GRIDLY_ARCGIS_DIAGNOSTIC\n", body)
        self.assertTrue(body.rstrip().endswith(b"#endif"))

    def test_compiler_scope_sanitization_and_cleanup(self):
        cases = [
            (None, None, 6),
            ("branch", "RUNNER_SCOPE", 0),
            ("sha", "SOURCE_SHA", 1),
            ("adapter", "ADAPTER_HASH", 1),
            ("xcode", "XCODE_VERSION", 2),
            ("sdk", "SDK_VERSION", 3),
            ("compile", "SWIFT_COMPILE_FAILED exit_code=73", 5),
            ("timeout", "SWIFT_COMPILE_TIMEOUT", 5),
            ("missing object", "SWIFT_OBJECT_MISSING", 5),
            ("empty body", "SWIFT_CONDITIONAL_BODY_MISSING", 6),
        ]
        for failure, status, call_count in cases:
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                xcode = root / "Xcode_26.5.app/Contents/Developer"
                sdk = xcode / "Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator26.5.sdk"
                sdk.mkdir(parents=True)
                source = root / self.source_path
                source.parent.mkdir(parents=True)
                source.write_bytes(b"synthetic adapter input")
                digest = hashlib.sha256(source.read_bytes()).hexdigest()
                scratch = root / "scratch"
                scratch.mkdir()
                runner = {
                    "GITHUB_ACTIONS": "true", "RUNNER_ENVIRONMENT": "github-hosted",
                    "GITHUB_REPOSITORY": "DBMaps/liberty-county-map", "GITHUB_EVENT_NAME": "push",
                    "GITHUB_REF": "refs/heads/other" if failure == "branch" else f"refs/heads/{self.branch}",
                    "GITHUB_RUN_ATTEMPT": "1", "GITHUB_SHA": self.sha, "RUNNER_TEMP": str(scratch),
                    "SYNTHETIC_SECRET_ENV": self.marker,
                }
                metadata = {
                    ("/usr/bin/git", "rev-parse", "HEAD"): "2" * 40 if failure == "sha" else self.sha,
                    ("/usr/bin/xcodebuild", "-version"): "Xcode 26.6" if failure == "xcode" else "Xcode 26.5\nBuild version 17F42",
                    self.xcrun + ("--show-sdk-version",): "26.6" if failure == "sdk" else "26.5",
                    self.xcrun + ("--show-sdk-path",): str(sdk),
                }
                objects = []
                stdout, stderr = io.StringIO(), io.StringIO()

                def subprocess_result(argv, **kwargs):
                    self.assertEqual(kwargs["cwd"], root)
                    self.assertEqual(kwargs["stdin"], subprocess.DEVNULL)
                    self.assertEqual(kwargs["stdout"], subprocess.PIPE)
                    self.assertEqual(kwargs["stderr"], subprocess.PIPE)
                    env = kwargs["env"]
                    expected_env = {"HOME", "PATH", "LC_ALL", "DEVELOPER_DIR"}
                    self.assertEqual(env["DEVELOPER_DIR"], str(xcode))
                    if argv in metadata:
                        self.assertEqual(set(env), expected_env)
                        return subprocess.CompletedProcess(argv, 0, metadata[argv], self.marker)
                    self.assertEqual(set(env), expected_env | {"TMPDIR"})
                    output = Path(argv[-1])
                    self.assertEqual(output.name, "GridlyLabelDiagnostic.o")
                    self.assertEqual(output.parent.parent, scratch)
                    self.assertEqual(env["TMPDIR"], str(output.parent))
                    if argv[:4] == self.xcrun + ("swiftc",):
                        self.assertEqual(argv, self.xcrun + (
                            "swiftc", "-emit-object", "-parse-as-library", "-swift-version", "5",
                            "-sdk", str(sdk), "-target", "arm64-apple-ios26.5-simulator",
                            "-D", "DEBUG", "-D", "GRIDLY_ARCGIS_DIAGNOSTIC", "-module-cache-path",
                            str(output.parent / "module-cache"), str(source), "-o", str(output),
                        ))
                        self.assertEqual(kwargs["timeout"], 90)
                        self.assertFalse(kwargs["check"])
                        objects.append(output)
                        (output.parent / "module-cache").mkdir()
                        if failure != "missing object":
                            output.write_bytes(b"synthetic object")
                        if failure == "timeout":
                            raise subprocess.TimeoutExpired(argv, 90, output=self.marker, stderr=self.marker)
                        diagnostic = f"{source}:27:4: error: {self.marker}\n/private/synthetic:1:2: warning: {self.marker}"
                        return subprocess.CompletedProcess(argv, 73 if failure == "compile" else 0,
                                                           self.marker, diagnostic if failure == "compile" else "")
                    self.assertEqual(argv, self.xcrun + ("nm", "-arch", "arm64", "-U", "-j", str(output)))
                    self.assertTrue(output.is_file())
                    symbols = "\n".join(f"GridlyLabelDiagnostic_{method}" for method in
                                        ("prepareFixture", "selectSyntheticTransport", "requestTile"))
                    return subprocess.CompletedProcess(argv, 0, "" if failure == "empty body" else symbols, self.marker)

                with (
                    patch.dict(os.environ, runner), patch.object(compile_job.sys, "platform", "darwin"),
                    patch.object(compile_job.platform, "machine", return_value="arm64"),
                    patch.object(compile_job, "ROOT", root), patch.object(compile_job, "XCODE", xcode),
                    patch.object(compile_job, "SOURCE_SHA256", "0" * 64 if failure == "adapter" else digest),
                    patch.object(compile_job.subprocess, "run", side_effect=subprocess_result) as process,
                    redirect_stdout(stdout), redirect_stderr(stderr),
                ):
                    if status:
                        with self.assertRaisesRegex(compile_job.Blocked, f"^{status}$"):
                            compile_job.main()
                    else:
                        compile_job.main()
                self.assertEqual(process.call_count, call_count)
                self.assertEqual(list(scratch.iterdir()), [])
                self.assertTrue(all(not path.exists() for path in objects))
                self.assertEqual(stderr.getvalue(), "")
                if failure == "compile":
                    self.assertEqual(stdout.getvalue(), "SWIFT_DIAGNOSTIC error line=27 column=4\n")
                elif not failure:
                    self.assertIn("APPLE_SWIFT_COMPILE_PASS", stdout.getvalue())
                    self.assertNotIn(self.marker, stdout.getvalue())
                else:
                    self.assertEqual(stdout.getvalue(), "")


if __name__ == "__main__":
    unittest.main()
