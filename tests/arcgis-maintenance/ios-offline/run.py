"""Run only on the dedicated, ephemeral GitHub-hosted arm64 macOS job."""
import json
import os
from pathlib import Path
import platform
import plistlib
import re
import signal
import socket
import subprocess
import sys
import tempfile
import time


BRANCH = "refs/heads/codex/arcgis-maintenance-ios-offline-certification"
FIXTURES = Path(__file__).resolve().parent
ROOT = FIXTURES.parents[2]
XCODE = "/Applications/Xcode_26.5.app/Contents/Developer"
RUNTIME = "com.apple.CoreSimulator.SimRuntime.iOS-26-5"
DEVICE = "com.apple.CoreSimulator.SimDeviceType.iPhone-17"
BUNDLE = "com.gridlygo.arcgis-offline-fixture"
EXECUTABLE = "GridlyArcGISFixture"
MARKER = "SYNTHETIC_GRIDLY_IOS_FIXTURE_20261109"
ADDRESS4 = "192.0.2.1"
ADDRESS6 = "fe80::4752:4944:4c59:1"
ENV = {
    "HOME": str(Path.home()),
    "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
    "LC_ALL": "C",
    "DEVELOPER_DIR": XCODE,
}
FIXTURE_FAILURES = frozenset("""
FIXTURE_PREPARATION FIXTURE_NAVIGATION DEFAULT_OFF SELECT_SYNTHETIC PRE_ARM ARM REQUEST_CAP EXHAUSTED_REOPEN
DIAGNOSTIC_ORDINALS DIAGNOSTIC_ALLOWLIST DIAGNOSTIC_FIELDS DIAGNOSTIC_MARKER CONCURRENT_SETUP CONCURRENT_ARM
CONCURRENT_START CONCURRENT_EXCLUSION CONCURRENT_DURABLE_STOP RETRY_SETUP NO_RETRY STOP_SETUP STOP_ARM
EXPLICIT_STOP INACTIVE_NOTIFICATION WEBKIT_TERMINATION_CALLBACK UNKNOWN_STOP_EVENT FIXTURE_ERROR
NAVIGATION_SETUP NAVIGATION_ARM NAVIGATION_CANCELLED
""".split())


class Blocked(Exception):
    pass


def require(condition, stage):
    if not condition:
        raise Blocked(stage)


def command(stage, *argv, timeout=15, input_text=None, check=True, include_stderr=False):
    try:
        result = subprocess.run(
            argv, cwd=ROOT, env=ENV, input=input_text, text=True, encoding="utf-8", errors="replace",
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout, check=check,
        )
    except (OSError, subprocess.SubprocessError):
        raise Blocked(stage) from None
    return result.stdout + (result.stderr if include_stderr else "")


def pf(*args, **options):
    return command("PF_COMMAND", "/usr/bin/sudo", "-n", "/sbin/pfctl", *args, **options)


def nonempty_lines(text):
    return [line.strip() for line in text.splitlines() if line.strip()]


def require_default_rules(rules, translation):
    wildcard = 'anchor "com.apple/*"'
    main = [line.removesuffix(" all") for line in nonempty_lines(rules)]
    require(main in [[wildcard], ["scrub-" + wildcard, wildcard]], "PF_ROOT_FILTER")
    default_translation = {"nat-" + wildcard, "rdr-" + wildcard, "binat-" + wildcard,
                           "dummynet-" + wildcard}
    require(all(line.removesuffix(" all") in default_translation for line in nonempty_lines(translation)),
            "PF_ROOT_TRANSLATION")


def require_interfaces(interfaces, pf_table):
    names = interfaces.split()
    require("lo0" in names and len(names) > 1, "PF_INTERFACE_INVENTORY")
    for line in nonempty_lines(pf_table):
        if re.search(r"\bskip\b", line, re.IGNORECASE):
            require(line.split()[0] == "lo0", "PF_SKIPPED_INTERFACE")
    for name in names:
        require(re.search(rf"(?m)^\s*{re.escape(name)}(?:\s|$)", pf_table), "PF_INTERFACE_INVENTORY")


def probe_packets(labels):
    counts = {}
    for line in nonempty_lines(labels):
        fields = line.split()
        require(len(fields) >= 3 and fields[0] not in counts and all(field.isdecimal() for field in fields[1:]),
                "PF_LABEL_FORMAT")
        counts[fields[0]] = int(fields[2])
    require(set(counts) == {"gridly_probe4", "gridly_probe6"}, "PF_LABELS")
    return counts


