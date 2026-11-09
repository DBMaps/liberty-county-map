"""Verify Build 18 Swift sources without linking or running the app."""
import hashlib
from itertools import islice
import os
from pathlib import Path
import platform
import re
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[3]
BRANCH = "refs/heads/codex/arcgis-ios-build18-xctest-verification"
XCODE = Path("/Applications/Xcode_26.5.app/Contents/Developer")
SDK_COMMAND = ("/usr/bin/xcrun", "--sdk", "iphonesimulator")
TARGET = "arm64-apple-ios16.4-simulator"
ADAPTER = "tools/arcgis-maintenance/native/ios/GridlyLabelDiagnostic.swift"
VIEW = "ios/App/App/GridlyBuild18DiagnosticViewController.swift"
BRIDGE = "ios/App/App/GridlyBridgeViewController.swift"
TESTS = "tests/arcgis-maintenance/ios-build18/Build18DiagnosticTests.swift"
XCTEST_MISSING_ASSERTION = re.compile(
    r"cannot find '(?:XCTAssertEqual|XCTAssertFalse|XCTAssertThrowsError|XCTAssertTrue|XCTFail)' in scope"
)
REVIEWED_INPUTS = {
    ADAPTER: "c7bcdb6cd97dc0b1b101bc4700f433e1fd9473376d64b8fe220ea198c2b4462f",
    VIEW: "8ab3c5653c02050c6f9d8f98f8c7f65bdc695c4b3acca78e997c685ef75229c9",
    BRIDGE: "98cbd7b9d1bcd6666171631d82baeb927a5287c686a238da68c094e06e6dc472",
    TESTS: "84d5f9162c967e7775ac0bd0a422b07b32ecf864d87bf0bacc370b44d43f7f64",
    "ios/App/App.xcodeproj/project.pbxproj": "3c5f122937f866c7e731100931a093cabf2b0a33cff626d51d6ba6f4cb787f2d",
    "ios/App/CapApp-SPM/Package.swift": "379598450aef91267e23df44223789d989d763b3a5636aef0182d7d87efb9a6c",
}


class Blocked(Exception):
    pass


def require(condition, status):
    if not condition:
        raise Blocked(status)


def command(stage, env, *argv, timeout=15):
    try:
        return subprocess.run(
            argv, cwd=ROOT, env=env, stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            encoding="utf-8", errors="replace", timeout=timeout, check=False,
        )
    except subprocess.TimeoutExpired:
        raise Blocked(f"{stage}_TIMEOUT") from None
    except OSError:
        raise Blocked(f"{stage}_FAILED") from None


def metadata(stage, env, *argv):
    result = command(stage, env, *argv)
    require(result.returncode == 0, f"{stage}_FAILED")
    return result.stdout.strip()


def swift_check(stage, env, compiler, args, sources, *, allow_compile_error=False):
    result = command(stage, env, *compiler, *args, *(str(ROOT / path) for path in sources), timeout=90)
    for source in sources:
        location = rf"(?m)^{re.escape(str(ROOT / source))}:([0-9]{{1,6}}):([0-9]{{1,4}}): (error|warning|note): ?([^\r\n]*)"
        for match in islice(re.finditer(location, result.stderr), 8):
            line, column, severity, message = match.groups()
            category = ""
            if source == TESTS and severity == "error" and XCTEST_MISSING_ASSERTION.fullmatch(message):
                category = " category=XCTEST_ASSERTION_NOT_IN_SCOPE"
            print(f"SWIFT_DIAGNOSTIC {Path(source).name} {severity} line={line} column={column} stage={stage}{category}")
    require(result.returncode == 0 or (allow_compile_error and result.returncode > 0),
            f"{stage}_FAILED exit_code={result.returncode}")
    return result.returncode


