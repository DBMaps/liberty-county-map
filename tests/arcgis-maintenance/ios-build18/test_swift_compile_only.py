"""Offline tests of the runner's scope, compiler arguments, redaction and cleanup."""
from contextlib import redirect_stdout
import hashlib
from io import StringIO
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import swift_compile_only as job


class CompileOnlyTests(unittest.TestCase):
    def test_reviewed_inputs_match_pins(self):
        self.assertEqual(len(job.REVIEWED_INPUTS), 6)
        for relative, digest in job.REVIEWED_INPUTS.items():
            with self.subTest(source=relative):
                data = (job.ROOT / relative).read_bytes().replace(b"\r\n", b"\n")
                self.assertEqual(hashlib.sha256(data).hexdigest(), digest)

    def test_workflow_is_limited_to_one_reviewed_branch_creation(self):
        workflows = job.ROOT / ".github/workflows"
        name = "gridly-arcgis-build18-compile-only.yml"
        source = (workflows / name).read_text(encoding="utf-8")
        branch = job.BRANCH.removeprefix("refs/heads/")
        self.assertIn(f"on:\n  push:\n    branches:\n      - {branch}\n\npermissions:\n  contents: read\n", source)
        for gate in ("github.repository == 'DBMaps/liberty-county-map'", f"github.ref == '{job.BRANCH}'",
                     "github.event_name == 'push'", "github.event.created == true", "github.event.deleted == false",
                     "github.event.forced == false", "github.run_attempt == 1", "runs-on: macos-26",
                     "ref: ${{ github.sha }}", "persist-credentials: false"):
            self.assertIn(gate, source)
        self.assertEqual(re.findall(r"(?m)^\s+run: (.+)$", source),
                         ["python3 -I -B tests/arcgis-maintenance/ios-build18/swift_compile_only.py"])
        self.assertEqual(re.findall(r"(?m)^\s+uses: (\S+)", source),
                         ["actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683"])
        for workflow in sorted([*workflows.glob("*.yml"), *workflows.glob("*.yaml")]):
            if workflow.name != name:
                with self.subTest(workflow=workflow.name):
                    text = workflow.read_text(encoding="utf-8")
                    triggers = re.search(r"(?ms)^on:\n(.*?)(?=^[a-z][a-z_-]*:|\Z)", text)
                    self.assertIsNotNone(triggers)
                    self.assertNotRegex(triggers.group(1), r"(?m)^\s+(push|create):")

    def test_compiler_stages_fail_closed_and_clean_up(self):
        sha = "1" * 40
        synthetic_detail = "SYNTHETIC_PRIVATE_COMPILER_DETAIL"
        cases = {
            "pass": None,
            "branch": "RUNNER_SCOPE",
            "source": "SOURCE_HASH GridlyLabelDiagnostic.swift",
            "xcode": "XCODE_VERSION",
            "timeout": "ADAPTER_OBJECT_TIMEOUT",
            "module": "ADAPTER_OUTPUT_MISSING",
            "symbols": "ADAPTER_CONDITIONAL_BODY_MISSING",
            "test": "XCTEST_TYPECHECK_FAILED exit_code=73",
            "parse": "INTEGRATION_PARSE_FAILED exit_code=73",
        }
        for case, expected in cases.items():
            with self.subTest(case=case), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                xcode = root / "Xcode.app/Contents/Developer"
                sdk_platform = xcode / "Platforms/iPhoneSimulator.platform"
                sdk = sdk_platform / "Developer/SDKs/iPhoneSimulator.sdk"
                sdk.mkdir(parents=True)
                frameworks = sdk_platform / "Developer/Library/Frameworks"
                (frameworks / "XCTest.framework").mkdir(parents=True)
                scratch = root / "scratch"
                scratch.mkdir()
                for relative in job.REVIEWED_INPUTS:
                    file = root / relative
                    file.parent.mkdir(parents=True, exist_ok=True)
                    file.write_bytes(b"synthetic source")
                digest = hashlib.sha256(b"synthetic source").hexdigest()
                pins = dict.fromkeys(job.REVIEWED_INPUTS, digest)
                if case == "source":
                    pins[job.ADAPTER] = "0" * 64
                runner = {
                    "GITHUB_ACTIONS": "true", "RUNNER_ENVIRONMENT": "github-hosted",
                    "GITHUB_REPOSITORY": "DBMaps/liberty-county-map", "GITHUB_EVENT_NAME": "push",
                    "GITHUB_REF": job.BRANCH if case != "branch" else "refs/heads/other",
                    "GITHUB_RUN_ATTEMPT": "1", "GITHUB_SHA": sha, "RUNNER_TEMP": str(scratch),
                    "SYNTHETIC_PRIVATE_ENV": synthetic_detail,
                }
                metadata = {
                    ("/usr/bin/git", "rev-parse", "HEAD"): sha,
                    ("/usr/bin/xcodebuild", "-version"): "Xcode 26.5\nBuild version 17F42" if case != "xcode" else "Xcode 26.6",
                    (*job.SDK_COMMAND, "--show-sdk-version"): "26.5",
                    (*job.SDK_COMMAND, "--show-sdk-path"): str(sdk),
                    (*job.SDK_COMMAND, "--show-sdk-platform-path"): str(sdk_platform),
                }
                stages = []

                def run(argv, **kwargs):
                    self.assertEqual(kwargs["cwd"], root)
                    self.assertEqual(kwargs["stdin"], subprocess.DEVNULL)
                    self.assertNotIn("SYNTHETIC_PRIVATE_ENV", kwargs["env"])
                    if argv in metadata:
                        return subprocess.CompletedProcess(argv, 0, metadata[argv], synthetic_detail)
                    work = Path(kwargs["env"]["TMPDIR"])
                    self.assertEqual(work.parent, scratch)
                    output = work / "GridlyLabelDiagnostic.o"
                    module = work / "App.swiftmodule"
                    if argv[3] == "nm":
                        self.assertTrue(output.is_file())
                        symbols = "\n".join(f"GridlyLabelDiagnostic_{method}" for method in
                                            ("prepareFixture", "authorizeProviderTransport", "requestTile"))
                        return subprocess.CompletedProcess(argv, 0, "" if case == "symbols" else symbols, "")
                    self.assertEqual(kwargs["timeout"], 90)
                    compiler_args = (
                        *job.SDK_COMMAND, "swiftc", "-swift-version", "5", "-sdk", str(sdk),
                        "-target", "arm64-apple-ios16.4-simulator", "-D", "DEBUG",
                        "-D", "GRIDLY_ARCGIS_DIAGNOSTIC", "-D", "GRIDLY_BUILD18_DIAGNOSTIC",
                        "-module-cache-path", str(work / "module-cache"),
                    )
                    if "-emit-object" in argv:
                        stages.append("adapter")
                        self.assertEqual(argv, (
                            *compiler_args, "-parse-as-library", "-enable-testing", "-module-name", "App",
                            "-emit-object", "-emit-module", "-emit-module-path", str(module),
                            "-o", str(output), str(root / job.ADAPTER),
                        ))
                        if case == "timeout":
                            raise subprocess.TimeoutExpired(argv, 90, stderr=synthetic_detail)
                        output.write_bytes(b"synthetic object")
                        if case != "module":
                            module.write_bytes(b"synthetic module")
                    elif "-typecheck" in argv:
                        stages.append("test")
                        self.assertEqual(argv, (
                            *compiler_args, "-typecheck", "-I", str(work), "-F", str(frameworks),
                            str(root / job.TESTS),
                        ))
                    else:
                        stages.append("parse")
                        self.assertEqual(argv, (
                            *compiler_args, "-parse", str(root / job.VIEW), str(root / job.BRIDGE),
                        ))
                    diagnostic = f"{argv[-1]}:27:4: error: {synthetic_detail}"
                    code = 73 if case == stages[-1] else 0
                    return subprocess.CompletedProcess(argv, code, synthetic_detail, diagnostic if code else "")

                with (
                    patch.dict(os.environ, runner), patch.object(job.sys, "platform", "darwin"),
                    patch.object(job.platform, "machine", return_value="arm64"),
                    patch.object(job, "ROOT", root), patch.object(job, "XCODE", xcode),
                    patch.object(job, "REVIEWED_INPUTS", pins), patch.object(job.subprocess, "run", side_effect=run),
                    redirect_stdout(StringIO()) as output,
                ):
                    if expected:
                        with self.assertRaises(job.Blocked) as failure:
                            job.main()
                        self.assertEqual(str(failure.exception), expected)
                    else:
                        job.main()
                        self.assertEqual(stages, ["adapter", "test", "parse"])
                        self.assertIn("SWIFT_INTEGRATION_SYNTAX_PASS APP_PROJECT_COMPILE_REQUIRED", output.getvalue())
                self.assertNotIn(synthetic_detail, output.getvalue())
                self.assertNotIn(str(root), output.getvalue())
                self.assertEqual(list(scratch.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