def send_canaries():
    # Numeric addresses only. IPv4 uses TEST-NET, and IPv6 stays link-local so a
    # global IPv6 route is unnecessary. Neither probe uses DNS or a real service.
    route = command("PROBE_INTERFACE", "/sbin/route", "-n", "get", ADDRESS4)
    match = re.search(r"(?m)^\s*interface:\s*(en\d+)\s*$", route)
    require(match is not None, "PROBE_INTERFACE")
    scope = socket.if_nametoindex(match[1])
    for family, target in [(socket.AF_INET, (ADDRESS4, 9)), (socket.AF_INET6, (ADDRESS6, 9, 0, scope))]:
        with socket.socket(family, socket.SOCK_DGRAM) as probe:
            try:
                probe.sendto(b"gridly-pf-test", target)
            except OSError:
                pass  # Success is determined only by the corresponding kernel deny counter.


class Firewall:
    def __init__(self, suffix):
        self.anchor = "com.apple/gridly-arcgis-" + suffix
        self.loaded = False
        self.token = None
        self.rules = [
            f'block drop out quick on ! lo0 inet proto udp from any to {ADDRESS4} label "gridly_probe4"',
            f'block drop out quick on ! lo0 inet6 proto udp from any to {ADDRESS6} label "gridly_probe6"',
            "block drop out quick on ! lo0 inet all",
            "block drop out quick on ! lo0 inet6 all",
        ]

    def check_policy(self, active):
        require_default_rules(pf("-sr"), pf("-sn"))
        require(not pf("-a", "com.apple", "-sr").strip(), "PF_APPLE_FILTER")
        require(not pf("-a", "com.apple", "-sn").strip(), "PF_APPLE_TRANSLATION")
        anchors = nonempty_lines(pf("-a", "com.apple", "-s", "Anchors"))
        children = set()
        for child in anchors:
            short = child.removeprefix("com.apple/")
            require(re.fullmatch(r"[A-Za-z0-9_.-]+", short), "PF_ANCHOR_INVENTORY")
            children.add("com.apple/" + short)
        require((self.anchor in children) == active, "PF_ANCHOR_REACHABILITY")
        for child in sorted(children - {self.anchor}):
            require(not pf("-a", child, "-sr").strip() and not pf("-a", child, "-sn").strip(), "PF_OTHER_ANCHOR")
        require_interfaces(command("INTERFACE_INVENTORY", "/sbin/ifconfig", "-l"), pf("-v", "-s", "Interfaces"))
        require(not pf("-ss").strip(), "PF_EXISTING_STATES")
        if active:
            require(re.search(r"(?m)^Status: Enabled\b", pf("-s", "info")), "PF_NOT_ENABLED")
            installed = nonempty_lines(pf("-a", self.anchor, "-sr"))
            require(installed == self.rules, "PF_RULE_READBACK")
            require(not pf("-a", self.anchor, "-sn").strip(), "PF_FIXTURE_TRANSLATION")

    def install(self):
        self.check_policy(active=False)
        rules = "\n".join(self.rules) + "\n"
        pf("-a", self.anchor, "-nf", "-", input_text=rules)
        self.loaded = True
        pf("-a", self.anchor, "-f", "-", input_text=rules)
        enabled = pf("-E", include_stderr=True)
        token = re.findall(r"(?m)^\s*Token\s*:\s*(\d+)\s*$", enabled)
        require(len(token) == 1, "PF_ENABLE_TOKEN")
        self.token = token[0]
        self.verify()

    def verify(self):
        self.check_policy(active=True)
        before = probe_packets(pf("-a", self.anchor, "-s", "labels"))
        send_canaries()
        after = probe_packets(pf("-a", self.anchor, "-s", "labels"))
        require(all(after[label] > count for label, count in before.items()), "PF_DUAL_STACK_PROBE")

    def close(self):
        if self.loaded:
            pf("-a", self.anchor, "-F", "rules")
            require(not pf("-a", self.anchor, "-sr").strip(), "PF_CLEANUP")
        if self.token is not None:
            pf("-X", self.token)


def sim(stage, *args, **options):
    return command(stage, "/usr/bin/xcrun", "simctl", *args, **options)


