"""Bounded Apple archive/export certification. Never changes either signed artifact.

Xcode export can re-sign Mach-O code. Compare signature-removed *copies* with
Apple's codesign tool, alongside original architecture/section hashes, verified
signatures, exact distribution certificate, profiles, and entitlements.
"""
import hashlib
import json
import plistlib
import re
import shutil
import struct
import subprocess
import tempfile
import textwrap
from pathlib import Path

AUTHORITY = "Apple Distribution: DJ Burns Collective LLC (2XSH6R7K37)"
CERT_SHA1 = "1264FCB7434D20490824D05F959D90D3825EA45C"
TEAM = "2XSH6R7K37"
BUNDLE = "com.gridlygo.gridly"
PROFILE_UUID = "c0398bd6-9b5e-4935-82e7-40d117a4ccdc"


def sha256(body):
    return hashlib.sha256(body).hexdigest()


def macho(body, signed=True):
    # This iPhone-only build has one arm64 slice. Refuse unsupported/fat layouts
    # rather than silently excluding an architecture or a trailing byte range.
    assert len(body) >= 32, "truncated Mach-O header"
    magic, cpu, subtype, filetype, count, size, flags, reserved = struct.unpack_from("<8I", body)
    assert magic == 0xFEEDFACF and cpu == 0x0100000C and filetype == 2, "expected thin arm64 MH_EXECUTE"
    end = 32 + size
    assert end <= len(body) and count <= size // 8, "invalid Mach-O load commands"
    sections, commands, signature = [], [], None
    cursor = 32
    for _ in range(count):
        assert cursor + 8 <= end, "truncated load command"
        cmd, length = struct.unpack_from("<2I", body, cursor)
        assert length >= 8 and length % 8 == 0 and cursor + length <= end, "invalid load command size"
        commands.append({"command": hex(cmd), "offset": cursor, "size": length})
        if cmd == 0x1D:  # LC_CODE_SIGNATURE
            assert length == 16 and signature is None, "invalid/duplicate LC_CODE_SIGNATURE"
            offset, blob_size = struct.unpack_from("<2I", body, cursor + 8)
            assert offset >= end and blob_size >= 12 and offset + blob_size == len(body), "signature must be a bounded terminal blob"
            signature = {"command_offset": cursor, "offset": offset, "size": blob_size}
        if cmd == 0x19:  # LC_SEGMENT_64
            assert length >= 72, "truncated segment"
            section_count = struct.unpack_from("<I", body, cursor + 64)[0]
            assert length == 72 + 80 * section_count, "invalid section table"
            for index in range(section_count):
                base = cursor + 72 + 80 * index
                name = body[base:base + 16].split(b"\0", 1)[0].decode("ascii")
                segment = body[base + 16:base + 32].split(b"\0", 1)[0].decode("ascii")
                section_size = struct.unpack_from("<Q", body, base + 40)[0]
                offset = struct.unpack_from("<I", body, base + 48)[0]
                section_flags = struct.unpack_from("<I", body, base + 64)[0]
                zero_fill = section_flags & 0xFF in (1, 0xC, 0x12)
                assert zero_fill or offset + section_size <= len(body), "section outside executable"
                sections.append({"segment": segment, "section": name, "offset": offset,
                                 "size": section_size, "flags": section_flags,
                                 "sha256": None if zero_fill else sha256(body[offset:offset + section_size])})
        cursor += length
    assert cursor == end, "load command count/size mismatch"
    assert not signed or signature is not None, "missing executable signature"
    if signature:
        for section in sections:
            assert section["sha256"] is None or section["offset"] + section["size"] <= signature["offset"], "signature overlaps a section"
        blob = body[signature["offset"]:]
        magic, length, slots = struct.unpack_from(">3I", blob)
        assert magic == 0xFADE0CC0 and 12 + slots * 8 <= length <= len(blob), "invalid signature superblob"
        slot_facts = []
        for index in range(slots):
            slot, offset = struct.unpack_from(">2I", blob, 12 + 8 * index)
            assert offset >= 12 + slots * 8 and offset + 8 <= length, "invalid signature slot"
            blob_magic, blob_length = struct.unpack_from(">2I", blob, offset)
            assert blob_length >= 8 and offset + blob_length <= length, "invalid signature slot length"
            slot_facts.append({"slot": hex(slot), "magic": hex(blob_magic), "size": blob_length,
                               "sha256": sha256(blob[offset:offset + blob_length])})
        signature["sha256"] = sha256(blob)
        signature["slots"] = slot_facts
    return {"architecture": {"cpu": cpu, "subtype": subtype}, "size": len(body),
            "sha256": sha256(body), "load_commands": commands,
            "signature": signature, "sections": sections}


