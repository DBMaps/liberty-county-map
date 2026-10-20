"""Local delivery gates: synthetic metadata/material only; never build, sign or call Apple."""
import ast
import copy
import errno
import contextlib
import hashlib
import io
import json
import os
import plistlib
import re
import subprocess
import sys
import tempfile
import unittest
import email.message
import email.utils
import socket
import urllib.error
from pathlib import Path
from unittest.mock import Mock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import apple_storekit_testflight_delivery as delivery

COMMIT = "1" * 40
REF = delivery.PREFIX + COMMIT
NOW = 1792364400
STAMP = delivery.dt.datetime.fromtimestamp(NOW, delivery.dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/gridly-storekit-testflight-delivery.yml"




DELIVERY_REPORTING_FUNCTIONS = {
    "classify_upload_error", "execute_upload", "write_upload_status", "upload_diagnostics",
    "upload_once", "remove_owned_workspace", "prior_attempt_evidence", "prior_attempt_slot",
    "DeliveryCheckFailure", "verify_delivery_export", "delivery_failure_category",
    "delivery_stage", "emit_delivery", "transfer_public", "ui_unused_build", "apple_id_command",
}


APPLE_ID_WORKFLOW_COMMENT = '# Apple ID delivery uses ONLY the two existing Apple ID secrets, never an API key.\n# REQUIRED additional annotation field: "apple_id_upload_authorization":{\n# "authorized":true,"method":"OWNER_AND_INDEPENDENT_APP_STORE_CONNECT_UI",\n# "owner_checked_at":"<same genuine UTC time as owner_checks_at>",\n# "independent_checked_at":"<genuine independent read-only UI check UTC time>",\n# "owner_verified_unused":true,"independent_verified_unused":true,\n# "build_uploads_reviewed":true,"testflight_all_builds_reviewed":true,\n# "no_pending_or_uncertain_uploads":true,"exclusive_upload_window_acknowledged":true}\n# The owner AND an independent reviewer must actually inspect App Store Connect\n# Build Uploads and all TestFlight builds before tagging; never fabricate evidence.\n# Both checks must remain within 1,800 seconds through the pre-upload gate.\n# D05\'s historical stage name now covers this explicit UI-evidence mode, not an API query.\n# No validation result alone is treated as proof that Build 15 is unused.\n# Do not include account identities, screenshots, raw Apple output or secrets in the tag.\n'


def normalize_uploader_repair(source):
    """Reverse exact transport call deltas for the older historical comparisons.

    The new transport and unchanged authorization functions are tested separately.
    Never substitute whole functions or fetch replacement implementations.
    """
    if 'def prepare_package_upload(' not in source:
        return source
    replacements = (
        ('        upload_command = prepare_package_upload(root, command, ipa, execute, **transport_options)\n', ''),
        ('upload_once(root, commit, upload_command, execute, **transport_options)',
         'upload_once(root, commit, [*command, "--upload-app"], execute, **transport_options)'),
        ('(run_upload_process if execute is _UPLOAD_RUN else execute)(command, check=True,',
         'execute(command, check=True,'),
        ('safe = subprocess.CalledProcessError(code, ["xcrun", "altool", "--upload-package"])',
         'safe = subprocess.CalledProcessError(code, ["xcrun", "altool", "--upload-app"])'),
    )
    for current, previous in replacements:
        assert source.count(current) == 1, current
        source = source.replace(current, previous, 1)
    tree = ast.parse(source)
    tree.body = [node for node in tree.body if not (isinstance(node, ast.FunctionDef)
        and node.name in {'private_upload_environment', 'run_upload_process',
                          'package_provider', 'prepare_package_upload'})]
    return ast.unparse(tree)


def normalize_prior_attempt(source):
    """Reverse only the exact optional-path deltas for historical comparisons."""
    source = normalize_uploader_repair(source)
    if "def prior_attempt_evidence(" not in source:
        return source
    tree=ast.parse(source)
    selected=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ('owner_authorization','ui_unused_build','authorize','authorization_guard')]
    if not any(isinstance(n,ast.Name) and n.id=='PRIOR_ATTEMPT_FIELD' for f in selected for n in ast.walk(f)):
        return source
    ui=ast.parse('if isinstance(evidence, dict) and PRIOR_ATTEMPT_FIELD in evidence:\n    return prior_attempt_evidence(authorization, now)').body[0]
    tag=ast.parse('if PRIOR_ATTEMPT_FIELD in value.get(APPLE_ID_AUTH_FIELD, {}):\n    prior_attempt_slot(ref, commit)').body[0]
    tail=ast.parse('value = owner_authorization(report["authorization"], commit, report["ref"], now)\nif PRIOR_ATTEMPT_FIELD in value.get(APPLE_ID_AUTH_FIELD, {}):\n    prior_attempt_slot(report["ref"], commit)\nreturn value').body
    old=ast.parse('return owner_authorization(report["authorization"], commit, report["ref"], now)').body[0]
    owner=ast.parse('if isinstance(value.get(APPLE_ID_AUTH_FIELD), dict) and PRIOR_ATTEMPT_FIELD in value[APPLE_ID_AUTH_FIELD]:\n    require(value["unused_build_number_confirmed"] is False, "historical build-number uncertainty must remain explicit")\n    common = common - {"unused_build_number_confirmed"}').body[0]
    for function in (n for n in tree.body if isinstance(n,ast.FunctionDef)):
        if function.name in ('owner_authorization','ui_unused_build','authorize'):
            expected=owner if function.name=='owner_authorization' else ui if function.name=='ui_unused_build' else tag
            matches=[n for n in function.body if isinstance(n,ast.If) and any(isinstance(x,ast.Name) and x.id=='PRIOR_ATTEMPT_FIELD' for x in ast.walk(n.test))]
            assert len(matches)==1 and ast.dump(matches[0])==ast.dump(expected)
            function.body.remove(matches[0])
        if function.name=='authorization_guard':
            assert [ast.dump(n) for n in function.body[-3:]]==[ast.dump(n) for n in tail]
            function.body=function.body[:-3]+[old]
    return ast.unparse(ast.fix_missing_locations(tree))


def normalize_recovery(source):
    """Reverse exact reviewed AST deltas; also accept already-normalized input."""
    if "def upload_once(" not in source:
        return source
    tree=ast.parse(normalize_prior_attempt(source))
    current=ast.parse('upload_once(root, commit, [*command, "--upload-app"], execute, **transport_options)').body[0]
    previous=ast.parse('write_json(marker, {"status": "ATTEMPTED", "source_commit": commit, "build": "15"})\nexecute_upload(root, [*command, "--upload-app"], execute, **transport_options)\nwrite_json(marker, {"status": "ACCEPTED", "source_commit": commit, "build": "15"})').body
    remove=ast.parse('remove_owned_workspace(root, owned, workspace_details)',mode='eval').body
    legacy_remove=ast.parse('shutil.rmtree(root)',mode='eval').body
    addition=ast.parse("""if "uploader_outcome" in transfer_report:
    result["upload_diagnostics"] = upload_diagnostics(transfer_report)
    if transfer_report["status"] == "ACCEPTED":
        require(result["upload_diagnostics"]["uploader_outcome"] == "RETURNED_ZERO"
                and result["upload_diagnostics"]["uploader_exit_code"] == 0, "incomplete upload process evidence")
        result["upload"] = "UPLOADER_SUCCEEDED_APPLE_UNCONFIRMED"
""").body[0]
    condition=ast.parse('job_status == "success" and result["upload"] in {"ACCEPTED", "UPLOADER_SUCCEEDED_APPLE_UNCONFIRMED"}',mode='eval').body
    legacy_condition=ast.parse('job_status == "success" and result["upload"] == "ACCEPTED"',mode='eval').body
    for function in (n for n in tree.body if isinstance(n,ast.FunctionDef)):
        if function.name=='transfer':
            for node in ast.walk(function):
                if isinstance(node,ast.With):
                    body=[]
                    for item in node.body:
                        if isinstance(item,ast.Expr) and isinstance(item.value,ast.Call) and getattr(item.value.func,'id','')=='upload_once':
                            assert ast.dump(item)==ast.dump(current)
                            body.extend(copy.deepcopy(previous))
                        else:body.append(item)
                    node.body=body
        if function.name=='cleanup_delivery':
            for node in ast.walk(function):
                if isinstance(node,ast.Expr) and isinstance(node.value,ast.Call) and getattr(node.value.func,'id','')=='remove_owned_workspace':
                    assert ast.dump(node.value)==ast.dump(remove)
                    node.value=copy.deepcopy(legacy_remove)
        if function.name=='finish':
            for node in ast.walk(function):
                if hasattr(node,"body") and isinstance(node.body,list):
                    body=[]
                    for item in node.body:
                        if isinstance(item,ast.If) and ast.dump(item.test)==ast.dump(addition.test):
                            assert ast.dump(item)==ast.dump(addition)
                        else:body.append(item)
                    node.body=body
                if isinstance(node,ast.Call) and getattr(node.func,'id','')=='require' and node.args and ast.dump(node.args[0])==ast.dump(condition):
                    node.args[0]=copy.deepcopy(legacy_condition)
    return ast.unparse(ast.fix_missing_locations(tree))


def normalize_apple_id_delivery(source):
    """Reverse only the explicitly reviewed Apple ID/UI additions for old-contract checks."""
    tree = ast.parse(normalize_recovery(source))
    for function in (n for n in tree.body if isinstance(n, ast.FunctionDef)):
        if function.name == "owner_authorization":
            for node in ast.walk(function):
                if isinstance(node, ast.Compare) and isinstance(node.left, ast.BinOp) and ast.unparse(node.left) == "set(value) - {APPLE_ID_AUTH_FIELD}":
                    node.left = node.left.left
            removable = ast.parse("if APPLE_ID_AUTH_FIELD in value:\n    ui_unused_build(value, now)").body[0]
            function.body = [n for n in function.body if ast.dump(n) != ast.dump(removable)]
        if function.name == "authorize":
            removable = ast.parse('if os.environ.get("GRIDLY_UPLOAD_AUTHENTICATION") == "APPLE_ID":\n    require(APPLE_ID_AUTH_FIELD in value, "explicit Apple ID UI authorization required")').body[0]
            function.body = [n for n in function.body if ast.dump(n) != ast.dump(removable)]
        if function.name == "delivery_failure_category":
            removable = ast.parse('if stage == "D06_ACTUAL_UPLOAD" and isinstance(error, subprocess.CalledProcessError):\n    category = getattr(error, "gridly_upload_category", None)\n    if category in UPLOAD_ERROR_CATEGORIES:\n        return category\n').body[0]
            function.body = [n for n in function.body if ast.dump(n) != ast.dump(removable)]
        if function.name == "transfer" and function.args.args[-1].arg == "progress":
            current = ast.parse('execute_upload(root, [*command, "--upload-app"], execute, **transport_options)').body[0]
            previous = ast.parse('execute([*command, "--upload-app"], check=True, cwd=root / "home", **transport_options)').body[0]
            for block in function.body:
                if isinstance(block, ast.With):
                    block.body = [previous if ast.dump(n) == ast.dump(current) else n for n in block.body]
            credentials = function.body[2]
            if any(isinstance(n, ast.If) and ast.unparse(n.test) == "apple_id_mode" for n in credentials.body):
                branch = credentials.body[-1]
                assert isinstance(branch, ast.If) and ast.unparse(branch.test) == "apple_id_mode"
                expected = ast.parse('authorization = authorization_guard(root, commit)\napple_id_mode = APPLE_ID_AUTH_FIELD in authorization\nrequire(os.environ.get("GRIDLY_UPLOAD_AUTHENTICATION") != "APPLE_ID" or apple_id_mode, "explicit Apple ID UI authorization required")\ntransport_options = {}').body
                assert [ast.dump(n) for n in credentials.body[1:-1]] == [ast.dump(n) for n in expected]
                assert ast.dump(branch.body[0]) == ast.dump(ast.parse("command, transport_options = apple_id_command(root, ipa, values)").body[0])
                credentials.body = credentials.body[:1] + branch.orelse
                availability = function.body[5]
                branch = availability.body[1]
                assert isinstance(branch, ast.If) and ast.unparse(branch.test) == "apple_id_mode"
                assert ast.dump(branch.body[0]) == ast.dump(ast.parse("unused = ui_unused_build(authorization_guard(root, commit), now=clock())").body[0])
                availability.body = availability.body[:1] + branch.orelse + availability.body[2:]
                for index in (3, 6):
                    call = function.body[index].body[-2 if index == 6 else 0].value
                    assert isinstance(call, ast.Call) and call.func.id == "execute"
                    assert ast.dump(call.keywords[-1]) == ast.dump(ast.keyword(arg=None, value=ast.Name(id="transport_options",ctx=ast.Load())))
                    call.keywords = call.keywords[:-1]
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(n, ast.Name) and n.id == "DELIVERY_CATEGORIES" for n in node.targets):
            if isinstance(node.value, ast.BinOp) and isinstance(node.value.right, ast.Name) and node.value.right.id == "UPLOAD_ERROR_CATEGORIES":
                node.value = node.value.left
    return ast.unparse(ast.fix_missing_locations(tree))


def restore_apple_id_workflow(text):
    old = delivery.cert.git("show", delivery.AUTH_BASE + ":.github/workflows/gridly-storekit-testflight-delivery.yml").decode()
    comment = APPLE_ID_WORKFLOW_COMMENT
    expected = old.replace("\n\n# LOCAL PREPARATION", "\n\n" + comment + "\n# LOCAL PREPARATION", 1)
    expected = expected.replace("      PYTHONDONTWRITEBYTECODE: '1'", "      PYTHONDONTWRITEBYTECODE: '1'\n      GRIDLY_UPLOAD_AUTHENTICATION: 'APPLE_ID'", 1)
    expected = expected.replace(
        "          ASC_KEY_ID: ${{ secrets.ASC_KEY_ID }}\n          ASC_ISSUER_ID: ${{ secrets.ASC_ISSUER_ID }}\n          ASC_PRIVATE_KEY_P8_BASE64: ${{ secrets.ASC_PRIVATE_KEY_P8_BASE64 }}",
        "          APPLE_ID_USERNAME: ${{ secrets.APPLE_ID_USERNAME }}\n          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}", 1)
    historical = delivery.cert.git("show", delivery.TRANSFER_BASE + ":.github/workflows/gridly-storekit-testflight-delivery.yml").decode()
    if text in (old, historical):
        return text  # Exact pinned input also permits idempotent historical normalization.
    if text != expected:
        raise AssertionError("only reviewed Apple ID bindings, mode and UI contract comments authorized")
    return old


def normalize_delivery_reporting(source):
    """Reverse only reviewed stage wrappers; new tests verify their live behavior."""
    tree=ast.parse(normalize_apple_id_delivery(source))
    for function in (node for node in tree.body if isinstance(node,ast.FunctionDef)):
        if function.name=="ready":
            for node in ast.walk(function):
                if isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id=="verify_delivery_export":
                    assert len(node.args)==2 and ast.literal_eval(node.args[1]) in {"INPUT","OUTPUT"}
                    node.func.id="export_guard";node.args=node.args[:1]
        if function.name=="transfer" and function.args.args[-1].arg=="progress":
            assert ast.literal_eval(function.args.defaults[-1]) is None
            function.args.args=function.args.args[:-1];function.args.defaults=function.args.defaults[:-1]
            wrappers=function.body[1:]
            assert len(wrappers)==6
            restored=[function.body[0]]
            for stage,node in zip(delivery.DELIVERY_STAGES,wrappers):
                assert isinstance(node,ast.With) and len(node.items)==1
                call=node.items[0].context_expr
                assert ast.dump(call)==ast.dump(ast.parse("delivery_stage("+repr(stage)+", progress)",mode="eval").body)
                restored.extend(node.body)
            restored[0]=ast.Expr(value=ast.Constant(value="One validation then one upload; no retry after uncertain Apple acceptance."))
            function.body=restored
        if function.name=="main":
            for node in ast.walk(function):
                if isinstance(node,ast.If) and len(node.orelse)==2 and isinstance(node.orelse[0],ast.Expr):
                    call=node.orelse[0].value
                    if isinstance(call,ast.Call) and isinstance(call.func,ast.Name) and call.func.id=="transfer_public":
                        assert ast.unparse(call)=="transfer_public(root, args.commit, Path(args.ipa))"
                        node.orelse=ast.parse('require(os.environ.get("RUNNER_OS") == "macOS" and os.environ.get("GITHUB_ACTIONS") == "true", "future authorized macOS workflow only")\nrequire(os.environ.get("HOME") == str(root / "home") and os.environ.get("CFFIXED_USER_HOME") == str(root / "home"), "private tool home required")\ntransfer(root, args.commit, Path(args.ipa))\nreturn').body
    return ast.unparse(ast.fix_missing_locations(tree))


def restore_delivery_reporting(text):
    text=restore_apple_id_workflow(text)
    old=delivery.cert.git("show",delivery.TRANSFER_BASE+":.github/workflows/gridly-storekit-testflight-delivery.yml").decode()
    line='          exec > "$DIAGNOSTIC_PRIVATE_ROOT/logs/step-8.log" 2>&1\n'
    expected=old.replace(line,'          # FD 3 carries only fixed delivery stages; raw Apple output stays private.\n          exec 3>&1\n'+line,1)
    if text==old:return old
    if text!=expected:raise AssertionError("only fixed delivery FD 3 wrapper authorized")
    return old


def restore_signing_environment(text):
    text=restore_delivery_reporting(text)
    old = delivery.cert.git("show", delivery.ENVIRONMENT_BASE + ":.github/workflows/gridly-storekit-testflight-delivery.yml").decode()
    expected = old
    for label in ("step-6", "step-7-1", "step-7-2", "step-7-3", "step-7-4", "step-7-5"):
        original = '          exec > "$DIAGNOSTIC_PRIVATE_ROOT/logs/' + label + '.log" 2>&1\n'
        expected = expected.replace(original, original + '          . "$DIAGNOSTIC_PRIVATE_ROOT/runner-context.sh"\n', 1)
    original = '          cd "$DELIVERY_SOURCE_DIR"\n          export TMPDIR="$DIAGNOSTIC_PRIVATE_ROOT/tmp/"\n          umask 077\n'
    expected = expected.replace(original, original + '          python3 -B tools/apple_storekit_testflight_delivery.py signing-context --runner-temp "$RUNNER_TEMP" --commit "$EXPECTED_COMMIT_SHA"\n', 1)
    original = ('          mkdir -p "$HOME/Library/MobileDevice/Provisioning Profiles"\n'
                '          profile_path="$HOME/Library/MobileDevice/Provisioning Profiles/$PROFILE_UUID.mobileprovision"\n'
                '          test ! -e "$profile_path"\n'
                '          printf \'%s\' "$profile_path" > "$DIAGNOSTIC_PRIVATE_ROOT/installed-profile"\n'
                '          cp "$DIAGNOSTIC_PRIVATE_ROOT/distribution.mobileprovision" "$profile_path"\n')
    expected = expected.replace(original, '          python3 -B tools/apple_storekit_testflight_delivery.py profile-install --runner-temp "$RUNNER_TEMP" --commit "$EXPECTED_COMMIT_SHA"\n', 1)
    line = next(line for line in expected.splitlines() if line.startswith('          xcodebuild -resolvePackageDependencies '))
    expected = expected.replace(line, '          ( . "$DIAGNOSTIC_PRIVATE_ROOT/runner-context.sh"; ' + line.strip() + ' )', 1)
    if text == old:
        return old
    if text != expected:
        raise AssertionError("only exact runner context and owned profile-install workflow changes authorized")
    return old


def without_p04_auth(text):
    permission = "permissions:\n  contents: read\n  actions: read\n"
    scoped = ("      - name: Verify source, build identity input and Xcode\n"
              "        env:\n          GRIDLY_HISTORY_TOKEN: ${{ github.token }}\n")
    if text.count(permission)!=1 or text.count(scoped)!=1:
        raise AssertionError("exact P04-only token binding and read permissions required")
    return text.replace(permission,"permissions:\n  contents: read\n",1).replace(
        scoped,"      - name: Verify source, build identity input and Xcode\n",1)


def authorization():
    return {**dict.fromkeys(delivery.CONFIRMATIONS, True), "delivery_commit": COMMIT,
            "certified_source_commit": delivery.SOURCE, "certification_run_id": delivery.RUN,
            "diagnostic_build_number": "15", "owner_checks_at": STAMP}


def owner_automatic_authorization():
    return {**authorization(), "testflight_auto_distribution_disabled": False,
            delivery.OWNER_AUTO_FIELD: {
                **dict.fromkeys(delivery.OWNER_AUTO_CONFIRMATIONS, True),
                "group_name": "Gridly Internal", "authorized_owner_account_count": 2,
            }}


def source_git(*, parent=delivery.UPLOADER_REPAIR_BASE, repair_base_parent=delivery.FAILED_AUTH_BASE,
               repair_base_inventory=None, failed_auth_parent=delivery.SOLO_OWNER_FIX_BASE, failed_auth_inventory=None,
               solo_fix_parent=delivery.SOLO_OWNER_ATTEST_BASE,
               solo_attest_parent=delivery.SOLO_OWNER_BASE,
               solo_owner_parent=delivery.CERTIFIED_BASE,
               solo_fix_inventory=None, solo_attest_inventory=None,
               solo_owner_inventory=None, base_parent=delivery.SOURCE,
               owner_parent=delivery.DELIVERY_BASE, preflight_parent=delivery.OWNER_CORRECTION,
               preparation=None, past_correction=None, preflight_inventory=None,
               historical_refinement=None, signing_inventory=None, cms_inventory=None,
               refinement_parent=delivery.PREFLIGHT_BASE, signing_parent=delivery.REFINEMENT_BASE,
               cms_parent=delivery.SIGNING_BASE, repair_parent=delivery.CMS_BASE,
               verified_parent=delivery.CMS_REPAIR_BASE, alignment_parent=delivery.SIGNING_VERIFIED_BASE,
               alignment_inventory=None, repair_inventory=None, verification_inventory=None,
               p04_parent=delivery.P04_BASE, p04_inventory=None,
               evidence_parent=delivery.ARCHIVE_BASE, archive_inventory=None,
               environment_parent=delivery.EVIDENCE_BASE, environment_inventory=None,
               transfer_parent=delivery.ENVIRONMENT_BASE, transfer_inventory=None,
               auth_parent=delivery.TRANSFER_BASE, auth_inventory=None,
               apple_id_parent=delivery.AUTH_BASE, apple_id_inventory=None,
               upload_parent=delivery.APPLE_ID_BASE, upload_inventory=None,
               certified_parent=delivery.UPLOAD_BASE, certified_inventory=None,
               correction=None, net=None, mode="100644", dirty=b"", staged=b"", untracked=b"",
               tag_object=None, tag_target=None, tag_type=None, missing_tag=None):
    additions = "\n".join("A\t" + path for path in sorted(delivery.FILES)).encode()
    modifications = "\n".join("M\t" + path for path in sorted(delivery.FILES)).encode()
    test_mode = "\n".join("M\t" + path for path in sorted(delivery.TEST_MODE_FILES)).encode()
    safety = test_mode + b"\n" + "\n".join("A\t" + path for path in sorted(delivery.SAFETY_FILES)).encode()
    repair = "\n".join("M\t" + path for path in sorted(delivery.REPAIR_FILES)).encode()
    verification = "\n".join("M\t" + path for path in sorted(delivery.SIGNING_VERIFICATION_FILES)).encode()
    alignment = "\n".join("M\t" + path for path in sorted(delivery.DELIVERY_ALIGNMENT_FILES)).encode()
    refinement = "\n".join("M\t" + path for path in sorted(delivery.REFINEMENT_FILES)).encode()
    preflight = "\n".join("A\t" + path for path in sorted(delivery.PREFLIGHT_FILES)).encode()
    all_additions = "\n".join("A\t" + path for path in sorted(delivery.FILES | delivery.PREFLIGHT_FILES | delivery.SIGNING_FILES | delivery.CMS_FILES | delivery.SAFETY_FILES)).encode()
    values = {
        ("rev-parse", "HEAD"): COMMIT.encode(),
        ("show", "-s", "--format=%P", COMMIT): parent.encode(),
        ("show", "-s", "--format=%P", delivery.UPLOADER_REPAIR_BASE): repair_base_parent.encode(),
        ("rev-parse", "--verify", delivery.PREFIX + delivery.UPLOADER_REPAIR_BASE): b"ea2d9158e9b0a0b1e0035947f15e2d3cef79173c",
        ("cat-file", "-t", delivery.PREFIX + delivery.UPLOADER_REPAIR_BASE): b"tag",
        ("rev-parse", "--verify", delivery.PREFIX + delivery.UPLOADER_REPAIR_BASE + "^{}"): delivery.UPLOADER_REPAIR_BASE.encode(),
        ("show", "-s", "--format=%P", delivery.FAILED_AUTH_BASE): failed_auth_parent.encode(),
        ("show", "-s", "--format=%P", delivery.SOLO_OWNER_FIX_BASE): solo_fix_parent.encode(),
        ("show", "-s", "--format=%P", delivery.SOLO_OWNER_ATTEST_BASE): solo_attest_parent.encode(),
        ("show", "-s", "--format=%P", delivery.SOLO_OWNER_BASE): solo_owner_parent.encode(),
        ("show", "-s", "--format=%P", delivery.CERTIFIED_BASE): certified_parent.encode(),
        ("show", "-s", "--format=%P", delivery.REFINEMENT_BASE): refinement_parent.encode(),
        ("show", "-s", "--format=%P", delivery.SIGNING_BASE): signing_parent.encode(),
        ("show", "-s", "--format=%P", delivery.CMS_BASE): cms_parent.encode(),
        ("show", "-s", "--format=%P", delivery.CMS_REPAIR_BASE): repair_parent.encode(),
        ("show", "-s", "--format=%P", delivery.SIGNING_VERIFIED_BASE): verified_parent.encode(),
        ("show", "-s", "--format=%P", delivery.P04_BASE): alignment_parent.encode(),
        ("show", "-s", "--format=%P", delivery.ARCHIVE_BASE): p04_parent.encode(),
        ("show", "-s", "--format=%P", delivery.EVIDENCE_BASE): evidence_parent.encode(),
        ("show", "-s", "--format=%P", delivery.ENVIRONMENT_BASE): environment_parent.encode(),
        ("show", "-s", "--format=%P", delivery.TRANSFER_BASE): transfer_parent.encode(),
        ("show", "-s", "--format=%P", delivery.AUTH_BASE): auth_parent.encode(),
        ("show", "-s", "--format=%P", delivery.APPLE_ID_BASE): apple_id_parent.encode(),
        ("show", "-s", "--format=%P", delivery.UPLOAD_BASE): upload_parent.encode(),
        ("show", "-s", "--format=%P", delivery.PREFLIGHT_BASE): preflight_parent.encode(),
        ("show", "-s", "--format=%P", delivery.OWNER_CORRECTION): owner_parent.encode(),
        ("show", "-s", "--format=%P", delivery.DELIVERY_BASE): base_parent.encode(),
        ("diff", "--name-status", "--no-renames", delivery.SOURCE, delivery.DELIVERY_BASE): additions if preparation is None else preparation,
        ("diff", "--name-status", "--no-renames", delivery.DELIVERY_BASE, delivery.OWNER_CORRECTION): modifications if past_correction is None else past_correction,
        ("diff", "--name-status", "--no-renames", delivery.OWNER_CORRECTION, delivery.PREFLIGHT_BASE): preflight if preflight_inventory is None else preflight_inventory,
        ("diff", "--name-status", "--no-renames", delivery.PREFLIGHT_BASE, delivery.REFINEMENT_BASE): refinement if historical_refinement is None else historical_refinement,
        ("diff", "--name-status", "--no-renames", delivery.REFINEMENT_BASE, delivery.SIGNING_BASE):
            "\n".join("A\t" + path for path in sorted(delivery.SIGNING_FILES)).encode() if signing_inventory is None else signing_inventory,
        ("diff", "--name-status", "--no-renames", delivery.SIGNING_BASE, delivery.CMS_BASE):
            "\n".join("A\t" + path for path in sorted(delivery.CMS_FILES)).encode() if cms_inventory is None else cms_inventory,
        ("diff", "--name-status", "--no-renames", delivery.CMS_BASE, delivery.CMS_REPAIR_BASE): repair if repair_inventory is None else repair_inventory,
        ("diff", "--name-status", "--no-renames", delivery.CMS_REPAIR_BASE, delivery.SIGNING_VERIFIED_BASE): verification if verification_inventory is None else verification_inventory,
        ("diff", "--name-status", "--no-renames", delivery.SIGNING_VERIFIED_BASE, delivery.P04_BASE): alignment if alignment_inventory is None else alignment_inventory,
        ("diff", "--name-status", "--no-renames", delivery.P04_BASE, delivery.ARCHIVE_BASE): modifications if p04_inventory is None else p04_inventory,
        ("diff", "--name-status", "--no-renames", delivery.ARCHIVE_BASE, delivery.EVIDENCE_BASE): modifications if archive_inventory is None else archive_inventory,
        ("diff", "--name-status", "--no-renames", delivery.EVIDENCE_BASE, delivery.ENVIRONMENT_BASE): modifications if environment_inventory is None else environment_inventory,
        ("diff", "--name-status", "--no-renames", delivery.ENVIRONMENT_BASE, delivery.TRANSFER_BASE): modifications if transfer_inventory is None else transfer_inventory,
        ("diff", "--name-status", "--no-renames", delivery.TRANSFER_BASE, delivery.AUTH_BASE): modifications if auth_inventory is None else auth_inventory,
        ("diff", "--name-status", "--no-renames", delivery.AUTH_BASE, delivery.APPLE_ID_BASE): modifications if apple_id_inventory is None else apple_id_inventory,
        ("diff", "--name-status", "--no-renames", delivery.APPLE_ID_BASE, delivery.UPLOAD_BASE): test_mode if upload_inventory is None else upload_inventory,
        ("diff", "--name-status", "--no-renames", delivery.UPLOAD_BASE, delivery.CERTIFIED_BASE): safety if certified_inventory is None else certified_inventory,
        ("diff", "--name-status", "--no-renames", delivery.CERTIFIED_BASE, delivery.SOLO_OWNER_BASE): test_mode if solo_owner_inventory is None else solo_owner_inventory,
        ("diff", "--name-status", "--no-renames", delivery.SOLO_OWNER_BASE, delivery.SOLO_OWNER_ATTEST_BASE): test_mode if solo_attest_inventory is None else solo_attest_inventory,
        ("diff", "--name-status", "--no-renames", delivery.SOLO_OWNER_ATTEST_BASE, delivery.SOLO_OWNER_FIX_BASE): test_mode if solo_fix_inventory is None else solo_fix_inventory,
        ("diff", "--name-status", "--no-renames", delivery.SOLO_OWNER_FIX_BASE, delivery.FAILED_AUTH_BASE): test_mode if failed_auth_inventory is None else failed_auth_inventory,
        ("diff", "--name-status", "--no-renames", delivery.FAILED_AUTH_BASE, delivery.UPLOADER_REPAIR_BASE): test_mode if repair_base_inventory is None else repair_base_inventory,
        ("diff", "--name-status", "--no-renames", delivery.UPLOADER_REPAIR_BASE, COMMIT): test_mode if correction is None else correction,
        ("diff", "--name-status", "--no-renames", delivery.SOURCE, COMMIT): all_additions if net is None else net,
        ("diff", "--name-only", "HEAD"): dirty,
        ("diff", "--cached", "--name-only"): staged,
        ("status", "--porcelain=v1", "--untracked-files=normal"): untracked,
    }
    for target,files in ((delivery.DELIVERY_BASE,delivery.FILES),(delivery.OWNER_CORRECTION,delivery.FILES),
                         (delivery.PREFLIGHT_BASE,delivery.PREFLIGHT_FILES),(delivery.REFINEMENT_BASE,delivery.REFINEMENT_FILES),
                         (delivery.SIGNING_BASE,delivery.SIGNING_FILES),(delivery.CMS_BASE,delivery.CMS_FILES),
                         (delivery.CMS_REPAIR_BASE,delivery.REPAIR_FILES),
                         (delivery.SIGNING_VERIFIED_BASE,delivery.SIGNING_VERIFICATION_FILES),
                         (delivery.P04_BASE,delivery.DELIVERY_ALIGNMENT_FILES),
                         (delivery.ARCHIVE_BASE,delivery.FILES),
                         (delivery.EVIDENCE_BASE,delivery.FILES), (delivery.ENVIRONMENT_BASE,delivery.FILES), (delivery.TRANSFER_BASE,delivery.FILES), (delivery.AUTH_BASE,delivery.FILES), (delivery.APPLE_ID_BASE,delivery.FILES)):
        for path in files:
            values[("ls-tree",target,"--",path)]=("100644 blob "+"0"*40+"\t"+path).encode()
    for path in delivery.TEST_MODE_FILES:
        values[("ls-tree", delivery.UPLOAD_BASE, "--", path)] = ("100644 blob " + "0"*40 + "\t" + path).encode()
    for path in delivery.TEST_MODE_FILES | delivery.SAFETY_FILES:
        values[("ls-tree", delivery.CERTIFIED_BASE, "--", path)] = ("100644 blob " + "0"*40 + "\t" + path).encode()
    for path in delivery.TEST_MODE_FILES:
        for checkpoint in (delivery.SOLO_OWNER_BASE, delivery.SOLO_OWNER_ATTEST_BASE, delivery.SOLO_OWNER_FIX_BASE, delivery.FAILED_AUTH_BASE, delivery.UPLOADER_REPAIR_BASE):
            values[("ls-tree", checkpoint, "--", path)] = ("100644 blob " + "0"*40 + "\t" + path).encode()
    for path in delivery.FILES | delivery.PREFLIGHT_FILES | delivery.SIGNING_FILES | delivery.CMS_FILES | delivery.SAFETY_FILES:
        values[("ls-tree", COMMIT, "--", path)] = (mode + " blob " + "0"*40 + "\t" + path).encode()
    for name, (original_object, original_target) in delivery.HISTORICAL_TAGS.items():
        ref = "refs/tags/" + name
        values[("rev-parse", "--verify", ref)] = (tag_object or original_object).encode()
        values[("cat-file", "-t", ref)] = (tag_type or "tag").encode()
        values[("rev-parse", "--verify", ref + "^{}")] = (tag_target or original_target).encode()
    def git(*args):
        if missing_tag and args == ("rev-parse", "--verify", "refs/tags/" + missing_tag):
            raise subprocess.CalledProcessError(128, ["git", *args])
        return values[args]
    return git


def event():
    return {"repository": {"full_name": delivery.REPOSITORY}, "created": True, "deleted": False,
            "forced": False, "ref": REF, "after": COMMIT}


def proof(ipa):
    activation = delivery.cert.activation_report_expected({}, "15")
    return {"status": "certified", "source_commit": COMMIT, "build": "15",
            "identity": {"CFBundleIdentifier": delivery.cert.release.BUNDLE, "CFBundleVersion": "15",
                         "CFBundleShortVersionString": "1.0.0", "UIDeviceFamily": [1]},
            "signed_artifacts_unchanged": True, "original_contracts_unchanged": True, "distribution_performed": False,
            "activation": activation, "web_files": 1005, "ipa_sha256": hashlib.sha256(ipa.read_bytes()).hexdigest()}


def upload_action(command):
    return '--upload-package' if '--upload-package' in command else command[-1]


def synthetic_transport_query(command, options):
    """Synthetic Apple schema/capabilities only. Never execute a tool or network call."""
    if '--help' in command:
        options['stdout'].write(b'--upload-package --apple-id --bundle-id --bundle-version '
            b'--bundle-short-version-string --asc-public-id --list-providers')
        return True
    if '--list-providers' in command:
        options['stdout'].write(json.dumps({'providers': [
            {'PublicID': '00000000-0000-0000-0000-000000000001',
             'WWDRTeamID': delivery.cert.release.TEAM}]}).encode())
        return True
    return False


def fixture(root):
    (root / ".owned").write_text(delivery.cert.PRIVATE_MARKER)
    (root / "logs").mkdir(mode=0o700)
    (root / "reports").mkdir()
    (root / "home").mkdir()
    (root / "tmp").mkdir()
    (root / "export").mkdir()
    ipa = root / "export/synthetic.ipa"
    ipa.write_bytes(b"NOT_AN_APP_OR_SIGNED_IPA")
    delivery.write_json(root / "reports/delivery-authorization.json",
                        {"authorization": authorization(), "ref": REF, "source_commit": COMMIT, "build": "15"})
    guard = {"source_commit": COMMIT, "certified_source_commit": delivery.SOURCE, "build": "15",
             "runtime_unchanged": True, "original_contracts_unchanged": True}
    historical = {"run": delivery.RUN, "source_commit": delivery.SOURCE, "attempt": 1, "status": "success", "artifacts": 0}
    delivery.write_json(root / "reports/delivery-preflight.json", {**guard, "historical_certification": historical})
    delivery.write_json(root / "reports/storekit-diagnostic-certification.json", proof(ipa))
    # Real baseline policy reads this synthetic complete TAP; no baseline assertion is altered.
    tap = root / "reports/storekit-diagnostic-regressions.tap"
    tap.write_text("TAP version 13\nnot ok 1 - " + delivery.cert.FAILURE + "\n1..1\n# tests 1\n# fail 1\n# skipped 0\n# cancelled 0\n# todo 0\n")
    delivery.write_json(root / "reports/storekit-diagnostic-regressions.json", delivery.cert.check_regressions(tap, 1, True))
    for path in (root / "DiagnosticExportOptions.plist", root / "export/ExportOptions.plist"):
        path.write_bytes(plistlib.dumps({"testFlightInternalTestingOnly": True, "method": "app-store-connect",
                                        "destination": "export", "manageAppVersionAndBuildNumber": False}))
    return ipa, guard


class SyntheticDeliveryTestCase(unittest.TestCase):
    """Select synthetic mode for the whole case, then restore the caller's environment."""
    upload_authentication = "API"

    def run(self, result=None):
        # A context manager is not stopped by fixtures' patch.stopall() cleanup.
        with patch.dict(os.environ, {"GRIDLY_UPLOAD_AUTHENTICATION": self.upload_authentication}):
            return super().run(result)


