"""Emit only fixed failure classifications from a private Xcode build log."""

import re
import sys


COMMANDS = {
    "SwiftCompile": "SWIFT_COMPILE",
    "CompileSwift": "SWIFT_COMPILE",
    "SwiftEmitModule": "SWIFT_EMIT_MODULE",
    "EmitSwiftModule": "SWIFT_EMIT_MODULE",
    "SwiftDriver": "SWIFT_DRIVER",
    "SwiftDriverJobDiscovery": "SWIFT_DRIVER",
    "SwiftDriverCompilation": "SWIFT_DRIVER",
    "SwiftDriverCompilationRequirements": "SWIFT_DRIVER",
    "Ld": "LINK",
    "CodeSign": "CODE_SIGN",
    "ProcessInfoPlistFile": "PROCESS_PLIST",
    "ProcessProductPackaging": "PROCESS_PRODUCT",
    "CompileAssetCatalog": "ASSET_CATALOG",
    "CompileAssetCatalogVariant": "ASSET_CATALOG",
    "CpResource": "COPY_RESOURCE",
    "Copy": "COPY",
    "PhaseScriptExecution": "BUILD_SCRIPT",
    "Validate": "VALIDATE",
}
TARGETS = {"App": "APP_HOST", "GridlyBuild18Tests": "XCTEST"}
TARGET = re.compile(r"\(in target '(App|GridlyBuild18Tests)' from project 'App'\)\s*$")
LOCATION = re.compile(
    r"(?:^|[/\\])(Build18DiagnosticTests\.swift|GridlyBuild18Candidate\.swift|"
    r"GridlyBuild18DiagnosticViewController\.swift|GridlyLabelDiagnostic\.swift|"
    r"GridlyBridgeViewController\.swift|project\.pbxproj)"
    r":([1-9][0-9]{0,4}):([1-9][0-9]{0,3}):\s*(?:fatal\s+)?error:"
)
ERROR = re.compile(r"(?:^|:\s+)(?:fatal\s+)?error:\s*|\bld:\s*", re.IGNORECASE)
ERROR_CODES = (
    ("XCODE_DESTINATION", r"unable to find a destination|no destinations|cannot test target .*destination|"
                          r"must be run on a concrete device|ineligible destination"),
    ("XCODE_TEST_SCHEME", r"not currently configured for the test action|"
                          r"does not contain a scheme|scheme .*not found"),
    ("XCODE_TEST_HOST", r"could not find test host|unable to find (?:the )?test host|"
                        r"(?:test_host|test host|bundle loader|bundle_loader).*(?:missing|not found|not set|invalid)"),
    ("XCODE_SIGNING", r"requires a development team|no profiles for|"
                      r"signing for .*requires|code signing is required|provisioning profile"),
    ("XCODE_BUILD_INPUT", r"build input file cannot be found|multiple commands produce"),
    ("XCODE_PACKAGE", r"could not resolve package dependencies|failed to resolve package graph"),
    ("SWIFT_MODULE_NOT_TESTABLE", r"module .* was not compiled for testing"),
    ("SWIFT_MODULE_MISSING", r"no such module|missing required module|could not build (?:objective-c )?module"),
    ("SWIFT_NAME_NOT_FOUND", r"cannot find .* in scope|use of unresolved identifier"),
    ("SWIFT_ACCESS_CONTROL", r"inaccessible due to .* protection level"),
    ("SWIFT_TYPE_ERROR", r"cannot convert value|cannot assign value|type .* has no member|"
                        r"cannot infer contextual base|generic parameter .*could not be inferred|ambiguous use of"),
    ("SWIFT_ACTOR_ISOLATION", r"actor-isolated|actor isolation|non-sendable type"),
    ("LINK_UNDEFINED_SYMBOLS", r"undefined symbols for architecture|undefined symbol:|symbol\(s\) not found"),
    ("LINK_DUPLICATE_SYMBOLS", r"\bduplicate symbols?\b"),
    ("LINK_INPUT_MISSING", r"framework .*not found|library .*not found|"
                          r"(?:framework|library) not found|(?:file|file or directory) not found:"),
    ("LINK_PLATFORM_MISMATCH", r"building for .* but linking in|built for .* not .*simulator|"
                               r"incompatible architecture"),
    ("LINK_COMMAND_FAILED", r"linker command failed"),
)


def classify(lines):
    commands = {}
    diagnostics = {}
    in_failure_summary = False
    for raw in lines:
        if len(raw) > 8192:
            continue
        line = raw.strip()
        if line == "The following build commands failed:":
            in_failure_summary = True
            continue
        if in_failure_summary and re.fullmatch(r"\([0-9]+ failures?\)", line):
            in_failure_summary = False
        if in_failure_summary and line and len(commands) < 6:
            command = COMMANDS.get(line.split(maxsplit=1)[0])
            if command:
                target = TARGET.search(line)
                commands[(command, TARGETS[target[1]] if target else "UNKNOWN")] = None

        if len(diagnostics) >= 8:
            continue
        error = ERROR.search(line)
        if not error and not line.startswith(("Undefined symbols for architecture ", "duplicate symbol ")):
            continue
        message = line[error.end():] if error else line
        if message.lower().startswith(("warning:", "note:")):
            continue
        location = LOCATION.search(line)
        code = next((label for label, pattern in ERROR_CODES if re.search(pattern, message, re.IGNORECASE)),
                    "SWIFT_SOURCE_ERROR" if location and location[1].endswith(".swift") else "UNCLASSIFIED_XCODE_ERROR")
        source = f" source={location[1]} line={location[2]} column={location[3]}" if location else ""
        diagnostics[f"BUILD18_XCTEST_DIAGNOSTIC code={code}{source}"] = None

    result = [f"BUILD18_XCTEST_FAILED_COMMAND kind={command} target={target}"
              for command, target in (commands or {("UNKNOWN", "UNKNOWN"): None})]
    result.extend(diagnostics or ["BUILD18_XCTEST_DIAGNOSTIC code=NO_CLASSIFIABLE_ERROR"])
    return result


if __name__ == "__main__":
    with open(sys.argv[1], encoding="utf-8", errors="replace") as log:
        print(*classify(log), sep="\n")