def main():
    require(
        sys.platform == "darwin" and platform.machine() == "arm64"
        and os.environ.get("GITHUB_ACTIONS") == "true"
        and os.environ.get("RUNNER_ENVIRONMENT") == "github-hosted"
        and os.environ.get("GITHUB_REPOSITORY") == "DBMaps/liberty-county-map"
        and os.environ.get("GITHUB_REF") == BRANCH and os.environ.get("GITHUB_EVENT_NAME") == "push"
        and os.environ.get("GITHUB_RUN_ATTEMPT") == "1", "RUNNER_SCOPE",
    )
    sha = os.environ.get("GITHUB_SHA", "")
    require(re.fullmatch(r"[0-9a-f]{40}", sha), "SOURCE_SHA")
    env = {
        "HOME": str(Path.home()), "PATH": "/usr/bin:/bin:/usr/sbin:/sbin",
        "LC_ALL": "C", "DEVELOPER_DIR": str(XCODE),
    }
    require(metadata("SOURCE_SHA", env, "/usr/bin/git", "rev-parse", "HEAD") == sha, "SOURCE_SHA")
    for relative, digest in REVIEWED_INPUTS.items():
        source = ROOT / relative
        require(source.is_file() and not source.is_symlink() and source.resolve().is_relative_to(ROOT.resolve()),
                f"SOURCE_PATH {source.name}")
        require(hashlib.sha256(source.read_bytes().replace(b"\r\n", b"\n")).hexdigest() == digest,
                f"SOURCE_HASH {source.name}")
    require(metadata("XCODE_VERSION", env, "/usr/bin/xcodebuild", "-version")
            == "Xcode 26.5\nBuild version 17F42", "XCODE_VERSION")
    require(metadata("SDK_VERSION", env, *SDK_COMMAND, "--show-sdk-version") == "26.5", "SDK_VERSION")
    sdk = Path(metadata("SDK_PATH", env, *SDK_COMMAND, "--show-sdk-path"))
    sdk_platform = Path(metadata("SDK_PLATFORM", env, *SDK_COMMAND, "--show-sdk-platform-path"))
    require(sdk.is_dir() and sdk_platform.is_dir() and sdk.resolve().is_relative_to(sdk_platform.resolve())
            and sdk_platform.resolve().is_relative_to(XCODE.resolve()), "SDK_PATH")
    frameworks = sdk_platform / "Developer/Library/Frameworks"

    with tempfile.TemporaryDirectory(prefix="gridly-build18-swift-", dir=os.environ["RUNNER_TEMP"]) as directory:
        work = Path(directory)
        output = work / "GridlyLabelDiagnostic.o"
        module = work / "App.swiftmodule"
        compile_env = {**env, "TMPDIR": str(work)}
        compiler = (*SDK_COMMAND, "swiftc")
        flags = ("-swift-version", "5", "-sdk", str(sdk), "-target", TARGET,
                 "-D", "DEBUG", "-D", "GRIDLY_ARCGIS_DIAGNOSTIC", "-D", "GRIDLY_BUILD18_DIAGNOSTIC")
        compile_flags = (*flags, "-module-cache-path", str(work / "module-cache"))
        adapter_flags = (*compile_flags, "-parse-as-library", "-enable-testing", "-module-name", "App")
        # This module contains the real adapter only. The App name satisfies the existing @testable import.
        swift_check("ADAPTER_TEST_MODULE", compile_env, compiler,
                    (*adapter_flags, "-emit-module", "-emit-module-path", str(module)), (ADAPTER,))
        require(module.is_file() and not module.is_symlink() and module.stat().st_size > 0, "ADAPTER_TEST_MODULE_MISSING")

        require((frameworks / "XCTest.framework").is_dir(), "XCTEST_FRAMEWORK_MISSING")
        xctest_flags = (*flags, "-typecheck", "-I", str(work), "-F", str(frameworks))
        original_status = swift_check(
            "XCTEST_ORIGINAL_TYPECHECK", compile_env, compiler,
            (*xctest_flags, "-module-cache-path", str(work / "xctest-original-cache")),
            (TESTS,), allow_compile_error=True,
        )
        if original_status == 0:
            print("SWIFT_XCTEST_ORIGINAL_PASS ROOT_CAUSE_NOT_REPRODUCED")
        else:
            print(f"SWIFT_XCTEST_ORIGINAL_FAIL exit_code={original_status}")

        # SwiftPM also searches the platform's Developer/usr/lib for Swift test support.
        test_imports = sdk_platform / "Developer/usr/lib"
        require(test_imports.is_dir() and test_imports.resolve().is_relative_to(XCODE.resolve()),
                "XCTEST_SWIFT_IMPORT_PATH_MISSING")
        swift_check("XCTEST_CORRECTED_TYPECHECK", compile_env, compiler,
                    (*xctest_flags, "-module-cache-path", str(work / "xctest-corrected-cache"), "-I", str(test_imports)),
                    (TESTS,))
        print("SWIFT_XCTEST_CORRECTED_PASS scope=adapter-module")

        swift_check("ADAPTER_OBJECT", compile_env, compiler,
                    (*adapter_flags, "-emit-object", "-o", str(output)), (ADAPTER,))
        require(output.is_file() and not output.is_symlink() and output.stat().st_size > 0, "ADAPTER_OUTPUT_MISSING")
        print("SWIFT_ADAPTER_OBJECT_PASS")
        symbols = metadata("ADAPTER_SYMBOLS", compile_env, *SDK_COMMAND, "nm", "-arch", "arm64", "-U", "-j", str(output))
        for method in ("prepareFixture", "authorizeProviderTransport", "requestTile"):
            require(any("GridlyLabelDiagnostic" in symbol and method in symbol for symbol in symbols.splitlines()),
                    "ADAPTER_CONDITIONAL_BODY_MISSING")
        print("SWIFT_ADAPTER_SYMBOLS_PASS")

        swift_check("VIEW_PARSE", compile_env, compiler, (*compile_flags, "-parse"), (VIEW,))
        print("SWIFT_VIEW_PARSE_PASS")
        swift_check("BRIDGE_PARSE", compile_env, compiler, (*compile_flags, "-parse"), (BRIDGE,))
        print("SWIFT_BRIDGE_PARSE_PASS")
        print("SWIFT_INTEGRATION_SYNTAX_PASS APP_PROJECT_COMPILE_REQUIRED")
    print(f"BUILD18_SWIFT_COMPILE_ONLY_PASS sha={sha} xcode=26.5 build=17F42 sdk=iphonesimulator26.5 target={TARGET}")


if __name__ == "__main__":
    try:
        main()
    except Blocked as failure:
        print(f"BUILD18_SWIFT_COMPILE_ONLY_BLOCKED {failure}")
        sys.exit(1)
    except (Exception, KeyboardInterrupt):
        print("BUILD18_SWIFT_COMPILE_ONLY_BLOCKED UNEXPECTED_RUNNER_STATE")
        sys.exit(1)