def require_simulator_runtime():
    try:
        result = subprocess.run(
            ("/usr/bin/xcrun", "simctl", "list", "-j", "runtimes"),
            cwd=ROOT, env=ENV, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            timeout=60, check=True,
        )
    except subprocess.TimeoutExpired:
        raise Blocked("SIM_RUNTIME_TIMEOUT") from None
    except subprocess.CalledProcessError as failure:
        raise Blocked(f"SIM_RUNTIME_COMMAND_FAILED exit_code={failure.returncode}") from None
    except OSError:
        raise Blocked("SIM_RUNTIME_COMMAND_FAILED") from None

    require(len(result.stdout) <= 1024 * 1024, "SIM_RUNTIME_INVALID_OUTPUT")
    try:
        inventory = json.loads(result.stdout.decode("utf-8"))
    except (ValueError, RecursionError):
        raise Blocked("SIM_RUNTIME_INVALID_OUTPUT") from None
    runtimes = inventory.get("runtimes") if isinstance(inventory, dict) else None
    require(isinstance(runtimes, list) and all(
        isinstance(row, dict) and isinstance(row.get("identifier"), str) and row["identifier"]
        and isinstance(row.get("isAvailable"), bool) for row in runtimes
    ), "SIM_RUNTIME_INVALID_OUTPUT")
    require(any(row["identifier"] == RUNTIME and row["isAvailable"] for row in runtimes), "SIM_RUNTIME_MISSING")
    print("SIM_RUNTIME_AVAILABLE", flush=True)


def compile_fixture(work):
    xcode = command("XCODE_VERSION", "/usr/bin/xcodebuild", "-version")
    version = re.fullmatch(r"Xcode (26\.5(?:\.\d+)?)\nBuild version ([A-Za-z0-9]+)\s*", xcode)
    require(version is not None, "XCODE_VERSION")
    require_simulator_runtime()
    sdk = command("SIMULATOR_SDK", "/usr/bin/xcrun", "--sdk", "iphonesimulator", "--show-sdk-path").strip()
    require(Path(sdk).is_dir() and sdk.startswith(XCODE + "/"), "SIMULATOR_SDK")
    app = work / (EXECUTABLE + ".app")
    app.mkdir()
    info = {
        "CFBundleExecutable": EXECUTABLE, "CFBundleIdentifier": BUNDLE, "CFBundleName": EXECUTABLE,
        "CFBundlePackageType": "APPL", "CFBundleVersion": "1", "CFBundleShortVersionString": "1.0",
        "CFBundleSupportedPlatforms": ["iPhoneSimulator"], "MinimumOSVersion": "26.5",
        "UIDeviceFamily": [1], "UILaunchScreen": {},
    }
    (app / "Info.plist").write_bytes(plistlib.dumps(info))
    adapter = ROOT / "tools/arcgis-maintenance/native/ios/GridlyLabelDiagnostic.swift"
    command("SWIFT_COMPILE", "/usr/bin/xcrun", "--sdk", "iphonesimulator", "swiftc",
            "-sdk", sdk, "-target", "arm64-apple-ios26.5-simulator", "-swift-version", "5",
            "-D", "DEBUG", "-D", "GRIDLY_ARCGIS_DIAGNOSTIC", "-parse-as-library",
            str(adapter), str(FIXTURES / "Fixture.swift"), "-o", str(app / EXECUTABLE), timeout=90)
    return app, version.groups()


def run_fixture(device, app, work, firewall):
    sim("SIM_BOOT", "boot", device)
    sim("SIM_BOOT_STATUS", "bootstatus", device, "-b", timeout=150)
    firewall.verify()
    sim("SIM_FIXTURE_INSTALL", "install", device, str(app))
    data = Path(sim("SIM_DATA_CONTAINER", "get_app_container", device, BUNDLE, "data").strip()).resolve(strict=True)
    require(data.is_relative_to(Path.home().resolve() / "Library/Developer/CoreSimulator/Devices" / device), "SIM_DATA_CONTAINER")
    result = data / "Library/Application Support/gridly-fixture-result"
    require(not result.exists(), "SIM_STALE_RESULT")
    stdout, stderr = work / "fixture.stdout", work / "fixture.stderr"
    firewall.verify()
    sim("SIM_FIXTURE_LAUNCH", "launch", f"--stdout={stdout}", f"--stderr={stderr}", device, BUNDLE, timeout=25)
    deadline = time.monotonic() + 65
    while not result.is_file() and time.monotonic() < deadline:
        time.sleep(0.2)
    require(result.is_file() and not result.is_symlink() and result.stat().st_size <= 64, "SIM_FIXTURE_RESULT")
    outcome = result.read_text(encoding="ascii")
    require(outcome == "IOS_SYNTHETIC_PASS", outcome if outcome in FIXTURE_FAILURES else "SIM_FIXTURE_RESULT")
    sim("SIM_FIXTURE_TERMINATE", "terminate", device, BUNDLE)
    for stream in (stdout, stderr):
        require(stream.is_file() and not stream.is_symlink() and stream.stat().st_size <= 1024 * 1024,
                "FIXTURE_LOG_CAPTURE")
        require(MARKER.encode() not in stream.read_bytes(), "FIXTURE_LOG_MARKER")
    logs = sim("SIM_LOG_CHECK", "spawn", device, "log", "show", "--last", "5m", "--style", "compact",
               "--info", "--debug", "--predicate",
               f'process == "{EXECUTABLE}" OR process CONTAINS "WebKit" OR subsystem BEGINSWITH "com.apple.WebKit"',
               timeout=25)
    require(MARKER not in logs, "FIXTURE_LOG_MARKER")