class SyntheticModeIsolationTests(SyntheticDeliveryTestCase):
    def test_legacy_case_uses_api_under_inherited_apple_id_and_restores_environment(self):
        class Probe(SyntheticDeliveryTestCase):
            def runTest(probe):
                probe.assertEqual(os.environ["GRIDLY_UPLOAD_AUTHENTICATION"], "API")
                patch.dict(os.environ, {"SYNTHETIC_MODE_CANARY": "temporary"}).start()
                patch.stopall()
                probe.assertEqual(os.environ["GRIDLY_UPLOAD_AUTHENTICATION"], "API")
        for inherited in ("APPLE_ID", None):
            with self.subTest(inherited=inherited), patch.dict(os.environ):
                os.environ.pop("GRIDLY_UPLOAD_AUTHENTICATION", None)
                if inherited is not None:
                    os.environ["GRIDLY_UPLOAD_AUTHENTICATION"] = inherited
                result = unittest.TestResult()
                Probe().run(result)
                self.assertTrue(result.wasSuccessful(), result.errors + result.failures)
                self.assertEqual(result.testsRun, 1)
                self.assertEqual(os.environ.get("GRIDLY_UPLOAD_AUTHENTICATION"), inherited)
                self.assertNotIn("SYNTHETIC_MODE_CANARY", os.environ)

    def test_mode_restores_after_a_failing_synthetic_case(self):
        class Probe(SyntheticDeliveryTestCase):
            def runTest(probe):
                probe.assertEqual(os.environ["GRIDLY_UPLOAD_AUTHENTICATION"], "API")
                probe.fail("synthetic failure")
        with patch.dict(os.environ, {"GRIDLY_UPLOAD_AUTHENTICATION": "APPLE_ID"}):
            result = unittest.TestResult()
            Probe().run(result)
            self.assertEqual(len(result.failures), 1)
            self.assertFalse(result.errors)
            self.assertEqual(os.environ["GRIDLY_UPLOAD_AUTHENTICATION"], "APPLE_ID")


class AuthorizationTests(SyntheticDeliveryTestCase):
    def test_exact_independent_authorization_passes(self):
        self.assertEqual(delivery.owner_authorization(authorization(), COMMIT, REF, NOW), authorization())

    def test_owner_only_automatic_distribution_requires_explicit_complete_authorization(self):
        candidate = owner_automatic_authorization()
        self.assertEqual(delivery.owner_authorization(candidate, COMMIT, REF, NOW), candidate)
        self.assertIs(candidate["testflight_auto_distribution_disabled"], False)
        self.assertEqual(candidate[delivery.OWNER_AUTO_FIELD]["authorized_owner_account_count"], 2)

    def test_owner_only_missing_false_nonboolean_or_extra_nested_confirmations_fail(self):
        required = delivery.OWNER_AUTO_CONFIRMATIONS | {"group_name", "authorized_owner_account_count"}
        for field in required:
            candidate = owner_automatic_authorization()
            del candidate[delivery.OWNER_AUTO_FIELD][field]
            with self.subTest(missing=field), self.assertRaises(ValueError):
                delivery.owner_authorization(candidate, COMMIT, REF, NOW)
        for field in delivery.OWNER_AUTO_CONFIRMATIONS:
            for value in (False, None, 0, 1, "true"):
                candidate = owner_automatic_authorization()
                candidate[delivery.OWNER_AUTO_FIELD][field] = value
                with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                    delivery.owner_authorization(candidate, COMMIT, REF, NOW)
        candidate = owner_automatic_authorization()
        candidate[delivery.OWNER_AUTO_FIELD]["email"] = "SYNTHETIC_PRIVATE_NEVER_LOG"
        with self.assertRaises(ValueError):
            delivery.owner_authorization(candidate, COMMIT, REF, NOW)

    def test_owner_only_other_account_counts_or_groups_are_rejected(self):
        for field, values in [("authorized_owner_account_count", (0, 1, 3, True, 2.0, "2", None)),
                              ("group_name", ("Other Internal", "External", "", None))]:
            for value in values:
                candidate = owner_automatic_authorization()
                candidate[delivery.OWNER_AUTO_FIELD][field] = value
                with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                    delivery.owner_authorization(candidate, COMMIT, REF, NOW)

    def test_disabled_and_owner_automatic_modes_cannot_be_mixed_or_implicitly_enabled(self):
        for value in (True, 0, 1, None, "false"):
            candidate = {**owner_automatic_authorization(), "testflight_auto_distribution_disabled": value}
            with self.subTest(value=value), self.assertRaises(ValueError):
                delivery.owner_authorization(candidate, COMMIT, REF, NOW)
        with self.assertRaises(ValueError):
            delivery.owner_authorization({**authorization(), "testflight_auto_distribution_disabled": False}, COMMIT, REF, NOW)
        for incomplete in (None, False, True, {}, []):
            candidate = {**owner_automatic_authorization(), delivery.OWNER_AUTO_FIELD: incomplete}
            with self.subTest(incomplete=incomplete), self.assertRaises(ValueError):
                delivery.owner_authorization(candidate, COMMIT, REF, NOW)

    def test_owner_only_common_publication_and_access_confirmations_remain_required(self):
        for field in delivery.CONFIRMATIONS - {"testflight_auto_distribution_disabled"}:
            for value in (False, None, 1, "true"):
                candidate = {**owner_automatic_authorization(), field: value}
                with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                    delivery.owner_authorization(candidate, COMMIT, REF, NOW)

    def test_owner_only_expired_future_incomplete_and_wrong_identity_authorizations_fail(self):
        for now in (NOW-1, NOW+1801):
            with self.assertRaises(ValueError):
                delivery.owner_authorization(owner_automatic_authorization(), COMMIT, REF, now)
        for field, value in [("delivery_commit", "2"*40), ("certified_source_commit", delivery.DELIVERY_BASE),
                              ("certification_run_id", 0), ("diagnostic_build_number", "14"), ("owner_checks_at", None)]:
            with self.subTest(field=field), self.assertRaises(ValueError):
                delivery.owner_authorization({**owner_automatic_authorization(), field: value}, COMMIT, REF, NOW)
        candidate = owner_automatic_authorization()
        del candidate["owner_checks_at"]
        with self.assertRaises(ValueError):
            delivery.owner_authorization(candidate, COMMIT, REF, NOW)

    def test_duplicate_owner_only_confirmation_is_rejected(self):
        text = json.dumps(owner_automatic_authorization()).replace('"authorized": true', '"authorized": true, "authorized": false')
        with self.assertRaises(ValueError):
            json.loads(text, object_pairs_hook=delivery.cert.unique_json_object)

    def test_each_missing_false_or_nonboolean_confirmation_fails(self):
        for field in delivery.CONFIRMATIONS:
            for value in (None, False, 1, "true"):
                candidate = authorization()
                if value is None:
                    del candidate[field]
                else:
                    candidate[field] = value
                with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                    delivery.owner_authorization(candidate, COMMIT, REF, NOW)

    def test_wrong_source_build_run_and_extra_fields_fail(self):
        for key, value in [("delivery_commit", "2"*40), ("certified_source_commit", "3"*40),
                           ("diagnostic_build_number", "14"), ("diagnostic_build_number", 15),
                           ("certification_run_id", str(delivery.RUN)), ("extra", True)]:
            candidate = {**authorization(), key: value}
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                delivery.owner_authorization(candidate, COMMIT, REF, NOW)

    def test_old_certification_and_branch_refs_cannot_authorize_upload(self):
        for ref in ("refs/heads/codex/storekit-diagnostics", delivery.cert.TAG_PREFIX + "15-" + delivery.SOURCE, REF + "x", REF.upper()):
            with self.subTest(ref=ref), self.assertRaises(ValueError):
                delivery.owner_authorization(authorization(), COMMIT, ref, NOW)

    def test_expired_future_and_malformed_owner_settings_fail(self):
        for now in (NOW-1, NOW+1801):
            with self.assertRaises(ValueError):
                delivery.owner_authorization(authorization(), COMMIT, REF, now)
        with self.assertRaises(ValueError):
            delivery.owner_authorization({**authorization(), "owner_checks_at": "yesterday"}, COMMIT, REF, NOW)

    def test_exact_unchanged_thirty_minute_boundary_is_enforced(self):
        self.assertEqual(delivery.OWNER_CHECK_TTL, 1800)
        for value in (authorization(), owner_automatic_authorization()):
            for moment in (NOW, NOW+1800):
                self.assertEqual(delivery.owner_authorization(value, COMMIT, REF, moment), value)
            for moment in (NOW-0.001, NOW+1800.001):
                with self.assertRaises(ValueError):
                    delivery.owner_authorization(value, COMMIT, REF, moment)

    def test_duplicate_annotation_keys_fail(self):
        with self.assertRaises(ValueError):
            json.loads('{"testflight_upload_authorized":true,"testflight_upload_authorized":false}', object_pairs_hook=delivery.cert.unique_json_object)

    def test_event_branch_updates_forced_tags_and_reruns_fail(self):
        for changes, attempt in [({"created": False}, "1"), ({"forced": True}, "1"), ({"deleted": True}, "1"),
                                  ({"ref": "refs/heads/main"}, "1"), ({"after": "4"*40}, "1"), ({}, "2"),
                                  ({"repository": {"full_name": "elsewhere/repository"}}, "1")]:
            with self.subTest(changes=changes, attempt=attempt), self.assertRaises(ValueError):
                delivery.event_gate({**event(), **changes}, REF, COMMIT, attempt, "5"*40)

    def test_annotated_tag_object_or_peeled_commit_event_passes(self):
        for after in (COMMIT, "5"*40):
            delivery.event_gate({**event(), "after": after}, REF, COMMIT, "1", "5"*40)

    def test_annotated_direct_tag_is_required(self):
        values = {("rev-parse", "HEAD"): COMMIT.encode(), ("rev-parse", "--verify", delivery.cert.DIAGNOSTIC_BRANCH): COMMIT.encode(),
                  ("cat-file", "-t", REF): b"tag",
                  ("cat-file", "-p", REF): ("object " + COMMIT + "\ntype commit\ntag " + REF.removeprefix("refs/tags/") + "\ntagger Synthetic\n\n" + json.dumps(authorization())).encode(),
                  ("rev-parse", "--verify", REF): b"5"*40}
        with patch.object(delivery.cert, "git", side_effect=lambda *args: values[args]), patch.object(delivery, "read_json", return_value=event()), patch.object(delivery.time, "time", return_value=NOW):
            self.assertEqual(delivery.authorize(REF, COMMIT, "synthetic", "1")["build"], "15")
            for replacement in (b"commit", b"blob"):
                values[("cat-file", "-t", REF)] = replacement
                with self.assertRaises(ValueError):
                    delivery.authorize(REF, COMMIT, "synthetic", "1")


class SourceAndEvidenceTests(SyntheticDeliveryTestCase):
    def test_exact_pinned_additional_correction_passes_without_runtime_changes(self):
        with patch.object(delivery.cert, "git", side_effect=source_git()), patch.object(delivery.subprocess, "run"), patch.object(delivery.cert, "original_contracts"):
            self.assertTrue(delivery.source_guard(COMMIT, True)["runtime_unchanged"])

    def test_changed_runtime_or_inventory_or_modes_cannot_pass(self):
        additions = "\n".join("A\t" + path for path in sorted(delivery.FILES)).encode()
        modifications = "\n".join("M\t" + path for path in sorted(delivery.REFINEMENT_FILES)).encode()
        for options in ({"correction": modifications+b"\nM\tjs/gridly-paid-ui.mjs"}, {"correction": b""},
                        {"correction": additions}, {"net": additions+b"\nM\tios/App/App/GridlyStoreKitPlugin.swift"},
                        {"net": b""}, {"preparation": b""}, {"past_correction": b""},
                        {"preflight_inventory": b""}, {"correction": modifications+b"\nM\ttools/apple_storekit_preflight_diagnostic.py"},
                        {"mode": "100755"}):
            with self.subTest(options=options), patch.object(delivery.cert, "git", side_effect=source_git(**options)), patch.object(delivery.subprocess, "run"), patch.object(delivery.cert, "original_contracts"), self.assertRaises(ValueError):
                delivery.source_guard(COMMIT, True)

    def test_incorrect_checkout_and_unclean_source_fail(self):
        with patch.object(delivery.cert, "git", return_value=b"9"*40), self.assertRaises(ValueError):
            delivery.source_guard(COMMIT, True)
        for old in (delivery.SOURCE, delivery.DELIVERY_BASE, delivery.OWNER_CORRECTION, delivery.PREFLIGHT_BASE,
                    delivery.REFINEMENT_BASE, delivery.SIGNING_BASE, delivery.CMS_BASE,
                    delivery.CMS_REPAIR_BASE, delivery.SIGNING_VERIFIED_BASE, delivery.P04_BASE, delivery.ARCHIVE_BASE, delivery.EVIDENCE_BASE):
            with self.subTest(old=old), self.assertRaises(ValueError):
                delivery.source_guard(old, True)
        for options in ({"dirty": b"js/gridly-paid-ui.mjs"}, {"staged": b"js/gridly-paid-ui.mjs"},
                        {"untracked": b"?? unexpected.txt"}):
            with self.subTest(options=options), patch.object(delivery.cert, "git", side_effect=source_git(**options)), patch.object(delivery.subprocess, "run"), patch.object(delivery.cert, "original_contracts"), self.assertRaises(ValueError):
                delivery.source_guard(COMMIT, True)

    def test_additional_or_merged_delivery_ancestry_is_rejected(self):
        for options in ({"parent": "9"*40}, {"parent": delivery.SOURCE},
                        {"parent": delivery.DELIVERY_BASE + " " + "8"*40},
                        {"base_parent": "7"*40}, {"base_parent": delivery.SOURCE + " " + "8"*40},
                        {"owner_parent": "7"*40}, {"preflight_parent": "8"*40},
                        {"preflight_parent": delivery.OWNER_CORRECTION + " " + "8"*40},
                        {"refinement_parent": "8"*40}, {"signing_parent": "8"*40}, {"cms_parent": "8"*40},
                        {"cms_parent": delivery.SIGNING_BASE + " " + "8"*40},
                        {"repair_parent":"8"*40},{"verified_parent":"8"*40},{"alignment_parent":"8"*40},
                        {"alignment_parent":delivery.SIGNING_VERIFIED_BASE+" "+"8"*40},
                        {"repair_parent":delivery.CMS_BASE+" "+"8"*40},
                        {"verified_parent":delivery.CMS_REPAIR_BASE+" "+"8"*40}):
            with self.subTest(options=options), patch.object(delivery.cert, "git", side_effect=source_git(**options)), self.assertRaises(ValueError):
                delivery.source_guard(COMMIT, True)

    def test_pinned_real_preparation_and_historical_source_remain_exact(self):
        self.assertEqual(delivery.cert.git("show", "-s", "--format=%P", delivery.DELIVERY_BASE).decode().strip(), delivery.SOURCE)
        self.assertEqual(delivery.SOURCE, "f9fc818321970b8b7e29df17358daf87a7d20308")
        self.assertEqual(delivery.RUN, 39181592021)
        self.assertEqual(delivery.OWNER_CORRECTION, "45bfe026b81f4928caceb9632cbf15e7ed842a25")
        self.assertEqual(delivery.PREFLIGHT_BASE, "13e73183cf3f257fbc9acd9a32d34d62b70ffb1e")
        for child,parent in ((delivery.PREFLIGHT_BASE, delivery.OWNER_CORRECTION),
                             (delivery.OWNER_CORRECTION, delivery.DELIVERY_BASE)):
            self.assertEqual(delivery.cert.git("show","-s","--format=%P",child).decode().strip(),parent)
        self.assertEqual(delivery.REFINEMENT_FILES, delivery.FILES | {"tests/storekit-preflight-diagnostic.test.py"})
        for path in delivery.PREFLIGHT_FILES:
            historical = delivery.cert.git("show", delivery.PREFLIGHT_BASE + ":" + path)
            preflight_ref = "refs/tags/gridly-storekit-preflight-15-" + delivery.PREFLIGHT_BASE
            self.assertEqual(historical, delivery.cert.git("show", preflight_ref + ":" + path))
            if path != "tests/storekit-preflight-diagnostic.test.py":
                self.assertEqual((ROOT/path).read_bytes().replace(b"\r\n", b"\n"), historical)
        for name, (tag_object, target) in delivery.HISTORICAL_TAGS.items():
            ref = "refs/tags/" + name
            self.assertEqual(delivery.cert.git("rev-parse", "--verify", ref).decode().strip(), tag_object)
            self.assertEqual(delivery.cert.git("cat-file", "-t", ref).decode().strip(), "tag")
            self.assertEqual(delivery.cert.git("rev-parse", "--verify", ref + "^{}").decode().strip(), target)

    def test_each_missing_modified_or_retargeted_historical_tag_fails_closed(self):
        for name in delivery.HISTORICAL_TAGS:
            for options in ({"missing_tag": name}, {"tag_object": "9"*40},
                            {"tag_target": COMMIT}, {"tag_type": "commit"}):
                with self.subTest(tag=name, options=options), patch.object(delivery.cert, "git", side_effect=source_git(**options)), patch.object(delivery.subprocess, "run"), patch.object(delivery.cert, "original_contracts"):
                    with self.assertRaises((ValueError, subprocess.CalledProcessError)):
                        delivery.source_guard(COMMIT, True)

    def test_every_refinement_file_is_mandatory_and_duplicate_records_are_rejected(self):
        records = ["M\t" + path for path in sorted(delivery.REFINEMENT_FILES)]
        candidates = [records[:index] + records[index+1:] for index in range(4)]
        candidates += [records + [records[0]], records + ["M\t.github/workflows/gridly-storekit-diagnostic-certification.yml"],
                       records + ["M\t.github/workflows/gridly-storekit-preflight-diagnostic.yml"]]
        for candidate in candidates:
            with self.subTest(candidate=candidate), patch.object(delivery.cert, "git", side_effect=source_git(historical_refinement="\n".join(candidate).encode())), patch.object(delivery.subprocess, "run"), patch.object(delivery.cert, "original_contracts"), self.assertRaises(ValueError):
                delivery.source_guard(COMMIT, True)

    def test_missing_or_unsuccessful_historical_certificate_fails(self):
        run = {"id": delivery.RUN, "head_sha": delivery.SOURCE, "run_attempt": 1, "status": "completed", "conclusion": "success",
               "path": ".github/workflows/gridly-storekit-diagnostic-certification.yml", "event": "push", "head_branch": "gridly-storekit-diagnostic-certify-15-" + delivery.SOURCE}
        jobs = {"total_count": 1, "jobs": [{"name": "certify-storekit-diagnostics", "conclusion": "success", "steps": [{"conclusion": "success"}]}]}
        artifacts = {"total_count": 0, "artifacts": []}
        def get(url):
            return jobs if "/jobs?" in url else artifacts if "/artifacts?" in url else run
        self.assertEqual(delivery.historical_evidence(get)["status"], "success")
        for field, value in [("head_sha", COMMIT), ("conclusion", "failure"), ("run_attempt", 2), ("id", 0), ("path", "other.yml")]:
            old = run[field]; run[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError): delivery.historical_evidence(get)
            run[field] = old
        jobs["jobs"][0]["steps"][0]["conclusion"] = "skipped"
        with self.assertRaises(ValueError): delivery.historical_evidence(get)
        jobs["jobs"][0]["steps"][0]["conclusion"] = "success"
        artifacts["total_count"] = 1
        with self.assertRaises(ValueError): delivery.historical_evidence(get)

    def test_original_release_safeguards_unchanged(self):
        delivery.cert.original_contracts()
        protected = delivery.cert.ALLOWED | {".github/workflows/gridly-apple-build-9.yml", "tools/apple_native_parity.py",
                                            "ios/App/App/GridlyBridgeViewController.swift", "ios/App/App.xcodeproj/project.pbxproj",
                                            "android/app/build.gradle", "js/gridly-entitlement.mjs", "js/gridly-store-verification.mjs"}
        for path in protected:
            self.assertEqual((ROOT / path).read_bytes().replace(b"\r\n", b"\n"), delivery.cert.git("show", delivery.SOURCE + ":" + path).replace(b"\r\n", b"\n"), path)