def first_difference(left, right):
    return next((i for i, pair in enumerate(zip(left, right)) if pair[0] != pair[1]),
                min(len(left), len(right)) if len(left) != len(right) else None)


def require_neutral_parity(left, right):
    assert left == right, f"NON-SIGNATURE executable mismatch at offset {first_difference(left, right)}; sizes {len(left)}/{len(right)}"


def unsigned_copy(executable, destination):
    shutil.copy2(executable, destination)
    subprocess.run(["codesign", "--remove-signature", str(destination)], check=True, capture_output=True)
    return destination.read_bytes()


def validate_entitlements(entitlements):
    assert entitlements["com.apple.developer.devicecheck.appattest-environment"] == "production", "nonproduction App Attest"
    assert entitlements.get("get-task-allow", False) is False, "debug entitlement"
    assert entitlements["application-identifier"] == TEAM + "." + BUNDLE, "wrong signed app identity"
    assert entitlements["com.apple.developer.team-identifier"] == TEAM, "wrong signed team"


def signed_app_facts(app, certificate_prefix):
    subprocess.run(["codesign", "--verify", "--deep", "--strict", "--verbose=2", str(app)], check=True)
    result = subprocess.run(["codesign", "-d", "--verbose=4", str(app)], check=True, capture_output=True, text=True)
    lines = result.stderr.splitlines() + result.stdout.splitlines()
    metadata = [line for line in lines if line.startswith(("Identifier=", "Authority=", "TeamIdentifier=", "CDHash=", "CodeDirectory ", "Signature size="))]
    assert "Identifier=" + BUNDLE in metadata and "TeamIdentifier=" + TEAM in metadata, "wrong code signing identity"
    assert "Authority=" + AUTHORITY in metadata, "wrong distribution signing authority"
    # codesign uses getopt_long optional_argument: the prefix must be attached
    # with '=' or it is interpreted as another code path to inspect.
    subprocess.run(["codesign", "-d", "--extract-certificates=" + str(certificate_prefix), str(app)], check=True)
    leaf_sha1 = hashlib.sha1(Path(str(certificate_prefix) + "0").read_bytes()).hexdigest().upper()
    assert leaf_sha1 == CERT_SHA1, "wrong distribution certificate"
    entitlements = plistlib.loads(subprocess.check_output(["codesign", "-d", "--entitlements", ":-", str(app)], stderr=subprocess.DEVNULL))
    validate_entitlements(entitlements)
    profile = plistlib.loads(subprocess.check_output(["security", "cms", "-D", "-i", str(app / "embedded.mobileprovision")]))
    assert profile["Name"] == "Gridly App Store Build 9" and profile["UUID"] == PROFILE_UUID, "wrong provisioning lineage"
    assert profile["TeamIdentifier"] == [TEAM] and profile["Entitlements"]["application-identifier"] == TEAM + "." + BUNDLE
    assert profile["Entitlements"].get("get-task-allow") is False
    assert not profile.get("ProvisionsAllDevices") and "ProvisionedDevices" not in profile
    info = plistlib.loads((app / "Info.plist").read_bytes())
    architectures = subprocess.check_output(["lipo", "-archs", str(app / info["CFBundleExecutable"])], text=True).strip().split()
    assert architectures == ["arm64"], "unexpected executable architecture(s)"
    expected = {"CFBundleShortVersionString": "1.0.0", "CFBundleVersion": "14", "CFBundleIdentifier": BUNDLE, "UIDeviceFamily": [1]}
    assert {key: info.get(key) for key in expected} == expected, "wrong app version/build/bundle/device family"
    return {"codesign": metadata, "certificate_sha1": leaf_sha1, "entitlements": entitlements, "architectures": architectures,
            "profile_uuid": profile["UUID"], "identity": expected, "executable": info["CFBundleExecutable"]}