def main():
    require(platform.system() == "Darwin" and platform.machine() == "arm64" and os.getuid() != 0
            and os.environ.get("GITHUB_ACTIONS") == "true"
            and os.environ.get("RUNNER_ENVIRONMENT") == "github-hosted"
            and os.environ.get("GITHUB_REPOSITORY") == "DBMaps/liberty-county-map"
            and os.environ.get("GITHUB_REF") == BRANCH and os.environ.get("GITHUB_EVENT_NAME") == "push"
            and os.environ.get("GITHUB_RUN_ATTEMPT") == "1", "RUNNER_SCOPE")
    sha = os.environ.get("GITHUB_SHA", "")
    run_id = os.environ.get("GITHUB_RUN_ID", "")
    require(re.fullmatch(r"[0-9a-f]{40}", sha) and run_id.isdecimal(), "RUNNER_IDENTITY")
    require(command("CHECKOUT_SHA", "/usr/bin/git", "rev-parse", "HEAD").strip() == sha, "CHECKOUT_SHA")
    temp = Path(os.environ["RUNNER_TEMP"]).resolve(strict=True)
    output = temp / "gridly-arcgis-synthetic-result.json"
    require(not output.exists() and not output.is_symlink(), "STALE_RESULT")
    os.umask(0o077)
    with tempfile.TemporaryDirectory(prefix="arcgis-fixture-", dir=temp) as directory:
        work = Path(directory)
        ENV["TMPDIR"] = str(work)
        app, (xcode, build) = compile_fixture(work)
        firewall = Firewall(run_id)
        device = None
        try:
            firewall.install()
            result = command("MAC_PRIVATE_INPUT", "node", str(FIXTURES / "private-input.mjs"), timeout=90)
            require(result.strip() == "MAC_PRIVATE_INPUT_PASS", "MAC_PRIVATE_INPUT")
            firewall.verify()
            value = sim("SIM_CREATE", "create", "Gridly ArcGIS Offline " + run_id, DEVICE, RUNTIME).strip()
            require(re.fullmatch(r"[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12}", value), "SIM_UUID")
            device = value
            run_fixture(device, app, work, firewall)
            firewall.verify()
        finally:
            # If simulator deletion fails, leave the deny rule active on this disposable runner.
            if device:
                sim("SIM_SHUTDOWN", "shutdown", device, timeout=30, check=False)
                sim("SIM_DELETE", "delete", device, timeout=30)
            firewall.close()
    macos = platform.mac_ver()[0]
    require(re.fullmatch(r"\d+\.\d+(?:\.\d+)?", macos), "MACOS_VERSION")
    with output.open("x", encoding="utf-8") as report:
        json.dump({
            "schema": 1, "source": sha, "architecture": "arm64", "macos": macos,
            "xcode": xcode, "xcode_build": build, "simulator_runtime": "iOS 26.5",
            "os_ipv4_egress": "PF_DENIED", "os_ipv6_egress": "PF_DENIED",
            "native_synthetic_transport": "PASS", "default_off": "PASS", "pre_arm": "PASS",
            "two_request_cap_and_third_rejection": "PASS", "concurrency_and_retry": "PASS",
            "cancellation_and_lifecycle_callbacks": "PASS", "sanitized_diagnostics": "PASS",
            "mac_private_file_permissions": "PASS", "wkwebview_https_authorization": "UNVERIFIED",
        }, report, sort_keys=True)
        report.write("\n")
    print("ARCGIS_IOS_SYNTHETIC_PASS")


def cancelled(_signal, _frame):
    raise Blocked("CANCELLED")


if __name__ == "__main__":
    signal.signal(signal.SIGINT, cancelled)
    signal.signal(signal.SIGTERM, cancelled)
    try:
        main()
    except Blocked as failure:
        print(f"ARCGIS_IOS_SYNTHETIC_BLOCKED {failure}")
        sys.exit(1)
    except Exception:
        print("ARCGIS_IOS_SYNTHETIC_BLOCKED UNEXPECTED_RUNNER_STATE")
        sys.exit(1)