class CertificationAndTransferTests(SyntheticDeliveryTestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.ipa, self.guard = fixture(self.root)
        self.addCleanup(patch.stopall)
        patch.object(delivery, "source_guard", return_value=self.guard).start()
        patch.object(delivery.time, "time", return_value=NOW).start()

    def test_complete_signed_certificate_and_baseline_exception_pass(self):
        _, regressions = delivery.ready(self.root, COMMIT, self.ipa)
        self.assertEqual(regressions["status"], "baseline_exception")
        self.assertFalse(regressions["suite_green"])

    def test_missing_certificate_prevents_any_credential_or_upload_access(self):
        (self.root / "reports/storekit-diagnostic-certification.json").unlink()
        with patch.object(delivery, "api_token") as signer, patch.object(delivery.subprocess, "run") as execute, self.assertRaises(FileNotFoundError):
            delivery.transfer(self.root, COMMIT, self.ipa, credentials={})
        signer.assert_not_called(); execute.assert_not_called()

    def test_signing_parity_identity_activation_or_build_failure_blocks_upload(self):
        for key, value in [("status", "failed"), ("build", "14"), ("source_commit", delivery.SOURCE), ("signed_artifacts_unchanged", False),
                           ("original_contracts_unchanged", False), ("activation", {}), ("web_files", 1004),
                           ("distribution_performed", True), ("identity", {})]:
            candidate = {**proof(self.ipa), key: value}
            delivery.write_json(self.root / "reports/storekit-diagnostic-certification.json", candidate)
            with self.subTest(key=key), patch.object(delivery.subprocess, "run") as execute, self.assertRaises(ValueError):
                delivery.transfer(self.root, COMMIT, self.ipa, credentials={})
            execute.assert_not_called()

    def test_changed_ipa_or_missing_preflight_blocks_upload(self):
        self.ipa.write_bytes(b"changed synthetic artifact")
        with self.assertRaises(ValueError): delivery.ready(self.root, COMMIT, self.ipa)
        self.ipa.write_bytes(b"NOT_AN_APP_OR_SIGNED_IPA")
        (self.root / "reports/delivery-preflight.json").unlink()
        with self.assertRaises(FileNotFoundError): delivery.ready(self.root, COMMIT, self.ipa)

    def test_noninternal_export_cannot_upload(self):
        for key, value in [("testFlightInternalTestingOnly", False), ("manageAppVersionAndBuildNumber", True), ("destination", "upload")]:
            options = {"testFlightInternalTestingOnly": True, "method": "app-store-connect", "destination": "export", "manageAppVersionAndBuildNumber": False, key: value}
            (self.root / "export/ExportOptions.plist").write_bytes(plistlib.dumps(options))
            with self.subTest(key=key), self.assertRaises(ValueError): delivery.ready(self.root, COMMIT, self.ipa)

    def test_new_regression_is_not_hidden(self):
        (self.root / "reports/storekit-diagnostic-regressions.tap").write_text("not ok 1 - NEW FAILURE\n# tests 1\n# fail 1\n")
        with self.assertRaises(AssertionError): delivery.ready(self.root, COMMIT, self.ipa)

    def fake_upload(self, *, existing=False, fail=False):
        calls = []
        def get(path, token):
            self.assertEqual(token, "SYNTHETIC_NOT_A_JWT")
            calls.append("apps" if path.startswith("/v1/apps?") else "builds")
            if path.startswith("/v1/apps?"):
                return {"data": [{"id": "123", "type": "apps", "attributes": {"bundleId": delivery.cert.release.BUNDLE}}]}
            return {"data": [{"id": "synthetic"}] if existing else []}
        def execute(command, **options):
            if synthetic_transport_query(command, options): return
            action = upload_action(command)
            calls.append(action)
            if fail and action == "--upload-package": raise subprocess.CalledProcessError(1, command, stderr="PRIVATE NEVER PRINT")
        creds = {"ASC_KEY_ID": "SYNTHETIC1", "ASC_ISSUER_ID": "00000000-0000-0000-0000-000000000000",
                 "ASC_PRIVATE_KEY_P8_BASE64": delivery.base64.b64encode(b"-----BEGIN PRIVATE KEY-----\nNOT_A_REAL_KEY\n-----END PRIVATE KEY-----").decode()}
        return calls, dict(credentials=creds, token_factory=lambda *args: "SYNTHETIC_NOT_A_JWT", get=get, execute=execute, clock=lambda: NOW)

    def test_validate_then_live_unused_check_then_exactly_one_upload(self):
        calls, options = self.fake_upload()
        delivery.transfer(self.root, COMMIT, self.ipa, **options)
        self.assertEqual(calls, ["--validate-app", "apps", "builds", "--upload-package"])
        self.assertEqual(delivery.read_json(self.root / "reports/delivery-transfer.json")["status"], "ACCEPTED")
        with self.assertRaises(ValueError): delivery.transfer(self.root, COMMIT, self.ipa, **options)
        self.assertEqual(calls.count("--upload-package"), 1)

    def test_owner_only_authorization_uses_same_signed_ipa_and_transport_with_no_group_operations(self):
        report = self.root / "reports/delivery-authorization.json"
        authorization_report = delivery.read_json(report)
        authorization_report["authorization"] = owner_automatic_authorization()
        delivery.write_json(report, authorization_report)
        before = self.ipa.read_bytes()
        calls, options = self.fake_upload()
        delivery.transfer(self.root, COMMIT, self.ipa, **options)
        self.assertEqual(calls, ["--validate-app", "apps", "builds", "--upload-package"])
        self.assertEqual(self.ipa.read_bytes(), before)

    def test_unapproved_owner_only_access_is_rejected_before_credentials_or_transport(self):
        report = self.root / "reports/delivery-authorization.json"
        class NeverReadCredentials(dict):
            def get(self, *args): raise AssertionError("credentials accessed before owner-only eligibility")
        for field in ("no_other_eligible_internal_users_confirmed", "both_accounts_owned_by_owner",
                      "automatic_availability_to_both_accounts_acknowledged"):
            candidate = owner_automatic_authorization()
            candidate[delivery.OWNER_AUTO_FIELD][field] = False
            value = delivery.read_json(report)
            value["authorization"] = candidate
            delivery.write_json(report, value)
            calls, options = self.fake_upload()
            options["credentials"] = NeverReadCredentials()
            with self.subTest(field=field), self.assertRaises(ValueError):
                delivery.transfer(self.root, COMMIT, self.ipa, **options)
            self.assertEqual(calls, [])

    def test_owner_only_eligibility_expiring_after_live_build_check_prevents_upload(self):
        report = self.root / "reports/delivery-authorization.json"
        value = delivery.read_json(report)
        value["authorization"] = owner_automatic_authorization()
        delivery.write_json(report, value)
        calls, options = self.fake_upload()
        get = options["get"]
        def expire(path, token):
            result = get(path, token)
            if path.startswith("/v1/builds?"):
                delivery.time.time.return_value = NOW + 1801
            return result
        options["get"] = expire
        with self.assertRaises(ValueError):
            delivery.transfer(self.root, COMMIT, self.ipa, **options)
        self.assertNotIn("--upload-package", calls)

    def test_successfully_certified_but_expired_build_cannot_read_upload_credentials(self):
        class NeverReadCredentials(dict):
            def get(self,*args): raise AssertionError("credentials accessed after expiry")
        delivery.time.time.return_value = NOW+1801
        with patch.object(delivery,"api_token") as signer,patch.object(delivery.subprocess,"run") as execute,self.assertRaises(ValueError):
            delivery.transfer(self.root, COMMIT, self.ipa, credentials=NeverReadCredentials())
        signer.assert_not_called(); execute.assert_not_called()

    def test_apple_validation_crossing_original_owner_deadline_blocks_upload(self):
        calls,options=self.fake_upload()
        original=options["execute"]
        def expire(command,**kwargs):
            original(command,**kwargs)
            delivery.time.time.return_value=NOW+1801
        options["execute"]=expire
        with self.assertRaises(ValueError):
            delivery.transfer(self.root,COMMIT,self.ipa,**options)
        self.assertEqual(calls,["--validate-app"])
        self.assertFalse((self.root/"reports/delivery-transfer.json").exists())

    def test_existing_build_prevents_upload(self):
        calls, options = self.fake_upload(existing=True)
        with self.assertRaises(ValueError): delivery.transfer(self.root, COMMIT, self.ipa, **options)
        self.assertNotIn("--upload-package", calls)

    def test_uncertain_acceptance_records_attempt_and_does_not_retry(self):
        calls, options = self.fake_upload(fail=True)
        with self.assertRaises(subprocess.CalledProcessError): delivery.transfer(self.root, COMMIT, self.ipa, **options)
        self.assertEqual(delivery.read_json(self.root / "reports/delivery-transfer.json")["status"], "ATTEMPTED")
        with self.assertRaises(ValueError): delivery.transfer(self.root, COMMIT, self.ipa, **options)
        self.assertEqual(calls.count("--upload-package"), 1)

    def test_apple_validation_failure_prevents_availability_and_upload(self):
        calls, options = self.fake_upload()
        def reject(command, **kwargs):
            if synthetic_transport_query(command, kwargs): return
            calls.append(upload_action(command))
            raise subprocess.CalledProcessError(1, command)
        options["execute"] = reject
        with self.assertRaises(subprocess.CalledProcessError):
            delivery.transfer(self.root, COMMIT, self.ipa, **options)
        self.assertEqual(calls, ["--validate-app"])

    def test_ipa_changed_during_validation_never_reaches_apple_upload(self):
        calls, options = self.fake_upload()
        def corrupt(command, **kwargs):
            if synthetic_transport_query(command, kwargs): return
            calls.append(upload_action(command))
            self.ipa.write_bytes(b"ALTERED")
        options["execute"] = corrupt
        with self.assertRaises(ValueError):
            delivery.transfer(self.root, COMMIT, self.ipa, **options)
        self.assertEqual(calls, ["--validate-app"])

    def test_live_availability_timeout_prevents_upload(self):
        calls, options = self.fake_upload()
        moments = iter([NOW, NOW+61])
        options["clock"] = lambda: next(moments)
        with self.assertRaises(ValueError):
            delivery.transfer(self.root, COMMIT, self.ipa, **options)
        self.assertNotIn("--upload-package", calls)

    def test_missing_existing_api_credentials_fail_without_requests(self):
        with patch.object(delivery, "api_token") as signer, patch.object(delivery.subprocess, "run") as execute, patch.object(delivery.cert, "original_contracts"), self.assertRaises(ValueError):
            delivery.transfer(self.root, COMMIT, self.ipa, credentials={})
        signer.assert_not_called(); execute.assert_not_called()


class AvailabilityAndCleanupTests(SyntheticDeliveryTestCase):
    def test_wrong_app_ambiguous_builds_and_pagination_fail_closed(self):
        for apps, builds in [({}, {}), ({"data": []}, {}), ({"data": [], "errors": [{"code": "synthetic"}]}, {}), ({"data": [{"id": "123", "type": "apps", "attributes": {"bundleId": "other.app"}}]}, {}),
                            ({"data": [{"id": "123", "type": "apps", "attributes": {"bundleId": delivery.cert.release.BUNDLE}}]}, {}),
                            ({"data": [{"id": "123", "type": "apps", "attributes": {"bundleId": delivery.cert.release.BUNDLE}}]}, {"data": [], "links": {"next": "unexpected"}}),
                            ({"data": [{"id": "123", "type": "apps", "attributes": {"bundleId": delivery.cert.release.BUNDLE}}]}, {"data": [], "meta": {"paging": {"total": 1}}}),
                            ({"data": [{"id": "123", "type": "apps", "attributes": {"bundleId": delivery.cert.release.BUNDLE}}]}, {"data": [], "errors": [{"code": "synthetic"}]})]:
            with self.subTest(apps=apps, builds=builds), self.assertRaises(ValueError):
                delivery.unused_build(lambda path: apps if path.startswith("/v1/apps?") else builds)

    def test_credentials_cannot_follow_http_redirects(self):
        with self.assertRaises(ValueError):
            delivery.NoRedirect().redirect_request(None, None, 302, "", {}, "https://elsewhere.example")

    def test_cleanup_failure_is_failure_and_summary_never_echoes_private_fields(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = delivery.cert.private_directory(temporary)
            root.mkdir(); (root / ".owned").write_text(delivery.cert.PRIVATE_MARKER)
            (root / "reports").mkdir()
            delivery.write_json(root / "reports/delivery-transfer.json", {"status": "ACCEPTED", "source_commit": "PRIVATE NEVER PRINT", "build": "15"})
            with patch.object(delivery, "cleanup_delivery", return_value={
                    "status":"FAIL","stages":{},"resources":dict.fromkeys(("workspace","profile","keychain"),"UNVERIFIED")}):
                result = delivery.finish(temporary, "success")
            self.assertEqual(result["certification"], "FAIL")
            self.assertEqual(result["cleanup"], "FAIL")
            self.assertNotIn("PRIVATE", json.dumps(result))

    def test_cleanup_alone_can_turn_accepted_certification_into_failure(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = delivery.cert.private_directory(temporary)
            root.mkdir()
            (root / ".owned").write_text(delivery.cert.PRIVATE_MARKER)
            fixture(root)
            delivery.write_json(root / "reports/delivery-transfer.json", {"status": "ACCEPTED", "source_commit": COMMIT, "build": "15"})
            with patch.object(delivery, "cleanup_delivery", return_value={
                    "status":"FAIL","stages":{},"resources":dict.fromkeys(("workspace","profile","keychain"),"UNVERIFIED")}):
                result = delivery.finish(temporary, "success")
            self.assertEqual(result["upload"], "ACCEPTED")
            self.assertEqual(result["regressions"], "BASELINE_EXCEPTION")
            self.assertEqual(result["cleanup"], "FAIL")
            self.assertEqual(result["certification"], "FAIL")

    def test_accepted_upload_is_not_retroactively_rejected_by_expired_owner_timestamp(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=delivery.cert.private_directory(temporary)
            root.mkdir(); (root/".owned").write_text(delivery.cert.PRIVATE_MARKER)
            fixture(root)
            delivery.write_json(root/"reports/delivery-transfer.json",{"status":"ACCEPTED","source_commit":COMMIT,"build":"15"})
            real_run = subprocess.run
            protected = [".github/workflows/gridly-apple-build-9.yml",
                         "tools/apple_native_parity.py", *delivery.cert.BASELINE_INPUTS]
            expected_git = [["git", "show", delivery.cert.BASE + ":" + path] for path in protected]
            git_calls, native_calls = [], []
            def synthetic_native(args, *positional, **keywords):
                if args == ["security", "list-keychains", "-d", "user"]:
                    native_calls.append(args)
                    return subprocess.CompletedProcess(args, 0, b"", b"")
                if args in expected_git:
                    git_calls.append(args)
                    return real_run(args, *positional, **keywords)
                self.fail("unexpected subprocess command in accepted-upload fixture")
            with patch.object(delivery.time,"time",return_value=NOW+3600), \
                    patch.object(delivery.Path,"home",return_value=root/"home"), \
                    patch.object(delivery.subprocess,"run",side_effect=synthetic_native):
                result=delivery.finish(temporary,"success")
            self.assertCountEqual(git_calls, expected_git)
            self.assertEqual(native_calls, [["security", "list-keychains", "-d", "user"]])
            self.assertEqual(result["upload"],"ACCEPTED")
            self.assertEqual(result["certification"],"PASS")
            self.assertEqual(result["cleanup"],"PASS")

    def test_private_generated_source_signed_output_and_key_are_removed(self):
        with tempfile.TemporaryDirectory() as temporary:
            env = Path(temporary) / "env"
            delivery.cert.prepare_private(temporary, env)
            root = delivery.cert.private_directory(temporary)
            for name in ("home/.appstoreconnect/private_keys/synthetic.p8", "source/www/config.json", "archive/App.app/file", "export/synthetic.ipa", "logs/raw.log", "reports/private.json"):
                path = root / name; path.parent.mkdir(parents=True, exist_ok=True); path.write_text("SYNTHETIC_PRIVATE")
            with patch.object(delivery.Path,"home",return_value=root/"home"), \
                    patch.object(delivery.subprocess,"run",return_value=subprocess.CompletedProcess([],0,b"",b"")):
                result = delivery.finish(temporary, "failure")
            self.assertEqual(result["cleanup"], "PASS")
            self.assertEqual(result["certification"], "FAIL")
            self.assertFalse(root.exists())


class DeliveryPreflightTests(SyntheticDeliveryTestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.ipa, self.guard = fixture(self.root)
        (self.root / "logs").mkdir(exist_ok=True)
        self.output = self.root / "reports/delivery-preflight.json"
        self.output.unlink()
        self.github_env = self.root / "github-env"
        self.github_env.write_text("")
        self.environment = {"GITHUB_SHA": COMMIT, "GITHUB_WORKSPACE": str(ROOT),
                            "GITHUB_REF": REF, "GITHUB_REF_NAME": REF.removeprefix("refs/tags/")}
        self.calls = []
        self.failures = {}
        self.history = {"run": delivery.RUN, "source_commit": delivery.SOURCE, "attempt": 1,
                        "status": "success", "artifacts": 0}
        self.addCleanup(patch.stopall)
        self.source = patch.object(delivery, "source_guard", return_value=self.guard).start()
        self.historical = patch.object(delivery, "historical_evidence", return_value=self.history).start()
        patch.object(delivery.time, "time", return_value=NOW).start()

    def execute(self, args, **options):
        self.calls.append((args, options))
        key = None
        output = b""
        if args == ["git", "rev-parse", "HEAD"]:
            key = "identity"; output = (COMMIT + "\n").encode()
        elif args == ["xcodebuild", "-version"]:
            key = "version"; output = b"Xcode 26.6\nBuild version SYNTHETIC\n"
        elif args[:2] == ["grep", "-E"]:
            key = "version_match"
            if key not in self.failures:
                return subprocess.CompletedProcess(args, 0 if re.search(rb"^Xcode 26([. ]|$)", options["input"], re.M) else 1, b"", b"")
        elif args == ["git", "cat-file", "-t", REF]:
            key = "tag"; output = b"tag\n"
        elif args == ["git", "rev-parse", REF + "^{commit}"]:
            key = "tag_sha"; output = (COMMIT + "\n").encode()
        elif args == ["git", "symbolic-ref", "-q", "HEAD"]:
            return self.failures.get("attached", subprocess.CompletedProcess(args, 1, b"", b""))
        elif args[:2] == ["git", "clone"]:
            key = "clone"
            if key not in self.failures:
                (self.root / "source").mkdir()
        elif args[:3] == ["git", "-C", str(self.root / "source")]:
            key = "clone_sha"; output = (COMMIT + "\n").encode()
        elif args == ["xcodebuild", "-help"]:
            key = "help"; output = b"\n  testFlightInternalTestingOnly : Bool\n"
        elif args[:2] == ["grep", "-Eq"]:
            key = "option"
            if key not in self.failures:
                text = Path(args[-1]).read_text()
                return subprocess.CompletedProcess(args, 0 if re.search(r"^[ \t]*testFlightInternalTestingOnly[ \t]*:", text, re.M) else 1, b"", b"")
        else:
            self.fail("unexpected command")
        if key in self.failures:
            action = self.failures[key]
            if isinstance(action, BaseException): raise action
            return action
        return subprocess.CompletedProcess(args, 0, output, b"SYNTHETIC_PRIVATE_NEVER_PUBLIC")

    def probes(self, **kwargs):
        records = delivery.delivery_preflight(self.root, COMMIT, kwargs.get("output", self.output),
                    kwargs.get("github_env", self.github_env), self.environment, execute=self.execute)
        return {record["stage"]: record for record in records}

    def test_all_eight_checks_and_original_private_report_pass(self):
        records = self.probes()
        self.assertEqual(list(records), list(delivery.PREFLIGHT_STAGES))
        self.assertTrue(all(record["status"] == "PASS" for record in records.values()))
        self.assertEqual(delivery.read_json(self.output), {**self.guard, "historical_certification": self.history})
        self.assertEqual(self.github_env.read_text(), "DELIVERY_SOURCE_DIR=" + str(self.root / "source") + "\n")
        self.source.assert_called_once_with(COMMIT, clean=True)
        self.historical.assert_called_once_with(token=None,environment={key:self.environment.get(key) for key in (
            "GITHUB_ACTIONS","RUNNER_OS","GITHUB_REPOSITORY","GITHUB_EVENT_NAME",
            "GITHUB_RUN_ATTEMPT","GITHUB_SHA","GITHUB_REF","GITHUB_API_URL")})

    def test_expired_preflight_owner_authorization_blocks_all_tooling(self):
        delivery.time.time.return_value = NOW + 1801
        records = self.probes()
        self.assertEqual(records["P01_SOURCE_SHA"]["category"], "AUTHORIZATION_REJECTED")
        self.assertFalse(self.calls); self.source.assert_not_called(); self.historical.assert_not_called()
        self.assertTrue(all(records[stage]["category"] == "DEPENDENCY_FAILED" for stage in delivery.PREFLIGHT_STAGES[1:]))

    def test_event_or_workspace_identity_mismatch_stops_independent_probes(self):
        for key, value in [("GITHUB_SHA", "f"*40), ("GITHUB_WORKSPACE", str(self.root))]:
            old = self.environment[key]; self.environment[key] = value
            records = self.probes()
            self.assertEqual(records["P01_SOURCE_SHA"]["category"], "SOURCE_SHA_MISMATCH")
            self.assertFalse(self.calls)
            self.environment[key] = old

    def test_checkout_sha_mismatch_is_identified_before_xcode(self):
        self.failures["identity"] = subprocess.CompletedProcess([], 0, b"wrong", b"PRIVATE")
        records = self.probes()
        self.assertEqual(records["P01_SOURCE_SHA"]["category"], "SOURCE_SHA_MISMATCH")
        self.assertEqual(len(self.calls), 1)

    def test_wrong_xcode_version_is_distinct_and_safe_independent_checks_continue(self):
        self.failures["version"] = subprocess.CompletedProcess([], 0, b"Xcode 27.0\n", b"PRIVATE")
        records = self.probes()
        self.assertEqual(records["P02_XCODE_VERSION"]["category"], "XCODE26_REQUIRED")
        self.assertEqual(records["P04_CERTIFICATION_HISTORY"]["status"], "PASS")
        self.assertEqual(records["P07_XCODE_HELP"]["status"], "PASS")

    def test_xcode_version_execution_failure_is_fixed(self):
        self.failures["version"] = OSError("PRIVATE COMMAND/PATH NEVER PUBLIC")
        records = self.probes()
        self.assertEqual(records["P02_XCODE_VERSION"]["category"], "XCODE_COMMAND_FAILED")

    def test_source_guard_failure_blocks_cloning_without_claiming_a_pass(self):
        self.source.side_effect = ValueError("PRIVATE_SOURCE_DETAIL")
        records = self.probes()
        self.assertEqual(records["P03_SOURCE_GUARD"]["category"], "DELIVERY_SOURCE_REJECTED")
        self.assertEqual(records["P06_CLONE_SHA"]["category"], "DEPENDENCY_FAILED")
        self.assertFalse(any(args[:2] == ["git","clone"] for args,_ in self.calls))
        self.assertEqual(records["P04_CERTIFICATION_HISTORY"]["status"], "PASS")

    def test_unexpected_history_exception_is_internal_failure_not_evidence_mismatch(self):
        self.historical.side_effect = ValueError("PRIVATE RESPONSE NEVER PUBLIC")
        records = self.probes()
        self.assertEqual(records["P04_CERTIFICATION_HISTORY"]["category"], "INTERNAL_FAILURE")
        self.assertFalse(self.output.exists())
        self.assertEqual(records["P07_XCODE_HELP"]["status"], "PASS")

    def test_private_report_failure_is_identified_without_writing_outside_root(self):
        outside = ROOT / "NOT_CREATED.json"
        records = self.probes(output=outside)
        self.assertEqual(records["P04_CERTIFICATION_HISTORY"]["category"], "PREFLIGHT_REPORT_FAILED")
        self.assertFalse(outside.exists())

    def test_tag_checkout_failure_blocks_clone(self):
        self.failures["tag"] = subprocess.CompletedProcess([], 0, b"commit", b"PRIVATE")
        records = self.probes()
        self.assertEqual(records["P05_TAG_CHECKOUT"]["category"], "TAG_CHECKOUT_REJECTED")
        self.assertEqual(records["P06_CLONE_SHA"]["category"], "DEPENDENCY_FAILED")

    def test_wrong_tag_target_blocks_clone(self):
        self.failures["tag_sha"] = subprocess.CompletedProcess([], 0, b"wrong", b"PRIVATE")
        records = self.probes()
        self.assertEqual(records["P05_TAG_CHECKOUT"]["category"], "TAG_CHECKOUT_REJECTED")

    def test_attached_checkout_and_old_preflight_tag_cannot_pass(self):
        self.failures["attached"] = subprocess.CompletedProcess([], 0, b"refs/heads/example", b"")
        records = self.probes()
        self.assertEqual(records["P05_TAG_CHECKOUT"]["category"], "TAG_CHECKOUT_REJECTED")
        self.failures.clear()
        self.environment["GITHUB_REF"] = "refs/tags/gridly-storekit-preflight-15-" + COMMIT
        records = self.probes()
        self.assertEqual(records["P05_TAG_CHECKOUT"]["category"], "TAG_CHECKOUT_REJECTED")

    def test_clone_failure_and_timeout_remain_distinct_from_sha_mismatch(self):
        for failure in (subprocess.CompletedProcess([], 1, b"PRIVATE", b"PRIVATE"),
                        subprocess.TimeoutExpired("PRIVATE", 1, output=b"PRIVATE")):
            self.failures["clone"] = failure
            records = self.probes()
            self.assertEqual(records["P06_CLONE_SHA"]["category"], "LOCAL_CLONE_FAILED")

    def test_clone_sha_mismatch_is_identified(self):
        self.failures["clone_sha"] = subprocess.CompletedProcess([], 0, b"wrong", b"PRIVATE")
        records = self.probes()
        self.assertEqual(records["P06_CLONE_SHA"]["category"], "CLONED_SHA_MISMATCH")
        self.assertEqual(self.github_env.read_text(), "")

    def test_clone_environment_export_failure_is_identified(self):
        records = self.probes(github_env=None)
        self.assertEqual(records["P06_CLONE_SHA"]["category"], "CLONE_ENVIRONMENT_FAILED")

    def test_help_execution_failure_blocks_recognition_even_if_key_is_present(self):
        self.failures["help"] = subprocess.CompletedProcess([], 1, b"testFlightInternalTestingOnly : Bool\n", b"PRIVATE")
        records = self.probes()
        self.assertEqual(records["P07_XCODE_HELP"]["category"], "XCODE_HELP_FAILED")
        self.assertEqual(records["P08_INTERNAL_EXPORT_OPTION"]["category"], "DEPENDENCY_FAILED")

    def test_missing_internal_option_is_independently_identified(self):
        self.failures["help"] = subprocess.CompletedProcess([], 0, b"unrelated : Bool\n", b"PRIVATE")
        records = self.probes()
        self.assertEqual(records["P07_XCODE_HELP"]["status"], "PASS")
        self.assertEqual(records["P08_INTERNAL_EXPORT_OPTION"]["category"], "INTERNAL_OPTION_NOT_RECOGNIZED")

    def test_fixed_public_report_never_exposes_raw_output_or_private_paths(self):
        self.failures["version"] = OSError("PRIVATE EXCEPTION NEVER PUBLIC")
        records = self.probes()
        public = io.StringIO()
        delivery.emit_preflight(list(records.values()), stream=public)
        values = [json.loads(line) for line in public.getvalue().splitlines()]
        self.assertEqual(values, list(records.values()))
        for token in ("PRIVATE", str(self.root), "Traceback", "Xcode 26.6"):
            self.assertNotIn(token, public.getvalue())
        self.assertTrue(any(b"SYNTHETIC_PRIVATE" in p.read_bytes() for p in (self.root/"logs").glob("*.log")))

    def test_public_emitter_rejects_arbitrary_labels_fields_and_statuses_atomically(self):
        valid = [delivery.preflight_result(stage, True, "NONE") for stage in delivery.PREFLIGHT_STAGES]
        for change in ({"raw":"PRIVATE"}, {"category":"PRIVATE"}, {"stage":"PRIVATE"}, {"status":"PRIVATE"}):
            records = copy.deepcopy(valid); records[-1].update(change)
            public = io.StringIO()
            with self.assertRaises(ValueError): delivery.emit_preflight(records, stream=public)
            self.assertEqual(public.getvalue(), "")

    def test_only_validated_records_reach_public_descriptor_three(self):
        records = [delivery.preflight_result(stage, True, "NONE") for stage in delivery.PREFLIGHT_STAGES]
        public = io.StringIO()
        with patch.object(delivery.os,"dup",return_value=123) as duplicate, patch.object(delivery.os,"fdopen",return_value=contextlib.nullcontext(public)):
            delivery.emit_preflight(records)
        duplicate.assert_called_once_with(3)
        self.assertEqual(len(public.getvalue().splitlines()),8)

    def test_subprocesses_capture_raw_output_and_cannot_inherit_public_descriptor(self):
        self.probes()
        for args,options in self.calls:
            self.assertIs(options["capture_output"],True)
            self.assertIs(options["close_fds"],True)
            self.assertIs(options["check"],False)
            if args[0]=="xcodebuild":self.assertIn(args[1:],(["-version"],["-help"]))

    def test_main_preflight_failure_never_reaches_transfer_or_credentials(self):
        records=[delivery.preflight_result(stage,False,"INTERNAL_FAILURE") for stage in delivery.PREFLIGHT_STAGES]
        argv=["tool","preflight","--runner-temp",str(self.root),"--commit",COMMIT,
              "--output",str(self.output),"--github-env",str(self.github_env)]
        with patch.object(sys,"argv",argv), patch.object(delivery.cert,"private_directory",return_value=self.root), patch.dict(delivery.os.environ,{"DIAGNOSTIC_PRIVATE_ROOT":str(self.root)}), patch.object(delivery,"delivery_preflight",return_value=records), patch.object(delivery,"emit_preflight") as public, patch.object(delivery,"transfer") as transfer:
            with self.assertRaises(SystemExit) as stopped:delivery.main()
        self.assertEqual(stopped.exception.code,1); transfer.assert_not_called(); public.assert_called_once_with(records)

    def test_interrupted_preflight_produces_only_fixed_internal_failure_records(self):
        argv=["tool","preflight","--runner-temp",str(self.root),"--commit",COMMIT]
        with patch.object(sys,"argv",argv), patch.object(delivery.cert,"private_directory",return_value=self.root), patch.dict(delivery.os.environ,{"DIAGNOSTIC_PRIVATE_ROOT":str(self.root)}), patch.object(delivery,"delivery_preflight",side_effect=KeyboardInterrupt("PRIVATE")), patch.object(delivery,"emit_preflight") as public:
            with self.assertRaises(SystemExit) as stopped:delivery.main()
        self.assertEqual(stopped.exception.code,1)
        self.assertTrue(all(record["category"]=="INTERNAL_FAILURE" for record in public.call_args.args[0]))

    def test_history_token_is_removed_before_authorization_and_all_child_commands(self):
        self.environment["GRIDLY_HISTORY_TOKEN"]="SYNTHETIC_TOKEN_NEVER_PUBLIC"
        original=self.execute
        def checked(args,**options):
            self.assertNotIn("GRIDLY_HISTORY_TOKEN",self.environment)
            return original(args,**options)
        with patch.object(delivery,"authorization_guard",wraps=delivery.authorization_guard) as owner:
            delivery.delivery_preflight(self.root,COMMIT,self.output,self.github_env,
                                        environment=self.environment,execute=checked)
        self.assertNotIn("GRIDLY_HISTORY_TOKEN",self.environment)
        self.assertEqual(self.historical.call_args.kwargs["token"],"SYNTHETIC_TOKEN_NEVER_PUBLIC")
        self.assertNotIn("GRIDLY_HISTORY_TOKEN",self.historical.call_args.kwargs["environment"])
        self.assertNotIn("SYNTHETIC_TOKEN_NEVER_PUBLIC",self.github_env.read_text())

    def test_process_environment_token_is_not_inherited_by_child_tools(self):
        environment={**self.environment,"GRIDLY_HISTORY_TOKEN":"SYNTHETIC_TOKEN_NEVER_PUBLIC"}
        original=self.execute
        def checked(args,**options):
            self.assertNotIn("GRIDLY_HISTORY_TOKEN",os.environ)
            return original(args,**options)
        with patch.dict(os.environ,environment,clear=True):
            records=delivery.delivery_preflight(self.root,COMMIT,self.output,self.github_env,execute=checked)
            self.assertNotIn("GRIDLY_HISTORY_TOKEN",os.environ)
        self.assertTrue(all(record["status"]=="PASS" for record in records))
        self.assertNotIn("SYNTHETIC_TOKEN_NEVER_PUBLIC",self.github_env.read_text())

    def test_each_history_retrieval_category_is_preserved_without_raw_output(self):
        for category in delivery.HISTORY_CATEGORIES:
            self.historical.side_effect=delivery.HistoryFailure(category)
            records=self.probes()
            self.assertEqual(records["P04_CERTIFICATION_HISTORY"]["category"],category)
            self.assertFalse(self.output.exists())
            self.assertEqual(records["P05_TAG_CHECKOUT"]["status"],"PASS")


class HistoryRetrievalTests(SyntheticDeliveryTestCase):
    """Synthetic HTTP responses only: never read a token or contact GitHub."""
    def setUp(self):
        self.token="SYNTHETIC_TOKEN_NEVER_PUBLIC"
        self.environment={"GITHUB_ACTIONS":"true","RUNNER_OS":"macOS",
            "GITHUB_REPOSITORY":delivery.REPOSITORY,"GITHUB_EVENT_NAME":"push",
            "GITHUB_RUN_ATTEMPT":"1","GITHUB_SHA":COMMIT,"GITHUB_REF":REF,
            "GITHUB_API_URL":"https://api.github.com"}
        self.base="https://api.github.com/repos/"+delivery.REPOSITORY+"/actions/runs/"+str(delivery.RUN)
        self.urls=[self.base,self.base+"/attempts/1/jobs?per_page=100",self.base+"/artifacts?per_page=100"]
        self.responses=[
            {"id":delivery.RUN,"head_sha":delivery.SOURCE,"run_attempt":1,"status":"completed",
             "conclusion":"success","path":".github/workflows/gridly-storekit-diagnostic-certification.yml",
             "event":"push","head_branch":"gridly-storekit-diagnostic-certify-15-"+delivery.SOURCE},
            {"total_count":1,"jobs":[{"name":"certify-storekit-diagnostics","conclusion":"success",
                                     "steps":[{"conclusion":"success"},{"conclusion":"success"}]}]},
            {"total_count":0,"artifacts":[]}]
        self.queue=[];self.requests=[];self.waits=[];self.elapsed=0

    def response(self,value=None,*,raw=None,headers=None,url=None,status=200):
        result=io.BytesIO(json.dumps({} if value is None else value).encode() if raw is None else raw)
        result.status=status
        result.headers=email.message.Message()
        for key,item in ({"Content-Type":"application/json"} if headers is None else headers).items():
            result.headers[key]=item
        result.geturl=lambda:url or self.requests[-1][0].full_url
        return result

    def error(self,code,headers=None,body=b'{"message":"PRIVATE_RAW_ERROR_NEVER_PUBLIC"}'):
        fields=email.message.Message()
        for key,value in (headers or {}).items():fields[key]=value
        return urllib.error.HTTPError(self.base,code,"PRIVATE_RAW_ERROR_NEVER_PUBLIC",fields,io.BytesIO(body))

    def open(self,request,timeout):
        self.requests.append((request,timeout,self.elapsed))
        self.assertLessEqual(timeout,delivery.HISTORY_TIMEOUT)
        if not self.queue:raise AssertionError("unexpected HTTP request")
        result=self.queue.pop(0)
        if isinstance(result,Exception):raise result
        return result

    def sleep(self,delay):
        self.assertGreater(delay,0)
        self.waits.append(delay);self.elapsed+=delay

    def fetch(self,url=None,**changes):
        options={"token":self.token,"environment":self.environment,"open_request":self.open,
                 "sleep":self.sleep,"clock":lambda:NOW+self.elapsed,"monotonic":lambda:self.elapsed}
        options.update(changes)
        return delivery.public_json(self.base if url is None else url,**options)

    def rejected(self,category,operation):
        output,error=io.StringIO(),io.StringIO()
        with contextlib.redirect_stdout(output),contextlib.redirect_stderr(error),self.assertRaises(delivery.HistoryFailure) as caught:
            operation()
        self.assertEqual(caught.exception.category,category)
        self.assertEqual(str(caught.exception),category)
        self.assertEqual(output.getvalue()+error.getvalue(),"")
        for private in (self.token,"PRIVATE_RAW","/private/","Bearer","Traceback"):
            self.assertNotIn(private,str(caught.exception))

    def test_all_three_live_responses_are_authenticated_pinned_and_verified(self):
        self.queue=[self.response(value) for value in self.responses]
        result=delivery.historical_evidence(self.fetch)
        self.assertEqual(result,{"run":delivery.RUN,"source_commit":delivery.SOURCE,
                                 "attempt":1,"status":"success","artifacts":0})
        self.assertEqual([r.full_url for r,_,_ in self.requests],self.urls)
        self.assertEqual(self.waits,[])
        for request,timeout,_ in self.requests:
            self.assertEqual(request.get_method(),"GET")
            self.assertEqual(request.get_header("Authorization"),"Bearer "+self.token)
            self.assertEqual(request.get_header("X-github-api-version"),"2022-11-28")
            self.assertEqual(timeout,10)

    def test_default_historical_helper_uses_authenticated_transport_for_every_response(self):
        self.queue=[self.response(v) for v in self.responses]
        fake=type("PrivateOpener",(),{"open":lambda _,request,timeout:self.open(request,timeout)})()
        with patch.object(delivery.urllib.request,"build_opener",return_value=fake) as build:
            result=delivery.historical_evidence(token=self.token,environment=self.environment)
        self.assertEqual(result["status"],"success")
        self.assertEqual(build.call_count,3)
        self.assertEqual([r.full_url for r,_,_ in self.requests],self.urls)

    def test_every_original_evidence_identity_or_conclusion_mismatch_is_rejected_without_retry(self):
        mutations=[(0,{"id":0}),(0,{"head_sha":COMMIT}),(0,{"run_attempt":2}),
            (0,{"status":"in_progress"}),(0,{"conclusion":"failure"}),(0,{"path":"other.yml"}),
            (0,{"event":"workflow_dispatch"}),(0,{"head_branch":"wrong-tag"}),
            (1,{"total_count":2}),(1,{"jobs":[]}),
            (1,{"jobs":[{"name":"other-job","conclusion":"success","steps":[{"conclusion":"success"}]}]}),
            (1,{"jobs":[{"name":"certify-storekit-diagnostics","conclusion":"failure","steps":[{"conclusion":"success"}]}]}),
            (1,{"jobs":[{"name":"certify-storekit-diagnostics","conclusion":"success","steps":[{"conclusion":"skipped"}]}]}),
            (2,{"total_count":1}),(2,{"artifacts":[{"id":"SYNTHETIC"}]})]
        for index,change in mutations:
            with self.subTest(index=index,change=change):
                values=copy.deepcopy(self.responses);values[index].update(change)
                self.queue=[self.response(v) for v in values];self.requests=[];self.waits=[]
                self.rejected("CERTIFICATION_EVIDENCE_REJECTED",lambda:delivery.historical_evidence(self.fetch))
                self.assertEqual(len(self.requests),index+1);self.assertFalse(self.waits)

    def test_missing_or_incomplete_response_fields_fail_closed(self):
        mutations=[(0,"id",None),(0,"run_attempt",True),(0,"head_sha",{}),
                   (1,"total_count","1"),(1,"jobs",{}),(1,"jobs",[{}]),
                   (1,"jobs",[{"name":"certify-storekit-diagnostics","conclusion":"success","steps":[]}]),
                   (1,"jobs",[{"name":"certify-storekit-diagnostics","conclusion":"success","steps":[{}]}]),
                   (2,"total_count",False),(2,"artifacts",None)]
        for index,key,value in mutations:
            with self.subTest(index=index,key=key):
                values=copy.deepcopy(self.responses);values[index][key]=value
                self.requests=[];self.queue=[self.response(v) for v in values]
                self.rejected("CERTIFICATION_RESPONSE_INVALID",lambda:delivery.historical_evidence(self.fetch))
        for index,fields in enumerate(self.responses):
            for key in fields:
                values=copy.deepcopy(self.responses);del values[index][key]
                self.requests=[];self.queue=[self.response(v) for v in values]
                self.rejected("CERTIFICATION_RESPONSE_INVALID",lambda:delivery.historical_evidence(self.fetch))

    def test_missing_or_malformed_token_cannot_open_a_request(self):
        for token in (None,"","contains space","x\nPRIVATE",1,"nonascii\u00e9"):
            with self.subTest(token=token):
                self.rejected("CERTIFICATION_AUTH_FAILED",lambda:self.fetch(token=token))
        self.assertEqual(self.requests,[])

    def test_wrong_or_missing_actions_context_cannot_access_token_transport(self):
        for key in self.environment:
            for value in (None,"wrong"):
                candidate={**self.environment,key:value}
                with self.subTest(key=key,value=value):
                    self.rejected("CERTIFICATION_CONTEXT_REJECTED",lambda:self.fetch(environment=candidate))
        self.assertEqual(self.requests,[])

    def test_unexpected_urls_cannot_receive_authorization(self):
        for url in (self.base+"/logs",self.base+"/attempts/2/jobs?per_page=100",
                    self.base+"?extra=1",self.base+"/artifacts?per_page=1",self.base+"#fragment",
                    self.base.replace("api.github.com","other.invalid"),
                    self.base.replace(delivery.REPOSITORY,"other/repository"),
                    self.base.replace(str(delivery.RUN),"1"),self.base.replace("https:","http:")):
            self.rejected("CERTIFICATION_CONTEXT_REJECTED",lambda:self.fetch(url))
        self.assertEqual(self.requests,[])

    def test_missing_actions_permission_and_invalid_authentication_are_not_retried(self):
        for status in (401,403):
            self.requests=[];self.queue=[self.error(status)]
            self.rejected("CERTIFICATION_AUTH_FAILED",self.fetch)
            self.assertEqual(len(self.requests),1);self.assertFalse(self.waits)

    def test_redirect_cannot_forward_token_and_changed_response_url_is_rejected(self):
        self.assertIsNone(delivery.HistoryNoRedirect().redirect_request(None,None,302,"PRIVATE",{},"https://other.invalid"))
        for status in (301,302,307,308):
            self.requests=[];self.queue=[self.error(status,{"Location":"https://other.invalid"})]
            self.rejected("CERTIFICATION_CONTEXT_REJECTED",self.fetch)
            self.assertEqual(len(self.requests),1)
        self.queue=[self.response({},url="https://other.invalid")]
        self.rejected("CERTIFICATION_CONTEXT_REJECTED",self.fetch)

    def test_default_transport_disables_proxy_and_redirect_and_has_no_global_opener(self):
        fake=type("PrivateOpener",(),{"open":lambda _,request,timeout:self.open(request,timeout)})()
        self.queue=[self.response({})]
        with patch.object(delivery.urllib.request,"build_opener",return_value=fake) as build:
            self.fetch(open_request=None)
        self.assertEqual(len(build.call_args.args),2)
        self.assertIsInstance(build.call_args.args[0],delivery.urllib.request.ProxyHandler)
        self.assertEqual(build.call_args.args[0].proxies,{})
        self.assertIsInstance(build.call_args.args[1],delivery.HistoryNoRedirect)

    def test_primary_rate_limit_waits_past_reset_and_retry_after_before_retry(self):
        self.queue=[self.error(403,{"Retry-After":"2","X-RateLimit-Remaining":"0",
                                  "X-RateLimit-Reset":str(NOW+7)}),self.response({})]
        self.fetch()
        self.assertEqual(self.waits,[8])
        self.assertEqual([elapsed for _,_,elapsed in self.requests],[0,8])

    def test_retry_after_http_date_is_respected(self):
        date=email.utils.format_datetime(delivery.dt.datetime.fromtimestamp(NOW+5,delivery.dt.timezone.utc),usegmt=True)
        self.queue=[self.error(429,{"Retry-After":date}),self.response({})]
        self.fetch();self.assertEqual(self.waits,[5])

    def test_secondary_limit_without_headers_waits_at_least_one_minute(self):
        for status in (403,429):
            self.requests=[];self.waits=[];self.elapsed=0
            self.queue=[self.error(status,body=b'{"message":"You have exceeded a secondary rate limit."}'),self.response({})]
            self.fetch()
            self.assertEqual(self.waits,[60])
            self.assertEqual([elapsed for _,_,elapsed in self.requests],[0,60])

    def test_rate_limit_past_reset_never_causes_immediate_retry(self):
        self.queue=[self.error(429,{"Retry-After":"0","X-RateLimit-Remaining":"0",
                                  "X-RateLimit-Reset":str(NOW-1)}),self.response({})]
        self.fetch();self.assertEqual(self.waits,[1])

    def test_rate_limit_over_budget_or_invalid_instructions_stop_without_retry(self):
        for headers in ({"Retry-After":"66"},{"Retry-After":"invalid"},{"Retry-After":"-1"},
                        {"X-RateLimit-Remaining":"0","X-RateLimit-Reset":str(NOW+500)},
                        {"X-RateLimit-Remaining":"0"},{"X-RateLimit-Remaining":"0","X-RateLimit-Reset":"invalid"}):
            self.requests=[];self.queue=[self.error(429,headers)]
            self.rejected("CERTIFICATION_RATE_LIMITED",self.fetch)
            self.assertEqual(len(self.requests),1);self.assertFalse(self.waits)

    def test_repeated_rate_limit_stops_at_wait_budget(self):
        self.queue=[self.error(429),self.error(429),self.response({})]
        self.rejected("CERTIFICATION_RATE_LIMITED",self.fetch)
        self.assertEqual(len(self.requests),2);self.assertEqual(self.waits,[60])

    def test_temporary_server_failures_retry_with_fixed_exponential_bounds(self):
        for status in (500,502,503,504):
            self.requests=[];self.waits=[];self.elapsed=0
            self.queue=[self.error(status),self.error(status),self.response({"validated":"synthetic"})]
            self.assertEqual(self.fetch(),{"validated":"synthetic"})
            self.assertEqual(self.waits,[1,2]);self.assertEqual(len(self.requests),3)

    def test_persistent_availability_failure_is_fixed_and_bounded(self):
        self.queue=[self.error(503),self.error(503),self.error(503)]
        self.rejected("CERTIFICATION_API_UNAVAILABLE",self.fetch)
        self.assertEqual(len(self.requests),3);self.assertEqual(self.waits,[1,2])

    def test_temporary_server_retry_after_cannot_be_ignored(self):
        self.queue=[self.error(503,{"Retry-After":"4"}),self.response({})]
        self.fetch();self.assertEqual(self.waits,[4])

    def test_timeout_recovery_and_exhaustion_are_distinct_from_api_failure(self):
        self.queue=[socket.timeout("PRIVATE_RAW"),urllib.error.URLError(socket.timeout("PRIVATE_RAW")),self.response({})]
        self.fetch();self.assertEqual(self.waits,[1,2])
        self.requests=[];self.waits=[];self.elapsed=0
        self.queue=[socket.timeout("PRIVATE_RAW") for _ in range(3)]
        self.rejected("CERTIFICATION_NETWORK_TIMEOUT",self.fetch)
        self.assertEqual(len(self.requests),3)

    def test_non_timeout_network_and_nontransient_http_failures_are_not_retried(self):
        for failure,category in ((urllib.error.URLError("PRIVATE_DNS"),"CERTIFICATION_NETWORK_FAILED"),
                                 (OSError("PRIVATE_TLS"),"CERTIFICATION_NETWORK_FAILED"),
                                 (self.error(404),"CERTIFICATION_API_REJECTED"),
                                 (self.error(422),"CERTIFICATION_API_REJECTED"),
                                 (self.error(501),"CERTIFICATION_API_REJECTED")):
            self.requests=[];self.queue=[failure]
            self.rejected(category,self.fetch)
            self.assertEqual(len(self.requests),1);self.assertFalse(self.waits)

    def test_overall_request_deadline_prevents_more_requests(self):
        self.queue=[self.error(503)]
        times=iter([0,0,90])
        self.rejected("CERTIFICATION_API_UNAVAILABLE",lambda:self.fetch(monotonic=lambda:next(times)))
        self.assertEqual(len(self.requests),1);self.assertFalse(self.waits)

    def test_malformed_json_duplicate_keys_wrong_type_content_and_pagination_are_not_retried(self):
        for raw in (b"PRIVATE_NOT_JSON",b'{"id":1,"id":2}',b"[]",b"null",b"\xff"):
            self.requests=[];self.queue=[self.response(raw=raw)]
            self.rejected("CERTIFICATION_RESPONSE_INVALID",self.fetch)
            self.assertEqual(len(self.requests),1);self.assertFalse(self.waits)
        for headers in ({"Content-Type":"text/html"},{"Content-Type":"application/json","Link":"PRIVATE_NEXT_URL"},{}):
            self.requests=[];self.queue=[self.response({},headers=headers)]
            self.rejected("CERTIFICATION_RESPONSE_INVALID",self.fetch)
            self.assertEqual(len(self.requests),1)

    def test_truncated_http_body_and_declared_length_mismatch_are_incomplete_response(self):
        self.queue=[delivery.http.client.IncompleteRead(b"PRIVATE_PARTIAL_BODY",100)]
        self.rejected("CERTIFICATION_RESPONSE_INVALID",self.fetch)
        for length in ("100","invalid","-1"):
            self.requests=[];self.queue=[self.response({},headers={
                "Content-Type":"application/json","Content-Length":length})]
            self.rejected("CERTIFICATION_RESPONSE_INVALID",self.fetch)
            self.assertEqual(len(self.requests),1)
        self.requests=[];self.queue=[self.response({},headers={
            "Content-Type":"application/json","Content-Length":"2"})]
        self.assertEqual(self.fetch(),{})

    def test_oversized_response_is_not_accepted_or_printed(self):
        self.queue=[self.response(raw=b" "* (delivery.HISTORY_MAX_BYTES+1))]
        self.rejected("CERTIFICATION_RESPONSE_INVALID",self.fetch)

    def test_all_fixed_failure_categories_reach_only_validated_preflight_output(self):
        self.assertEqual(delivery.HISTORY_CATEGORIES,{
            "CERTIFICATION_EVIDENCE_REJECTED","CERTIFICATION_AUTH_FAILED",
            "CERTIFICATION_RATE_LIMITED","CERTIFICATION_API_UNAVAILABLE",
            "CERTIFICATION_NETWORK_TIMEOUT","CERTIFICATION_RESPONSE_INVALID",
            "CERTIFICATION_CONTEXT_REJECTED","CERTIFICATION_NETWORK_FAILED","CERTIFICATION_API_REJECTED"})
        for category in delivery.HISTORY_CATEGORIES:
            record=delivery.preflight_result("P04_CERTIFICATION_HISTORY",False,category)
            self.assertEqual(record["category"],category)
        with self.assertRaises(ValueError):delivery.HistoryFailure("PRIVATE_RAW")

    def test_workflow_changes_are_exactly_read_permission_and_step_scoped_builtin_token(self):
        text=WORKFLOW.read_text()
        before=delivery.cert.git("show",delivery.P04_BASE+":.github/workflows/gridly-storekit-testflight-delivery.yml").decode()
        self.assertEqual(without_p04_auth(restore_archive_block(text)),before)
        self.assertEqual(text.count("GRIDLY_HISTORY_TOKEN:"),1)
        self.assertEqual(text.count("github.token"),1)
        self.assertNotIn("GITHUB_TOKEN:",text)
        self.assertNotRegex(text,r"actions:\s*write|contents:\s*write|permissions:\s*write-all")
        step=text[text.index("      - name: Verify source, build identity input and Xcode\n"):text.index("      - name: Set up Node\n")]
        self.assertIn("GRIDLY_HISTORY_TOKEN:",step)
        self.assertLess(text.index("apple_storekit_testflight_delivery.py authorize"),text.index("GRIDLY_HISTORY_TOKEN:"))
        for mutant in (text.replace("actions: read","actions: write"),text.replace("contents: read","contents: write")):
            with self.assertRaises(AssertionError):without_p04_auth(mutant)

    def test_one_new_child_requires_exactly_two_test_mode_files_and_modes(self):
        records=["M\t"+path for path in sorted(delivery.TEST_MODE_FILES)]
        candidates=[records[:i]+records[i+1:] for i in range(len(records))]
        candidates += [records+[records[0]],["A\t"+p for p in sorted(delivery.TEST_MODE_FILES)],
                       records+["M\tjs/gridly-paid-ui.mjs"],records+["M\ttools/apple_storekit_signing_diagnostic.py"]]
        for candidate in candidates:
            with self.subTest(candidate=candidate),patch.object(delivery.cert,"git",side_effect=source_git(
                    correction="\n".join(candidate).encode())),patch.object(delivery.subprocess,"run"),\
                    patch.object(delivery.cert,"original_contracts"),self.assertRaises(ValueError):
                delivery.source_guard(COMMIT,True)



class WorkflowTests(SyntheticDeliveryTestCase):
    def setUp(self):
        self.text = WORKFLOW.read_text()

    def test_unrelated_delivery_execution_and_security_functions_remain_unchanged(self):
        baseline = delivery.cert.git("show", delivery.PREFLIGHT_BASE + ":tools/apple_storekit_testflight_delivery.py").decode()
        current = (ROOT / "tools/apple_storekit_testflight_delivery.py").read_text()
        functions = lambda source: {node.name: ast.dump(node) for node in ast.parse(normalize_delivery_reporting(source)).body if isinstance(node, (ast.FunctionDef, ast.ClassDef))}
        before, after = functions(baseline), functions(current)
        self.assertEqual(set(after) - set(before), {"preflight_result", "emit_preflight", "delivery_preflight",
                                                  "HistoryFailure", "HistoryNoRedirect", "history_context", "history_retry_delay", "cleanup_delivery",
                                                  "classify_archive", "archive_report", "emit_archive", "cleanup_errno"} | {"owned_runner_directory", "runner_context", "capture_runner_context", "runner_native_environment", "runner_profile", "prepare_signing_context", "install_runner_profile", "verify_runner_profile_ownership", "restore_keychain_context"} | DELIVERY_REPORTING_FUNCTIONS)
        self.assertFalse(set(before) - set(after))
        for name in before.keys() - {"source_guard", "main", "public_json", "historical_evidence", "finish"}:
            self.assertEqual(after[name], before[name], name)
        constants = lambda source: {node.targets[0].id: ast.dump(node.value) for node in ast.parse(source).body
                                    if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name)}
        for name,value in constants(baseline).items():
            self.assertEqual(constants(current)[name],value,name)
        self.assertEqual(delivery.OWNER_CHECK_TTL, 1800)
        old_workflow = delivery.cert.git("show", delivery.PREFLIGHT_BASE + ":.github/workflows/gridly-storekit-testflight-delivery.yml").decode()
        def outside_preflight(text):
            text=text.split("\non:\n",1)[1]
            start=text.index("      - name: Verify source, build identity input and Xcode\n")
            end=text.index("      - name: Set up Node\n",start)
            return text[:start],text[end:]
        old_cms = 'security cms -D -i "$DIAGNOSTIC_PRIVATE_ROOT/distribution.mobileprovision" > "$DIAGNOSTIC_PRIVATE_ROOT/profile.plist"'
        new_cms = 'security cms -D -k "$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db" -i "$DIAGNOSTIC_PRIVATE_ROOT/distribution.mobileprovision" > "$DIAGNOSTIC_PRIVATE_ROOT/profile.plist"'
        self.assertEqual(old_workflow.count(old_cms), 1)
        self.assertEqual(outside_preflight(without_p04_auth(restore_archive_block(self.text))),outside_preflight(old_workflow.replace(old_cms,new_cms)))
        self.assertIn("no_other_eligible_internal_users_confirmed", self.text)
        self.assertIn("BOTH", self.text)

    def test_nonpreflight_cli_modes_are_bytecode_structurally_unchanged(self):
        old=delivery.cert.git("show",delivery.PREFLIGHT_BASE+":tools/apple_storekit_testflight_delivery.py").decode()
        new=(ROOT/"tools/apple_storekit_testflight_delivery.py").read_text()
        def mode(node,value):
            return isinstance(node,ast.If) and isinstance(node.test,ast.Compare) and ast.dump(node.test)==ast.dump(ast.parse("args.mode == "+repr(value),mode="eval").body)
        def normalized(source):
            function=next(node for node in ast.parse(normalize_archive_cli(source)).body if isinstance(node,ast.FunctionDef) and node.name=="main")
            function.body=[node for node in function.body if not mode(node,"preflight")]
            for node in ast.walk(function):
                if mode(node,"authorize") and len(node.orelse)==1 and mode(node.orelse[0],"preflight"):
                    node.orelse=node.orelse[0].orelse
            return ast.dump(function)
        self.assertEqual(normalized(old),normalized(new))

    def test_only_separate_new_tag_can_trigger(self):
        trigger = self.text.split("\non:\n", 1)[1].split("\npermissions:", 1)[0]
        self.assertEqual(trigger.strip(), "push:\n    tags:\n      - 'gridly-storekit-testflight-deliver-15-*'")
        for clause in ["github.event.created == true", "github.event.deleted == false", "github.event.forced == false", "github.run_attempt == 1", "github.repository == 'DBMaps/liberty-county-map'"]:
            self.assertIn(clause, self.text)
        self.assertNotIn("repository.private", self.text)

    def test_full_native_certification_precedes_upload_secret_access(self):
        self.assertLess(self.text.index("python3 -B tools/apple_storekit_diagnostic_certification.py certify"), self.text.index("APPLE_APP_SPECIFIC_PASSWORD:"))
        self.assertLess(self.text.index("apple_storekit_testflight_delivery.py authorize"), self.text.index("secrets."))
        self.assertIn("^Xcode 26([. ]|$)", (ROOT / "tools/apple_storekit_testflight_delivery.py").read_text())
        for value in ["macos-26", "'22'", "GRIDLY_STOREKIT_DIAGNOSTICS", "tests/build14-native-lifecycle.test.py", "tests/apple_native_parity_test.py", "tests/storekit-diagnostics-native.test.py", "activation --build-number"]:
            self.assertIn(value, self.text)

    def test_no_public_artifacts_cache_groups_release_or_old_workflow_changes(self):
        self.assertNotRegex(self.text, r"uses:.*(?:upload-artifact|cache|download-artifact)")
        self.assertNotRegex(self.text, r"\n\s+cache:")
        self.assertNotRegex(self.text, r"(?:pilot|fastlane|appStoreVersions|betaGroups|betaTesters|reviewSubmissions|--submit|--release)")
        self.assertIn("persist-credentials: false", self.text)
        self.assertIn("if: always()", self.text)
        self.assertIn("finish-public", self.text)
        self.assertIn('"git", "clone", "--no-hardlinks", "--branch"', (ROOT / "tools/apple_storekit_testflight_delivery.py").read_text())
        self.assertIn('cd "$DELIVERY_SOURCE_DIR"', self.text)

    def test_all_sensitive_shell_blocks_redirect_before_commands(self):
        blocks = re.findall(r"        run: \|\n((?:(?:          .*)?\n)+)", self.text)
        self.assertEqual(len(blocks), 14)
        for index,block in enumerate(blocks[1:-1],1):
            prefix='          set -euo pipefail\n          set +x\n          umask 077\n'
            self.assertTrue(block.startswith(prefix))
            rest=block[len(prefix):]
            if index==2:
                self.assertTrue(rest.startswith('          # FD 3 carries only validated fixed stage records; raw output stays private.\n          exec 3>&1\n'))
                rest=rest.split('          exec 3>&1\n',1)[1]
            if index==9:
                self.assertTrue(rest.startswith('          # FD 3 carries only the fixed archive classification; raw output stays private.\n          exec 3>&1\n'))
                rest=rest.split('          exec 3>&1\n',1)[1]
            if index==12:
                self.assertTrue(rest.startswith('          # FD 3 carries only fixed delivery stages; raw Apple output stays private.\n          exec 3>&1\n'))
                rest=rest.split('          exec 3>&1\n',1)[1]
            self.assertRegex(rest, r'^          exec > "\$DIAGNOSTIC_PRIVATE_ROOT/logs/step-(?:[1-8]|7-[1-5])\.log" 2>&1\n')
        self.assertEqual(self.text.count("exec 3>&1"),3)
        self.assertIn('--github-env "$GITHUB_ENV" --output',self.text)
        self.assertIn("testFlightInternalTestingOnly", self.text)
        self.assertIn("manageAppVersionAndBuildNumber", self.text)

    def test_each_shell_body_parses_without_running(self):
        bash = Path("C:/Program Files/Git/bin/bash.exe") if os.name == "nt" else Path("/bin/bash")
        blocks = re.findall(r"        run: \|\n((?:(?:          .*)?\n)+)", self.text)
        for block in blocks:
            body = "\n".join(line[10:] if line.startswith("          ") else line for line in block.splitlines()) + "\n"
            subprocess.run([str(bash), "-n"], input=body, text=True, check=True, capture_output=True)



class CmsSigningRepairTests(SyntheticDeliveryTestCase):
    old_cms = 'security cms -D -i "$DIAGNOSTIC_PRIVATE_ROOT/distribution.mobileprovision" > "$DIAGNOSTIC_PRIVATE_ROOT/profile.plist"'
    new_cms = 'security cms -D -k "$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db" -i "$DIAGNOSTIC_PRIVATE_ROOT/distribution.mobileprovision" > "$DIAGNOSTIC_PRIVATE_ROOT/profile.plist"'

    @staticmethod
    def signing_body(text):
        start = text.index("      - name: Install distribution signing\n")
        candidates = [text.find("      - name: " + name, start) for name in
                      ("Archive and export", "Signing identity precheck")]
        end = min(index for index in candidates if index >= 0)
        block = text[start:end].split("        run: |\n", 1)[1]
        return "\n".join(line[10:] for line in block.splitlines()) + "\n"

    def test_only_executable_workflow_change_is_explicit_cms_keychain(self):
        previous = delivery.cert.git("show", delivery.CMS_BASE + ":.github/workflows/gridly-storekit-testflight-delivery.yml").decode()
        current = WORKFLOW.read_text()
        self.assertEqual(previous.count(self.old_cms), 1)
        self.assertEqual(current.count(self.new_cms), 1)
        self.assertNotIn(self.old_cms, current)
        self.assertEqual(without_p04_auth(restore_archive_block(current)).split("\non:\n",1)[1],
                         previous.replace(self.old_cms,self.new_cms).split("\non:\n",1)[1])
        self.assertEqual(self.signing_body(restore_signing_environment(current)), self.signing_body(previous).replace(self.old_cms,self.new_cms))

    def test_cms_uses_the_created_unlocked_import_destination_without_fallback(self):
        body = self.signing_body(WORKFLOW.read_text())
        commands = [line for line in body.splitlines() if line.startswith("security ")]
        cms = [line for line in commands if line.startswith("security cms ")]
        self.assertEqual(cms, [self.new_cms])
        keychain = '"$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db"'
        for prefix in ("security create-keychain ", "security unlock-keychain ", "security import "):
            line = next(line for line in commands if line.startswith(prefix))
            self.assertIn(keychain, line)
            self.assertLess(body.index(line), body.index(self.new_cms))
            if prefix=="security import ":
                self.assertIn("-k " + keychain, line)
        self.assertEqual(body.count("security cms "), 1)
        self.assertNotIn("||", cms[0])
        self.assertIn("set -euo pipefail\n", body)

    def exercise_signing_boundary(self, fail=False, implicit_mutant=False):
        # Execute only the production signing boundary with shell-function fakes.
        # No security/OpenSSL tool, real key, certificate, profile or app is used.
        bash = "C:/Program Files/Git/bin/bash.exe" if os.name=="nt" else "/bin/bash"
        body = self.signing_body(restore_signing_environment(WORKFLOW.read_text()))
        preamble = body[:body.index('test -n "$APPLE_DIST_PRIVATE_KEY_PEM_BASE64"')]
        boundary = body[body.index('security create-keychain '):body.index("PROFILE_NAME=$(")]
        if implicit_mutant:
            boundary=boundary.replace(' -k "$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db" -i ', ' -i ')
        fake = r'''
native_phase=0
security() {
  operation="$1"; shift
  case "$operation" in
    create-keychain)
      last=""
      for value in "$@"; do last="$value"; done
      test "$last" = "$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db" || return 71
      printf OWNED_SYNTHETIC_KEYCHAIN > "$last"
      native_phase=1;;
    unlock-keychain)
      last=""
      for value in "$@"; do last="$value"; done
      test "$native_phase" = 1 && test -f "$last" || return 72
      test "$last" = "$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db" || return 72
      native_phase=2;;
    import)
      test "$native_phase" = 2 || return 73
      import_key=""
      while test "$#" -gt 0; do
        if test "$1" = -k; then shift; import_key="$1"; fi
        shift
      done
      test "$import_key" = "$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db" || return 73
      native_phase=3;;
    set-key-partition-list|list-keychains)
      test "$native_phase" = 3 || return 74;;
    cms)
      test "$native_phase" = 3 || return 75
      cms_key=""
      cms_input=""
      while test "$#" -gt 0; do
        case "$1" in -k) shift; cms_key="$1";; -i) shift; cms_input="$1";; esac
        shift
      done
      test "$cms_key" = "$DIAGNOSTIC_PRIVATE_ROOT/signing.keychain-db" || return 76
      test "$cms_input" = "$DIAGNOSTIC_PRIVATE_ROOT/distribution.mobileprovision" || return 77
      test "$(cat "$cms_input")" = SYNTHETIC_PROFILE_BYTES || return 78
      if test "$FAIL_CMS" = 1; then return 23; fi
      printf SYNTHETIC_PLIST_ONLY;;
    *) return 79;;
  esac
}
'''
        with tempfile.TemporaryDirectory(prefix="gridly-cms-repair-synthetic-") as temporary:
            root=Path(temporary)
            (root/"logs").mkdir();(root/"tmp").mkdir();(root/"runner-context.sh").write_text(":\n")
            for name in ("distribution-private.key","distribution-cert.pem","distribution.p12"):
                (root/name).write_text("SYNTHETIC_PRIVATE_NEVER_PUBLIC")
            (root/"distribution.mobileprovision").write_text("SYNTHETIC_PROFILE_BYTES")
            names=("PATH","SystemRoot","SYSTEMROOT","WINDIR","TEMP","TMP","PATHEXT","COMSPEC","ProgramFiles","PROGRAMFILES")
            env={name:os.environ[name] for name in names if name in os.environ}
            env.update(DIAGNOSTIC_PRIVATE_ROOT=str(root).replace("\\","/"),
                       DELIVERY_SOURCE_DIR=str(root).replace("\\","/"), KEYCHAIN_PASSWORD="SYNTHETIC",
                       TEMP_P12_PASSWORD="SYNTHETIC", FAIL_CMS="1" if fail else "0")
            script=fake+preamble+boundary+'\nprintf VALIDATION_REACHED > "$DIAGNOSTIC_PRIVATE_ROOT/reached"\n'
            result=subprocess.run([bash,"--noprofile","--norc","-e","-o","pipefail"],input=script,text=True,
                                  capture_output=True,env=env)
            expected=76 if implicit_mutant else 23 if fail else 0
            self.assertEqual(result.returncode,expected)
            self.assertEqual((root/"reached").exists(),not (fail or implicit_mutant))
            self.assertTrue(all(not (root/name).exists() for name in
                                ("distribution-private.key","distribution-cert.pem","distribution.p12")))
            self.assertNotIn("SYNTHETIC_PRIVATE_NEVER_PUBLIC",result.stdout+result.stderr)

    def test_actual_boundary_accepts_explicit_imported_identity_keychain(self):
        self.exercise_signing_boundary()

    def test_actual_boundary_rejects_cms_failure_before_profile_validation_and_cleans(self):
        self.exercise_signing_boundary(fail=True)

    def test_synthetic_boundary_detects_an_implicit_keychain_fallback(self):
        self.exercise_signing_boundary(implicit_mutant=True)

    def test_preflight_tooling_and_persist_gates_are_unchanged_outside_history_boundary(self):
        before=ast.parse(delivery.cert.git("show",delivery.P04_BASE+":tools/apple_storekit_testflight_delivery.py"))
        after=ast.parse((ROOT/"tools/apple_storekit_testflight_delivery.py").read_text())
        original=next(n for n in before.body if isinstance(n,ast.FunctionDef) and n.name=="delivery_preflight")
        current=next(n for n in after.body if isinstance(n,ast.FunctionDef) and n.name=="delivery_preflight")
        current.body=[n for n in current.body if not (
            isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name)
            and n.targets[0].id in {"history_token","history_environment"})]
        checked=next(n for n in current.body if isinstance(n,ast.FunctionDef) and n.name=="checked")
        handler=next(n for n in ast.walk(checked) if isinstance(n,ast.ExceptHandler))
        self.assertEqual(handler.name,"failure")
        fixed=ast.parse('if stage == "P04_CERTIFICATION_HISTORY" and isinstance(failure, HistoryFailure):\n    category = failure.category').body[0]
        self.assertEqual(ast.dump(handler.body[0]),ast.dump(fixed))
        handler.name=None;handler.body=handler.body[1:]
        history=next(n for n in current.body if isinstance(n,ast.Assign)
                     and isinstance(n.targets[0],ast.Name) and n.targets[0].id=="history")
        expected=ast.parse('checked("P04_CERTIFICATION_HISTORY", "INTERNAL_FAILURE", lambda: historical_evidence(token=history_token, environment=history_environment))',mode="eval").body
        self.assertEqual(ast.dump(history.value),ast.dump(expected))
        history.value=ast.parse('checked("P04_CERTIFICATION_HISTORY", "CERTIFICATION_EVIDENCE_REJECTED", historical_evidence)',mode="eval").body
        self.assertEqual(ast.dump(current),ast.dump(original))
        # A mutation to any other preflight command, dependency or report must fail.
        changed=copy.deepcopy(current);changed.body.append(ast.Pass())
        self.assertNotEqual(ast.dump(changed),ast.dump(original))

    def test_existing_functions_and_controls_are_unchanged_outside_p04(self):
        before=delivery.cert.git("show",delivery.P04_BASE+":tools/apple_storekit_testflight_delivery.py").decode()
        after=(ROOT/"tools/apple_storekit_testflight_delivery.py").read_text()
        functions=lambda text:{node.name:ast.dump(node) for node in ast.parse(normalize_delivery_reporting(text)).body if isinstance(node,(ast.FunctionDef,ast.ClassDef))}
        original,current=functions(before),functions(after)
        self.assertEqual(set(current)-set(original),
                         {"HistoryFailure","HistoryNoRedirect","history_context","history_retry_delay","cleanup_delivery",
                          "classify_archive","archive_report","emit_archive","cleanup_errno"} | {"owned_runner_directory", "runner_context", "capture_runner_context", "runner_native_environment", "runner_profile", "prepare_signing_context", "install_runner_profile", "verify_runner_profile_ownership", "restore_keychain_context"} | DELIVERY_REPORTING_FUNCTIONS)
        self.assertFalse(set(original)-set(current))
        for name in original.keys()-{"source_guard","public_json","historical_evidence","delivery_preflight","finish","main"}:
            self.assertEqual(original[name],current[name],name)
        nodes=lambda text:{n.targets[0].id:n.value for n in ast.parse(text).body
                           if isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name)}
        old,new=nodes(before),nodes(after)
        self.assertEqual(set(new)-set(old),{"UPLOADER_REPAIR_BASE","_UPLOAD_RUN","CERTIFIED_BASE","SOLO_OWNER_BASE","SOLO_OWNER_ATTEST_BASE","SOLO_OWNER_FIX_BASE","FAILED_AUTH_BASE","FAILED_AUTH_TAG","FAILED_AUTH_TAG_OBJECT","SOLO_OWNER_UI_METHOD","SOLO_OWNER_UI_CONFIRMATIONS","PRIOR_ATTEMPT_FIELD","PRIOR_ATTEMPT_RUN","PRIOR_ATTEMPT_CONFIRMATIONS","SAFETY_FILES","UPLOAD_BASE","UPLOAD_ERROR_CATEGORIES","APPLE_ID_BASE","TEST_MODE_FILES","AUTH_BASE","APPLE_ID_AUTH_FIELD","UI_UNUSED_METHOD","UI_UNUSED_CONFIRMATIONS","TRANSFER_BASE","DELIVERY_STAGES","DELIVERY_STAGE_FAILURES","DELIVERY_CATEGORIES","P04_BASE","ARCHIVE_BASE","EVIDENCE_BASE","ENVIRONMENT_BASE","ARCHIVE_RULES","ARCHIVE_MAX_BYTES","ARCHIVE_STRUCTURED_STATES","HISTORY_CATEGORIES","HISTORY_ATTEMPTS",
                         "HISTORY_WAIT_BUDGET","HISTORY_DEADLINE","HISTORY_TIMEOUT","HISTORY_MAX_BYTES"})
        for name,node in old.items():
            if name=="HISTORICAL_TAGS":
                self.assertIsInstance(new[name],ast.Dict)
                self.assertEqual(len(new[name].keys),15)
                retained=ast.Dict(keys=new[name].keys[:7],values=new[name].values[:7])
                self.assertEqual(ast.dump(node),ast.dump(retained))
            elif name=="PREFLIGHT_CATEGORIES":
                self.assertEqual(delivery.PREFLIGHT_CATEGORIES,ast.literal_eval(node)|delivery.HISTORY_CATEGORIES)
            else:self.assertEqual(ast.dump(node),ast.dump(new[name]),name)
        self.assertEqual(delivery.OWNER_CHECK_TTL,1800)

    def test_exact_reviewed_history_and_all_fifteen_authorization_tags(self):
        self.assertEqual(delivery.REFINEMENT_BASE,"4c95caed0d261fca1dbaf86fc926660661d0643b")
        self.assertEqual(delivery.SIGNING_BASE,"db4df3949b1f02325b8869433bbbd16b234487db")
        self.assertEqual(delivery.CMS_BASE,"cbe3c297099dbca9c6d376848157de0253aeae39")
        self.assertEqual(delivery.CMS_REPAIR_BASE,"17e36af1f5a8cc5f7f8ed927fb3e7fae758ee991")
        self.assertEqual(delivery.SIGNING_VERIFIED_BASE,"b1e2b7a35dff887dfa4a464a19215b66893b0ee8")
        self.assertEqual(delivery.SIGNING_VERIFICATION_FILES,{"tools/apple_storekit_signing_diagnostic.py",
            "tests/storekit-signing-diagnostic.test.py","tests/storekit-testflight-delivery.test.py"})
        self.assertEqual(delivery.DELIVERY_ALIGNMENT_FILES,{"tools/apple_storekit_testflight_delivery.py",
            "tests/storekit-testflight-delivery.test.py"})
        expected={
            "gridly-storekit-diagnostic-certify-15-f9fc818321970b8b7e29df17358daf87a7d20308":
                ("bb496cafcbeaf7d6aaf6574e6b5561ac242599fc",delivery.SOURCE),
            "gridly-storekit-testflight-deliver-15-45bfe026b81f4928caceb9632cbf15e7ed842a25":
                ("15a2d8093f31ccaea515b715e604c803d89af469",delivery.OWNER_CORRECTION),
            "gridly-storekit-preflight-15-13e73183cf3f257fbc9acd9a32d34d62b70ffb1e":
                ("41b9592697daf7898b66dd582b6da3af5dc8412d",delivery.PREFLIGHT_BASE),
            "gridly-storekit-testflight-deliver-15-4c95caed0d261fca1dbaf86fc926660661d0643b":
                ("e6425dadac56501e8b389efecd5c50d95501d823",delivery.REFINEMENT_BASE),
            "gridly-storekit-signing-diagnostic-15-db4df3949b1f02325b8869433bbbd16b234487db":
                ("ffa6924f2ec257f42a183f8f05daaccc66b85685",delivery.SIGNING_BASE),
            "gridly-storekit-cms-diagnostic-15-cbe3c297099dbca9c6d376848157de0253aeae39":
                ("975205d798d31197be41fe505a417064b519b63f",delivery.CMS_BASE),
            "gridly-storekit-signing-diagnostic-15-b1e2b7a35dff887dfa4a464a19215b66893b0ee8":
                ("0ec2230f6c42b4212afa18bf71d3045a0c978be3",delivery.SIGNING_VERIFIED_BASE),
        }
        expected["gridly-storekit-testflight-deliver-15-40824c760a65b56b1b0056d1d9b90d571b7f47d4"]=(
            "06dbef1c5ae5f5250b536d8f3b6232487b114f56",delivery.P04_BASE)
        self.assertEqual(delivery.P04_BASE,"40824c760a65b56b1b0056d1d9b90d571b7f47d4")
        expected["gridly-storekit-testflight-deliver-15-45ce66b98b44bd6cea67820124e695483e7a6b9b"]=(
            "e71cf11b1fbca960527ad019762a12cb68b25600",delivery.ARCHIVE_BASE)
        self.assertEqual(delivery.ARCHIVE_BASE,"45ce66b98b44bd6cea67820124e695483e7a6b9b")
        expected["gridly-storekit-testflight-deliver-15-779d67c7b89569db7cacb6a253eff6da8d3f74ef"]=(
            "69876691a5c1e996ac099edb492c75fbd6b99696",delivery.EVIDENCE_BASE)
        self.assertEqual(delivery.EVIDENCE_BASE,"779d67c7b89569db7cacb6a253eff6da8d3f74ef")
        self.assertEqual(delivery.ENVIRONMENT_BASE,"b27d780e3148a903917b7a05595f17006f1ab8e0")
        expected["gridly-storekit-testflight-deliver-15-"+delivery.ENVIRONMENT_BASE]=("c8a561e739bff54346c75864042d65b08b1b9b4e",delivery.ENVIRONMENT_BASE)
        self.assertEqual(delivery.TRANSFER_BASE,"2cca00a2248e9a0c04ef5173e3364709a517f31e")
        expected["gridly-storekit-testflight-deliver-15-"+delivery.TRANSFER_BASE]=("7f756b44328fa46edccf8b4f4242460617382621",delivery.TRANSFER_BASE)
        self.assertEqual(delivery.AUTH_BASE,"03620e25ed19fc70ab9e493627fb84c4b9a3617c")
        expected["gridly-storekit-testflight-deliver-15-"+delivery.AUTH_BASE]=("4e9510666f0a51bdc9209a877e6dd420677abb7d",delivery.AUTH_BASE)
        self.assertEqual(delivery.APPLE_ID_BASE,"0c17376475cf76798d553e7b9717543056df1595")
        expected["gridly-storekit-testflight-deliver-15-"+delivery.APPLE_ID_BASE]=("554bcf82c8b6aae6e99a610ace4b2d4977c0e999",delivery.APPLE_ID_BASE)
        self.assertEqual(delivery.UPLOAD_BASE,"54cbf359ac73225d0354491409533d1ea613d885")
        expected["gridly-storekit-testflight-deliver-15-"+delivery.UPLOAD_BASE]=("5d23842099145de5b955f4d0e21efa5a60a2a82f",delivery.UPLOAD_BASE)
        self.assertEqual(delivery.HISTORICAL_TAGS,expected)
        for child,parent in ((delivery.UPLOAD_BASE,delivery.APPLE_ID_BASE), (delivery.APPLE_ID_BASE,delivery.AUTH_BASE), (delivery.AUTH_BASE,delivery.TRANSFER_BASE),
                             (delivery.TRANSFER_BASE,delivery.ENVIRONMENT_BASE),
                             (delivery.ENVIRONMENT_BASE,delivery.EVIDENCE_BASE),
                             (delivery.EVIDENCE_BASE,delivery.ARCHIVE_BASE),
                             (delivery.ARCHIVE_BASE,delivery.P04_BASE),
                             (delivery.P04_BASE,delivery.SIGNING_VERIFIED_BASE),
                             (delivery.SIGNING_VERIFIED_BASE,delivery.CMS_REPAIR_BASE),
                             (delivery.CMS_REPAIR_BASE,delivery.CMS_BASE),(delivery.CMS_BASE,delivery.SIGNING_BASE),(delivery.SIGNING_BASE,delivery.REFINEMENT_BASE),
                             (delivery.REFINEMENT_BASE,delivery.PREFLIGHT_BASE)):
            self.assertEqual(delivery.cert.git("show","-s","--format=%P",child).decode().strip(),parent)
        for commit,files in ((delivery.SIGNING_BASE,delivery.SIGNING_FILES),(delivery.CMS_BASE,delivery.CMS_FILES)):
            for path in files:
                historical = delivery.cert.git("show",commit+":"+path)
                self.assertEqual(historical, delivery.cert.git("show",delivery.CMS_BASE+":"+path),path)
                if path not in {"tools/apple_storekit_signing_diagnostic.py","tests/storekit-signing-diagnostic.test.py"}:
                    self.assertEqual((ROOT/path).read_bytes().replace(b"\r\n",b"\n"),historical,path)
        checkpoint=delivery.FAILED_AUTH_BASE
        support={"tools/apple_storekit_testflight_delivery.py","tests/storekit-testflight-delivery.test.py"}
        self.assertEqual(support,delivery.TEST_MODE_FILES)
        def git(*args):
            return delivery.cert.git(*args).decode().strip()
        rows=git("diff","--name-status","--no-renames",checkpoint).splitlines()
        self.assertEqual(delivery.CERTIFIED_BASE,"685d6e70f79792d828a093e5427f76acbeee6341")
        self.assertEqual(git("show","-s","--format=%P",checkpoint),delivery.SOLO_OWNER_FIX_BASE)
        self.assertEqual(git("show","-s","--format=%P",delivery.SOLO_OWNER_FIX_BASE),delivery.SOLO_OWNER_ATTEST_BASE)
        self.assertEqual(git("show","-s","--format=%P",delivery.SOLO_OWNER_ATTEST_BASE),delivery.SOLO_OWNER_BASE)
        self.assertEqual(git("show","-s","--format=%P",delivery.SOLO_OWNER_BASE),delivery.CERTIFIED_BASE)
        for earlier,later in ((delivery.CERTIFIED_BASE,delivery.SOLO_OWNER_BASE),
                              (delivery.SOLO_OWNER_BASE,delivery.SOLO_OWNER_ATTEST_BASE),
                              (delivery.SOLO_OWNER_ATTEST_BASE,delivery.SOLO_OWNER_FIX_BASE),
                              (delivery.SOLO_OWNER_FIX_BASE,checkpoint)):
            self.assertEqual(git("diff","--name-status","--no-renames",earlier,later).splitlines(),["M\t"+path for path in sorted(support)])
        historical=git("diff","--name-status","--no-renames",delivery.UPLOAD_BASE,checkpoint).splitlines()
        self.assertEqual(set(historical),{"M\t"+path for path in support}|{"A\t"+path for path in delivery.SAFETY_FILES})
        self.assertEqual(len(historical),3)
        self.assertEqual(delivery.SAFETY_FILES,{".github/workflows/gridly-storekit-macos-safety-tests.yml"})
        self.assertEqual(set(rows),{"M\t"+path for path in support})
        self.assertEqual(len(rows),2)
        self.assertFalse(git("diff","--cached","--name-only"))
        self.assertFalse(git("ls-files","--others","--exclude-standard"))
        head=git("rev-parse","HEAD")
        self.assertFalse(git("status","--porcelain=v1","--untracked-files=all"))
        self.assertEqual(git("show","-s","--format=%P",head),delivery.UPLOADER_REPAIR_BASE)
        delivery.source_guard(head,True)
        for path in support:
            entry=git("ls-files","--stage","--",path).split()
            self.assertEqual((entry[0],entry[2]),("100644","0"))
            self.assertEqual(git("ls-tree",head,"--",path).split()[0],"100644")
        # Keep the signed b1 checkpoint byte-identical in the current candidate.
        # Its earlier three-file gate alignment is historical evidence only.
        for path in ("tools/apple_storekit_signing_diagnostic.py","tests/storekit-signing-diagnostic.test.py"):
            self.assertEqual((ROOT/path).read_bytes().replace(b"\r\n",b"\n"),
                             delivery.cert.git("show",checkpoint+":"+path),path)
        helper="tools/apple_storekit_signing_diagnostic.py"
        before=ast.parse(delivery.cert.git("show",delivery.CMS_REPAIR_BASE+":"+helper))
        after=ast.parse(delivery.cert.git("show",checkpoint+":"+helper))
        auth_constants={"SOURCE","DELIVERY","OWNER","PREFLIGHT","SIGNING","CMS","REPAIR","SUPPORT_FILES",
                        "DELIVERY_FILES","PREFLIGHT_FILES","CMS_FILES","HISTORICAL_INVENTORIES","CHAIN","HISTORY"}
        def strip_authorization(tree):
            tree=copy.deepcopy(tree)
            tree.body=[node for node in tree.body if not
                (isinstance(node,ast.FunctionDef) and node.name=="source_guard") and not
                (isinstance(node,ast.Assign) and isinstance(node.targets[0],ast.Name)
                 and node.targets[0].id in auth_constants)]
            return ast.dump(tree)
        self.assertEqual(strip_authorization(before),strip_authorization(after))
        # Mutation checks prove native/security functions and controls stay protected.
        for function in ("signing_script","run_signing","cleanup","authorization","authorize","emit","child_environment"):
            mutant=copy.deepcopy(after)
            node=next(n for n in mutant.body if isinstance(n,ast.FunctionDef) and n.name==function)
            node.body.append(ast.Pass())
            self.assertNotEqual(strip_authorization(before),strip_authorization(mutant),function)
        mutant=copy.deepcopy(after)
        node=next(n for n in mutant.body if isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name)
                  and n.targets[0].id=="INPUTS")
        node.value=ast.Constant(value="UNAPPROVED_SECRET_CHANGE")
        self.assertNotEqual(strip_authorization(before),strip_authorization(mutant))
        tests="tests/storekit-signing-diagnostic.test.py"
        before=ast.parse(delivery.cert.git("show",delivery.CMS_REPAIR_BASE+":"+tests))
        after=ast.parse(delivery.cert.git("show",checkpoint+":"+tests))
        allowed={"source_git","test_exact_three_additions_and_all_history_pass",
                 "test_exact_three_successor_modifications_and_all_history_pass",
                 "test_extra_missing_renamed_modified_or_duplicate_inventory_fails",
                 "test_extra_commits_merges_wrong_parents_and_dirty_source_fail",
                 "test_all_three_modes_must_remain_100644",
                 "test_existing_tracked_runtime_workflows_and_baseline_are_unchanged",
                 "test_older_tags_and_branch_pushes_cannot_match_new_workflow",
                 "test_reviewed_successor_constants_history_and_inventories_are_exact",
                 "test_each_historical_inventory_and_mode_change_fails_closed",
                 "test_only_source_authorization_changes_preserve_all_native_and_security_functions"}
        def strip_source_expectations(tree):
            tree=copy.deepcopy(tree)
            tree.body=[n for n in tree.body if not (isinstance(n,ast.FunctionDef) and n.name in allowed)]
            for node in ast.walk(tree):
                if isinstance(node,ast.ClassDef):
                    node.body=[n for n in node.body if not (isinstance(n,ast.FunctionDef) and n.name in allowed)]
            return ast.dump(tree)
        self.assertEqual(strip_source_expectations(before),strip_source_expectations(after))

    def test_historical_cms_repair_requires_all_four_reviewed_files_only(self):
        self.assertEqual(delivery.REPAIR_FILES, delivery.FILES | {"tests/storekit-signing-diagnostic.test.py"})
        records=["M\t"+path for path in sorted(delivery.REPAIR_FILES)]
        bad=[records[:i]+records[i+1:] for i in range(4)]
        bad += [records+[records[0]],["A\t"+path for path in sorted(delivery.REPAIR_FILES)],
                records+["M\tjs/gridly-paid-ui.mjs"],
                records+["M\ttools/apple_storekit_signing_diagnostic.py"],
                records+["M\ttests/storekit-preflight-diagnostic.test.py"]]
        for candidate in bad:
            with self.subTest(candidate=candidate),patch.object(delivery.cert,"git",side_effect=source_git(
                    repair_inventory="\n".join(candidate).encode())),patch.object(delivery.subprocess,"run"),\
                    patch.object(delivery.cert,"original_contracts"),self.assertRaises(ValueError):
                delivery.source_guard(COMMIT,True)

    def test_historical_alignment_requires_exactly_two_modified_delivery_files(self):
        records=["M\t"+p for p in sorted(delivery.DELIVERY_ALIGNMENT_FILES)]
        candidates=[records[:-1],records[1:],records+[records[0]],
                    ["A\t"+p for p in sorted(delivery.DELIVERY_ALIGNMENT_FILES)]]
        for path in ("js/gridly-paid-ui.mjs","tools/apple_storekit_signing_diagnostic.py",
                     "tests/storekit-signing-diagnostic.test.py",
                     ".github/workflows/gridly-storekit-testflight-delivery.yml",
                     ".github/workflows/gridly-apple-build-9.yml"):
            candidates.append(records+["M\t"+path])
        for candidate in candidates:
            with self.subTest(candidate=candidate),patch.object(delivery.cert,"git",side_effect=source_git(
                    alignment_inventory="\n".join(candidate).encode())),patch.object(delivery.subprocess,"run"),\
                    patch.object(delivery.cert,"original_contracts"),self.assertRaises(ValueError):
                delivery.source_guard(COMMIT,True)

    def test_signing_verification_inventory_and_each_historical_mode_fail_closed(self):
        records=["M\t"+p for p in sorted(delivery.SIGNING_VERIFICATION_FILES)]
        candidates=[records[:-1],records+[records[0]],records+["M\tjs/gridly-paid-ui.mjs"],
                    ["A\t"+p for p in sorted(delivery.SIGNING_VERIFICATION_FILES)]]
        for candidate in candidates:
            with self.subTest(candidate=candidate),patch.object(delivery.cert,"git",side_effect=source_git(
                    verification_inventory="\n".join(candidate).encode())),patch.object(delivery.subprocess,"run"),\
                    patch.object(delivery.cert,"original_contracts"),self.assertRaises(ValueError):
                delivery.source_guard(COMMIT,True)
        historical=((delivery.DELIVERY_BASE,delivery.FILES),(delivery.OWNER_CORRECTION,delivery.FILES),
                    (delivery.PREFLIGHT_BASE,delivery.PREFLIGHT_FILES),(delivery.REFINEMENT_BASE,delivery.REFINEMENT_FILES),
                    (delivery.SIGNING_BASE,delivery.SIGNING_FILES),(delivery.CMS_BASE,delivery.CMS_FILES),
                    (delivery.CMS_REPAIR_BASE,delivery.REPAIR_FILES),
                    (delivery.SIGNING_VERIFIED_BASE,delivery.SIGNING_VERIFICATION_FILES),
                    (delivery.P04_BASE,delivery.DELIVERY_ALIGNMENT_FILES),
                         (delivery.ARCHIVE_BASE,delivery.FILES),
                         (delivery.EVIDENCE_BASE,delivery.FILES), (delivery.ENVIRONMENT_BASE,delivery.FILES), (delivery.TRANSFER_BASE,delivery.FILES), (delivery.AUTH_BASE,delivery.FILES), (delivery.APPLE_ID_BASE,delivery.FILES))
        valid=source_git()
        for target,files in historical:
            for path in files:
                for mode in ("100755","120000"):
                    def changed(*args):
                        if args==("ls-tree",target,"--",path):
                            return (mode+" blob "+"0"*40+"\t"+path).encode()
                        return valid(*args)
                    with self.subTest(target=target,path=path,mode=mode),patch.object(delivery.cert,"git",side_effect=changed),\
                            patch.object(delivery.subprocess,"run"),patch.object(delivery.cert,"original_contracts"),self.assertRaises(ValueError):
                        delivery.source_guard(COMMIT,True)

    def test_historical_signing_and_cms_inventory_changes_are_rejected(self):
        for options in ({"signing_inventory":b""},{"cms_inventory":b""},
                        {"signing_inventory":b"A\tjs/gridly-paid-ui.mjs"},
                        {"cms_inventory":b"M\ttools/apple_storekit_cms_diagnostic.py"}):
            with self.subTest(options=options),patch.object(delivery.cert,"git",side_effect=source_git(**options)),\
                    patch.object(delivery.subprocess,"run"),patch.object(delivery.cert,"original_contracts"),self.assertRaises(ValueError):
                delivery.source_guard(COMMIT,True)


ARCHIVE_NAMES = ("Signing identity precheck", "Xcode build-settings query", "Xcode archive",
                 "Internal-only IPA export", "Signed IPA certification")


def archive_stages(text):
    start = text.index("      - name: " + ARCHIVE_NAMES[0] + "\n")
    end = text.index("      - name: Validate availability and deliver only", start)
    blocks = re.split(r"(?=      - name: )", text[start:end])[1:]
    if len(blocks) != 5:
        raise AssertionError("exactly five native Actions stages required")
    for name, block in zip(ARCHIVE_NAMES, blocks):
        if not block.startswith("      - name: " + name + "\n        shell: bash\n        run: |\n"):
            raise AssertionError("default success gating and exact stage order required")
    return start, end, blocks


def restore_archive_block(text):
    """Reverse ONLY the reviewed split after checking every private command byte."""
    text = restore_archive_reporting(text)
    start, end, blocks = archive_stages(text)
    historical = delivery.cert.git("show", delivery.ARCHIVE_BASE + ":" + str(WORKFLOW.relative_to(ROOT)).replace("\\","/")).decode()
    old_start = historical.index("      - name: Archive and export isolated diagnostic artifact locally\n")
    old_end = historical.index("      - name: Validate availability and deliver only", old_start)
    original = historical[old_start:old_end]
    original_body = original.split("        run: |\n",1)[1]
    common = ('          set -euo pipefail\n          set +x\n          umask 077\n'
              '          exec > "$DIAGNOSTIC_PRIVATE_ROOT/logs/step-7.log" 2>&1\n'
              '          cd "$DELIVERY_SOURCE_DIR"\n          export TMPDIR="$DIAGNOSTIC_PRIVATE_ROOT/tmp/"\n')
    assert original_body.startswith(common)
    commands=[]
    archive_line='          archive="$DIAGNOSTIC_PRIVATE_ROOT/Gridly-StoreKit-Diagnostic-$DIAGNOSTIC_BUILD_NUMBER.xcarchive"\n'
    for index,block in enumerate(blocks,1):
        body=block.split("        run: |\n",1)[1]
        prefix=common.replace("step-7.log","step-7-"+str(index)+".log")
        assert body.startswith(prefix)
        body=body[len(prefix):]
        if index in (3,4,5):
            assert body.startswith(archive_line)
            body=body[len(archive_line):]
        if index==2:
            assert body.startswith("          xcode_status=0\n")
            body=body.removeprefix("          xcode_status=0\n")
            capture=(' > "$DIAGNOSTIC_PRIVATE_ROOT/logs/build-settings-raw.log" 2>&1 || xcode_status=$?\n'
                     '          if [ "$xcode_status" -ne 0 ]; then exit "$xcode_status"; fi\n          awk ')
            assert body.count(capture)==1
            body=body.replace(capture," 2>&1 | \\\n            awk ",1)
            raw=' "$DIAGNOSTIC_PRIVATE_ROOT/logs/build-settings-raw.log" > '
            assert body.count(raw)==1
            body=body.replace(raw," > ",1)
            body=archive_line+body
        commands.append(body)
    assert common+"".join(commands)==original_body, "archive commands, settings filter or export policy changed"
    return text[:start]+original+text[end:]


class ArchiveStageVisibilityTests(SyntheticDeliveryTestCase):
    def test_exact_stage_split_preserves_every_original_command_and_other_workflow_bytes(self):
        before=delivery.cert.git("show",delivery.ARCHIVE_BASE+":"+str(WORKFLOW.relative_to(ROOT)).replace("\\","/")).decode()
        self.assertEqual(restore_archive_block(WORKFLOW.read_text()),before)

    def test_all_five_stages_and_upload_use_native_default_success_gating(self):
        text=WORKFLOW.read_text()
        start,end,blocks=archive_stages(text)
        transfer=text[end:text.index("      - name: Remove all private outputs",end)]
        for block in [*blocks,transfer]:
            self.assertNotIn("continue-on-error",block)
            self.assertNotIn("        if:",block)
            self.assertIn("          set -euo pipefail\n",block)
        self.assertLess(text.index(ARCHIVE_NAMES[-1]),text.index("APPLE_APP_SPECIFIC_PASSWORD:"))

    def exercise(self, failed):
        # Execute real workflow Bash boundaries with shell-function fakes ONLY.
        # No native tools, real signed material, application build or Apple API.
        bash="C:/Program Files/Git/bin/bash.exe" if os.name=="nt" else "/bin/bash"
        _,_,blocks=archive_stages(WORKFLOW.read_text())
        identity=re.search(r"grep -Fq '([^']+)'",blocks[0]).group(1)
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            for name in ("logs","reports","source","tmp"):
                (root/name).mkdir()
            (root/"runner-context.sh").write_text(":\n")
            posix=lambda path:str(path).replace("\\","/")
            environment={**os.environ,"DIAGNOSTIC_PRIVATE_ROOT":posix(root),
                         "DELIVERY_SOURCE_DIR":posix(root/"source"),"DIAGNOSTIC_BUILD_NUMBER":"15",
                         "EXPECTED_COMMIT_SHA":COMMIT,"TEAM_ID":"SYNTHETIC","PROFILE_NAME":"SYNTHETIC",
                         "TRACE":posix(root/"trace"),"FAKE_ID":identity,"FAIL_STAGE":str(failed),"RUNNER_TEMP":posix(root)}
            fakes=r"""
security() {
  printf 'identity\n' >> "$TRACE"
  printf '%s\n' "$FAKE_ID"
  printf 'SYNTHETIC_PRIVATE_ERROR\n' >&2
  if [ "$FAIL_STAGE" = 1 ]; then return 37; fi
}
xcodebuild() {
  local phase=archive stage=3 code=66
  case " $* " in
    *" -showBuildSettings "*) phase=settings; stage=2; code=65 ;;
    *" -exportArchive "*) phase=export; stage=4; code=67 ;;
  esac
  printf '%s\n' "$phase" >> "$TRACE"
  printf 'Build settings for action build and target App:\n CURRENT_PROJECT_VERSION = 15\n'
  printf 'SYNTHETIC_PRIVATE_ERROR\n' >&2
  if [ "$FAIL_STAGE" = "$stage" ]; then return "$code"; fi
  if [ "$stage" = 4 ]; then
    mkdir "$DIAGNOSTIC_PRIVATE_ROOT/gridly-diagnostic-export"
    printf SYNTHETIC > "$DIAGNOSTIC_PRIVATE_ROOT/gridly-diagnostic-export/synthetic.ipa"
  fi
}
awk() { printf 'filter\n' >> "$TRACE"; command awk "$@"; }
python3() {
  case " $* " in *" archive-public "*) return 0 ;; esac
  printf 'certification\n' >> "$TRACE"
  printf 'SYNTHETIC_PRIVATE_ERROR\n' >&2
  if [ "$FAIL_STAGE" = 5 ]; then return 68; fi
}
"""
            results=[]
            for block in blocks:
                body="\n".join(line[10:] for line in block.split("        run: |\n",1)[1].splitlines())+"\n"
                result=subprocess.run([bash],input=fakes+body,text=True,env=environment,capture_output=True)
                results.append(result.returncode)
                self.assertEqual(result.stdout,"")
                self.assertEqual(result.stderr,"")
                if result.returncode:
                    break  # Actions default success() semantics, verified above.
            trace=(root/"trace").read_text().splitlines()
            return results,trace,(root/"reports/storekit-diagnostic-build-settings.txt").exists()

    def test_each_first_failure_retains_real_exit_and_blocks_all_later_stages(self):
        codes=(37,65,66,67,68)
        traces=[["identity"],["identity","settings"],["identity","settings","filter","archive"],
                ["identity","settings","filter","archive","export"],
                ["identity","settings","filter","archive","export","certification"]]
        for stage,code in enumerate(codes,1):
            with self.subTest(stage=stage):
                results,trace,settings=self.exercise(stage)
                self.assertEqual(results,[0]*(stage-1)+[code])
                self.assertEqual(trace,traces[stage-1])
                self.assertEqual(settings,stage>=3)

    def test_success_runs_all_five_boundaries_in_original_order(self):
        results,trace,settings=self.exercise(0)
        self.assertEqual(results,[0]*5)
        self.assertEqual(trace,["identity","settings","filter","archive","export","certification"])
        self.assertTrue(settings)

    def test_settings_capture_cannot_be_replaced_by_a_successful_pipeline(self):
        text=WORKFLOW.read_text()
        mutant=text.replace(' || xcode_status=$?\n',' | cat\n',1)
        with self.assertRaises(AssertionError):restore_archive_block(mutant)

    def test_native_or_export_command_mutations_cannot_pass_preservation(self):
        text=WORKFLOW.read_text()
        for old,new in (("-destination 'generic/platform=iOS'","-destination OTHER"),
                        ("<key>testFlightInternalTestingOnly</key><true/>",
                         "<key>testFlightInternalTestingOnly</key><false/>"),
                        ("CURRENT_PROJECT_VERSION=\"$DIAGNOSTIC_BUILD_NUMBER\"","CURRENT_PROJECT_VERSION=16")):
            with self.subTest(old=old),self.assertRaises(AssertionError):
                restore_archive_block(text.replace(old,new,1))

    def test_cleanup_proof_logic_and_upload_path_remain_structurally_unchanged(self):
        old=delivery.cert.git("show",delivery.ARCHIVE_BASE+":tools/apple_storekit_testflight_delivery.py").decode()
        new=(ROOT/"tools/apple_storekit_testflight_delivery.py").read_text()
        functions=lambda text:{n.name:n for n in ast.parse(normalize_delivery_reporting(text)).body if isinstance(n,ast.FunctionDef)}
        before,after=functions(old),functions(new)
        for name in before.keys()-{"source_guard","finish","main","cleanup_delivery"}:
            self.assertEqual(ast.dump(before[name]),ast.dump(after[name]),name)
        old_main=next(n for n in ast.parse(normalize_archive_cli(old)).body if isinstance(n,ast.FunctionDef) and n.name=="main")
        new_main=next(n for n in ast.parse(normalize_archive_cli(new)).body if isinstance(n,ast.FunctionDef) and n.name=="main")
        self.assertEqual(ast.dump(old_main),ast.dump(new_main))
        # Only the cleanup delegate/reporting block is replaced inside finish;
        # final evidence validation, accepted-upload truth and fail-closed gate stay exact.
        before=copy.deepcopy(before["finish"]);after=copy.deepcopy(after["finish"])
        old_cleanup=next(i for i,n in enumerate(before.body) if isinstance(n,ast.Try)
                         and "cleanup_private" in ast.unparse(n))
        new_cleanup=next(i for i,n in enumerate(after.body) if isinstance(n,ast.Assign)
                         and isinstance(n.value,ast.Call) and getattr(n.value.func,"id","")=="cleanup_delivery")
        self.assertEqual(ast.dump(ast.Module(body=before.body[:old_cleanup],type_ignores=[])),
                         ast.dump(ast.Module(body=after.body[:new_cleanup],type_ignores=[])))
        self.assertEqual(ast.dump(ast.Module(body=before.body[old_cleanup+1:],type_ignores=[])),
                         ast.dump(ast.Module(body=after.body[new_cleanup+4:],type_ignores=[])))


class CleanupStageVisibilityTests(SyntheticDeliveryTestCase):
    def run_case(self, mode="success"):
        with tempfile.TemporaryDirectory() as temporary:
            root=delivery.cert.private_directory(temporary)
            (root/"home").mkdir(parents=True)
            (root/"logs").mkdir()
            (root/".owned").write_text(delivery.cert.PRIVATE_MARKER)
            profile=root/"home/Library/MobileDevice/Provisioning Profiles"/(delivery.cert.release.PROFILE_UUID+".mobileprovision")
            profile.parent.mkdir(parents=True)
            profile.write_text("SYNTHETIC_PRIVATE_PROFILE")
            (root/"installed-profile").write_text(str(profile))
            keychain=root/"signing.keychain-db";keychain.write_text("SYNTHETIC_PRIVATE_KEYCHAIN")
            if mode=="wrong_marker":(root/"installed-profile").write_text(str(root/"unapproved"))
            if mode=="unowned":(root/".owned").write_text("WRONG")
            real_unlink=Path.unlink;real_rmtree=delivery.shutil.rmtree
            calls=[]
            def native(args,**kwargs):
                calls.append(args[:2])
                if args[:2]==["security","delete-keychain"]:
                    if mode not in ("delete_failed","registry_failed"):
                        real_unlink(keychain)
                    return subprocess.CompletedProcess(args,1 if mode in ("delete_failed","failed_but_absent") else 0,b"",b"SYNTHETIC_PRIVATE_ERROR")
                self.assertEqual(args,["security","list-keychains","-d","user"])
                if mode=="ownership_changed":(root/".owned").write_text("WRONG")
                remains=mode=="delete_failed"
                return subprocess.CompletedProcess(args,1 if mode=="registry_failed" else 0,
                       json.dumps(str(keychain)).encode() if remains else b"",b"SYNTHETIC_PRIVATE_ERROR")
            def unlink(path,*a,**kw):
                if path==profile and mode=="profile_failed":raise OSError("SYNTHETIC_PRIVATE_ERROR")
                return real_unlink(path,*a,**kw)
            def tree(path):
                self.assertEqual(path,root)
                if mode=="tree_failed":raise OSError("SYNTHETIC_PRIVATE_ERROR")
                real_rmtree(path)
                if mode=="tree_failed_but_absent":raise OSError("SYNTHETIC_PRIVATE_ERROR")
            stdout,stderr=io.StringIO(),io.StringIO()
            with patch.object(delivery.Path,"home",return_value=root/"home"), \
                    patch.object(delivery.subprocess,"run",side_effect=native), \
                    patch.object(delivery,"remove_owned_workspace",side_effect=lambda target, owned, details: tree(target)), \
                    patch.object(delivery.Path,"unlink",new=unlink), \
                    contextlib.redirect_stdout(stdout),contextlib.redirect_stderr(stderr):
                result=delivery.cleanup_delivery(temporary)
            self.assertEqual(stdout.getvalue()+stderr.getvalue(),"")
            self.assertNotIn("SYNTHETIC",json.dumps(result))
            self.assertNotIn(str(root),json.dumps(result))
            return result,calls,root.exists()

    def test_independent_success_proves_all_five_stages_and_all_resources_absent(self):
        result,calls,exists=self.run_case()
        self.assertEqual(result["status"],"PASS")
        self.assertEqual(len(result["stages"]),5)
        self.assertTrue(all(r["status"]=="PASS" for r in result["stages"].values()))
        self.assertEqual(result["resources"],dict.fromkeys(("workspace","profile","keychain"),"ABSENT"))
        self.assertEqual(calls,[["security","delete-keychain"],["security","list-keychains"]])
        self.assertFalse(exists)

    def test_unowned_workspace_never_deletes_or_queries_native_resources(self):
        result,calls,exists=self.run_case("unowned")
        self.assertEqual(result["status"],"FAIL")
        self.assertEqual(result["stages"]["C01_OWNERSHIP"]["category"],"OWNERSHIP_UNVERIFIED")
        self.assertEqual(result["stages"]["C02_PROFILE"]["status"],"NOT_RUN")
        self.assertTrue(all(value=="UNVERIFIED" for value in result["resources"].values()))
        self.assertEqual(calls,[])
        self.assertTrue(exists)

    def test_profile_removal_failure_remains_visible_after_tree_success(self):
        result,_,exists=self.run_case("profile_failed")
        self.assertEqual(result["status"],"FAIL")
        self.assertEqual(result["stages"]["C02_PROFILE"],{"status":"FAIL","category":"REMOVAL_FAILED"})
        self.assertEqual(result["stages"]["C04_WORKSPACE"]["status"],"PASS")
        self.assertEqual(result["stages"]["C05_ABSENCE"],{"status":"PASS","category":"ABSENT_WITH_PRIOR_FAILURE"})
        self.assertFalse(exists)

    def test_wrong_profile_marker_is_rejected_even_after_owned_tree_removal(self):
        result,_,exists=self.run_case("wrong_marker")
        self.assertEqual(result["status"],"FAIL")
        self.assertEqual(result["stages"]["C02_PROFILE"]["category"],"OWNERSHIP_UNVERIFIED")
        self.assertFalse(exists)

    def test_native_deletion_failure_cannot_be_hidden_by_filesystem_absence(self):
        result,_,exists=self.run_case("delete_failed")
        self.assertEqual(result["status"],"FAIL")
        self.assertEqual(result["resources"]["keychain"],"UNVERIFIED")
        self.assertEqual(result["stages"]["C03_KEYCHAIN"]["category"],"RESOURCE_REMAINS")
        self.assertEqual(result["stages"]["C05_ABSENCE"]["category"],"ABSENCE_UNVERIFIED")
        self.assertFalse(exists)

    def test_failed_native_operation_is_observable_when_absence_is_independently_verified(self):
        result,_,_=self.run_case("failed_but_absent")
        self.assertEqual(result["status"],"FAIL")
        self.assertEqual(result["stages"]["C03_KEYCHAIN"]["category"],"OPERATION_FAILED_BUT_ABSENT")
        self.assertEqual(result["stages"]["C05_ABSENCE"]["category"],"ABSENT_WITH_PRIOR_FAILURE")

    def test_registry_query_failure_never_certifies_keychain_absence(self):
        result,_,exists=self.run_case("registry_failed")
        self.assertEqual(result["status"],"FAIL")
        self.assertEqual(result["resources"]["keychain"],"UNVERIFIED")
        self.assertEqual(result["stages"]["C03_KEYCHAIN"]["category"],"ABSENCE_UNVERIFIED")
        self.assertFalse(exists)

    def test_workspace_removal_failure_and_actual_remaining_resources_are_separate(self):
        result,_,exists=self.run_case("tree_failed")
        self.assertEqual(result["status"],"FAIL")
        self.assertEqual(result["stages"]["C04_WORKSPACE"]["category"],"REMOVAL_FAILED")
        self.assertEqual(result["resources"]["workspace"],"PRESENT")
        self.assertEqual(result["resources"]["profile"],"ABSENT")
        self.assertEqual(result["resources"]["keychain"],"ABSENT")
        self.assertEqual(result["stages"]["C05_ABSENCE"]["category"],"RESOURCE_REMAINS")
        self.assertTrue(exists)

    def test_workspace_operation_error_with_final_absence_remains_a_failure(self):
        result,_,exists=self.run_case("tree_failed_but_absent")
        self.assertEqual(result["status"],"FAIL")
        self.assertEqual(result["stages"]["C04_WORKSPACE"]["category"],"REMOVAL_FAILED")
        self.assertEqual(result["stages"]["C05_ABSENCE"]["category"],"ABSENT_WITH_PRIOR_FAILURE")
        self.assertFalse(exists)

    def test_ownership_is_rechecked_immediately_before_recursive_removal(self):
        result,_,exists=self.run_case("ownership_changed")
        self.assertEqual(result["status"],"FAIL")
        self.assertEqual(result["stages"]["C04_WORKSPACE"]["category"],"OWNERSHIP_UNVERIFIED")
        self.assertTrue(exists)

    def test_fixed_public_schema_has_no_path_raw_error_or_arbitrary_category(self):
        statuses={"PASS","FAIL","NOT_RUN"}
        categories={"DEPENDENCY_FAILED","OWNERSHIP_VERIFIED","OWNERSHIP_UNVERIFIED",
                    "ABSENCE_VERIFIED","REMOVAL_FAILED","ABSENCE_UNVERIFIED","RESOURCE_REMAINS",
                    "OPERATION_FAILED_BUT_ABSENT","REMOVAL_FAILED_ABSENCE_UNVERIFIED","ABSENT_WITH_PRIOR_FAILURE"}
        for mode in ("success","unowned","profile_failed","wrong_marker","delete_failed","failed_but_absent",
                     "registry_failed","tree_failed","tree_failed_but_absent","ownership_changed"):
            result,_,_=self.run_case(mode)
            for name,record in result["stages"].items():
                self.assertEqual(set(record),{"status","category"} | (
                    {"error_code","retry_status","retry_error_code"} if name=="C04_WORKSPACE" else set()))
                self.assertIn(record["status"],statuses)
                self.assertIn(record["category"],categories)
                if name=="C04_WORKSPACE":
                    self.assertIn(record["error_code"],{"NONE","UNKNOWN","EACCES","EPERM","EBUSY","ETXTBSY","ENOTEMPTY","EEXIST","ENOENT","EROFS"})
                    self.assertIn(record["retry_status"],{"NOT_ATTEMPTED","NOT_NEEDED","ATTEMPTED","SUCCEEDED","FAILED","BLOCKED_OWNERSHIP"})
                    self.assertIn(record["retry_error_code"],{"NONE","UNKNOWN","EACCES","EPERM","EBUSY","ETXTBSY","ENOTEMPTY","EEXIST","ENOENT","EROFS"})

    def test_wrong_private_home_cannot_delete_outside_owned_tree(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=delivery.cert.private_directory(temporary);root.mkdir()
            (root/".owned").write_text(delivery.cert.PRIVATE_MARKER)
            with patch.object(delivery.Path,"home",return_value=Path(temporary)/"unrelated"), \
                    patch.object(delivery.subprocess,"run") as native,patch.object(delivery.shutil,"rmtree") as tree:
                result=delivery.cleanup_delivery(temporary)
            self.assertEqual(result["status"],"FAIL")
            native.assert_not_called();tree.assert_not_called()

    def test_latest_p04_parent_inventory_and_mode_remain_pinned(self):
        for options in ({"p04_parent":"9"*40},{"p04_parent":delivery.P04_BASE+" "+"8"*40},
                        {"p04_inventory":b""},{"p04_inventory":b"M\tjs/gridly-paid-ui.mjs"}):
            with self.subTest(options=options),patch.object(delivery.cert,"git",side_effect=source_git(**options)), \
                    patch.object(delivery.subprocess,"run"),patch.object(delivery.cert,"original_contracts"),self.assertRaises(ValueError):
                delivery.source_guard(COMMIT,True)


def restore_archive_reporting(text):
    text=restore_signing_environment(text)
    """Validate and reverse only the new reporting shell wrapper."""
    marker="      - name: Xcode archive\n";end_marker="      - name: Internal-only IPA export\n"
    start=text.index(marker);end=text.index(end_marker,start)
    old=delivery.cert.git("show",delivery.EVIDENCE_BASE+":"+str(WORKFLOW.relative_to(ROOT)).replace("\\","/")).decode()
    original=old[old.index(marker):old.index(end_marker,old.index(marker))]
    expected=original.replace(
        '          exec > "$DIAGNOSTIC_PRIVATE_ROOT/logs/step-7-3.log" 2>&1',
        '          # FD 3 carries only the fixed archive classification; raw output stays private.\n'
        '          exec 3>&1\n          exec > "$DIAGNOSTIC_PRIVATE_ROOT/logs/step-7-3.log" 2>&1',1)
    expected=expected.replace("          xcodebuild -project","          archive_status=0\n          xcodebuild -project",1)
    expected=expected.replace('PROVISIONING_PROFILE_SPECIFIER="$PROFILE_NAME" archive\n',
        'PROVISIONING_PROFILE_SPECIFIER="$PROFILE_NAME" archive > "$DIAGNOSTIC_PRIVATE_ROOT/logs/archive-raw.log" 2>&1 || archive_status=$?\n',1)
    expected+=('          python3 -B tools/apple_storekit_testflight_delivery.py archive-public --runner-temp "$RUNNER_TEMP" --archive-exit "$archive_status" || true\n'
               '          exit "$archive_status"\n')
    assert text[start:end]==expected,"archive build/signing arguments or reporting exit contract changed"
    return text[:start]+original+text[end:]


def normalize_archive_cli(source):
    tree=ast.parse(normalize_delivery_reporting(source))
    main=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=="main")
    for node in ast.walk(main):
        if isinstance(node,ast.If) and isinstance(node.test,ast.Compare) and ast.unparse(node.test) == "args.mode == 'private-init'":
            node.body=[statement for statement in node.body if not (isinstance(statement,ast.Try) and len(statement.body)==1 and isinstance(statement.body[0],ast.Expr) and isinstance(statement.body[0].value,ast.Call) and getattr(statement.body[0].value.func,"id","")=="capture_runner_context")]
    main.body=[node for node in main.body if not (isinstance(node,ast.If) and isinstance(node.test,ast.Compare) and isinstance(node.test.comparators[0],ast.Set)
               and {getattr(value,"value",None) for value in node.test.comparators[0].elts}=={"signing-context","profile-install"})]
    for node in ast.walk(main):
        if isinstance(node,ast.keyword) and node.arg=="choices" and isinstance(node.value,ast.List):
            node.value.elts=[value for value in node.value.elts if getattr(value,"value",None) not in {"signing-context","profile-install"}]
    main=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=="main")
    main.body=[n for n in main.body if not (isinstance(n,ast.If) and ast.dump(n.test)==
        ast.dump(ast.parse('args.mode == "archive-public"',mode="eval").body))]
    for node in ast.walk(main):
        if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute) and node.func.attr=="add_argument":
            for keyword in node.keywords:
                if keyword.arg=="choices" and isinstance(keyword.value,ast.List):
                    keyword.value.elts=[v for v in keyword.value.elts if not (isinstance(v,ast.Constant) and v.value=="archive-public")]
        if isinstance(node,ast.For) and isinstance(node.target,ast.Name) and node.target.id=="name" and isinstance(node.iter,ast.Tuple):
            node.iter.elts=[v for v in node.iter.elts if not (isinstance(v,ast.Constant) and v.value=="archive-exit")]
    return ast.unparse(tree)


