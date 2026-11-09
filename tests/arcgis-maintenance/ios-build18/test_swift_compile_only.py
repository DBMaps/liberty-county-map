"""Offline tests of the runner's scope, compiler arguments, redaction and cleanup."""
from contextlib import redirect_stdout
import hashlib
from io import StringIO
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import swift_compile_only as job


class CompileOnlyTests(unittest.TestCase):
    def test_reviewed_inputs_match_pins(self):
        # The standalone runner is frozen at its last reviewed inputs. The new
        # candidate is verified by the actual Xcode App target and hosted tests.
        reviewed = "f852cc5f0bb18ef22989dadcf6033dafe96b9495"
        self.assertEqual(len(job.REVIEWED_INPUTS), 6)
        for relative, digest in job.REVIEWED_INPUTS.items():
            with self.subTest(source=relative):
                data = subprocess.check_output(["git", "show", f"{reviewed}:{relative}"], cwd=job.ROOT)
                data = data.replace(b"\r\n", b"\n")
                self.assertEqual(hashlib.sha256(data).hexdigest(), digest)

    def test_workflow_is_limited_to_one_reviewed_branch_creation(self):
        workflows = job.ROOT / ".github/workflows"
        name = "gridly-arcgis-build18-compile-only.yml"
        source = (workflows / name).read_text(encoding="utf-8")
        branch = "codex/arcgis-ios-build18-xctest-verification"
        self.assertEqual(job.BRANCH, f"refs/heads/{branch}")
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
                    if workflow.name == "gridly-apple-build18-archive-only.yml":
                        self.assertEqual(triggers.group(1).strip(),
                                         "push:\n    branches:\n      - codex/arcgis-ios-build18-xctest-closure-fix")
                    else:
                        self.assertNotRegex(triggers.group(1), r"(?m)^\s+(push|create):")

    def test_app_archive_and_hosted_xctest_build_do_not_execute_native_code(self):
        workflow = job.ROOT / ".github/workflows/gridly-apple-build18-archive-only.yml"
        source = workflow.read_text(encoding="utf-8")
        candidate = "b9cbff579b1cbf05842030fc01cd7ed60267dd1d"
        base = "1055168666f094d2fd551d002b31556c81a8280b"
        certified = "88d410ea4b55f69dd7d6a3533b507211d47f8d56"
        diagnostics_base = "1685a65acdce51797a91f21f87ff2f7c8b31dd6c"
        branch = "refs/heads/codex/arcgis-ios-build18-xctest-closure-fix"
        test_path = "tests/arcgis-maintenance/ios-build18/Build18DiagnosticTests.swift"
        test_digest = hashlib.sha256((job.ROOT / test_path).read_bytes().replace(b"\r\n", b"\n")).hexdigest()
        for gate in ("github.repository == 'DBMaps/liberty-county-map'", "github.actor == 'DBMaps'",
                     f"github.ref == '{branch}'", "github.event_name == 'push'", "github.event.created == true",
                     "github.event.deleted == false", "github.event.forced == false", "github.run_attempt == 1",
                     "contents: read", "runs-on: macos-26", f"APPLICATION_SHA: {candidate}", f"INTEGRATION_BASE_SHA: {base}",
                     f"CERTIFIED_SOURCE_SHA: {certified}", f"XCTEST_SOURCE_SHA256: {test_digest}",
                     f"DIAGNOSTICS_BASE_SHA: {diagnostics_base}", test_path,
                     'test "$(git -C control show -s --format=%P HEAD)" = "$DIAGNOSTICS_BASE_SHA"',
                     'git -C candidate merge-base --is-ancestor "$CERTIFIED_SOURCE_SHA" HEAD',
                     'test "$(git -C candidate show -s --format=%P "$CERTIFIED_SOURCE_SHA")" = "$INTEGRATION_BASE_SHA"',
                     'test "$(git -C candidate show -s --format=%P "$INTEGRATION_BASE_SHA")" = "$APPLICATION_SHA"',
                     'test "$(git -C candidate rev-parse HEAD)" = "$GITHUB_SHA"',
                     f'xctest_digest="$(shasum -a 256 candidate/{test_path})"',
                     'test "${xctest_digest%% *}" = "$XCTEST_SOURCE_SHA256"',
                     "APP_ARCHIVE_CERTIFIED", "XCTEST_BUILD_CERTIFICATION=FAILED",
                     "XCTEST_BUILD_CERTIFICATION=PRODUCT_VERIFICATION_FAILED", "XCTEST_BUILD_CERTIFICATION=PASSED",
                     "BUILD18_NATIVE_LIFECYCLE_14_DEFERRED", "BUILD18_NATIVE_EXECUTION_NOT_RUN"):
            self.assertIn(gate, source)
        self.assertEqual(source.count("persist-credentials: false"), 2)
        self.assertEqual(source.count("ref: ${{ github.sha }}"), 2)
        self.assertNotRegex(source, r"\bsimctl\b|\btest-without-building\b|\bpfctl\b|\baltool\b|"
                                    r"\bbuild14-native-lifecycle\.test\.py\b|\bsecrets\.|"
                                    r"\bupload-artifact\b|--runtime-config-file|-exportArchive")
        commands = re.findall(r"(?m)^\s*xcodebuild ([^\n]+)", re.sub(r"\\\n\s*", " ", source))
        self.assertEqual(len(commands), 3)
        resolve, archive, xctest = commands
        previous = subprocess.check_output(
            ["git", "show", f"{certified}:.github/workflows/{workflow.name}"], cwd=job.ROOT, text=True
        )
        reviewed_commands = re.findall(r"(?m)^\s*xcodebuild ([^\n]+)", re.sub(r"\\\n\s*", " ", previous))
        self.assertEqual([resolve, archive], reviewed_commands[:2])
        self.assertEqual(xctest, reviewed_commands[2] + '  > "$private/xctest-build.log" 2>&1 || xctest_exit=$?')
        self.assertIn("-resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App", resolve)
        self.assertIn("-project ios/App/App.xcodeproj -scheme App -configuration Release", archive)
        self.assertIn("-destination 'generic/platform=iOS'", archive)
        self.assertIn("SWIFT_ACTIVE_COMPILATION_CONDITIONS='GRIDLY_ARCGIS_DIAGNOSTIC GRIDLY_BUILD18_DIAGNOSTIC' archive", archive)
        self.assertIn("-project ios/App/App.xcodeproj -scheme GridlyBuild18Diagnostics -configuration Debug", xctest)
        self.assertIn("-destination 'generic/platform=iOS Simulator'", xctest)
        self.assertIn("ARCHS=arm64 ONLY_ACTIVE_ARCH=NO ENABLE_TESTABILITY=YES", xctest)
        self.assertIn("SWIFT_ACTIVE_COMPILATION_CONDITIONS='DEBUG GRIDLY_ARCGIS_DIAGNOSTIC GRIDLY_BUILD18_DIAGNOSTIC' build-for-testing", xctest)
        for command in (archive, xctest):
            self.assertIn("CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY= GRIDLY_BUILD18_OWNER_PUBLIC_KEY=", command)
        previous_control = subprocess.check_output(
            ["git", "show", f"{diagnostics_base}:.github/workflows/{workflow.name}"], cwd=job.ROOT, text=True
        )
        protected = '          git -C candidate merge-base --is-ancestor "$RELEASED_SHA" HEAD'
        self.assertEqual(source[source.index(protected):], previous_control[previous_control.index(protected):])

    def test_xcode_log_classifies_errors_without_releasing_log_content(self):
        tool = job.ROOT / "tools/arcgis-maintenance/xctest-build-diagnostics.py"
        cases = (
            (
                "SwiftCompile normal arm64 /private/SYNTHETIC_PATH/Build18DiagnosticTests.swift\n"
                "/private/SYNTHETIC_PATH/Build18DiagnosticTests.swift:42:7: error: no such module 'SYNTHETIC_SECRET'\n"
                "The following build commands failed:\n"
                "\tSwiftCompile normal arm64 /private/SYNTHETIC_PATH/Build18DiagnosticTests.swift "
                "(in target 'GridlyBuild18Tests' from project 'App')\n(1 failure)\n",
                ["BUILD18_XCTEST_FAILED_COMMAND kind=SWIFT_COMPILE target=XCTEST",
                 "BUILD18_XCTEST_DIAGNOSTIC code=SWIFT_MODULE_MISSING source=Build18DiagnosticTests.swift line=42 column=7"],
            ),
            (
                "Undefined symbols for architecture arm64:\n  \"_SYNTHETIC_SECRET\"\n"
                "clang: error: linker command failed with exit code 1 (use -v to see invocation)\n"
                "The following build commands failed:\n"
                "\tLd /private/SYNTHETIC_PATH/App normal (in target 'App' from project 'App')\n(1 failure)\n",
                ["BUILD18_XCTEST_FAILED_COMMAND kind=LINK target=APP_HOST",
                 "BUILD18_XCTEST_DIAGNOSTIC code=LINK_UNDEFINED_SYMBOLS",
                 "BUILD18_XCTEST_DIAGNOSTIC code=LINK_COMMAND_FAILED"],
            ),
            (
                "xcodebuild: error: Unable to find a destination matching https://example.invalid/?key=SYNTHETIC_SECRET\n",
                ["BUILD18_XCTEST_FAILED_COMMAND kind=UNKNOWN target=UNKNOWN",
                 "BUILD18_XCTEST_DIAGNOSTIC code=XCODE_DESTINATION"],
            ),
            (
                "error: Could not find test host at /private/SYNTHETIC_PATH/App.app\n",
                ["BUILD18_XCTEST_FAILED_COMMAND kind=UNKNOWN target=UNKNOWN",
                 "BUILD18_XCTEST_DIAGNOSTIC code=XCODE_TEST_HOST"],
            ),
            (
                "/private/SYNTHETIC_PATH/Unknown.swift:13:7: error: SYNTHETIC_SECRET\n",
                ["BUILD18_XCTEST_FAILED_COMMAND kind=UNKNOWN target=UNKNOWN",
                 "BUILD18_XCTEST_DIAGNOSTIC code=UNCLASSIFIED_XCODE_ERROR"],
            ),
            (
                "SwiftCompile normal arm64 SYNTHETIC_PATH (in target 'App' from project 'App')\n"
                "warning: error-like SYNTHETIC_SECRET\nld: warning: SYNTHETIC_PATH\n",
                ["BUILD18_XCTEST_FAILED_COMMAND kind=UNKNOWN target=UNKNOWN",
                 "BUILD18_XCTEST_DIAGNOSTIC code=NO_CLASSIFIABLE_ERROR"],
            ),
        )
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "private.log"
            for index, (log, expected) in enumerate(cases):
                with self.subTest(case=index):
                    path.write_text(log, encoding="utf-8")
                    result = subprocess.run([sys.executable, "-I", "-B", str(tool), str(path)],
                                            capture_output=True, text=True, check=True)
                    self.assertEqual(result.stdout.splitlines(), expected)
                    self.assertEqual(result.stderr, "")
            path.write_text("".join(f"Build18DiagnosticTests.swift:{line}:7: error: SYNTHETIC_SECRET\n"
                                    for line in range(1, 25)), encoding="utf-8")
            result = subprocess.run([sys.executable, "-I", "-B", str(tool), str(path)],
                                    capture_output=True, text=True, check=True)
            self.assertEqual(len(result.stdout.splitlines()), 9)
            self.assertNotIn("SYNTHETIC_SECRET", result.stdout + result.stderr)

    def test_focused_xcode_error_text_requires_a_full_safe_match_at_the_pinned_coordinate(self):
        tool = job.ROOT / "tools/arcgis-maintenance/xctest-build-diagnostics.py"
        location = "/private/SYNTHETIC_PATH/Build18DiagnosticTests.swift:141:61: error: "
        conversion = ("invalid conversion from throwing function of type '(UIImage?, String) throws -> ()' "
                      "to non-throwing function type '(UIImage?, String) -> Void'")
        fallback = "BUILD18_XCTEST_DIAGNOSTIC code=SWIFT_SOURCE_ERROR source=Build18DiagnosticTests.swift line=141 column=61"
        prefix = "BUILD18_XCTEST_DIAGNOSTIC code="
        source = " source=Build18DiagnosticTests.swift line=141 column=61 message="
        cases = (
            (location + conversion, prefix + "SWIFT_THROWING_CLOSURE_CONVERSION" + source + conversion),
            (location + conversion + " SYNTHETIC_TOKEN",
             prefix + "SWIFT_THROWING_CLOSURE_CONVERSION" + source + "WITHHELD"),
            (location + conversion.replace("UIImage?", "https://example.invalid/?token=SYNTHETIC_TOKEN", 1),
             prefix + "SWIFT_THROWING_CLOSURE_CONVERSION" + source + "WITHHELD"),
            (location + "converting non-sendable function value to '@Sendable (UIImage?, String) -> Void' may introduce data races",
             prefix + "SWIFT_CLOSURE_SENDABILITY" + source
             + "converting non-sendable function value to '@Sendable (UIImage?, String) -> Void' may introduce data races"),
            (location + "converting function value of type '@MainActor (UIImage?, String) -> Void' "
             "to '(UIImage?, String) -> Void' loses global actor 'MainActor'",
             prefix + "SWIFT_CLOSURE_ACTOR_ISOLATION" + source
             + "converting function value of type '@MainActor (UIImage?, String) -> Void' "
             "to '(UIImage?, String) -> Void' loses global actor 'MainActor'"),
            (location + "type of expression is ambiguous without a type annotation",
             prefix + "SWIFT_CLOSURE_TYPE_INFERENCE" + source + "type of expression is ambiguous without a type annotation"),
            (location + "errors thrown from here are not handled",
             prefix + "SWIFT_UNHANDLED_THROW" + source + "errors thrown from here are not handled"),
            (location + "SYNTHETIC_TOKEN=/private/path https://example.invalid/", fallback + " message=WITHHELD"),
            (location.replace(":141:61:", ":141:62:") + conversion, fallback.replace("column=61", "column=62")),
            ("error: quoted " + location + conversion, fallback),
        )
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "private.log"
            command = [sys.executable, "-I", "-B", str(tool), str(path)]
            for index, (log, expected) in enumerate(cases):
                with self.subTest(case=index):
                    path.write_text(log + "\n", encoding="utf-8")
                    result = subprocess.run(command, capture_output=True, text=True, check=True)
                    self.assertEqual(result.stdout.splitlines()[1:], [expected])
                    self.assertEqual(result.stderr, "")
            earlier = "".join(f"GridlyBuild18Candidate.swift:{line}:7: error: SYNTHETIC_TOKEN\n" for line in range(1, 13))
            path.write_text(earlier + location + conversion + "\n", encoding="utf-8")
            result = subprocess.run(command, capture_output=True, text=True, check=True)
            self.assertEqual(result.stdout.splitlines()[1], cases[0][1])
            self.assertEqual(len(result.stdout.splitlines()), 9)
            self.assertNotRegex(result.stdout + result.stderr, r"SYNTHETIC_|/private/|https://")

    def test_compiler_stages_fail_closed_and_clean_up(self):
        sha = "1" * 40
        synthetic_detail = "SYNTHETIC_PRIVATE_COMPILER_DETAIL"
        cases = {
            "pass": None,
            "original": None,
            "old-branch": "RUNNER_SCOPE",
            "attempt": "RUNNER_SCOPE",
            "source": "SOURCE_HASH GridlyLabelDiagnostic.swift",
            "xcode": "XCODE_VERSION",
            "timeout": "ADAPTER_OBJECT_TIMEOUT",
            "module": "ADAPTER_TEST_MODULE_MISSING",
            "object": "ADAPTER_OUTPUT_MISSING",
            "symbols": "ADAPTER_CONDITIONAL_BODY_MISSING",
            "imports": "XCTEST_SWIFT_IMPORT_PATH_MISSING",
            "original-timeout": "XCTEST_ORIGINAL_TYPECHECK_TIMEOUT",
            "original-terminated": "XCTEST_ORIGINAL_TYPECHECK_FAILED exit_code=-9",
            "corrected": "XCTEST_CORRECTED_TYPECHECK_FAILED exit_code=73",
            "view": "VIEW_PARSE_FAILED exit_code=73",
            "bridge": "BRIDGE_PARSE_FAILED exit_code=73",
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
                test_imports = sdk_platform / "Developer/usr/lib"
                if case != "imports":
                    test_imports.mkdir(parents=True)
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
                    "GITHUB_REF": "refs/heads/codex/arcgis-ios-build18-compile-only" if case == "old-branch" else job.BRANCH,
                    "GITHUB_RUN_ATTEMPT": "2" if case == "attempt" else "1",
                    "GITHUB_SHA": sha, "RUNNER_TEMP": str(scratch),
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
                        self.assertEqual(argv, (*job.SDK_COMMAND, "nm", "-arch", "arm64", "-U", "-j", str(output)))
                        stages.append("symbols")
                        symbols = "\n".join(f"GridlyLabelDiagnostic_{method}" for method in
                                            ("prepareFixture", "authorizeProviderTransport", "requestTile"))
                        return subprocess.CompletedProcess(argv, 0, "" if case == "symbols" else symbols, "")
                    self.assertEqual(kwargs["timeout"], 90)
                    compiler_args = (
                        *job.SDK_COMMAND, "swiftc", "-swift-version", "5", "-sdk", str(sdk),
                        "-target", "arm64-apple-ios16.4-simulator", "-D", "DEBUG",
                        "-D", "GRIDLY_ARCGIS_DIAGNOSTIC", "-D", "GRIDLY_BUILD18_DIAGNOSTIC",
                    )
                    compile_args = (*compiler_args, "-module-cache-path", str(work / "module-cache"))
                    adapter_args = (*compile_args, "-parse-as-library", "-enable-testing", "-module-name", "App")
                    if "-emit-module" in argv:
                        stages.append("module")
                        self.assertEqual(argv, (
                            *adapter_args, "-emit-module", "-emit-module-path", str(module), str(root / job.ADAPTER),
                        ))
                        if case != "module":
                            module.write_bytes(b"synthetic module")
                    elif "-emit-object" in argv:
                        stages.append("adapter")
                        self.assertEqual(argv, (
                            *adapter_args, "-emit-object", "-o", str(output), str(root / job.ADAPTER),
                        ))
                        if case == "timeout":
                            raise subprocess.TimeoutExpired(argv, 90, stderr=synthetic_detail)
                        if case != "object":
                            output.write_bytes(b"synthetic object")
                    elif "-typecheck" in argv:
                        comparison = "original" if stages[-1] == "module" else "corrected"
                        stages.append(comparison)
                        self.assertTrue(module.is_file())
                        self.assertFalse(output.exists())
                        imports = ("-I", str(test_imports)) if comparison == "corrected" else ()
                        self.assertEqual(argv, (
                            *compiler_args, "-typecheck", "-I", str(work), "-F", str(frameworks),
                            "-module-cache-path", str(work / f"xctest-{comparison}-cache"), *imports, str(root / job.TESTS),
                        ))
                        if case == "original-timeout" and comparison == "original":
                            raise subprocess.TimeoutExpired(argv, 90, stderr=synthetic_detail)
                        if case == "original-terminated" and comparison == "original":
                            return subprocess.CompletedProcess(argv, -9, "", synthetic_detail)
                    else:
                        view = stages[-1] == "symbols"
                        stages.append("view" if view else "bridge")
                        source = job.VIEW if view else job.BRIDGE
                        self.assertEqual(argv, (*compile_args, "-parse", str(root / source)))
                    diagnostic = f"{argv[-1]}:27:4: error: {synthetic_detail}"
                    if case == stages[-1] and case in {"original", "corrected"}:
                        diagnostic += (
                            f"\n{argv[-1]}:14:13: error: cannot find 'XCTAssertFalse' in scope"
                            f"\n{argv[-1]}:27:9: error: cannot find '{synthetic_detail}' in scope"
                            f"\n{argv[-1]}:28:9: error: cannot find 'XCTAssertThrowsError' in scope {synthetic_detail}"
                            "\n/private/synthetic.swift:14:13: error: cannot find 'XCTAssertFalse' in scope"
                        )
                    code = 73 if case == stages[-1] and case != "module" else 0
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
                        self.assertEqual(stages, ["module", "original", "corrected", "adapter", "symbols", "view", "bridge"])
                        self.assertIn("SWIFT_XCTEST_CORRECTED_PASS scope=adapter-module", output.getvalue())
                        self.assertIn("SWIFT_ADAPTER_OBJECT_PASS", output.getvalue())
                        self.assertIn("SWIFT_ADAPTER_SYMBOLS_PASS", output.getvalue())
                        self.assertIn("SWIFT_VIEW_PARSE_PASS", output.getvalue())
                        self.assertIn("SWIFT_BRIDGE_PARSE_PASS", output.getvalue())
                        self.assertIn("SWIFT_INTEGRATION_SYNTAX_PASS APP_PROJECT_COMPILE_REQUIRED", output.getvalue())
                if case == "pass":
                    self.assertIn("SWIFT_XCTEST_ORIGINAL_PASS ROOT_CAUSE_NOT_REPRODUCED", output.getvalue())
                if case == "original":
                    self.assertIn("SWIFT_XCTEST_ORIGINAL_FAIL exit_code=73", output.getvalue())
                    self.assertNotIn("ROOT_CAUSE_NOT_REPRODUCED", output.getvalue())
                if case in {"imports", "original-timeout", "original-terminated"}:
                    self.assertEqual(stages, ["module", "original"])
                if case == "corrected":
                    self.assertEqual(stages, ["module", "original", "corrected"])
                if case in {"original", "corrected"}:
                    self.assertIn("SWIFT_DIAGNOSTIC Build18DiagnosticTests.swift error line=14 column=13 "
                                  f"stage=XCTEST_{case.upper()}_TYPECHECK category=XCTEST_ASSERTION_NOT_IN_SCOPE",
                                  output.getvalue())
                    self.assertEqual(output.getvalue().count("category="), 1)
                    self.assertNotIn("/private/synthetic.swift", output.getvalue())
                self.assertNotIn(synthetic_detail, output.getvalue())
                self.assertNotIn(str(root), output.getvalue())
                self.assertEqual(list(scratch.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