def certify_native_parity(app, ipa, native_source):
    app, ipa = Path(app), Path(ipa)
    source = Path(native_source).read_text()
    assert 'as? String == "14"' in source, "missing Build-14-only activation"
    match = re.search(r'private static let legacyRecoveryScript = #"""\n(.*?)\n\s*"""#', source, re.S)
    assert match, "missing scoped recovery body"
    recovery = textwrap.dedent(match.group(1)).encode()
    ready_match = re.search(r'private static let legacyReadinessScript = #"""\n(.*?)\n\s*"""#', source, re.S)
    assert ready_match, "missing event-driven runtime readiness body"
    readiness = textwrap.dedent(ready_match.group(1)).encode()
    with tempfile.TemporaryDirectory(prefix="gridly-native-parity-") as temporary:
        work = Path(temporary)
        # ditto preserves native bundle structure. Only extraction/copies change;
        # codesign verification reads the original archive and extracted IPA app.
        subprocess.run(["ditto", "-x", "-k", str(ipa), str(work / "export")], check=True)
        exported_apps = list((work / "export" / "Payload").glob("*.app"))
        assert len(exported_apps) == 1, "expected one exported iPhone app"
        exported_app = exported_apps[0]
        archive_facts = signed_app_facts(app, work / "archive-cert-")
        ipa_facts = signed_app_facts(exported_app, work / "ipa-cert-")
        assert archive_facts["entitlements"] == ipa_facts["entitlements"], "archive/IPA entitlement mismatch"
        assert archive_facts["identity"] == ipa_facts["identity"] and archive_facts["executable"] == ipa_facts["executable"]
        archive_path = app / archive_facts["executable"]
        ipa_path = exported_app / ipa_facts["executable"]
        archive_bytes, ipa_bytes = archive_path.read_bytes(), ipa_path.read_bytes()
        archive_macho, ipa_macho = macho(archive_bytes), macho(ipa_bytes)
        report = {"archive": {**archive_facts, "macho": archive_macho}, "ipa": {**ipa_facts, "macho": ipa_macho},
                  "raw_equal": archive_bytes == ipa_bytes, "first_raw_difference": first_difference(archive_bytes, ipa_bytes),
                  "archive_prefix_sha256": sha256(archive_bytes[:archive_macho["signature"]["offset"]]),
                  "ipa_prefix_sha256": sha256(ipa_bytes[:ipa_macho["signature"]["offset"]])}
        print("native executable signed diagnostics: " + json.dumps(report, sort_keys=True), flush=True)
        assert archive_macho["architecture"] == ipa_macho["architecture"], "archive/IPA architecture mismatch"
        if archive_macho["sections"] != ipa_macho["sections"]:
            different = [{"archive": a, "ipa": b} for a, b in zip(archive_macho["sections"], ipa_macho["sections"]) if a != b]
            raise AssertionError("archive/IPA section content/layout mismatch: " + json.dumps(different, sort_keys=True))
        neutral_archive = unsigned_copy(archive_path, work / "archive-unsigned")
        neutral_ipa = unsigned_copy(ipa_path, work / "ipa-unsigned")
        for original, neutral in ((archive_macho, neutral_archive), (ipa_macho, neutral_ipa)):
            neutral_facts = macho(neutral, signed=False)
            assert neutral_facts["signature"] is None, "signature removal incomplete"
            assert neutral_facts["architecture"] == original["architecture"] and neutral_facts["sections"] == original["sections"], "signature removal changed sections/architecture"
        print("signing-neutral diagnostics: " + json.dumps({"archive_size": len(neutral_archive), "ipa_size": len(neutral_ipa),
              "archive_sha256": sha256(neutral_archive), "ipa_sha256": sha256(neutral_ipa),
              "first_difference": first_difference(neutral_archive, neutral_ipa)}, sort_keys=True), flush=True)
        require_neutral_parity(neutral_archive, neutral_ipa)
        for label, body in (("archive", neutral_archive), ("IPA", neutral_ipa)):
            assert recovery in body, label + " compiled recovery body differs from source"
            assert readiness in body, label + " compiled runtime readiness body differs from source"
            for text in (b"Review legacy saved report", b"Keep saved retry", b"Forget saved retry"):
                assert text in body, label + " compiled owner confirmation missing"
        assert archive_path.read_bytes() == archive_bytes and ipa_path.read_bytes() == ipa_bytes, "signed artifact was modified"
        result = {"archive_sha256": sha256(archive_bytes), "ipa_sha256": sha256(ipa_bytes),
                  "signing_neutral_sha256": sha256(neutral_archive), "source_sha256": sha256(source.encode()),
                  "recovery_body_sha256": sha256(recovery), "readiness_body_sha256": sha256(readiness), "architecture": archive_macho["architecture"],
                  "raw_equal": archive_bytes == ipa_bytes, "code_equal": True,
                  "recovery_in_archive_and_ipa": True, "signed_artifacts_unchanged": True}
        print("signing-aware native recovery parity PASS: " + json.dumps(result, sort_keys=True), flush=True)
        return result