class ArchiveErrorEvidenceTests(SyntheticDeliveryTestCase):
    canary="/private/SYNTHETIC_SECRET_PATH/credential-CANARY-token"
    examples=(
        ("error: No profiles for 'com.synthetic' were found.", "PROVISIONING_OR_SIGNING","PROFILE_REJECTED"),
        ("error: Code signing identity is unavailable.", "PROVISIONING_OR_SIGNING","SIGNING_FAILED"),
        ("error: Build input file cannot be found: ", "MISSING_BUILD_INPUT","BUILD_INPUT_MISSING"),
        (".swift:12:5: error: cannot find private symbol in scope", "SWIFT_COMPILATION","SWIFT_COMPILER_FAILED"),
        ("xcodebuild: error: Could not resolve package dependencies:", "PACKAGE_DEPENDENCY","DEPENDENCY_RESOLUTION_FAILED"),
        ("Sandbox: swift-frontend(123) deny(1) file-write-create ", "SANDBOX_OR_FILESYSTEM","SANDBOX_DENIED"),
        ("error: Permission denied: ", "SANDBOX_OR_FILESYSTEM","SANDBOX_DENIED"),
        ("xcodebuild: error: SDK iphoneos cannot be located", "TOOLCHAIN_OR_SDK","TOOLCHAIN_UNAVAILABLE"),
    )

    def test_each_allowlisted_class_never_echoes_private_lines(self):
        for example,category,reason in self.examples:
            with self.subTest(category=category):
                record=delivery.classify_archive(example+self.canary,65)
                self.assertEqual((record["category"],record["reason"]),(category,reason))
                self.assertEqual(record["exit_code"],65)
                self.assertNotIn("CANARY",json.dumps(record));self.assertNotIn("/private",json.dumps(record))

    def test_unknown_error_is_unknown_and_retains_original_exit(self):
        record=delivery.classify_archive("error: opaque "+self.canary,65)
        self.assertEqual((record["category"],record["reason"]),("UNCLASSIFIED","UNKNOWN"))
        self.assertEqual(record["status"],"FAIL")
        self.assertEqual(record["exit_code"],65)

    def test_success_cannot_inherit_error_class_from_unrelated_log(self):
        record=delivery.classify_archive("error: Permission denied "+self.canary,0)
        self.assertEqual((record["status"],record["category"],record["reason"]),("PASS","NONE","NONE"))

    def test_input_and_output_are_bounded(self):
        record=delivery.classify_archive("x"*delivery.ARCHIVE_MAX_BYTES+"\nerror: Code signing "+self.canary,65)
        self.assertEqual(record["reason"],"UNKNOWN")
        self.assertLess(len(json.dumps(record)),400)

    def test_raw_log_prefers_private_error_evidence_and_no_native_tool_without_bundle(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=delivery.cert.private_directory(temporary);(root/"logs").mkdir(parents=True)
            (root/".owned").write_text(delivery.cert.PRIVATE_MARKER)
            (root/"logs/archive-raw.log").write_text("error: Build input file cannot be found: "+self.canary)
            with patch.dict(os.environ,{"DIAGNOSTIC_PRIVATE_ROOT":str(root)}),patch.object(delivery.subprocess,"run") as native:
                record=delivery.archive_report(temporary,65)
            native.assert_not_called()
            self.assertEqual(record["reason"],"BUILD_INPUT_MISSING")
            self.assertEqual(record["evidence_source"],"PRIVATE_TEXT")
            self.assertNotIn("CANARY",json.dumps(record))

    def structured_case(self, bad=False, timeout=False):
        with tempfile.TemporaryDirectory() as temporary:
            root=delivery.cert.private_directory(temporary);(root/"logs").mkdir(parents=True)
            (root/"tmp/result.xcresult").mkdir(parents=True)
            (root/".owned").write_text(delivery.cert.PRIVATE_MARKER)
            (root/"logs/archive-raw.log").write_text("Writing error result bundle to "+str(root/"tmp/result.xcresult")+
                "\nerror: Code signing identity missing: "+self.canary)
            def native(args,**kwargs):
                self.assertEqual(args,["xcrun","xcresulttool","get","object","--legacy","--path",str(root/"tmp/result.xcresult"),"--format","json"])
                self.assertEqual(kwargs["timeout"],10)
                self.assertEqual(kwargs["stderr"],subprocess.DEVNULL)
                if timeout:raise subprocess.TimeoutExpired(args,10)
                data=b"INVALID "+self.canary.encode() if bad else json.dumps({
                    "issues":{"errorSummaries":{"_values":[{"issueType":{"_value":"Swift Compiler Error"},
                    "message":{"_value":"unknown symbol "+self.canary}}]}}}).encode()
                kwargs["stdout"].write(data)
                return subprocess.CompletedProcess(args,0)
            with patch.dict(os.environ,{"DIAGNOSTIC_PRIVATE_ROOT":str(root)}),patch.object(delivery.subprocess,"run",side_effect=native):
                return delivery.archive_report(temporary,65)

    def test_existing_structured_diagnostic_is_preferred_without_changing_archive(self):
        record=self.structured_case()
        self.assertEqual(record["reason"],"SWIFT_COMPILER_FAILED")
        self.assertEqual(record["evidence_source"],"STRUCTURED")
        self.assertEqual(record["structured_status"],"READ")
        self.assertNotIn("CANARY",json.dumps(record))

    def test_unreferenced_result_bundle_cannot_be_attributed_to_archive(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=delivery.cert.private_directory(temporary);(root/"logs").mkdir(parents=True)
            (root/"tmp/stale.xcresult").mkdir(parents=True)
            (root/".owned").write_text(delivery.cert.PRIVATE_MARKER)
            (root/"logs/archive-raw.log").write_text("error: Build input file cannot be found: "+self.canary)
            with patch.dict(os.environ,{"DIAGNOSTIC_PRIVATE_ROOT":str(root)}),patch.object(delivery.subprocess,"run") as native:
                record=delivery.archive_report(temporary,65)
            native.assert_not_called()
            self.assertEqual(record["reason"],"BUILD_INPUT_MISSING")
            self.assertEqual(record["structured_status"],"NOT_AVAILABLE")

    def test_malformed_structured_output_falls_back_to_private_log(self):
        record=self.structured_case(bad=True)
        self.assertEqual(record["reason"],"SIGNING_FAILED")
        self.assertEqual(record["structured_status"],"UNREADABLE")

    def test_structured_tool_timeout_does_not_hide_raw_error_or_exit(self):
        record=self.structured_case(timeout=True)
        self.assertEqual(record["reason"],"SIGNING_FAILED")
        self.assertEqual(record["exit_code"],65)

    def test_unowned_context_fails_closed_without_invoking_tools(self):
        with tempfile.TemporaryDirectory() as temporary,patch.object(delivery.subprocess,"run") as native:
            result=delivery.archive_report(temporary,65)
        native.assert_not_called()
        self.assertEqual(result["reason"],"UNKNOWN")
        self.assertEqual(result["structured_status"],"CONTEXT_REJECTED")

    def test_emitter_only_accepts_fixed_schema_and_values(self):
        valid=delivery.classify_archive("error: Permission denied "+self.canary,65)
        with patch.object(delivery.os,"write") as output:
            delivery.emit_archive(valid)
        fd,raw=output.call_args.args
        self.assertEqual(fd,3);self.assertNotIn(b"CANARY",raw)
        for mutant in ({**valid,"reason":self.canary},{**valid,"path":self.canary},
                       {**valid,"exit_code":self.canary},{**valid,"evidence_source":self.canary},
                       {**valid,"structured_status":self.canary}):
            with patch.object(delivery.os,"write") as output,self.assertRaises(ValueError):
                delivery.emit_archive(mutant)
            output.assert_not_called()

    def test_archive_error_reporting_cannot_change_native_exit_or_allow_downstream(self):
        bash="C:/Program Files/Git/bin/bash.exe" if os.name=="nt" else "/bin/bash"
        _,_,blocks=archive_stages(WORKFLOW.read_text())
        body="\n".join(line[10:] for line in blocks[2].split("        run: |\n",1)[1].splitlines())+"\n"
        for native_status in (0,65,74):
            with self.subTest(status=native_status),tempfile.TemporaryDirectory() as temporary:
                root=Path(temporary);(root/"logs").mkdir();(root/"runner-context.sh").write_text(":\n")
                env={**os.environ,"DIAGNOSTIC_PRIVATE_ROOT":str(root).replace("\\","/"),
                     "DELIVERY_SOURCE_DIR":str(root).replace("\\","/"),"DIAGNOSTIC_BUILD_NUMBER":"15",
                     "TEAM_ID":"SYNTHETIC","PROFILE_NAME":"SYNTHETIC","RUNNER_TEMP":str(root).replace("\\","/"),
                     "NATIVE_STATUS":str(native_status)}
                fakes='xcodebuild() { printf SYNTHETIC_PRIVATE_CANARY; return "$NATIVE_STATUS"; }\npython3() { printf SYNTHETIC_PRIVATE_CANARY; return 99; }\n'
                result=subprocess.run([bash],input=fakes+body,text=True,capture_output=True,env=env)
                self.assertEqual(result.returncode,native_status)
                self.assertEqual(result.stdout+result.stderr,"")
                self.assertEqual((root/"logs/archive-raw.log").read_text(),"SYNTHETIC_PRIVATE_CANARY")

    def test_only_archive_reporting_shell_wrapper_changed_after_verified_checkpoint(self):
        old=delivery.cert.git("show",delivery.EVIDENCE_BASE+":"+str(WORKFLOW.relative_to(ROOT)).replace("\\","/")).decode()
        self.assertEqual(restore_archive_reporting(WORKFLOW.read_text()),old)
        self.assertNotIn("-resultBundlePath",WORKFLOW.read_text())
        self.assertNotRegex(WORKFLOW.read_text(),r"uses:.*(?:upload-artifact|cache)")

    def test_other_production_functions_and_cli_modes_are_unchanged(self):
        old=delivery.cert.git("show",delivery.EVIDENCE_BASE+":tools/apple_storekit_testflight_delivery.py").decode()
        new=(ROOT/"tools/apple_storekit_testflight_delivery.py").read_text()
        functions=lambda text:{n.name:ast.dump(n) for n in ast.parse(normalize_delivery_reporting(text)).body if isinstance(n,(ast.FunctionDef,ast.ClassDef))}
        before,after=functions(old),functions(new)
        self.assertEqual(set(after)-set(before),{"classify_archive","archive_report","emit_archive","cleanup_errno"} | {"owned_runner_directory", "runner_context", "capture_runner_context", "runner_native_environment", "runner_profile", "prepare_signing_context", "install_runner_profile", "verify_runner_profile_ownership", "restore_keychain_context"} | DELIVERY_REPORTING_FUNCTIONS)
        for name in before.keys()-{"source_guard","cleanup_delivery","main"}:
            self.assertEqual(before[name],after[name],name)
        normalized=functions(normalize_archive_cli(new))
        self.assertEqual(normalized["main"],before["main"])

    def test_latest_archive_history_inventory_and_parent_fail_closed(self):
        for options in ({"evidence_parent":"9"*40},{"evidence_parent":delivery.ARCHIVE_BASE+" "+"8"*40},
                        {"archive_inventory":b""},{"archive_inventory":b"M\tjs/gridly-paid-ui.mjs"}):
            with self.subTest(options=options),patch.object(delivery.cert,"git",side_effect=source_git(**options)), \
                    patch.object(delivery.subprocess,"run"),patch.object(delivery.cert,"original_contracts"),self.assertRaises(ValueError):
                delivery.source_guard(COMMIT,True)


class CleanupErrorRecoveryTests(SyntheticDeliveryTestCase):
    def exercise(self, error_number, *, retry_fails=False, partial=False, mutate=False):
        with tempfile.TemporaryDirectory() as temporary:
            root=delivery.cert.private_directory(temporary);(root/"home").mkdir(parents=True)
            (root/"logs").mkdir();(root/".owned").write_text(delivery.cert.PRIVATE_MARKER)
            (root/"writer-output").write_text("SYNTHETIC_CANARY")
            real_tree=delivery.shutil.rmtree
            calls=[]
            def tree(target):
                self.assertEqual(target,root)
                self.assertTrue(target.resolve().is_relative_to(Path(temporary).resolve()))
                calls.append(target)
                if len(calls)==1:
                    # Simulate an active writer or partial removal, entirely in this fixture.
                    if error_number==errno.ENOTEMPTY:(root/"late-write").write_text("SYNTHETIC_CANARY")
                    if partial:(root/".owned").unlink()
                    if mutate:(root/".owned").write_text("UNOWNED")
                    raise OSError(error_number,"SYNTHETIC_PRIVATE_ERROR",str(root/"SYNTHETIC_SECRET_PATH"))
                if retry_fails:raise OSError(error_number,"SYNTHETIC_PRIVATE_RETRY_ERROR")
                real_tree(target)
            with patch.object(delivery.Path,"home",return_value=root/"home"), \
                    patch.object(delivery.subprocess,"run",return_value=subprocess.CompletedProcess([],0,b"",b"")), \
                    patch.object(delivery,"remove_owned_workspace",side_effect=lambda target, owned, details: tree(target)),patch.object(delivery.time,"sleep") as sleep:
                result=delivery.cleanup_delivery(temporary)
            self.assertNotIn("SYNTHETIC",json.dumps(result))
            self.assertNotIn(str(root),json.dumps(result))
            self.assertEqual(result["status"],"FAIL") # First error is never turned green.
            return result,len(calls),sleep.call_count,root.exists()

    def test_permission_denied_is_classified_without_permission_changes_or_retry(self):
        for code,name in ((errno.EACCES,"EACCES"),(errno.EPERM,"EPERM"),(errno.EROFS,"EROFS")):
            with self.subTest(code=code):
                result,calls,sleeps,exists=self.exercise(code)
                detail=result["stages"]["C04_WORKSPACE"]
                self.assertEqual(detail["error_code"],name)
                self.assertEqual(detail["retry_status"],"NOT_ATTEMPTED")
                self.assertEqual((calls,sleeps,exists),(1,0,True))
                self.assertEqual(result["stages"]["C05_ABSENCE"]["category"],"RESOURCE_REMAINS")

    def test_busy_and_concurrent_nonempty_retry_once_with_sticky_failure(self):
        for code,name in ((errno.EBUSY,"EBUSY"),(errno.ENOTEMPTY,"ENOTEMPTY")):
            with self.subTest(code=code):
                result,calls,sleeps,exists=self.exercise(code)
                detail=result["stages"]["C04_WORKSPACE"]
                self.assertEqual((detail["status"],detail["error_code"],detail["retry_status"]),("FAIL",name,"SUCCEEDED"))
                self.assertEqual((calls,sleeps,exists),(2,1,False))
                self.assertEqual(result["stages"]["C05_ABSENCE"]["category"],"ABSENT_WITH_PRIOR_FAILURE")
                self.assertTrue(all(v=="ABSENT" for v in result["resources"].values()))

    def test_persistent_busy_failure_never_retries_more_than_once(self):
        result,calls,sleeps,exists=self.exercise(errno.EBUSY,retry_fails=True)
        detail=result["stages"]["C04_WORKSPACE"]
        self.assertEqual((calls,sleeps,exists),(2,1,True))
        self.assertEqual((detail["retry_status"],detail["retry_error_code"]),("FAILED","EBUSY"))

    def test_partial_removal_of_ownership_marker_blocks_retry(self):
        result,calls,sleeps,exists=self.exercise(errno.ENOTEMPTY,partial=True)
        detail=result["stages"]["C04_WORKSPACE"]
        self.assertEqual(detail["retry_status"],"BLOCKED_OWNERSHIP")
        self.assertEqual((calls,sleeps,exists),(1,0,True))

    def test_changed_ownership_marker_blocks_retry(self):
        result,calls,sleeps,exists=self.exercise(errno.EBUSY,mutate=True)
        self.assertEqual(result["stages"]["C04_WORKSPACE"]["retry_status"],"BLOCKED_OWNERSHIP")
        self.assertEqual((calls,sleeps,exists),(1,0,True))

    def test_unknown_exception_never_publishes_message_or_tries_speculative_repair(self):
        result,calls,sleeps,exists=self.exercise(errno.EIO)
        self.assertEqual(result["stages"]["C04_WORKSPACE"]["error_code"],"UNKNOWN")
        self.assertEqual((calls,sleeps,exists),(1,0,True))

    def test_errno_classification_cannot_echo_path_message_or_arbitrary_errno(self):
        self.assertEqual(delivery.cleanup_errno(ValueError("PRIVATE_CANARY")),"UNKNOWN")
        self.assertEqual(delivery.cleanup_errno(OSError(99999,"PRIVATE_CANARY","PRIVATE_PATH")),"UNKNOWN")
        self.assertEqual(delivery.cleanup_errno(OSError(errno.ENOENT,"PRIVATE_CANARY")),"ENOENT")

    def test_cleanup_does_not_chmod_clear_flags_kill_processes_or_expand_paths(self):
        source=ast.unparse(next(n for n in ast.parse((ROOT/"tools/apple_storekit_testflight_delivery.py").read_text()).body
                               if isinstance(n,ast.FunctionDef) and n.name=="cleanup_delivery"))
        for forbidden in ("chmod(","chown(","chflags(","kill(","pkill","sudo","ignore_errors=True"):
            self.assertNotIn(forbidden,source)
        self.assertEqual(source.count("remove_owned_workspace(root, owned, workspace_details)"),2)
        self.assertIn("root_identity",source)
        self.assertIn('{"EBUSY", "ENOTEMPTY"}'.replace('"',"'"),source)



class RunnerSigningEnvironmentTests(SyntheticDeliveryTestCase):
    @contextlib.contextmanager
    def context(self, cf=False):
        with tempfile.TemporaryDirectory() as temporary:
            base=Path(temporary).resolve(strict=True)
            root=delivery.cert.private_directory(base)
            for name in ("home","logs","reports","tmp"):
                (root/name).mkdir(parents=True,exist_ok=True)
            (root/".owned").write_text(delivery.cert.PRIVATE_MARKER)
            home=base/"normal-runner-home";home.mkdir()
            values={"HOME":str(home)}
            with patch.dict(delivery.os.environ,values):
                delivery.os.environ.pop("CFFIXED_USER_HOME",None)
                if cf:delivery.os.environ["CFFIXED_USER_HOME"]=str(home)
                delivery.capture_runner_context(root)
                delivery.write_json(root/"reports/delivery-authorization.json",
                    {"authorization":owner_automatic_authorization(),"ref":REF,"source_commit":COMMIT,"build":"15"})
                names=[str(home/"Library/Keychains/original.keychain-db")]
                state={"names":names[:],"original":names[:],"calls":[],"set_failure":False,"verify_failure":False,"delete_failure":False,"real_run":subprocess.run}
                def native(args,**kwargs):
                    self.assertEqual(kwargs["env"]["HOME"],str(home))
                    self.assertEqual(kwargs["env"].get("CFFIXED_USER_HOME"),str(home) if cf else None)
                    self.assertEqual(kwargs["stdout"],subprocess.PIPE)
                    self.assertEqual(kwargs["stderr"],subprocess.PIPE)
                    state["calls"].append(args)
                    if args[:5]==["security","list-keychains","-d","user","-s"]:
                        if state["set_failure"]:raise OSError(errno.EACCES,"SYNTHETIC_PRIVATE_CANARY")
                        state["names"]=args[5:]
                        if state["verify_failure"]:state["names"]=[]
                        return subprocess.CompletedProcess(args,0,b"",b"PRIVATE_CANARY")
                    if args==["security","list-keychains","-d","user"]:
                        return subprocess.CompletedProcess(args,0,
                            "\n".join(json.dumps(name) for name in state["names"]).encode(),b"PRIVATE_CANARY")
                    if args==["security","delete-keychain",str(root/"signing.keychain-db")]:
                        if state["delete_failure"]:raise OSError(errno.EACCES,"SYNTHETIC_PRIVATE_CANARY")
                        (root/"signing.keychain-db").unlink(missing_ok=True)
                        state["names"]=[name for name in state["names"] if name!=str(root/"signing.keychain-db")]
                        return subprocess.CompletedProcess(args,0,b"",b"PRIVATE_CANARY")
                    self.fail("unexpected native operation")
                with patch.object(delivery.subprocess,"run",side_effect=native),patch.object(delivery.time,"time",return_value=NOW):
                    yield root,home,state

    def prepare(self,root,state):
        delivery.prepare_signing_context(root,COMMIT)
        (root/"signing.keychain-db").write_bytes(b"SYNTHETIC_PRIVATE_KEYCHAIN")
        state["names"]=[str(root/"signing.keychain-db")]

    def install(self,root):
        (root/"distribution.mobileprovision").write_bytes(b"SAME_SYNTHETIC_PROFILE_BYTES")
        delivery.install_runner_profile(root,COMMIT)
        return delivery.runner_profile(root)

    def cleanup(self,root):
        with patch.object(delivery.Path,"home",return_value=root/"home"),contextlib.redirect_stdout(io.StringIO()) as out,contextlib.redirect_stderr(io.StringIO()) as err:
            result=delivery.cleanup_delivery(root.parent)
        self.assertEqual(out.getvalue()+err.getvalue(),"")
        self.assertNotIn("CANARY",json.dumps(result))
        self.assertNotIn(str(root),json.dumps(result))
        return result

    def test_runner_home_capture_is_metadata_only_and_preserves_unset_cf(self):
        with self.context() as (root,home,state):
            self.assertEqual(state["calls"],[])
            self.assertEqual(delivery.runner_context(root)["home"],str(home))
            self.assertIsNone(delivery.runner_context(root)["cf_home"])
            script=(root/"runner-context.sh").read_text()
            self.assertIn("unset CFFIXED_USER_HOME\n",script)
            self.assertNotIn("PRIVATE_KEY",script)

    def test_original_cf_home_is_restored_exactly_when_present(self):
        with self.context(cf=True) as (root,home,state):
            self.assertEqual(delivery.runner_native_environment(root)["CFFIXED_USER_HOME"],str(home))
            self.assertIn("export CFFIXED_USER_HOME=",(root/"runner-context.sh").read_text())

    def test_conflicting_cf_context_is_rejected_without_native_access(self):
        with self.context() as (root,home,state),patch.dict(delivery.os.environ,{"CFFIXED_USER_HOME":str(root/"wrong")}):
            with self.assertRaises(ValueError):delivery.capture_runner_context(root)
            self.assertEqual(state["calls"],[])

    def test_private_or_different_home_cannot_authorize_signing(self):
        with self.context() as (root,home,state),patch.dict(delivery.os.environ,{"HOME":str(root/"home")}):
            with self.assertRaises(ValueError):delivery.prepare_signing_context(root,COMMIT)
            self.assertEqual(state["calls"],[])

    def test_context_identity_mutation_fails_closed(self):
        with self.context() as (root,home,state):
            value=delivery.read_json(root/"runner-context.json");value["identity"][1]+=1
            delivery.write_json(root/"runner-context.json",value)
            with self.assertRaises(ValueError):delivery.prepare_signing_context(root,COMMIT)
            self.assertEqual(state["calls"],[])

    def test_expired_authorization_precedes_keychain_query(self):
        with self.context() as (root,home,state),patch.object(delivery.time,"time",return_value=NOW+1801):
            with self.assertRaises(ValueError):delivery.prepare_signing_context(root,COMMIT)
            self.assertEqual(state["calls"],[])

    def test_existing_profile_is_never_overwritten_or_claimed(self):
        with self.context() as (root,home,state):
            profile=delivery.runner_profile(root);profile.parent.mkdir(parents=True);profile.write_bytes(b"UNRELATED_OWNER_BYTES")
            with self.assertRaises(ValueError):delivery.prepare_signing_context(root,COMMIT)
            self.assertEqual(profile.read_bytes(),b"UNRELATED_OWNER_BYTES")
            self.assertFalse((root/"installed-profile").exists())
            self.assertEqual(state["calls"],[])

    def test_snapshot_is_captured_before_signing_and_cannot_be_repeated(self):
        with self.context() as (root,home,state):
            self.prepare(root,state)
            self.assertEqual(delivery.read_json(root/"keychain-search-list.json")["names"],state["original"])
            with self.assertRaises(ValueError):delivery.prepare_signing_context(root,COMMIT)
            self.assertEqual(len(state["calls"]),1)

    def test_same_original_profile_bytes_are_installed_in_runner_library(self):
        with self.context() as (root,home,state):
            self.prepare(root,state);profile=self.install(root)
            self.assertTrue(profile.is_relative_to(home))
            self.assertFalse(profile.is_relative_to(root))
            self.assertEqual(profile.read_bytes(),(root/"distribution.mobileprovision").read_bytes())
            delivery.verify_runner_profile_ownership(root,profile)

    def test_install_collision_remains_exclusive_after_preparation(self):
        with self.context() as (root,home,state):
            self.prepare(root,state)
            profile=delivery.runner_profile(root);profile.parent.mkdir(parents=True);profile.write_bytes(b"UNRELATED")
            with self.assertRaises(FileExistsError):self.install(root)
            self.assertEqual(profile.read_bytes(),b"UNRELATED")
            self.assertFalse((root/"installed-profile").exists())

    def test_changed_profile_inode_is_not_deleted(self):
        with self.context() as (root,home,state):
            self.prepare(root,state);profile=self.install(root)
            replacement=profile.with_suffix(".replacement");replacement.write_bytes(b"UNRELATED");replacement.replace(profile)
            result=self.cleanup(root)
            self.assertEqual(result["status"],"FAIL")
            self.assertEqual(result["stages"]["C02_PROFILE"]["category"],"OWNERSHIP_UNVERIFIED")
            self.assertEqual(profile.read_bytes(),b"UNRELATED")
            self.assertEqual(result["resources"]["profile"],"PRESENT")

    def test_symlinked_profile_parent_cannot_install_or_delete(self):
        with self.context() as (root,home,state):
            self.prepare(root,state)
            actual=Path.is_symlink
            with patch.object(Path,"is_symlink",new=lambda path: path==home/"Library" or actual(path)):
                with self.assertRaises(ValueError):self.install(root)
                result=self.cleanup(root)
            self.assertEqual(result["status"],"FAIL")
            self.assertTrue(root.exists())

    def test_cleanup_restores_original_search_list_then_verifies_all_absence(self):
        with self.context() as (root,home,state):
            self.prepare(root,state);profile=self.install(root)
            unrelated=home/"unrelated";unrelated.write_bytes(b"PRESERVE")
            result=self.cleanup(root)
            self.assertEqual(result["status"],"PASS")
            self.assertEqual(state["names"],state["original"])
            self.assertFalse(profile.exists());self.assertFalse(root.exists())
            self.assertEqual(unrelated.read_bytes(),b"PRESERVE")
            operations=[call[1] for call in state["calls"]]
            self.assertEqual(operations,["list-keychains","list-keychains","list-keychains","list-keychains","delete-keychain","list-keychains"])

    def test_search_list_restore_error_is_not_hidden_by_keychain_deletion(self):
        with self.context() as (root,home,state):
            self.prepare(root,state);self.install(root);state["set_failure"]=True
            result=self.cleanup(root)
            self.assertEqual(result["status"],"FAIL")
            self.assertEqual(result["stages"]["C03_KEYCHAIN"]["status"],"FAIL")
            self.assertEqual(result["resources"]["keychain"],"UNVERIFIED")
            self.assertTrue(any(call[1]=="delete-keychain" for call in state["calls"]))

    def test_restore_requires_exact_readback_not_only_success_exit(self):
        with self.context() as (root,home,state):
            self.prepare(root,state);self.install(root);state["verify_failure"]=True
            self.assertEqual(self.cleanup(root)["status"],"FAIL")

    def test_native_delete_failure_does_not_prevent_search_list_restoration(self):
        with self.context() as (root,home,state):
            self.prepare(root,state);self.install(root);state["delete_failure"]=True
            result=self.cleanup(root)
            self.assertEqual(result["status"],"FAIL")
            self.assertEqual(state["names"],state["original"])

    def test_malformed_snapshot_cannot_set_arbitrary_keychain_paths(self):
        with self.context() as (root,home,state):
            self.prepare(root,state)
            delivery.write_json(root/"keychain-search-list.json",{"home":str(home),"names":["relative"]})
            before=len(state["calls"])
            with self.assertRaises(ValueError):delivery.restore_keychain_context(root)
            self.assertEqual(len(state["calls"]),before)

    def test_missing_context_cannot_fall_back_and_certify_external_cleanup(self):
        with self.context() as (root,home,state):
            self.prepare(root,state);profile=self.install(root)
            (root/"runner-context.json").unlink()
            result=self.cleanup(root)
            self.assertEqual(result["status"],"FAIL")
            self.assertEqual(result["stages"]["C01_OWNERSHIP"]["status"],"FAIL")
            self.assertTrue(profile.exists());self.assertTrue(root.exists())

    def test_eacces_remains_failure_without_chmod_or_speculative_retry(self):
        with self.context() as (root,home,state):
            self.prepare(root,state);profile=self.install(root)
            with patch.object(delivery.shutil,"rmtree",side_effect=PermissionError(errno.EACCES,"CANARY")) as tree:
                result=self.cleanup(root)
            self.assertEqual(result["status"],"FAIL")
            self.assertEqual(result["stages"]["C04_WORKSPACE"]["error_code"],"EACCES")
            self.assertEqual(result["stages"]["C04_WORKSPACE"]["retry_status"],"NOT_ATTEMPTED")
            self.assertEqual(result["resources"]["workspace"],"PRESENT")
            self.assertFalse(profile.exists());self.assertEqual(state["names"],state["original"])
            self.assertEqual(tree.call_count,1)

    def test_no_original_home_deletion_or_permission_broadening_exists(self):
        code=Path("tools/apple_storekit_testflight_delivery.py").read_text()
        functions={n.name:ast.unparse(n) for n in ast.parse(normalize_delivery_reporting(code)).body if isinstance(n,ast.FunctionDef)}
        for name in ("cleanup_delivery","install_runner_profile","restore_keychain_context"):
            for forbidden in ("chmod(","chown(","chflags(","kill(","ignore_errors=True"):
                self.assertNotIn(forbidden,functions[name])
        self.assertEqual(functions["cleanup_delivery"].count("shutil.rmtree(root)"),2)
        self.assertIn('profile.open(\'xb\')',functions["install_runner_profile"])

    def test_actual_workflow_native_scope_keeps_upload_home_private_and_cms_explicit(self):
        text=restore_delivery_reporting(WORKFLOW.read_text())
        old=restore_signing_environment(text)
        self.assertEqual(text.count('. "$DIAGNOSTIC_PRIVATE_ROOT/runner-context.sh"'),7)
        signing=CmsSigningRepairTests.signing_body(text)
        self.assertLess(signing.index("signing-context --"),signing.index("security create-keychain"))
        self.assertLess(signing.index('test "$PROFILE_UUID"'),signing.index("profile-install --"))
        self.assertIn(CmsSigningRepairTests.new_cms,signing)
        transfer=text.split("      - name: Validate availability and deliver",1)[1]
        self.assertNotIn("runner-context.sh",transfer)
        for value in ("testFlightInternalTestingOnly","manageAppVersionAndBuildNumber","ASC_PRIVATE_KEY_P8_BASE64"):
            self.assertEqual(text.count(value),old.count(value))

    def test_capture_is_only_new_private_init_operation_and_transfer_contract_is_identical(self):
        old=delivery.cert.git("show",delivery.ENVIRONMENT_BASE+":tools/apple_storekit_testflight_delivery.py").decode()
        new=Path("tools/apple_storekit_testflight_delivery.py").read_text()
        functions=lambda code:{n.name:ast.dump(n) for n in ast.parse(normalize_delivery_reporting(code)).body if isinstance(n,ast.FunctionDef)}
        for name in functions(old).keys()-{"source_guard","cleanup_delivery","main"}:
            self.assertEqual(functions(old)[name],functions(new)[name],name)
        self.assertEqual(functions(normalize_archive_cli(old))["main"],functions(normalize_archive_cli(new))["main"])


    def test_real_shell_sources_runner_context_only_inside_native_subshell(self):
        bash="C:/Program Files/Git/bin/bash.exe" if os.name=="nt" else "/bin/bash"
        with self.context() as (root,home,state):
            posix=lambda path:str(path).replace("\\","/")
            environment={**os.environ,"HOME":posix(root/"home"),"CFFIXED_USER_HOME":posix(root/"home"),
                         "DIAGNOSTIC_PRIVATE_ROOT":posix(root),"EXPECTED_RUNNER":str(home)}
            script='''
set -euo pipefail
outer="$HOME"
outer_cf="$CFFIXED_USER_HOME"
(
 . "$DIAGNOSTIC_PRIVATE_ROOT/runner-context.sh"
 test "$HOME" = "$EXPECTED_RUNNER"
 test -z "$(printenv CFFIXED_USER_HOME || true)"
)
test "$HOME" = "$outer"
test "$CFFIXED_USER_HOME" = "$outer_cf"
'''
            completed=state["real_run"]([bash,"--noprofile","--norc"],input=script,text=True,capture_output=True,env=environment)
            self.assertEqual(completed.returncode,0)
            self.assertEqual(completed.stdout+completed.stderr,"")

    def test_tampering_to_environment_workflow_delta_fails_preservation(self):
        text=WORKFLOW.read_text()
        for mutant in (text.replace(' . "$DIAGNOSTIC_PRIVATE_ROOT/runner-context.sh"; ',' ',1),
                       text.replace('profile-install --','unauthorized-install --',1),
                       text.replace('CODE_SIGN_STYLE=Manual','CODE_SIGN_STYLE=Automatic',1)):
            with self.assertRaises(AssertionError):restore_signing_environment(mutant)


    def test_profile_install_requires_keychain_discoverable_under_runner_context(self):
        with self.context() as (root,home,state):
            self.prepare(root,state);state["names"]=state["original"]
            with self.assertRaises(ValueError):self.install(root)
            self.assertFalse(delivery.runner_profile(root).exists())
            self.assertFalse((root/"installed-profile").exists())

    def test_initial_context_failure_publishes_only_fixed_status(self):
        with tempfile.TemporaryDirectory() as temporary:
            argv=["helper","private-init","--runner-temp",temporary,"--github-env",str(Path(temporary)/"env")]
            with patch.object(sys,"argv",argv),patch.object(delivery,"capture_runner_context",side_effect=OSError(errno.EACCES,"PRIVATE_CANARY_PATH")),contextlib.redirect_stdout(io.StringIO()) as out,contextlib.redirect_stderr(io.StringIO()) as err,self.assertRaises(SystemExit) as stopped:
                delivery.main()
            self.assertEqual(stopped.exception.code,1)
            self.assertEqual(out.getvalue(),'{"private_workspace":"FAILED"}\n')
            self.assertEqual(err.getvalue(),"")

    def test_latest_environment_parent_and_inventory_fail_closed(self):
        for options in ({"environment_parent":"9"*40},{"environment_parent":delivery.EVIDENCE_BASE+" "+"8"*40},
                        {"environment_inventory":b""},{"environment_inventory":b"M\tjs/gridly-paid-ui.mjs"}):
            with self.subTest(options=options),patch.object(delivery.cert,"git",side_effect=source_git(**options)),patch.object(delivery.subprocess,"run"),patch.object(delivery.cert,"original_contracts"),self.assertRaises(ValueError):
                delivery.source_guard(COMMIT,True)



class DeliveryStageReportingTests(SyntheticDeliveryTestCase):
    def setUp(self):
        self.actual_source_guard=delivery.source_guard
        CertificationAndTransferTests.setUp(self)
    fake_upload=CertificationAndTransferTests.fake_upload
    canary="SYNTHETIC_PRIVATE_TOKEN_PATH_NEVER_PUBLIC"

    def exercise(self, *, fail=None, mutate=None, write_failure=None, environment=None):
        (self.root/".owned").write_text(delivery.cert.PRIVATE_MARKER)
        calls,options=self.fake_upload(existing=fail=="existing",fail=fail=="upload")
        if mutate:mutate()
        if fail=="credentials":options["credentials"]={}
        if fail=="validation":
            def execute(command,**kwargs):
                if synthetic_transport_query(command, kwargs): return
                calls.append(upload_action(command));raise subprocess.CalledProcessError(2,command,stderr=self.canary)
            options["execute"]=execute
        if fail=="postcheck":
            original=options["execute"]
            def execute(command,**kwargs):
                if synthetic_transport_query(command, kwargs): return
                original(command,**kwargs);self.ipa.write_bytes(b"ALTERED")
            options["execute"]=execute
        if fail=="token":
            def token(*args):raise subprocess.CalledProcessError(1,["node",self.canary],stderr=self.canary)
            options["token_factory"]=token
        if fail=="availability":
            def get(*args):raise OSError(self.canary)
            options["get"]=get
        if fail=="expired":
            original=options["get"]
            def get(path,token):
                result=original(path,token)
                if path.startswith("/v1/builds?"):delivery.time.time.return_value=NOW+1801
                return result
            options["get"]=get
        frames=[]
        def write(fd,raw):
            self.assertEqual(fd,3)
            if write_failure==len(frames)+1:raise OSError(self.canary)
            self.assertLessEqual(len(raw),8192)
            self.assertNotIn(self.canary.encode(),raw)
            self.assertNotIn(str(self.root).encode(),raw)
            self.assertNotIn(b"PRIVATE KEY",raw)
            frames.append(json.loads(raw))
            return len(raw)
        actual=delivery.transfer
        def invoke(*args,**kwargs):return actual(*args,**kwargs,**options)
        env={"RUNNER_OS":"macOS","GITHUB_ACTIONS":"true","HOME":str(self.root/"home"),"CFFIXED_USER_HOME":str(self.root/"home")}
        if environment:env.update(environment)
        error=None
        with patch.object(delivery,"transfer",side_effect=invoke),patch.object(delivery.os,"write",side_effect=write),patch.dict(delivery.os.environ,env),contextlib.redirect_stdout(io.StringIO()) as out,contextlib.redirect_stderr(io.StringIO()) as err:
            try:delivery.transfer_public(self.root,COMMIT,self.ipa)
            except BaseException as caught:error=caught
        self.assertEqual(out.getvalue()+err.getvalue(),"")
        return calls,frames,error

    def final(self,frames):
        return frames[-1]["delivery_stages"]

    def assert_boundary(self,frames,index,category):
        records=self.final(frames)
        self.assertEqual([row["stage"] for row in records],list(delivery.DELIVERY_STAGES))
        self.assertEqual([row["status"] for row in records],["PASS"]*index+["FAIL"]+["NOT_RUN"]*(5-index))
        self.assertEqual(records[index]["category"],category)

    def test_success_reports_all_six_stages_in_order_and_one_upload(self):
        calls,frames,error=self.exercise()
        self.assertIsNone(error)
        self.assertEqual(calls,["--validate-app","apps","builds","--upload-package"])
        self.assertEqual(len(frames),12)
        self.assertEqual([row["status"] for row in self.final(frames)],["PASS"]*6)
        self.assertEqual(delivery.read_json(self.root/"reports/delivery-transfer.json")["status"],"ACCEPTED")
        self.assertEqual(delivery.read_json(self.root/"reports/delivery-stages.json"),frames[-1])

    def test_missing_signed_proof_stops_before_any_credential_access(self):
        calls,frames,error=self.exercise(mutate=lambda:(self.root/"reports/storekit-diagnostic-certification.json").unlink())
        self.assertIsInstance(error,FileNotFoundError);self.assertEqual(calls,[])
        self.assert_boundary(frames,0,"LOCAL_VERIFICATION_REJECTED")

    def test_local_private_home_guard_is_reported_before_credentials(self):
        calls,frames,error=self.exercise(environment={"HOME":str(self.root/"unapproved")})
        self.assertIsInstance(error,ValueError);self.assertEqual(calls,[])
        self.assert_boundary(frames,0,"DELIVERY_CONTEXT_REJECTED")

    def test_credential_presence_and_format_failure_is_separate_from_apple(self):
        calls,frames,error=self.exercise(fail="credentials")
        self.assertIsInstance(error,ValueError);self.assertEqual(calls,[])
        self.assert_boundary(frames,1,"CREDENTIAL_FORMAT_REJECTED")

    def test_apple_validation_failure_preserves_native_exception_and_blocks_availability(self):
        calls,frames,error=self.exercise(fail="validation")
        self.assertIsInstance(error,subprocess.CalledProcessError);self.assertEqual(error.returncode,2)
        self.assertEqual(calls,["--validate-app"])
        self.assert_boundary(frames,2,"APPLE_VALIDATION_FAILED")
        self.assertFalse((self.root/"reports/delivery-transfer.json").exists())

    def test_post_validation_ipa_mutation_is_reported_and_cannot_upload(self):
        calls,frames,error=self.exercise(fail="postcheck")
        self.assertIsInstance(error,ValueError);self.assertEqual(calls,["--validate-app"])
        self.assert_boundary(frames,3,"IPA_BYTES_CHANGED")

    def test_api_token_generation_failure_is_distinct_without_token_or_command_output(self):
        calls,frames,error=self.exercise(fail="token")
        self.assertIsInstance(error,subprocess.CalledProcessError);self.assertEqual(calls,["--validate-app"])
        self.assert_boundary(frames,4,"API_TOKEN_GENERATION_FAILED")

    def test_live_apple_availability_failure_blocks_upload(self):
        calls,frames,error=self.exercise(fail="availability")
        self.assertIsInstance(error,OSError);self.assertEqual(calls,["--validate-app"])
        self.assert_boundary(frames,4,"BUILD_AVAILABILITY_FAILED")

    def test_existing_build_fails_closed_and_reports_no_unused_attestation(self):
        calls,frames,error=self.exercise(fail="existing")
        self.assertIsInstance(error,ValueError);self.assertEqual(calls,["--validate-app","apps","builds"])
        self.assert_boundary(frames,4,"BUILD_NOT_CONFIRMED_UNUSED")
        self.assertFalse((self.root/"reports/delivery-availability.json").exists())

    def test_expired_owner_authorization_after_live_check_still_blocks_upload(self):
        calls,frames,error=self.exercise(fail="expired")
        self.assertIsInstance(error,ValueError);self.assertNotIn("--upload-package",calls)
        self.assert_boundary(frames,4,"OWNER_AUTHORIZATION_EXPIRED")

    def test_upload_failure_is_uncertain_and_never_retried(self):
        calls,frames,error=self.exercise(fail="upload")
        self.assertIsInstance(error,subprocess.CalledProcessError)
        self.assertEqual(calls.count("--upload-package"),1)
        self.assert_boundary(frames,5,"UPLOAD_NO_TOOL_OUTPUT")
        self.assertEqual(delivery.read_json(self.root/"reports/delivery-transfer.json")["status"],"ATTEMPTED")

    def test_public_channel_failure_prevents_any_transport(self):
        calls,frames,error=self.exercise(write_failure=1)
        self.assertIsInstance(error,OSError);self.assertEqual(calls,[]);self.assertEqual(frames,[])

    def test_post_acceptance_reporting_failure_preserves_acceptance_marker(self):
        calls,frames,error=self.exercise(write_failure=12)
        self.assertIsInstance(error,OSError);self.assertEqual(calls.count("--upload-package"),1)
        self.assertEqual(delivery.read_json(self.root/"reports/delivery-transfer.json")["status"],"ACCEPTED")

    def test_actual_output_sidecar_absence_is_not_misclassified_as_bad_credentials(self):
        calls,frames,error=self.exercise(mutate=lambda:(self.ipa.parent/"ExportOptions.plist").unlink())
        self.assertIsInstance(error,delivery.DeliveryCheckFailure);self.assertEqual(calls,[])
        self.assert_boundary(frames,0,"OUTPUT_EXPORT_UNREADABLE")

    def test_generated_missing_input_echo_keys_still_fail_but_identify_the_exact_key(self):
        for key,label in (("testFlightInternalTestingOnly","INTERNAL_ONLY"),("method","METHOD"),("destination","DESTINATION"),("manageAppVersionAndBuildNumber","BUILD_NUMBER")):
            for origin,path in (("INPUT",self.root/"DiagnosticExportOptions.plist"),("OUTPUT",self.ipa.parent/"ExportOptions.plist")):
                options={"testFlightInternalTestingOnly":True,"method":"app-store-connect","destination":"export","manageAppVersionAndBuildNumber":False}
                del options[key];path.write_bytes(plistlib.dumps(options))
                with self.subTest(origin=origin,key=key),self.assertRaises(delivery.DeliveryCheckFailure) as failure:
                    delivery.verify_delivery_export(path,origin)
                self.assertEqual(failure.exception.category,origin+"_EXPORT_"+label+"_MISSING")

    def test_generated_policy_contradictions_are_not_normalized_away(self):
        options={"testFlightInternalTestingOnly":True,"method":"app-store-connect","destination":"export","manageAppVersionAndBuildNumber":False}
        for key,value,label in (("testFlightInternalTestingOnly",False,"INTERNAL_ONLY"),("testFlightInternalTestingOnly",1,"INTERNAL_ONLY"),("method","ad-hoc","METHOD"),("destination","upload","DESTINATION"),("manageAppVersionAndBuildNumber",True,"BUILD_NUMBER"),("manageAppVersionAndBuildNumber",0,"BUILD_NUMBER")):
            path=self.ipa.parent/"ExportOptions.plist";path.write_bytes(plistlib.dumps({**options,key:value}))
            with self.subTest(key=key,value=value),self.assertRaises(delivery.DeliveryCheckFailure) as failure:
                delivery.verify_delivery_export(path,"OUTPUT")
            self.assertEqual(failure.exception.category,"OUTPUT_EXPORT_"+label+"_REJECTED")

    def test_extra_xcode_keys_are_allowed_but_values_are_never_published(self):
        options={"testFlightInternalTestingOnly":True,"method":"app-store-connect","destination":"export","manageAppVersionAndBuildNumber":False,"provisioningProfiles":{self.canary:self.canary},"teamID":self.canary}
        path=self.ipa.parent/"ExportOptions.plist";path.write_bytes(plistlib.dumps(options))
        self.assertTrue(delivery.verify_delivery_export(path,"OUTPUT"))

    def test_malformed_or_oversized_sidecar_has_only_fixed_unreadable_category(self):
        path=self.ipa.parent/"ExportOptions.plist"
        for body in (self.canary.encode(),b"x"*65537):
            path.write_bytes(body)
            with self.assertRaises(delivery.DeliveryCheckFailure) as failure:delivery.verify_delivery_export(path,"OUTPUT")
            self.assertEqual(failure.exception.category,"OUTPUT_EXPORT_UNREADABLE")

    def test_public_emitter_rejects_private_or_contradictory_records_atomically(self):
        base=[{"stage":stage,"status":"NOT_RUN","category":"DEPENDENCY_FAILED"} for stage in delivery.DELIVERY_STAGES]
        for field in ("stage","status","category","private_path"):
            rows=copy.deepcopy(base);rows[0][field]=self.canary
            with self.subTest(field=field),patch.object(delivery.os,"write") as output,self.assertRaises(ValueError):
                delivery.emit_delivery(rows)
            output.assert_not_called()
        for index in (0,3,5):
            rows=copy.deepcopy(base);rows[index]={"stage":delivery.DELIVERY_STAGES[index],"status":"PASS","category":"NONE"}
            if index==0:rows[0]["category"]="APPLE_VALIDATION_FAILED"
            with patch.object(delivery.os,"write") as output,self.assertRaises(ValueError):delivery.emit_delivery(rows)
            output.assert_not_called()

    def test_failure_category_never_echoes_exception_or_native_command_values(self):
        for stage in delivery.DELIVERY_STAGES:
            value=delivery.delivery_failure_category(stage,ValueError(self.canary))
            self.assertIn(value,delivery.DELIVERY_CATEGORIES)
            self.assertNotIn(self.canary,value)
        with self.assertRaises(ValueError):delivery.DeliveryCheckFailure(self.canary)

    def test_ready_transfer_and_cli_guards_preserve_every_original_statement(self):
        old=delivery.cert.git("show",delivery.TRANSFER_BASE+":tools/apple_storekit_testflight_delivery.py").decode()
        current=(ROOT/"tools/apple_storekit_testflight_delivery.py").read_text()
        functions=lambda code:{n.name:ast.dump(n) for n in ast.parse(code).body if isinstance(n,ast.FunctionDef)}
        original,normalized=functions(old),functions(normalize_delivery_reporting(current))
        for name in ("ready","transfer","export_guard","api_token","apple_get","unused_build","authorization_guard","cleanup_delivery","finish"):
            self.assertEqual(original[name],normalized[name],name)
        before=functions(normalize_archive_cli(old));after=functions(normalize_archive_cli(current))
        self.assertEqual(before["main"],after["main"])

    def test_original_private_home_guards_run_before_ready_in_public_wrapper(self):
        source=(ROOT/"tools/apple_storekit_testflight_delivery.py").read_text()
        function=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=="transfer_public")
        precheck=next(n for n in function.body if isinstance(n,ast.FunctionDef) and n.name=="precheck")
        self.assertEqual(len(precheck.body),3)
        self.assertIn("RUNNER_OS",ast.unparse(precheck.body[0]))
        self.assertIn("CFFIXED_USER_HOME",ast.unparse(precheck.body[1]))
        self.assertEqual(ast.unparse(precheck.body[2]),"return ready(private, source, artifact)")

    def test_workflow_delta_is_only_a_fixed_public_descriptor_inside_existing_step(self):
        current=WORKFLOW.read_text()
        original=delivery.cert.git("show",delivery.TRANSFER_BASE+":"+str(WORKFLOW.relative_to(ROOT)).replace("\\","/")).decode()
        self.assertEqual(restore_delivery_reporting(current),original)
        for mutant in (current.replace("exec 3>&1","exec 3>&2",1),current.replace("actions: read","actions: write",1),current.replace("testFlightInternalTestingOnly","REMOVED",1)):
            with self.assertRaises(AssertionError):restore_delivery_reporting(mutant)


    def test_missing_generated_destination_is_identified_before_credentials_or_apple(self):
        def mutate():
            path=self.ipa.parent/"ExportOptions.plist"
            with path.open("rb") as stream:options=plistlib.load(stream)
            del options["destination"];path.write_bytes(plistlib.dumps(options))
        calls,frames,error=self.exercise(mutate=mutate)
        self.assertIsInstance(error,delivery.DeliveryCheckFailure);self.assertEqual(calls,[])
        self.assert_boundary(frames,0,"OUTPUT_EXPORT_DESTINATION_MISSING")
        self.assertFalse((self.root/"home/.appstoreconnect").exists())

    def test_controlled_input_identity_policy_is_never_bypassed(self):
        def mutate():
            path=self.root/"DiagnosticExportOptions.plist"
            with path.open("rb") as stream:options=plistlib.load(stream)
            options["manageAppVersionAndBuildNumber"]=True
            path.write_bytes(plistlib.dumps(options))
        calls,frames,error=self.exercise(mutate=mutate)
        self.assertIsInstance(error,delivery.DeliveryCheckFailure);self.assertEqual(calls,[])
        self.assert_boundary(frames,0,"INPUT_EXPORT_BUILD_NUMBER_REJECTED")

    def test_existing_public_report_cannot_authorize_a_second_delivery_execution(self):
        self.exercise()
        calls,frames,error=self.exercise()
        self.assertIsInstance(error,ValueError);self.assertEqual(calls,[]);self.assertEqual(frames,[])

    def test_real_workflow_shell_keeps_raw_child_output_private_and_preserves_exit(self):
        bash="C:/Program Files/Git/bin/bash.exe" if os.name=="nt" else "/bin/bash"
        text=WORKFLOW.read_text()
        step=text.split("      - name: Validate availability and deliver only the fully certified internal IPA\n",1)[1]
        step=step.split("      - name: Remove all private outputs",1)[0]
        body="\n".join(line[10:] for line in step.split("        run: |\n",1)[1].splitlines())+"\n"
        export=self.root/"gridly-diagnostic-export";export.mkdir()
        (export/"synthetic.ipa").write_bytes(b"NOT_A_REAL_IPA")
        (self.root/"logs").mkdir(exist_ok=True)
        environment={**os.environ,"DIAGNOSTIC_PRIVATE_ROOT":str(self.root).replace("\\","/"),
                     "DELIVERY_SOURCE_DIR":str(self.root).replace("\\","/"),
                     "RUNNER_TEMP":str(self.root).replace("\\","/"),"EXPECTED_COMMIT_SHA":COMMIT}
        rows=[{"stage":stage,"status":"NOT_RUN","category":"DEPENDENCY_FAILED"} for stage in delivery.DELIVERY_STAGES]
        rows[0]={"stage":delivery.DELIVERY_STAGES[0],"status":"FAIL","category":"LOCAL_VERIFICATION_REJECTED"}
        frame=json.dumps({"delivery_stages":rows})
        fake="python3() { printf '%s' '"+self.canary+"'; printf '%s\\n' '"+frame+"' >&3; return 73; }\n"
        result=subprocess.run([bash,"--noprofile","--norc"],input=fake+body,text=True,capture_output=True,env=environment)
        self.assertEqual(result.returncode,73)
        self.assertNotIn(self.canary,result.stdout+result.stderr)
        self.assertEqual(json.loads(result.stdout),{"delivery_stages":rows})
        self.assertIn(self.canary,(self.root/"logs/step-8.log").read_text())

    def test_exact_latest_parent_inventory_and_tag_protection_fail_closed(self):
        for options in ({"transfer_parent":"9"*40},{"transfer_parent":delivery.ENVIRONMENT_BASE+" "+"8"*40},{"transfer_inventory":b""},{"transfer_inventory":b"M\tjs/gridly-paid-ui.mjs"}):
            with self.subTest(options=options),patch.object(delivery,"source_guard",self.actual_source_guard),patch.object(delivery.cert,"git",side_effect=source_git(**options)),patch.object(delivery.subprocess,"run"),patch.object(delivery.cert,"original_contracts"),self.assertRaises(ValueError):
                delivery.source_guard(COMMIT,True)


class AppleIdDeliveryTests(SyntheticDeliveryTestCase):
    upload_authentication = "APPLE_ID"

    def test_explicit_apple_id_cases_keep_production_mode(self):
        self.assertEqual(os.environ["GRIDLY_UPLOAD_AUTHENTICATION"], "APPLE_ID")

    def setUp(self):
        self.actual_source_guard = delivery.source_guard
        CertificationAndTransferTests.setUp(self)

    def bind(self):
        value = owner_automatic_authorization()
        value[delivery.APPLE_ID_AUTH_FIELD] = {
            **dict.fromkeys(delivery.UI_UNUSED_CONFIRMATIONS, True),
            "method": delivery.UI_UNUSED_METHOD, "owner_checked_at": STAMP, "independent_checked_at": STAMP,
        }
        self.save(value)
        return value

    def save(self, value):
        delivery.write_json(self.root / "reports/delivery-authorization.json",
                            {"authorization": value, "ref": REF, "source_commit": COMMIT, "build": "15"})

    def exercise(self, *, value=None, credentials=None, failure=None, on_progress=None):
        self.save(self.bind() if value is None else value)
        calls, stages = [], []
        secret = "SYNTHETIC_NOT_A_REAL_PASSWORD"
        class OnlyExistingAppleSecrets(dict):
            def get(values, key, default=None):
                self.assertIn(key, {"APPLE_ID_USERNAME", "APPLE_APP_SPECIFIC_PASSWORD"})
                return super().get(key, default)
        supplied = OnlyExistingAppleSecrets(APPLE_ID_USERNAME="synthetic@example.invalid",
                                            APPLE_APP_SPECIFIC_PASSWORD=secret) if credentials is None else credentials
        def execute(command, **options):
            if synthetic_transport_query(command, options): return
            calls.append(upload_action(command))
            self.assertEqual(command[:6], (["xcrun", "altool", "--upload-package", str(self.ipa), "--type", "ios"] if "--upload-package" in command else ["xcrun", "altool", "--type", "ios", "--file", str(self.ipa)]))
            self.assertEqual(command[-2:] if "--upload-package" in command else command[-3:-1], ["--password", "@env:APPLE_APP_SPECIFIC_PASSWORD"])
            self.assertNotIn(secret, command)
            self.assertEqual(options["env"]["APPLE_APP_SPECIFIC_PASSWORD"], secret)
            self.assertEqual(options["cwd"], self.root / "home")
            self.assertIs(options["check"], True)
            if failure == "validation" or failure == "upload" and upload_action(command) == "--upload-package":
                raise subprocess.CalledProcessError(1, command, stderr="SYNTHETIC_PRIVATE_NEVER_PUBLIC")
            if failure == "expiry_after_validation":
                delivery.time.time.return_value = NOW + 1801
            if failure == "changed_ipa":
                self.ipa.write_bytes(b"ALTERED")
        def no_api(*args):
            self.fail("Apple ID mode attempted API credential/token/query use")
        def progress(stage, status, category):
            stages.append((stage, status, category))
            if on_progress:
                on_progress(stage, status)
        error = None
        with patch.dict(os.environ, {"GRIDLY_UPLOAD_AUTHENTICATION": "APPLE_ID"}):
            try:
                delivery.transfer(self.root, COMMIT, self.ipa, credentials=supplied,
                                  token_factory=no_api, get=no_api, execute=execute, clock=lambda: NOW, progress=progress)
            except Exception as caught:
                error = caught
        return calls, stages, error

    def test_exact_owner_and_independent_ui_evidence_is_accepted_and_labeled_truthfully(self):
        value = self.bind()
        self.assertEqual(delivery.owner_authorization(value, COMMIT, REF, NOW), value)
        receipt = delivery.ui_unused_build(value, NOW)
        self.assertEqual(receipt["verification_method"], delivery.UI_UNUSED_METHOD)
        self.assertEqual(receipt["build"], "15")
        self.assertEqual(receipt["version"], "1.0.0")
        self.assertTrue(receipt["unused"])

    def test_every_missing_false_nonboolean_or_extra_ui_confirmation_fails(self):
        for field in delivery.UI_UNUSED_CONFIRMATIONS:
            for invalid in (False, 0, 1, None, "true"):
                value = self.bind()
                value[delivery.APPLE_ID_AUTH_FIELD][field] = invalid
                with self.subTest(field=field, invalid=invalid), self.assertRaises(ValueError):
                    delivery.owner_authorization(value, COMMIT, REF, NOW)
            value = self.bind()
            del value[delivery.APPLE_ID_AUTH_FIELD][field]
            with self.assertRaises(ValueError):
                delivery.owner_authorization(value, COMMIT, REF, NOW)
        value = self.bind()
        value[delivery.APPLE_ID_AUTH_FIELD]["private_account"] = "NEVER_PUBLIC"
        with self.assertRaises(ValueError):
            delivery.owner_authorization(value, COMMIT, REF, NOW)

    def test_missing_independent_check_cannot_be_replaced_by_owner_attestation(self):
        for invalid in (None, False, {}, [], {"authorized": True}):
            value = self.bind()
            value[delivery.APPLE_ID_AUTH_FIELD] = invalid
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                delivery.owner_authorization(value, COMMIT, REF, NOW)

    def test_wrong_evidence_method_cannot_claim_an_api_or_validation_result(self):
        for method in ("API", "APPLE_VALIDATION", "", None):
            value = self.bind()
            value[delivery.APPLE_ID_AUTH_FIELD]["method"] = method
            with self.assertRaises(ValueError):
                delivery.owner_authorization(value, COMMIT, REF, NOW)

    def test_both_ui_timestamps_must_be_genuine_fresh_utc_and_not_future(self):
        for field in ("owner_checked_at", "independent_checked_at"):
            for invalid in ("yesterday", None, STAMP.replace("Z", "+00:00"), "2026-99-99T99:99:99Z"):
                value = self.bind()
                value[delivery.APPLE_ID_AUTH_FIELD][field] = invalid
                with self.subTest(field=field, invalid=invalid), self.assertRaises(ValueError):
                    delivery.owner_authorization(value, COMMIT, REF, NOW)
        value = self.bind()
        for moment in (NOW - .001, NOW + 1800.001):
            with self.assertRaises(ValueError):
                delivery.owner_authorization(value, COMMIT, REF, moment)
        self.assertEqual(delivery.owner_authorization(value, COMMIT, REF, NOW + 1800), value)

    def test_independent_timestamp_expiry_is_checked_separately_from_owner(self):
        value = self.bind()
        value[delivery.APPLE_ID_AUTH_FIELD]["independent_checked_at"] = delivery.dt.datetime.fromtimestamp(
            NOW - 1801, delivery.dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        with self.assertRaises(ValueError):
            delivery.owner_authorization(value, COMMIT, REF, NOW)

    def test_owner_ui_timestamp_must_match_the_access_authorization(self):
        value = self.bind()
        value[delivery.APPLE_ID_AUTH_FIELD]["owner_checked_at"] = delivery.dt.datetime.fromtimestamp(
            NOW - 1, delivery.dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        with self.assertRaises(ValueError):
            delivery.owner_authorization(value, COMMIT, REF, NOW)

    def test_duplicate_ui_annotation_keys_are_rejected(self):
        text = json.dumps(self.bind()).replace('"independent_verified_unused": true',
                                               '"independent_verified_unused": true, "independent_verified_unused": false')
        with self.assertRaises(ValueError):
            json.loads(text, object_pairs_hook=delivery.cert.unique_json_object)

    def test_no_pending_or_uncertain_upload_or_exclusive_window_cannot_be_omitted(self):
        for name in ("no_pending_or_uncertain_uploads", "exclusive_upload_window_acknowledged"):
            value = self.bind()
            value[delivery.APPLE_ID_AUTH_FIELD][name] = False
            calls, stages, error = self.exercise(value=value)
            self.assertIsInstance(error, ValueError)
            self.assertEqual(calls, [])
            self.assertEqual(stages[-1][0:2], (delivery.DELIVERY_STAGES[0], "FAIL"))

    def test_annotated_authorization_requires_ui_evidence_before_build_and_secrets(self):
        value = self.bind()
        values = {
            ("rev-parse", "HEAD"): COMMIT.encode(),
            ("rev-parse", "--verify", delivery.cert.DIAGNOSTIC_BRANCH): COMMIT.encode(),
            ("cat-file", "-t", REF): b"tag",
            ("rev-parse", "--verify", REF): b"5" * 40,
        }
        def annotate(candidate):
            values[("cat-file", "-p", REF)] = (
                "object " + COMMIT + "\ntype commit\ntag " + REF.removeprefix("refs/tags/")
                + "\ntagger Synthetic\n\n" + json.dumps(candidate)).encode()
        with patch.dict(os.environ, {"GRIDLY_UPLOAD_AUTHENTICATION": "APPLE_ID"}), patch.object(
                delivery.cert, "git", side_effect=lambda *args: values[args]), patch.object(
                delivery, "read_json", return_value=event()), patch.object(delivery, "apple_id_command") as credentials:
            annotate(value)
            self.assertEqual(delivery.authorize(REF, COMMIT, "synthetic", "1")["authorization"], value)
            del value[delivery.APPLE_ID_AUTH_FIELD]
            annotate(value)
            with self.assertRaisesRegex(ValueError, "explicit Apple ID UI authorization required"):
                delivery.authorize(REF, COMMIT, "synthetic", "1")
            credentials.assert_not_called()

    def test_only_existing_apple_secrets_validate_then_upload_once_without_api(self):
        before = self.ipa.read_bytes()
        calls, stages, error = self.exercise()
        self.assertIsNone(error)
        self.assertEqual(calls, ["--validate-app", "--upload-package"])
        self.assertEqual(self.ipa.read_bytes(), before)
        self.assertEqual([r[0] for r in stages if r[1] == "PASS"], list(delivery.DELIVERY_STAGES))
        self.assertFalse((self.root / "home/.appstoreconnect").exists())
        receipt = delivery.read_json(self.root / "reports/delivery-availability.json")
        self.assertEqual(receipt["verification_method"], delivery.UI_UNUSED_METHOD)
        self.assertEqual(delivery.read_json(self.root / "reports/delivery-transfer.json")["status"], "ACCEPTED")

    def test_missing_ui_authorization_in_workflow_mode_never_reads_api_credentials(self):
        calls, stages, error = self.exercise(value=owner_automatic_authorization())
        self.assertIsInstance(error, ValueError)
        self.assertEqual(calls, [])
        self.assertEqual(stages[-1], (delivery.DELIVERY_STAGES[1], "FAIL", "APPLE_ID_AUTHORIZATION_REJECTED"))

    def test_missing_or_bad_apple_secret_cannot_fall_back_to_api(self):
        for values in ({}, {"APPLE_ID_USERNAME": "synthetic@example.invalid"},
                       {"APPLE_APP_SPECIFIC_PASSWORD": "synthetic"},
                       {"APPLE_ID_USERNAME": "synthetic@example.invalid\n", "APPLE_APP_SPECIFIC_PASSWORD": "synthetic"},
                       {"APPLE_ID_USERNAME": "synthetic@example.invalid", "APPLE_APP_SPECIFIC_PASSWORD": "synthetic\n"}):
            calls, stages, error = self.exercise(credentials=values)
            self.assertIsInstance(error, ValueError)
            self.assertEqual(calls, [])
            self.assertEqual(stages[-1], (delivery.DELIVERY_STAGES[1], "FAIL", "APPLE_ID_CREDENTIALS_REJECTED"))

    def test_apple_validation_failure_never_reaches_unused_receipt_or_upload(self):
        calls, stages, error = self.exercise(failure="validation")
        self.assertIsInstance(error, subprocess.CalledProcessError)
        self.assertEqual(calls, ["--validate-app"])
        self.assertEqual(stages[-1][0:2], (delivery.DELIVERY_STAGES[2], "FAIL"))
        self.assertFalse((self.root / "reports/delivery-transfer.json").exists())

    def test_expired_owner_checks_after_apple_validation_block_upload(self):
        calls, stages, error = self.exercise(failure="expiry_after_validation")
        self.assertIsInstance(error, ValueError)
        self.assertEqual(calls, ["--validate-app"])
        self.assertEqual(stages[-1][0:2], (delivery.DELIVERY_STAGES[3], "FAIL"))

    def test_ui_evidence_is_rechecked_after_post_validation_and_immediately_before_upload(self):
        def expire(stage, status):
            if stage == delivery.DELIVERY_STAGES[4] and status == "RUNNING":
                delivery.time.time.return_value = NOW + 1801
        calls, stages, error = self.exercise(on_progress=expire)
        self.assertIsInstance(error, ValueError)
        self.assertEqual(calls, ["--validate-app"])
        self.assertEqual(stages[-1][0:2], (delivery.DELIVERY_STAGES[4], "FAIL"))
        self.assertFalse((self.root / "reports/delivery-transfer.json").exists())

    def test_signed_ipa_mutation_still_blocks_upload(self):
        calls, stages, error = self.exercise(failure="changed_ipa")
        self.assertIsInstance(error, ValueError)
        self.assertEqual(calls, ["--validate-app"])
        self.assertEqual(stages[-1][2], "IPA_BYTES_CHANGED")

    def test_uncertain_apple_id_upload_is_recorded_and_never_retried(self):
        calls, stages, error = self.exercise(failure="upload")
        self.assertIsInstance(error, subprocess.CalledProcessError)
        self.assertEqual(calls.count("--upload-package"), 1)
        self.assertEqual(delivery.read_json(self.root / "reports/delivery-transfer.json")["status"], "ATTEMPTED")
        self.assertEqual(stages[-1][2], "UPLOAD_NO_TOOL_OUTPUT")
        calls, stages, error = self.exercise()
        self.assertIsInstance(error, ValueError)
        self.assertEqual(calls, [])

    def test_owner_only_access_and_public_release_holds_remain_mandatory(self):
        for field in ("no_unapproved_internal_access_confirmed", "testflight_upload_authorized"):
            value = self.bind()
            value[field] = False
            calls, stages, error = self.exercise(value=value)
            self.assertIsInstance(error, ValueError)
            self.assertEqual(calls, [])
        value = self.bind()
        value[delivery.OWNER_AUTO_FIELD]["authorized_owner_account_count"] = 3
        calls, stages, error = self.exercise(value=value)
        self.assertIsInstance(error, ValueError)
        self.assertEqual(calls, [])

    def test_public_error_categories_never_include_credentials_or_private_exceptions(self):
        for message, category in (
            ("existing Apple ID upload credentials required", "APPLE_ID_CREDENTIALS_REJECTED"),
            ("complete independent UI build evidence required", "UI_BUILD_EVIDENCE_REJECTED"),
            ("independent UI build evidence expired", "UI_BUILD_EVIDENCE_REJECTED")):
            self.assertEqual(delivery.delivery_failure_category(delivery.DELIVERY_STAGES[1], ValueError(message)), category)
        self.assertEqual(delivery.delivery_failure_category(delivery.DELIVERY_STAGES[2], ValueError("SYNTHETIC_PASSWORD")),
                         "APPLE_VALIDATION_FAILED")

    def test_workflow_only_binds_existing_apple_upload_secrets_after_signed_certification(self):
        text = WORKFLOW.read_text()
        begin = text.index("      - name: Validate availability and deliver only")
        block = text[begin:text.index("      - name: Remove all private outputs", begin)]
        self.assertIn("APPLE_ID_USERNAME: ${{ secrets.APPLE_ID_USERNAME }}", block)
        self.assertIn("APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}", block)
        self.assertNotIn("ASC_KEY", block)
        self.assertNotIn("ASC_ISSUER", block)
        self.assertNotIn("ASC_PRIVATE", block)
        self.assertIn("GRIDLY_UPLOAD_AUTHENTICATION: 'APPLE_ID'", text)
        self.assertLess(text.index("apple_storekit_testflight_delivery.py authorize"), text.index("secrets."))
        self.assertLess(text.index("apple_storekit_diagnostic_certification.py certify"), begin)
        self.assertEqual(restore_apple_id_workflow(text), delivery.cert.git(
            "show", delivery.AUTH_BASE + ":.github/workflows/gridly-storekit-testflight-delivery.yml").decode())
        self.assertEqual(restore_delivery_reporting(restore_delivery_reporting(text)), restore_delivery_reporting(text))
        for mutant in (text.replace("GRIDLY_UPLOAD_AUTHENTICATION: 'APPLE_ID'", "GRIDLY_UPLOAD_AUTHENTICATION: 'API'"),
                       text.replace("secrets.APPLE_APP_SPECIFIC_PASSWORD", "secrets.UNREVIEWED_PASSWORD")):
            with self.assertRaises(AssertionError):
                restore_apple_id_workflow(mutant)

    def test_cleanup_and_native_signing_functions_are_identical_to_reviewed_source(self):
        old = delivery.cert.git("show", delivery.AUTH_BASE + ":tools/apple_storekit_testflight_delivery.py").decode()
        current = (ROOT / "tools/apple_storekit_testflight_delivery.py").read_text()
        functions = lambda text: {n.name: ast.dump(n) for n in ast.parse(text).body if isinstance(n, ast.FunctionDef)}
        before, after = functions(old), functions(normalize_recovery(current))
        for name in ("cleanup_delivery", "cleanup_errno", "finish", "ready", "export_guard",
                     "prepare_signing_context", "install_runner_profile", "restore_keychain_context",
                     "archive_report", "api_token", "apple_get", "unused_build"):
            self.assertEqual(before[name], after[name], name)

    def test_new_direct_parent_and_its_inventory_are_pinned(self):
        for options in ({"auth_parent": "9" * 40}, {"auth_parent": delivery.TRANSFER_BASE + " " + "8" * 40},
                        {"auth_inventory": b""}, {"auth_inventory": b"M\tjs/gridly-paid-ui.mjs"}):
            with patch.object(delivery, "source_guard", self.actual_source_guard), patch.object(
                    delivery.cert, "git", side_effect=source_git(**options)), patch.object(delivery.subprocess, "run"), patch.object(
                    delivery.cert, "original_contracts"), self.assertRaises(ValueError):
                delivery.source_guard(COMMIT, True)


    def test_test_mode_parent_and_inventory_fail_closed(self):
        records = ["M\t" + path for path in sorted(delivery.TEST_MODE_FILES)]
        bad = ({"parent": delivery.AUTH_BASE}, {"parent": delivery.APPLE_ID_BASE + " " + "8" * 40},
               {"apple_id_parent": "9" * 40}, {"apple_id_parent": delivery.AUTH_BASE + " " + "8" * 40},
               {"apple_id_inventory": b""}, {"apple_id_inventory": b"M\tjs/gridly-paid-ui.mjs"},
               {"correction": "\n".join(records + ["M\t.github/workflows/gridly-storekit-testflight-delivery.yml"]).encode()})
        for options in bad:
            with self.subTest(options=options), patch.object(delivery, "source_guard", self.actual_source_guard), patch.object(
                    delivery.cert, "git", side_effect=source_git(**options)), patch.object(
                    delivery.subprocess, "run"), patch.object(delivery.cert, "original_contracts"), self.assertRaises(ValueError):
                delivery.source_guard(COMMIT, True)

    def test_test_mode_correction_changes_no_production_function_except_source_guard(self):
        old = delivery.cert.git("show", delivery.APPLE_ID_BASE + ":tools/apple_storekit_testflight_delivery.py").decode()
        current = delivery.cert.git("show", delivery.UPLOAD_BASE + ":tools/apple_storekit_testflight_delivery.py").decode()
        functions = lambda text: {n.name: ast.dump(n) for n in ast.parse(text).body if isinstance(n, (ast.FunctionDef, ast.ClassDef))}
        before, after = functions(old), functions(current)
        self.assertEqual(before.keys(), after.keys())
        for name in before.keys() - {"source_guard"}:
            self.assertEqual(before[name], after[name], name)
        self.assertEqual(WORKFLOW.read_bytes().replace(b"\r\n", b"\n"),
                         delivery.cert.git("show", delivery.APPLE_ID_BASE + ":.github/workflows/gridly-storekit-testflight-delivery.yml"))
        self.assertEqual(delivery.TEST_MODE_FILES, {
            "tools/apple_storekit_testflight_delivery.py", "tests/storekit-testflight-delivery.test.py"})

class UploadFailureTests(SyntheticDeliveryTestCase):
    cases = (
        (b"Authentication failed CANARY", "UPLOAD_AUTHENTICATION_REJECTED"),
        (b"Redundant Binary Upload CANARY", "UPLOAD_BUILD_ALREADY_PRESENT"),
        (b"Build number has already been used CANARY", "UPLOAD_BUILD_ALREADY_PRESENT"),
        (b"ERROR ITMS-90035 CANARY", "UPLOAD_APPLE_PACKAGE_REJECTED"),
        (b"File CANARY does not exist", "UPLOAD_LOCAL_FILE_UNREADABLE"),
        (b"Connection reset CANARY", "UPLOAD_TRANSPORT_OR_SERVICE_UNCERTAIN"),
        (b"HTTP status 503 CANARY", "UPLOAD_TRANSPORT_OR_SERVICE_UNCERTAIN"),
        (b"", "UPLOAD_NO_TOOL_OUTPUT"),
        (b"CANARY unknown error", "UPLOAD_UNCLASSIFIED_TOOL_ERROR"),
    )

    def test_fixed_categories_never_return_raw_output(self):
        for raw, expected in self.cases:
            with self.subTest(expected=expected):
                self.assertEqual(delivery.classify_upload_error(raw), expected)
                self.assertNotIn("CANARY", delivery.classify_upload_error(raw))
                self.assertIn(expected, delivery.DELIVERY_CATEGORIES)
        self.assertEqual(delivery.classify_upload_error(b"Authentication failed" + b"x"*65536),
                         "UPLOAD_UNCLASSIFIED_TOOL_ERROR")

    def test_upload_runs_once_and_output_is_private_and_removed(self):
        for raw, expected in self.cases:
            with self.subTest(expected=expected), tempfile.TemporaryDirectory() as directory:
                root=Path(directory); fixture(root); calls=[]; streams=[]
                command=["xcrun","altool","--username","synthetic@example.invalid","--password","@env:APPLE_APP_SPECIFIC_PASSWORD","--upload-package"]
                def execute(cmd, **options):
                    calls.append(cmd); private=options["stdout"]; streams.append(private)
                    self.assertEqual(options["stderr"],subprocess.STDOUT)
                    self.assertIs(options["check"],True)
                    self.assertEqual(options["cwd"],root/"home")
                    private.write(raw)
                    raise subprocess.CalledProcessError(1,cmd)
                with contextlib.redirect_stdout(io.StringIO()) as out, contextlib.redirect_stderr(io.StringIO()) as err:
                    with self.assertRaises(subprocess.CalledProcessError) as failure:
                        delivery.execute_upload(root,command,execute,env={"APPLE_APP_SPECIFIC_PASSWORD":"SYNTHETIC_SECRET"})
                self.assertEqual(calls,[command])
                self.assertEqual(out.getvalue()+err.getvalue(),"")
                self.assertEqual(delivery.delivery_failure_category("D06_ACTUAL_UPLOAD",failure.exception),expected)
                self.assertIsNone(failure.exception.stdout); self.assertIsNone(failure.exception.stderr)
                self.assertTrue(streams[0].closed)
                self.assertEqual(list((root/"logs").iterdir()),[])

    def test_success_keeps_exact_proven_command_and_password_environment(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);fixture(root);calls=[]
            command=["xcrun","altool","--upload-package"]
            def execute(cmd, **options):
                calls.append(cmd);self.assertEqual(options["env"],{"APPLE_APP_SPECIFIC_PASSWORD":"SYNTHETIC_SECRET"})
            delivery.execute_upload(root,command,execute,env={"APPLE_APP_SPECIFIC_PASSWORD":"SYNTHETIC_SECRET"})
            self.assertEqual(calls,[command]);self.assertEqual(list((root/"logs").iterdir()),[])

    def test_unowned_log_directory_cannot_run_upload(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)/"owned";root.mkdir();fixture(root)
            (root/".owned").unlink()
            with patch.object(delivery.subprocess,"run") as execute,self.assertRaises(ValueError):
                delivery.execute_upload(root,["xcrun","altool","--upload-package"],execute)
            execute.assert_not_called()

    def test_current_upload_parent_inventory_and_tag_fail_closed(self):
        for options in ({"parent":delivery.APPLE_ID_BASE},{"parent":delivery.UPLOAD_BASE+" "+"9"*40},
                        {"upload_parent":"9"*40},{"upload_inventory":b""},
                        {"upload_inventory":b"M\tjs/gridly-paid-ui.mjs"},
                        {"missing_tag":"gridly-storekit-testflight-deliver-15-"+delivery.UPLOAD_BASE}):
            with self.subTest(options=options),patch.object(delivery.cert,"git",side_effect=source_git(**options)),patch.object(
                    delivery.subprocess,"run"),patch.object(delivery.cert,"original_contracts"),self.assertRaises((ValueError,subprocess.CalledProcessError)):
                delivery.source_guard(COMMIT,True)

    def test_only_d06_output_handling_and_source_guard_changed(self):
        old=delivery.cert.git("show",delivery.UPLOAD_BASE+":tools/apple_storekit_testflight_delivery.py").decode()
        current=normalize_prior_attempt((ROOT/"tools/apple_storekit_testflight_delivery.py").read_text())
        funcs=lambda value:{n.name:ast.dump(n) for n in ast.parse(value).body if isinstance(n,(ast.FunctionDef,ast.ClassDef))}
        before,after=funcs(old),funcs(current)
        self.assertEqual(set(after)-set(before),{"classify_upload_error","execute_upload","write_upload_status","upload_diagnostics","upload_once","remove_owned_workspace","prior_attempt_evidence","prior_attempt_slot"})
        for name in before.keys()-{"source_guard","transfer","delivery_failure_category","cleanup_delivery","finish"}:
            self.assertEqual(before[name],after[name],name)
        normalized=funcs(normalize_apple_id_delivery(current))
        normalized_old=funcs(normalize_apple_id_delivery(old))
        self.assertEqual(normalized["transfer"],normalized_old["transfer"])
        self.assertEqual(normalized["delivery_failure_category"],normalized_old["delivery_failure_category"])
        restored=funcs(normalize_recovery(current))
        for name in ("cleanup_delivery","finish"):
            self.assertEqual(restored[name],before[name],name)
        self.assertEqual(WORKFLOW.read_bytes().replace(b"\r\n",b"\n"),
                         delivery.cert.git("show",delivery.UPLOAD_BASE+":.github/workflows/gridly-storekit-testflight-delivery.yml"))



class UploadRecoveryReliabilityTests(SyntheticDeliveryTestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.ipa,self.guard=fixture(self.root)
        self.command=['xcrun','altool','--username','SYNTHETIC_PRIVATE_USER','--upload-package']
        self.marker=self.root/'reports/delivery-transfer.json'

    def run_upload(self, error=None):
        calls=[]
        def execute(command, **options):
            calls.append(command)
            options['stdout'].write(b'SYNTHETIC_PRIVATE_OUTPUT Authentication failed')
            if error is not None:raise error
            return subprocess.CompletedProcess(command,0)
        caught=None
        with contextlib.redirect_stdout(io.StringIO()) as out, contextlib.redirect_stderr(io.StringIO()) as err:
            try:delivery.upload_once(self.root,COMMIT,self.command,execute)
            except BaseException as value:caught=value
        self.assertEqual(out.getvalue()+err.getvalue(),'')
        self.assertEqual(calls,[self.command])
        if caught is not None:
            self.assertNotIn('SYNTHETIC_PRIVATE',str(caught))
        return caught

    def test_process_success_atomically_records_zero_not_independent_apple_processing(self):
        self.assertIsNone(self.run_upload())
        value=delivery.read_json(self.marker)
        self.assertEqual(value['status'],'ACCEPTED')
        self.assertEqual(value['uploader_outcome'],'RETURNED_ZERO')
        self.assertEqual(value['uploader_exit_code'],0)
        self.assertEqual(value['apple_processing'],'NOT_VERIFIED')
        self.assertFalse(list(self.marker.parent.glob('.upload-status-*')))

    def test_nonzero_exit_and_classification_are_sanitized_and_persisted(self):
        error=self.run_upload(subprocess.CalledProcessError(23,self.command,output=b'SYNTHETIC_PRIVATE_OUTPUT',stderr=b'SYNTHETIC_PRIVATE_ERROR'))
        self.assertIsInstance(error,subprocess.CalledProcessError)
        self.assertEqual(error.returncode,23)
        self.assertIsNone(error.stdout);self.assertIsNone(error.stderr)
        self.assertEqual(error.cmd,['xcrun','altool','--upload-package'])
        self.assertEqual(delivery.delivery_failure_category('D06_ACTUAL_UPLOAD',error),'UPLOAD_AUTHENTICATION_REJECTED')
        value=delivery.read_json(self.marker)
        self.assertEqual((value['status'],value['uploader_outcome'],value['uploader_exit_code']),('ATTEMPTED','RETURNED_NONZERO',23))
        self.assertNotIn('SYNTHETIC_PRIVATE',json.dumps(value))

    def test_process_invocation_failure_is_fixed_and_uncertain(self):
        error=self.run_upload(FileNotFoundError(errno.ENOENT,'SYNTHETIC_PRIVATE_ERROR','SYNTHETIC_PRIVATE_PATH'))
        self.assertEqual(error.category,'UPLOAD_PROCESS_INVOCATION_FAILED')
        self.assertEqual(delivery.read_json(self.marker)['uploader_outcome'],'INVOCATION_FAILED')

    def test_timeout_and_interrupt_never_become_success_or_retry(self):
        for error,category,outcome in (
            (subprocess.TimeoutExpired(self.command,1,output=b'SYNTHETIC_PRIVATE_OUTPUT'),'UPLOAD_PROCESS_TIMEOUT_UNCERTAIN','TIMED_OUT_UNCERTAIN'),
            (KeyboardInterrupt('SYNTHETIC_PRIVATE_INTERRUPT'),'UPLOAD_PROCESS_INTERRUPTED_UNCERTAIN','INTERRUPTED_UNCERTAIN'),
            (SystemExit('SYNTHETIC_PRIVATE_INTERRUPT'),'UPLOAD_PROCESS_INTERRUPTED_UNCERTAIN','INTERRUPTED_UNCERTAIN')):
            with self.subTest(category=category):
                self.marker.unlink(missing_ok=True)  # Independent synthetic scenario, never a real retry.
                caught=self.run_upload(error)
                self.assertEqual(caught.category,category)
                value=delivery.read_json(self.marker)
                self.assertEqual((value['status'],value['uploader_outcome']),('ATTEMPTED',outcome))

    def test_signal_termination_stays_uncertain(self):
        error=self.run_upload(subprocess.CalledProcessError(-15,self.command))
        self.assertEqual(delivery.delivery_failure_category('D06_ACTUAL_UPLOAD',error),'UPLOAD_PROCESS_SIGNALED_UNCERTAIN')
        self.assertEqual(delivery.read_json(self.marker)['uploader_exit_code'],-15)

    def test_failure_to_record_attempt_prevents_process_invocation(self):
        with patch.object(delivery,'write_upload_status',side_effect=PermissionError('SYNTHETIC_PRIVATE')),patch.object(delivery,'execute_upload') as execute:
            with self.assertRaises(delivery.DeliveryCheckFailure) as error:
                delivery.upload_once(self.root,COMMIT,self.command,execute)
        self.assertEqual(error.exception.category,'UPLOAD_ATTEMPT_STATUS_FAILED');execute.assert_not_called()

    def test_process_zero_but_acceptance_record_failure_preserves_attempt_marker(self):
        replace=delivery.os.replace;calls=[]
        def atomic(src,dst):
            calls.append(1)
            if len(calls)==2:raise PermissionError('SYNTHETIC_PRIVATE_PATH')
            return replace(src,dst)
        with patch.object(delivery.os,'replace',side_effect=atomic):error=self.run_upload()
        self.assertEqual(error.category,'UPLOAD_SUCCESS_STATUS_PERSISTENCE_FAILED')
        self.assertEqual(delivery.read_json(self.marker)['status'],'ATTEMPTED')
        self.assertEqual(delivery.read_json(self.marker)['uploader_outcome'],'UNDETERMINED')
        self.assertFalse(list(self.marker.parent.glob('.upload-status-*')))

    def test_failed_process_status_persistence_is_separate_and_still_uncertain(self):
        write=delivery.write_upload_status;calls=[]
        def record(root,value):
            calls.append(1)
            if len(calls)==2:raise PermissionError('SYNTHETIC_PRIVATE')
            return write(root,value)
        with patch.object(delivery,'write_upload_status',side_effect=record):
            error=self.run_upload(subprocess.CalledProcessError(7,self.command))
        self.assertEqual(error.category,'UPLOAD_FAILURE_STATUS_PERSISTENCE_FAILED')
        self.assertEqual(delivery.read_json(self.marker)['status'],'ATTEMPTED')

    def test_capture_setup_failure_does_not_invoke_uploader(self):
        with patch.object(delivery.tempfile,'TemporaryFile',side_effect=PermissionError('SYNTHETIC_PRIVATE')),patch.object(delivery.subprocess,'run') as execute:
            with self.assertRaises(delivery.DeliveryCheckFailure) as error:
                delivery.upload_once(self.root,COMMIT,self.command,execute)
        self.assertEqual(error.exception.category,'UPLOAD_OUTPUT_CAPTURE_FAILED');execute.assert_not_called()
        self.assertEqual(delivery.read_json(self.marker)['uploader_outcome'],'OUTPUT_SETUP_FAILED')

    def test_new_summary_distinguishes_process_success_from_apple_confirmation(self):
        self.run_upload()
        clean={'status':'PASS','stages':{},'resources':{}}
        with patch.object(delivery.cert,'private_directory',return_value=self.root),patch.object(delivery,'cleanup_delivery',return_value=clean):
            result=delivery.finish('unused','success')
        self.assertEqual(result['upload'],'UPLOADER_SUCCEEDED_APPLE_UNCONFIRMED')
        self.assertEqual(result['upload_diagnostics']['apple_processing'],'NOT_VERIFIED')
        self.assertEqual(result['certification'],'PASS')

    def test_existing_attempt_blocks_every_second_invocation(self):
        self.run_upload()
        with patch.object(delivery, "execute_upload") as execute,self.assertRaises(ValueError):
            delivery.upload_once(self.root,COMMIT,self.command,execute)
        execute.assert_not_called()

    def test_unexpected_process_exception_never_exposes_raw_message(self):
        error=self.run_upload(RuntimeError("SYNTHETIC_PRIVATE_ERROR"))
        self.assertEqual(error.category,"UPLOAD_PROCESS_OUTCOME_UNCERTAIN")
        self.assertEqual(delivery.read_json(self.marker)["status"],"ATTEMPTED")

    def test_mocked_status_symlink_blocks_upload_without_reading_target(self):
        original=Path.is_symlink
        def linked(path):return path==self.marker or original(path)
        with patch.object(Path,"is_symlink",new=linked),patch.object(delivery,"execute_upload") as execute,self.assertRaises(ValueError):
            delivery.upload_once(self.root,COMMIT,self.command,execute)
        execute.assert_not_called()

    def test_status_marker_symlink_cannot_overwrite_external_file(self):
        outside=self.root/'outside-canary';outside.write_text('SYNTHETIC_PRIVATE')
        try:self.marker.symlink_to(outside)
        except OSError:self.skipTest('Windows symlink privilege unavailable')
        with patch.object(delivery,'execute_upload') as execute,self.assertRaises(ValueError):
            delivery.upload_once(self.root,COMMIT,self.command,execute)
        execute.assert_not_called();self.assertEqual(outside.read_text(),'SYNTHETIC_PRIVATE')

    def test_recovery_normalization_is_idempotent_and_rejects_gate_mutations(self):
        current=(ROOT/"tools/apple_storekit_testflight_delivery.py").read_text()
        normalized=normalize_recovery(current)
        self.assertEqual(normalize_recovery(normalized),normalized)
        for before,after in (("        upload_once(root, commit,", '        upload_once(root, "UNAPPROVED",'),
                             ("remove_owned_workspace(root, owned, workspace_details)","remove_owned_workspace(root, None, workspace_details)"),
                             ('result["upload_diagnostics"] = upload_diagnostics(transfer_report)', 'result["upload_diagnostics"] = upload_diagnostics({})')):
            mutant=current.replace(before,after,1)
            with self.subTest(before=before),self.assertRaises(AssertionError):normalize_recovery(mutant)

    def test_unknown_process_fields_cannot_enter_summary(self):
        result=delivery.upload_diagnostics({'uploader_outcome':'SYNTHETIC_PRIVATE','uploader_exit_code':'SYNTHETIC_PRIVATE','apple_processing':'ACCEPTED'})
        self.assertEqual(result,{'uploader_outcome':'UNDETERMINED','uploader_exit_code':None,'apple_processing':'NOT_VERIFIED'})


class OwnedWorkspaceRecoveryTests(SyntheticDeliveryTestCase):
    @contextlib.contextmanager
    def workspace(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=delivery.cert.private_directory(temporary);root.mkdir()
            (root/'.owned').write_text(delivery.cert.PRIVATE_MARKER)
            (root/'home').mkdir();(root/'home/child').write_text('SYNTHETIC_PRIVATE')
            identity=(root.stat().st_dev,root.stat().st_ino)
            def owned():
                delivery.require(root.is_dir() and not root.is_symlink() and (root/'.owned').is_file()
                    and not (root/'.owned').is_symlink() and (root/'.owned').read_text()==delivery.cert.PRIVATE_MARKER
                    and (root.stat().st_dev,root.stat().st_ino)==identity,'unowned workspace')
            yield root,owned,{}

    def test_owned_tree_is_removed_without_touching_sibling(self):
        with self.workspace() as (root,owned,details):
            outside=root.parent/'outside';outside.write_text('SYNTHETIC_PRIVATE')
            delivery.remove_owned_workspace(root,owned,details)
            self.assertFalse(root.exists());self.assertEqual(outside.read_text(),'SYNTHETIC_PRIVATE')
            self.assertEqual(details['operation'],'REMOVE_WORKSPACE_ROOT')

    def test_eacces_keeps_marker_and_reports_exact_operation_without_paths(self):
        with self.workspace() as (root,owned,details):
            def denied(path,**options):
                error=PermissionError(errno.EACCES,'SYNTHETIC_PRIVATE',str(path/'child'))
                options['onerror'](delivery.os.unlink,path/'child',(PermissionError,error,None))
            with patch.object(delivery.shutil,'rmtree',side_effect=denied) as remove:
                with self.assertRaises(PermissionError):delivery.remove_owned_workspace(root,owned,details)
            self.assertEqual(remove.call_count,1)
            self.assertEqual(details,{'operation':'REMOVE_FILE','resource_class':'PRIVATE_HOME'})
            self.assertEqual((root/'.owned').read_text(),delivery.cert.PRIVATE_MARKER)
            self.assertTrue(root.exists());self.assertNotIn('SYNTHETIC_PRIVATE',json.dumps(details))

    def test_partial_child_removal_can_be_reentered_with_intact_ownership(self):
        with self.workspace() as (root,owned,details):
            remove=delivery.shutil.rmtree
            def partial(path,**options):
                (path/'child').unlink()
                raise PermissionError(errno.EACCES,'SYNTHETIC_PRIVATE')
            with patch.object(delivery.shutil,'rmtree',side_effect=partial):
                with self.assertRaises(PermissionError):delivery.remove_owned_workspace(root,owned,details)
            self.assertTrue((root/'.owned').is_file())
            delivery.remove_owned_workspace(root,owned,details)
            self.assertFalse(root.exists())

    def test_missing_or_invalid_marker_cannot_delete_owned_children(self):
        for kind in ('missing','invalid'):
            with self.subTest(kind=kind),self.workspace() as (root,owned,details):
                if kind=='missing':(root/'.owned').unlink()
                else:(root/'.owned').write_text('INVALID')
                with patch.object(delivery.shutil,'rmtree') as remove,self.assertRaises(ValueError):
                    delivery.remove_owned_workspace(root,owned,details)
                remove.assert_not_called();self.assertTrue((root/'home/child').exists())

    def test_directory_link_target_remains_untouched(self):
        with self.workspace() as (root,owned,details):
            outside=root.parent/'outside';outside.mkdir();(outside/'canary').write_text('SYNTHETIC_PRIVATE')
            try:(root/'link').symlink_to(outside,target_is_directory=True)
            except OSError:self.skipTest('Windows symlink privilege unavailable')
            delivery.remove_owned_workspace(root,owned,details)
            self.assertFalse(root.exists());self.assertEqual((outside/'canary').read_text(),'SYNTHETIC_PRIVATE')

    def test_mocked_marker_symlink_blocks_deletion_without_target_access(self):
        with self.workspace() as (root,owned,details):
            original=Path.is_symlink
            def linked(path):return path==root/".owned" or original(path)
            with patch.object(Path,"is_symlink",new=linked),patch.object(delivery.shutil,"rmtree") as remove,self.assertRaises(ValueError):
                delivery.remove_owned_workspace(root,owned,details)
            remove.assert_not_called();self.assertTrue((root/"home/child").exists())

    def test_mocked_root_symlink_blocks_deletion(self):
        with self.workspace() as (root,owned,details):
            original=Path.is_symlink
            def linked(path):return path==root or original(path)
            with patch.object(Path,"is_symlink",new=linked),patch.object(delivery.shutil,"rmtree") as remove,self.assertRaises(ValueError):
                delivery.remove_owned_workspace(root,owned,details)
            remove.assert_not_called();self.assertTrue((root/"home/child").exists())

    def test_mocked_child_link_is_unlinked_without_recursive_traversal(self):
        with self.workspace() as (root,owned,details):
            link=root/"link";link.write_text("SYNTHETIC_LINK")
            original=Path.lstat; visited=[];remove=delivery.shutil.rmtree
            def linked(path,*args,**options):
                value=original(path,*args,**options)
                if path==link:
                    values=list(value);values[0]=delivery.stat.S_IFLNK|0o700
                    return delivery.os.stat_result(values)
                return value
            def tree(path,**options):
                visited.append(path);return remove(path,**options)
            with patch.object(Path,"lstat",new=linked),patch.object(delivery.shutil,"rmtree",side_effect=tree):
                delivery.remove_owned_workspace(root,owned,details)
            self.assertNotIn(link,visited);self.assertFalse(root.exists())

    def test_root_link_is_rejected_without_traversing_target(self):
        with self.workspace() as (root,owned,details):
            linked=root.parent/'linked'
            try:linked.symlink_to(root,target_is_directory=True)
            except OSError:self.skipTest('Windows symlink privilege unavailable')
            def reject():delivery.require(not linked.is_symlink(),'unowned workspace')
            with patch.object(delivery.shutil,'rmtree') as remove,self.assertRaises(ValueError):
                delivery.remove_owned_workspace(linked,reject,details)
            remove.assert_not_called();self.assertTrue((root/'home/child').exists())

    def test_cleanup_integration_reports_eacces_and_independent_absence_truthfully(self):
        with self.workspace() as (root,owned,details):
            def denied(path,**options):
                error=PermissionError(errno.EACCES,'SYNTHETIC_PRIVATE')
                options['onerror'](delivery.os.scandir,path,(PermissionError,error,None))
            with patch.object(delivery.Path,'home',return_value=root/'home'),patch.object(delivery.subprocess,'run',return_value=subprocess.CompletedProcess([],0,b'',b'')),patch.object(delivery.shutil,'rmtree',side_effect=denied) as remove,patch.object(delivery.time,'sleep') as sleep:
                result=delivery.cleanup_delivery(root.parent)
            self.assertEqual(result['stages']['C04_WORKSPACE']['error_code'],'EACCES')
            self.assertEqual(result['stages']['C04_WORKSPACE']['operation'],'LIST_DIRECTORY')
            self.assertEqual(result['stages']['C04_WORKSPACE']['resource_class'],'PRIVATE_HOME')
            self.assertEqual(result['stages']['C04_WORKSPACE']['retry_status'],'NOT_ATTEMPTED')
            self.assertEqual(result['stages']['C05_ABSENCE']['category'],'RESOURCE_REMAINS')
            self.assertEqual(result['resources'],{'workspace':'PRESENT','profile':'ABSENT','keychain':'ABSENT'})
            self.assertEqual(remove.call_count,1);sleep.assert_not_called()
            self.assertNotIn('SYNTHETIC_PRIVATE',json.dumps(result))

    def test_no_permission_changes_and_only_authorized_cleanup_calls(self):
        body=ast.unparse(next(n for n in ast.parse((ROOT/'tools/apple_storekit_testflight_delivery.py').read_text()).body if isinstance(n,ast.FunctionDef) and n.name=='remove_owned_workspace'))
        for forbidden in ('chmod(', 'chown(', 'chflags(', 'kill(', 'sudo', 'ignore_errors=True'):
            self.assertNotIn(forbidden,body)
        self.assertEqual(body.count('shutil.rmtree('),1)
        self.assertIn("child.name == '.owned'",body)



class MacosSafetyWorkflowTests(SyntheticDeliveryTestCase):
    def setUp(self):
        self.text=(ROOT/next(iter(delivery.SAFETY_FILES))).read_text()

    def test_only_exact_diagnostic_branch_push_can_start_test_job(self):
        trigger=self.text.split("\non:\n",1)[1].split("\npermissions:",1)[0]
        self.assertEqual(trigger,"  push:\n    branches:\n      - 'codex/storekit-macos-certification-15'\n")
        for forbidden in ("workflow_dispatch:","workflow_run:","workflow_call:","pull_request:","tags:","branches-ignore:"):
            self.assertNotIn(forbidden,trigger)
        self.assertIn("github.ref == 'refs/heads/codex/storekit-macos-certification-15'",self.text)
        self.assertIn("github.run_attempt == 1",self.text)

    def test_workflow_has_exact_checkout_and_read_only_no_secret_context(self):
        self.assertIn("permissions:\n  contents: read\n",self.text)
        self.assertEqual(self.text.count("uses:"),1)
        for required in ("runs-on: macos-26","uses: actions/checkout@v4","ref: ${{ github.sha }}",
                         "fetch-depth: 0","fetch-tags: true","persist-credentials: false"):
            self.assertIn(required,self.text)
        for forbidden in ("secrets.","github.token","environment:","id-token:","write", "upload-artifact", "cache:","continue-on-error", "certification_authorized", "testflight_upload_authorized"):
            self.assertNotIn(forbidden,self.text)

    def test_only_existing_synthetic_suite_runs_in_both_modes_with_live_guards(self):
        self.assertIn('for mode in ("UNSET", "APPLE_ID"):',self.text)
        self.assertIn('tests/storekit-testflight-delivery.test.py',self.text)
        self.assertIn('sys.addaudithook(guard)',self.text)
        self.assertIn('socket.connect',self.text)
        self.assertIn('socket.getaddrinfo',self.text)
        self.assertIn('LIVE_PROCESS_BLOCKED',self.text)
        self.assertIn('unittest.TextTestRunner(verbosity=2)',self.text)
        self.assertNotIn('tools/apple_storekit_testflight_delivery.py ',self.text)
        self.assertNotIn('--upload-package',self.text)
        self.assertNotIn('--validate-app',self.text)
        self.assertNotIn('xcodebuild',self.text)
        self.assertNotIn('subprocess.run(',self.text)
        self.assertNotIn('subprocess.check_output(',self.text)

    def test_test_workflow_shell_and_embedded_python_parse_without_execution(self):
        block=self.text.split('        run: |\n',1)[1]
        body='\n'.join(line[10:] for line in block.splitlines())+'\n'
        python=body.split("python3 -B - <<'PY'\n",1)[1].rsplit('\nPY',1)[0]
        ast.parse(python)
        bash='C:/Program Files/Git/bin/bash.exe' if os.name=='nt' else '/bin/bash'
        subprocess.run([bash,'-n'],input=body,text=True,check=True,capture_output=True)

    def test_source_guard_requires_exact_mixed_three_file_inventory(self):
        expected={"M\t"+path for path in delivery.TEST_MODE_FILES}|{"A\t"+path for path in delivery.SAFETY_FILES}
        valid='\n'.join(sorted(expected)).encode()
        for rows in (b'',valid+b'\nM\tjs/gridly-paid-ui.mjs',
                     valid.replace(b'A\t.github',b'M\t.github'),
                     valid+b'\n'+valid.splitlines()[0],
                     '\n'.join(sorted(expected-{"A\t"+next(iter(delivery.SAFETY_FILES))})).encode()):
            with self.subTest(rows=rows),patch.object(delivery.cert,'git',side_effect=source_git(certified_inventory=rows)),patch.object(delivery.subprocess,'run'),patch.object(delivery.cert,'original_contracts'),self.assertRaises(ValueError):
                delivery.source_guard(COMMIT,True)



class PriorAttemptExceptionTests(SyntheticDeliveryTestCase):
    """All acknowledgments below are synthetic fixtures, never owner attestations."""
    upload_authentication = "APPLE_ID"
    save = AppleIdDeliveryTests.save
    exercise = AppleIdDeliveryTests.exercise

    def setUp(self):
        self.actual_source_guard=delivery.source_guard
        CertificationAndTransferTests.setUp(self)
        self.actual_git=delivery.cert.git
        self.tags=["refs/tags/"+name for name in delivery.HISTORICAL_TAGS if ("refs/tags/"+name).startswith(delivery.PREFIX)]+[delivery.FAILED_AUTH_TAG, REF]
        query=("rev-parse","--symbolic-full-name","--tags="+delivery.PREFIX.removeprefix("refs/tags/")+"*")
        def git(*args):
            if args==query:return "\n".join(self.tags).encode()
            if args==("cat-file","-t",delivery.FAILED_AUTH_TAG):return b"tag"
            if args==("rev-parse","--verify",delivery.FAILED_AUTH_TAG):return delivery.FAILED_AUTH_TAG_OBJECT.encode()
            if args==("rev-parse","--verify",delivery.FAILED_AUTH_TAG+"^{}"):return delivery.FAILED_AUTH_BASE.encode()
            return self.actual_git(*args)
        patch.object(delivery.cert,'git',side_effect=git).start()

    def bind(self):
        value=owner_automatic_authorization()
        value['unused_build_number_confirmed']=False
        value[delivery.APPLE_ID_AUTH_FIELD]={
            **dict.fromkeys(delivery.SOLO_OWNER_UI_CONFIRMATIONS,True),
            'method':delivery.SOLO_OWNER_UI_METHOD,'owner_checked_at':STAMP,
            'no_pending_or_uncertain_uploads':False,
            delivery.PRIOR_ATTEMPT_FIELD:{
                **dict.fromkeys(delivery.PRIOR_ATTEMPT_CONFIRMATIONS,True),
                'prior_run_id':39315841160,'bundle_id':'com.gridlygo.gridly','platform':'IOS',
                'version':'1.0.0','build':'15','certified_candidate_commit':delivery.CERTIFIED_BASE,
            }}
        self.save(value);return value

    def exception(self,value):return value[delivery.APPLE_ID_AUTH_FIELD][delivery.PRIOR_ATTEMPT_FIELD]

    def test_exact_exception_is_accepted_without_falsifying_uncertainty(self):
        value=self.bind();before=copy.deepcopy(value)
        self.assertEqual(delivery.owner_authorization(value,COMMIT,REF,NOW),value)
        receipt=delivery.ui_unused_build(value,NOW)
        self.assertEqual(value,before)
        self.assertIs(value[delivery.APPLE_ID_AUTH_FIELD]['no_pending_or_uncertain_uploads'],False)
        self.assertIs(value['unused_build_number_confirmed'],False)
        self.assertEqual(receipt['historical_transport_acceptance'],'UNKNOWN')
        self.assertIs(receipt['registered_build_visible'],False)
        self.assertNotIn('unused',receipt)
        self.assertNotIn('ACCEPTED',json.dumps(receipt))
        self.assertEqual(receipt['prior_run_id'],39315841160)
        self.assertEqual(receipt['verification_method'],delivery.SOLO_OWNER_UI_METHOD)
        self.assertNotIn('independent_checked_at',receipt)
        self.assertNotIn('independent_checked_at',value[delivery.APPLE_ID_AUTH_FIELD])

    def test_normal_strict_option_remains_unchanged_and_requires_truthful_flag(self):
        value=AppleIdDeliveryTests.bind(self)
        receipt=delivery.ui_unused_build(value,NOW)
        self.assertIs(receipt['unused'],True)
        self.assertNotIn('prior_attempt_exception_authorized',receipt)
        value[delivery.APPLE_ID_AUTH_FIELD]['no_pending_or_uncertain_uploads']=False
        with self.assertRaises(ValueError):delivery.owner_authorization(value,COMMIT,REF,NOW)

    def test_only_exact_prior_run_and_types_are_allowed(self):
        for run in (39315841161,True,'39315841160',None):
            value=self.bind();self.exception(value)['prior_run_id']=run
            with self.subTest(run=run),self.assertRaises(ValueError):delivery.owner_authorization(value,COMMIT,REF,NOW)

    def test_wrong_app_platform_version_build_and_certified_lineage_are_rejected(self):
        for key,value in (('bundle_id','com.example.other'),('platform','ANDROID'),('version','1.0.1'),
                          ('build','14'),('build','16'),('certified_candidate_commit',delivery.UPLOAD_BASE)):
            candidate=self.bind();self.exception(candidate)[key]=value
            with self.subTest(key=key,value=value),self.assertRaises(ValueError):delivery.owner_authorization(candidate,COMMIT,REF,NOW)
        candidate=self.bind();candidate['diagnostic_build_number']='16'
        with self.assertRaises(ValueError):delivery.owner_authorization(candidate,COMMIT,REF,NOW)
        candidate=self.bind();candidate['certified_source_commit']='9'*40
        with self.assertRaises(ValueError):delivery.owner_authorization(candidate,COMMIT,REF,NOW)

    def test_every_owner_confirmation_is_mandatory_and_boolean(self):
        for key in delivery.PRIOR_ATTEMPT_CONFIRMATIONS:
            for invalid in (False,0,1,None,'true'):
                value=self.bind();self.exception(value)[key]=invalid
                with self.subTest(key=key,invalid=invalid),self.assertRaises(ValueError):delivery.owner_authorization(value,COMMIT,REF,NOW)
            value=self.bind();del self.exception(value)[key]
            with self.assertRaises(ValueError):delivery.owner_authorization(value,COMMIT,REF,NOW)
        value=self.bind();self.exception(value)['extra']='SYNTHETIC'
        with self.assertRaises(ValueError):delivery.owner_authorization(value,COMMIT,REF,NOW)

    def test_no_common_upload_approval_or_exclusive_window_is_bypassed(self):
        for key in ('testflight_upload_authorized','no_unapproved_internal_access_confirmed','baseline_exception_acknowledged'):
            value=self.bind();value[key]=False
            calls,_,error=self.exercise(value=value)
            self.assertIsInstance(error,ValueError);self.assertEqual(calls,[])
        value=self.bind();value[delivery.APPLE_ID_AUTH_FIELD]['exclusive_upload_window_acknowledged']=False
        calls,_,error=self.exercise(value=value)
        self.assertIsInstance(error,ValueError);self.assertEqual(calls,[])

    def test_missing_or_contradictory_uncertainty_exception_fails(self):
        value=self.bind();value['unused_build_number_confirmed']=True
        with self.assertRaises(ValueError):delivery.owner_authorization(value,COMMIT,REF,NOW)
        for invalid in (True,0,None,'false'):
            value=self.bind();value[delivery.APPLE_ID_AUTH_FIELD]['no_pending_or_uncertain_uploads']=invalid
            with self.subTest(invalid=invalid),self.assertRaises(ValueError):delivery.owner_authorization(value,COMMIT,REF,NOW)
        value=self.bind();del value[delivery.APPLE_ID_AUTH_FIELD][delivery.PRIOR_ATTEMPT_FIELD]
        with self.assertRaises(ValueError):delivery.owner_authorization(value,COMMIT,REF,NOW)
        value=self.bind();value[delivery.PRIOR_ATTEMPT_FIELD]=self.exception(value)
        with self.assertRaises(ValueError):delivery.owner_authorization(value,COMMIT,REF,NOW)

    def test_visible_processing_or_new_unresolved_upload_blocks_before_credentials(self):
        for key in ('owner_verified_no_registered_build','owner_verified_no_processing_build',
                    'owner_verified_no_new_pending_or_uncertain_uploads'):
            value=self.bind();self.exception(value)[key]=False
            calls,_,error=self.exercise(value=value)
            with self.subTest(key=key):self.assertIsInstance(error,ValueError);self.assertEqual(calls,[])

    def test_stale_future_malformed_or_missing_ui_evidence_fails(self):
        for key in ('owner_checked_at',):
            for offset in (-1801,1):
                value=self.bind();value[delivery.APPLE_ID_AUTH_FIELD][key]=delivery.dt.datetime.fromtimestamp(NOW+offset,delivery.dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
                with self.subTest(key=key,offset=offset),self.assertRaises(ValueError):delivery.owner_authorization(value,COMMIT,REF,NOW)
            value=self.bind();del value[delivery.APPLE_ID_AUTH_FIELD][key]
            with self.assertRaises(ValueError):delivery.owner_authorization(value,COMMIT,REF,NOW)
        value=self.bind();value[delivery.APPLE_ID_AUTH_FIELD]['independent_checked_at']=STAMP
        with self.assertRaises(ValueError):delivery.owner_authorization(value,COMMIT,REF,NOW)
        for extra in ('independent_verified_unused','independent_checked_at'):
            value=self.bind();value[delivery.APPLE_ID_AUTH_FIELD][extra]=True
            with self.subTest(extra=extra),self.assertRaises(ValueError):delivery.owner_authorization(value,COMMIT,REF,NOW)
        for extra in ('independent_verified_no_registered_build','independent_verified_no_processing_build','independent_verified_no_new_pending_or_uncertain_uploads'):
            value=self.bind();self.exception(value)[extra]=True
            with self.subTest(extra=extra),self.assertRaises(ValueError):delivery.owner_authorization(value,COMMIT,REF,NOW)
        self.assertEqual(delivery.owner_authorization(self.bind(),COMMIT,REF,NOW+1800)['delivery_commit'],COMMIT)

    def test_duplicate_authorization_fields_are_not_accepted(self):
        raw=json.dumps(self.bind()).replace('"prior_run_id": 39315841160','"prior_run_id": 39315841160, "prior_run_id": 39315841160')
        with self.assertRaises(ValueError):json.loads(raw,object_pairs_hook=delivery.cert.unique_json_object)

    def test_exception_validates_then_invokes_only_one_mock_upload(self):
        calls,stages,error=self.exercise()
        self.assertIsNone(error);self.assertEqual(calls,['--validate-app','--upload-package'])
        self.assertEqual(stages[-1][:2],('D06_ACTUAL_UPLOAD','PASS'))
        receipt=delivery.read_json(self.root/'reports/delivery-availability.json')
        self.assertEqual(receipt['historical_transport_acceptance'],'UNKNOWN');self.assertNotIn('unused',receipt)
        calls,_,error=self.exercise()
        self.assertIsInstance(error,ValueError);self.assertEqual(calls,[])

    def test_consumed_or_unknown_delivery_tag_blocks_a_second_exception(self):
        for mutation in ('extra','duplicate','missing_current','missing_failed_tag','missing_history'):
            original=list(self.tags)
            if mutation=='extra':self.tags.append(delivery.PREFIX+'9'*40)
            elif mutation=='duplicate':self.tags.append(REF)
            elif mutation=='missing_current':self.tags.remove(REF)
            elif mutation=='missing_failed_tag':self.tags.remove(delivery.FAILED_AUTH_TAG)
            else:self.tags.pop(0)
            calls,_,error=self.exercise()
            with self.subTest(mutation=mutation):self.assertIsInstance(error,ValueError);self.assertEqual(calls,[])
            self.tags=original

    def test_only_exact_pinned_malformed_tag_is_accepted(self):
        original_git=delivery.cert.git
        commands=(
            ("cat-file","-t",delivery.FAILED_AUTH_TAG),
            ("rev-parse","--verify",delivery.FAILED_AUTH_TAG),
            ("rev-parse","--verify",delivery.FAILED_AUTH_TAG+"^{}"),
        )
        for command in commands:
            def falsify(*args):
                return b"not-the-approved-object" if args==command else original_git(*args)
            with self.subTest(command=command),patch.object(delivery.cert,"git",side_effect=falsify):
                calls,_,error=self.exercise()
                self.assertIsInstance(error,ValueError)
                self.assertEqual(calls,[])

    def test_new_uncertainty_after_validation_blocks_d05_and_upload(self):
        value=self.bind()
        def update(stage,status):
            if stage=='D05_LIVE_BUILD_AVAILABILITY' and status=='RUNNING':
                self.exception(value)['owner_verified_no_new_pending_or_uncertain_uploads']=False;self.save(value)
        calls,stages,error=self.exercise(value=value,on_progress=update)
        self.assertIsInstance(error,ValueError);self.assertEqual(calls,['--validate-app'])
        self.assertEqual(stages[-1][:2],('D05_LIVE_BUILD_AVAILABILITY','FAIL'))

    def test_fresh_annotated_tag_and_attempt_one_remain_required_before_secrets(self):
        value=self.bind();tags=list(self.tags)
        values={('rev-parse','HEAD'):COMMIT.encode(),('rev-parse','--verify',delivery.cert.DIAGNOSTIC_BRANCH):COMMIT.encode(),
                ('cat-file','-t',REF):b'tag',('rev-parse','--verify',REF):b'5'*40,
                ('cat-file','-p',REF):('object '+COMMIT+'\ntype commit\ntag '+REF.removeprefix('refs/tags/')+'\ntagger Synthetic\n\n'+json.dumps(value)).encode(),
                ('rev-parse','--symbolic-full-name','--tags='+delivery.PREFIX.removeprefix('refs/tags/')+'*'):'\n'.join(tags).encode(),
                ('cat-file','-t',delivery.FAILED_AUTH_TAG):b'tag',
                ('rev-parse','--verify',delivery.FAILED_AUTH_TAG):delivery.FAILED_AUTH_TAG_OBJECT.encode(),
                ('rev-parse','--verify',delivery.FAILED_AUTH_TAG+'^{}'):delivery.FAILED_AUTH_BASE.encode()}
        with patch.object(delivery.cert,'git',side_effect=lambda *a:values[a]),patch.object(delivery,'read_json',return_value=event()),patch.object(delivery,'apple_id_command') as credentials:
            self.assertEqual(delivery.authorize(REF,COMMIT,'synthetic','1')['authorization'],value)
            with self.assertRaises(ValueError):delivery.authorize(REF,COMMIT,'synthetic','2')
            values[('rev-parse','--verify',delivery.cert.DIAGNOSTIC_BRANCH)]=b'9'*40
            with self.assertRaises(ValueError):delivery.authorize(REF,COMMIT,'synthetic','1')
            credentials.assert_not_called()

    def test_direct_child_inventory_and_certified_history_are_exact(self):
        with patch.object(delivery,'source_guard',self.actual_source_guard),patch.object(delivery.cert,'git',side_effect=source_git()),patch.object(delivery.subprocess,'run'),patch.object(delivery.cert,'original_contracts'):
            self.assertTrue(delivery.source_guard(COMMIT,True)['runtime_unchanged'])
        for options in ({'parent':delivery.UPLOAD_BASE},{'parent':delivery.FAILED_AUTH_BASE+' '+'9'*40},
                        {'failed_auth_parent':'9'*40},{'failed_auth_inventory':b''},
                        {'solo_fix_parent':'9'*40},{'solo_fix_inventory':b''},
                        {'solo_attest_parent':'9'*40},{'solo_attest_inventory':b''},
                        {'solo_owner_parent':'9'*40},{'solo_owner_inventory':b''},
                        {'certified_parent':'9'*40},{'certified_inventory':b''},{'correction':b''},
                        {'correction':b'M\tjs/gridly-paid-ui.mjs'},{'mode':'100755'},
                        {'missing_tag':next(iter(delivery.HISTORICAL_TAGS))},{'tag_target':'9'*40}):
            with self.subTest(options=options),patch.object(delivery,'source_guard',self.actual_source_guard),patch.object(delivery.cert,'git',side_effect=source_git(**options)),patch.object(delivery.subprocess,'run'),patch.object(delivery.cert,'original_contracts'),self.assertRaises((ValueError,subprocess.CalledProcessError)):
                delivery.source_guard(COMMIT,True)

    def test_optional_path_deltas_preserve_every_other_production_function(self):
        before=delivery.cert.git('show',delivery.CERTIFIED_BASE+':tools/apple_storekit_testflight_delivery.py').decode()
        after=(ROOT/'tools/apple_storekit_testflight_delivery.py').read_text()
        funcs=lambda text:{n.name:ast.dump(n) for n in ast.parse(text).body if isinstance(n,(ast.FunctionDef,ast.ClassDef))}
        old,new=funcs(before),funcs(normalize_prior_attempt(after))
        self.assertEqual(set(new)-set(old),{'prior_attempt_evidence','prior_attempt_slot'})
        for name in old.keys()-{'source_guard'}:self.assertEqual(old[name],new[name],name)
        old_globals={n.targets[0].id:ast.dump(n.value) for n in ast.parse(before).body if isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name)}
        new_globals={n.targets[0].id:ast.dump(n.value) for n in ast.parse(after).body if isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name)}
        for name in old_globals:self.assertEqual(old_globals[name],new_globals[name],name)
        self.assertEqual(delivery.OWNER_CHECK_TTL,1800)

    def test_normalizer_rejects_changed_optional_gate_calls(self):
        text=(ROOT/'tools/apple_storekit_testflight_delivery.py').read_text()
        for before,after in (('return prior_attempt_evidence(authorization, now)','return prior_attempt_evidence({}, now)'),
                             ('        prior_attempt_slot(ref, commit)','        prior_attempt_slot(ref, "UNAPPROVED")')):
            with self.subTest(before=before),self.assertRaises(AssertionError):normalize_prior_attempt(text.replace(before,after,1))

class SupportedPackageUploaderTests(SyntheticDeliveryTestCase):
    """No real tool, provider response, authorization or credential is used here."""
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.ipa, _ = fixture(self.root)
        self.command, self.options = delivery.apple_id_command(self.root, self.ipa, {
            'APPLE_ID_USERNAME': 'synthetic@example.invalid',
            'APPLE_APP_SPECIFIC_PASSWORD': 'SYNTHETIC_SECRET'})
        self.provider = '00000000-0000-0000-0000-000000000001'
        self.other = '00000000-0000-0000-0000-000000000002'
        self.providers = {'providers': [{'PublicID': self.provider,
                                       'WWDRTeamID': delivery.cert.release.TEAM}]}

    def prepare(self, *, providers=None, help_text=None, error=None, selected=None):
        calls = []
        def execute(command, **options):
            calls.append((command, options))
            self.assertNotIn('SYNTHETIC_SECRET', command)
            self.assertEqual(options['timeout'], 30)
            if error is not None:
                raise error
            if '--help' in command and help_text is not None:
                options['stdout'].write(help_text)
            elif '--list-providers' in command:
                options['stdout'].write(json.dumps(self.providers if providers is None else providers).encode())
            else:
                self.assertTrue(synthetic_transport_query(command, options))
        with patch.dict(os.environ):
            os.environ.pop('GRIDLY_APPLE_PROVIDER_PUBLIC_ID', None)
            if selected is not None:
                os.environ['GRIDLY_APPLE_PROVIDER_PUBLIC_ID'] = selected
            command = delivery.prepare_package_upload(self.root, self.command, self.ipa,
                                                       execute, **self.options)
        return command, calls

    def test_supported_ipa_command_has_exact_identity_and_env_password(self):
        command, calls = self.prepare()
        self.assertEqual(command, ['xcrun', 'altool', '--upload-package', str(self.ipa),
            '--type', 'ios', '--apple-id', '6814845611', '--bundle-id', 'com.gridlygo.gridly',
            '--bundle-short-version-string', '1.0.0', '--bundle-version', '15',
            '--username', 'synthetic@example.invalid', '--password', '@env:APPLE_APP_SPECIFIC_PASSWORD'])
        self.assertNotIn('--file', command)
        self.assertNotIn('--asc-public-id', command)
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0][0], ['xcrun', 'altool', '--help'])
        self.assertNotIn('APPLE_APP_SPECIFIC_PASSWORD', calls[0][1]['env'])
        self.assertEqual(calls[1][0], ['xcrun', 'altool', '--list-providers', '--output-format',
                                     'json', *self.command[6:]])
        self.assertEqual(calls[1][1]['env']['APPLE_APP_SPECIFIC_PASSWORD'], 'SYNTHETIC_SECRET')
        self.assertTrue(all(options['stdout'].closed for _, options in calls))
        self.assertEqual(list((self.root/'logs').iterdir()), [])
        self.assertFalse((self.root/'reports/delivery-transfer.json').exists())

    def test_multiple_providers_require_selection_from_discovery_and_correct_signing_team(self):
        providers = {'providers': [*self.providers['providers'],
            {'PublicID': self.other, 'WWDRTeamID': 'OTHERTEAM1'}]}
        for selected in (None, '00000000-0000-0000-0000-000000000003', self.other):
            with self.subTest(selected=selected), self.assertRaisesRegex(ValueError, 'no upload permitted'):
                self.prepare(providers=providers, selected=selected)
        command, _ = self.prepare(providers=providers, selected=self.provider)
        self.assertEqual(command[command.index('--asc-public-id')+1], self.provider)

    def test_missing_empty_malformed_duplicate_and_error_provider_data_fail_closed(self):
        for response in ({}, {'providers': []}, {'providers': 'private'},
                         {'providers': [{}]}, {'providers': [{'PublicID': 'private'}]},
                         {'providers': self.providers['providers'] * 2},
                         {'errors': ['PRIVATE'], **self.providers},
                         {'product-errors': ['PRIVATE'], **self.providers},
                         {'providers': [{'PublicID': self.provider, 'WWDRTeamID': 'OTHERTEAM1'}]}):
            with self.subTest(response=response), self.assertRaisesRegex(ValueError, 'no upload permitted'):
                self.prepare(providers=response)

    def test_unsupported_or_failed_help_and_discovery_do_not_attempt_upload(self):
        for help_text in (b'', b'--upload-app', b'--upload-package-unsupported'):
            with self.subTest(help_text=help_text), self.assertRaisesRegex(ValueError, 'no upload permitted'):
                self.prepare(help_text=help_text)
        for error in (subprocess.CalledProcessError(-6, self.command, output=b'PRIVATE'),
                      subprocess.TimeoutExpired(self.command, 30, output=b'PRIVATE'),
                      KeyboardInterrupt('PRIVATE'), OSError('PRIVATE')):
            with self.subTest(error=type(error)), self.assertRaises(ValueError) as caught:
                self.prepare(error=error)
            self.assertNotIn('PRIVATE', str(caught.exception))
        self.assertFalse((self.root/'reports/delivery-transfer.json').exists())

    def test_private_environment_is_per_child_and_rejects_unowned_directories(self):
        original = {'HOME': 'foreign', 'TMPDIR': 'foreign', 'CFFIXED_USER_HOME': 'foreign',
                    'JAVA_TOOL_OPTIONS': 'foreign', '_JAVA_OPTIONS': 'foreign',
                    'JDK_JAVA_OPTIONS': 'foreign', 'APPLE_APP_SPECIFIC_PASSWORD': 'SYNTHETIC_SECRET'}
        before = dict(original)
        result = delivery.private_upload_environment(self.root, original)
        self.assertEqual(original, before)
        self.assertEqual(result['HOME'], str(self.root/'home'))
        self.assertEqual(result['CFFIXED_USER_HOME'], str(self.root/'home'))
        self.assertEqual(result['TMPDIR'], str(self.root/'tmp'))
        self.assertIn('-Duser.home="'+str(self.root/'home')+'"', result['JAVA_TOOL_OPTIONS'])
        self.assertIn('-Djava.io.tmpdir="'+str(self.root/'tmp')+'"', result['JAVA_TOOL_OPTIONS'])
        self.assertEqual(result['APPLE_APP_SPECIFIC_PASSWORD'], 'SYNTHETIC_SECRET')
        self.assertNotIn('_JAVA_OPTIONS', result)
        self.assertNotIn('JDK_JAVA_OPTIONS', result)
        (self.root/'.owned').unlink()
        with self.assertRaises(ValueError):
            delivery.private_upload_environment(self.root, original)

    def test_owned_process_group_is_bounded_and_reaped_for_every_process_outcome(self):
        for outcome in (0, -6, subprocess.TimeoutExpired(self.command, 900), KeyboardInterrupt()):
            process = Mock(pid=424242)
            process.wait.side_effect = [outcome, 0]
            with self.subTest(outcome=type(outcome)), patch.object(delivery.sys, 'platform', 'darwin'), \
                 patch.object(delivery.subprocess, 'Popen', return_value=process) as spawn, \
                 patch.object(delivery.os, 'killpg', create=True) as kill, \
                 patch.object(delivery.signal, 'SIGKILL', 9, create=True), \
                 patch.object(delivery.time, 'sleep'):
                def invoke():
                    return delivery.run_upload_process(self.command, check=True, cwd=self.root/'home',
                                                       stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT,
                                                       env={'APPLE_APP_SPECIFIC_PASSWORD': 'SYNTHETIC_SECRET'})
                if outcome == 0:
                    self.assertEqual(invoke().returncode, 0)
                elif outcome == -6:
                    with self.assertRaises(subprocess.CalledProcessError) as caught: invoke()
                    self.assertEqual(caught.exception.returncode, -6)
                else:
                    with self.assertRaises(type(outcome)): invoke()
                self.assertTrue(spawn.call_args.kwargs['start_new_session'])
                self.assertEqual(spawn.call_count, 1)
                self.assertEqual([call.args for call in kill.call_args_list],
                    [(424242, delivery.signal.SIGTERM), (424242, 9)])
                self.assertEqual([call.kwargs for call in process.wait.call_args_list],
                                 [{'timeout': 900}, {'timeout': 5}])

    def test_process_cleanup_failure_is_not_suppressed(self):
        process = Mock(pid=424242)
        process.wait.return_value = 0
        with patch.object(delivery.sys, 'platform', 'darwin'), \
             patch.object(delivery.subprocess, 'Popen', return_value=process), \
             patch.object(delivery.os, 'killpg', side_effect=PermissionError('PRIVATE'), create=True), \
             self.assertRaises(PermissionError):
            delivery.run_upload_process(self.command, check=True, cwd=self.root/'home')

    def test_repair_only_changes_transport_and_exact_source_ancestry(self):
        baseline = delivery.cert.git('show', delivery.UPLOADER_REPAIR_BASE +
                                     ':tools/apple_storekit_testflight_delivery.py').decode()
        current = (ROOT/'tools/apple_storekit_testflight_delivery.py').read_text()
        functions = lambda source: {node.name: ast.dump(node) for node in ast.parse(source).body
                                   if isinstance(node, (ast.FunctionDef, ast.ClassDef))}
        before, after = functions(baseline), functions(current)
        self.assertEqual(set(after)-set(before), {'private_upload_environment', 'run_upload_process',
                                                'package_provider', 'prepare_package_upload'})
        for name in before.keys()-{'source_guard', 'execute_upload', 'transfer'}:
            self.assertEqual(before[name], after[name], name)
        normalized = functions(normalize_uploader_repair(current))
        for name in ('execute_upload', 'transfer'):
            self.assertEqual(before[name], normalized[name], name)
        self.assertEqual(delivery.UPLOADER_REPAIR_BASE, 'b66348762e10bf47031f2297963345cf18088b83')
        head = delivery.cert.git('rev-parse', 'HEAD').decode().strip()
        if head != delivery.UPLOADER_REPAIR_BASE:
            self.assertEqual(delivery.cert.git('show', '-s', '--format=%P', head).decode().strip(),
                             delivery.UPLOADER_REPAIR_BASE)
        changed = delivery.cert.git('diff', '--name-only', delivery.UPLOADER_REPAIR_BASE).decode().splitlines()
        self.assertEqual(set(changed), delivery.TEST_MODE_FILES)

    def test_new_parent_inventory_and_failed_delivery_tag_are_frozen(self):
        for options in ({'parent': delivery.FAILED_AUTH_BASE}, {'repair_base_parent': '9'*40},
                        {'repair_base_inventory': b''}, {'correction': b'M\tjs/gridly-paid-ui.mjs'},
                        {'dirty': b'changed'}, {'mode': '100755'}):
            with self.subTest(options=options), patch.object(delivery.cert, 'git', side_effect=source_git(**options)), \
                 patch.object(delivery.subprocess, 'run'), patch.object(delivery.cert, 'original_contracts'), \
                 self.assertRaises(ValueError):
                delivery.source_guard(COMMIT, True)
        original = source_git()
        tag = delivery.PREFIX + delivery.UPLOADER_REPAIR_BASE
        for command in (('rev-parse', '--verify', tag), ('cat-file', '-t', tag),
                        ('rev-parse', '--verify', tag+'^{}')):
            def changed(*args): return b'changed' if args == command else original(*args)
            with self.subTest(command=command), patch.object(delivery.cert, 'git', side_effect=changed), \
                 patch.object(delivery.subprocess, 'run'), patch.object(delivery.cert, 'original_contracts'), \
                 self.assertRaises(ValueError):
                delivery.source_guard(COMMIT, True)


if __name__ == "__main__":
    unittest.main()
