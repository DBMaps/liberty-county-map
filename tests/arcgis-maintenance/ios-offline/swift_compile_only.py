"""Compile the pinned adapter into an object on the dedicated macOS job."""
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
BRANCH = "refs/heads/codex/arcgis-maintenance-ios-compile-only"
SOURCE = Path("tools/arcgis-maintenance/native/ios/GridlyLabelDiagnostic.swift")
SOURCE_SHA256 = "854f47e2bdb96fa335c4281ad52339574abcbb9af1b7542217949088507e0daf"
XCODE = Path("/Applications/Xcode_26.5.app/Contents/Developer")
SDK_COMMAND = ("/usr/bin/xcrun", "--sdk", "iphonesimulator")
TARGET = "arm64-apple-ios26.5-simulator"


class Blocked(Exception):
    pass


def require(condition, status):
    if not condition:
        raise Blocked(status)


def command(stage, env, *argv, timeout=15, check=True):
    try:
        return subprocess.run(
            argv, cwd=ROOT, env=env, stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            encoding="utf-8", errors="replace", timeout=timeout, check=check,
        )
    except subprocess.TimeoutExpired:
        raise Blocked(f"{stage}_TIMEOUT") from None
    except (OSError, subprocess.SubprocessError):
        raise Blocked(f"{stage}_FAILED") from None


def report_diagnostics(source, text):
    location = rf"(?m)^{re.escape(str(source))}:([0-9]{{1,6}}):([0-9]{{1,4}}): (error|warning|note):"
    for match in islice(re.finditer(location, text), 8):
        line, column, severity = match.groups()
        print(f"SWIFT_DIAGNOSTIC {severity} line={line} column={column}")


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
    checkout = command("SOURCE_SHA", env, "/usr/bin/git", "rev-parse", "HEAD")
    require(checkout.stdout.strip() == sha, "SOURCE_SHA")
    source = ROOT / SOURCE
    require(source.is_file() and not source.is_symlink()
            and hashlib.sha256(source.read_bytes()).hexdigest() == SOURCE_SHA256, "ADAPTER_HASH")
    version = command("XCODE_VERSION", env, "/usr/bin/xcodebuild", "-version")
    require(version.stdout.strip() == "Xcode 26.5\nBuild version 17F42", "XCODE_VERSION")
    sdk_version = command("SDK_VERSION", env, *SDK_COMMAND, "--show-sdk-version")
    require(sdk_version.stdout.strip() == "26.5", "SDK_VERSION")
    sdk_path = command("SDK_PATH", env, *SDK_COMMAND, "--show-sdk-path")
    sdk = Path(sdk_path.stdout.strip())
    require(sdk.is_dir() and sdk.resolve().is_relative_to(XCODE.resolve()), "SDK_PATH")

    with tempfile.TemporaryDirectory(prefix="gridly-swift-object-", dir=os.environ["RUNNER_TEMP"]) as directory:
        work = Path(directory)
        output = work / "GridlyLabelDiagnostic.o"
        compile_env = {**env, "TMPDIR": str(work)}
        result = command(
            "SWIFT_COMPILE", compile_env, *SDK_COMMAND, "swiftc", "-emit-object", "-parse-as-library",
            "-swift-version", "5", "-sdk", str(sdk), "-target", TARGET,
            "-D", "DEBUG", "-D", "GRIDLY_ARCGIS_DIAGNOSTIC", "-module-cache-path", str(work / "module-cache"),
            str(source), "-o", str(output), timeout=90, check=False,
        )
        report_diagnostics(source, result.stderr)
        require(result.returncode == 0, f"SWIFT_COMPILE_FAILED exit_code={result.returncode}")
        require(output.is_file() and not output.is_symlink() and output.stat().st_size > 0, "SWIFT_OBJECT_MISSING")
        symbols = command("SWIFT_OBJECT_SYMBOLS", compile_env, *SDK_COMMAND, "nm", "-arch", "arm64", "-U", "-j", str(output))
        adapter_symbols = [symbol for symbol in symbols.stdout.splitlines() if "GridlyLabelDiagnostic" in symbol]
        for method in ("prepareFixture", "selectSyntheticTransport", "requestTile"):
            require(any(method in symbol for symbol in adapter_symbols), "SWIFT_CONDITIONAL_BODY_MISSING")
    print(f"APPLE_SWIFT_COMPILE_PASS sha={sha} xcode=26.5 build=17F42 sdk=iphonesimulator26.5 target={TARGET}")


if __name__ == "__main__":
    try:
        main()
    except Blocked as failure:
        print(f"APPLE_SWIFT_COMPILE_BLOCKED {failure}")
        sys.exit(1)
    except (Exception, KeyboardInterrupt):
        print("APPLE_SWIFT_COMPILE_BLOCKED UNEXPECTED_RUNNER_STATE")
        sys.exit(1)
