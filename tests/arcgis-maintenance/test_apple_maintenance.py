"""Pure source/identity tests; no Swift compilation, signing, archive or store API."""
import unittest,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
import apple_native_parity as parity
import apple_acceptance_build_only as build
def frozen(ref,path):
    return subprocess.check_output(['git','show',ref+':'+path],cwd=ROOT).decode().replace('\r\n','\n')
LEGACY=frozen(build.APPLE14,'ios/App/App/GridlyBridgeViewController.swift')
RELEASED=frozen('71168111a133fa1c187620b9604b08e79fbf4687','ios/App/App/GridlyBridgeViewController.swift')

class AppleMaintenance(unittest.TestCase):
    def test_default_build17_assertions_and_fixed_native_source_remain_exact(self):
        self.assertEqual(parity.approved_recovery_source(LEGACY),RELEASED)
        build.require_maintenance_identity('17','1.0.1')
        build.require_recovery_build(RELEASED,'17')
        self.assertEqual((ROOT/'ios/App/App/GridlyBridgeViewController.swift').read_text(encoding='utf-8'),RELEASED)
        for number in ['15','18','19','017','17.0','',None]:
            with self.assertRaises(AssertionError):build.require_recovery_build(RELEASED,number)
        with self.assertRaises(AssertionError):build.require_maintenance_identity('18','1.0.2')

    def test_build18_requires_exact_opt_in_identity_and_recovery_derivative(self):
        profile=parity.MAINTENANCE_PROFILE
        future=parity.approved_recovery_source(LEGACY,profile)
        self.assertEqual(future.replace('["14", "16", "17", "18"]','["14", "16", "17"]'),RELEASED)
        build.require_maintenance_identity('18','1.0.2',profile)
        build.require_recovery_build(future,'18',profile)
        self.assertEqual(parity.expected_app_identity('18','1.0.2',profile),{'CFBundleIdentifier':'com.gridlygo.gridly','CFBundleVersion':'18','CFBundleShortVersionString':'1.0.2','UIDeviceFamily':[1]})
        for number,version in [('17','1.0.1'),('18','1.0.1'),('19','1.0.2'),('018','1.0.2'),('18','9.0.0')]:
            with self.subTest(number=number,version=version),self.assertRaises(AssertionError):build.require_maintenance_identity(number,version,profile)
        for source,number,p in [(RELEASED,'18',profile),(future,'17',profile),(future,'18',None),(future,'18','wrong'),(future.replace('GridlyLegacyRecoveryCompatibility.supports','false && GridlyLegacyRecoveryCompatibility.supports'),'18',profile)]:
            with self.assertRaises(AssertionError):build.require_recovery_build(source,number,p)

    def test_profile_does_not_change_signing_or_protective_archive_checks(self):
        self.assertEqual(parity.TEAM,'2XSH6R7K37')
        self.assertEqual(parity.BUNDLE,'com.gridlygo.gridly')
        for p in ['ios/App/App/App-Production.entitlements','ios/App/App/Info.plist','ios/App/App/GridlyStoreKitPlugin.swift','ios/App/App/AppDelegate.swift']:
            self.assertEqual((ROOT/p).read_text(encoding='utf-8'),frozen('71168111a133fa1c187620b9604b08e79fbf4687',p))
        for path in ['tools/apple_acceptance_build_only.py','tools/apple_native_parity.py']:
            text=(ROOT/path).read_text(encoding='utf-8')
            for marker in (['P0_CLOCK_HASHES','dirty tracked source','uncommitted runtime source','native source changed after preflight'] if path.endswith('build_only.py') else ['codesign','require_neutral_parity','signed artifact was modified','compiled recovery body differs from source']):
                self.assertIn(marker,text)
        with self.assertRaises(AssertionError):parity.approved_recovery_source(LEGACY,'wrong')

    def test_maintenance_attestation_cannot_accept_a_legacy_or_unmarked_stage(self):
        profile=parity.MAINTENANCE_PROFILE
        build.require_maintenance_bundle_mode({})
        build.require_maintenance_bundle_mode({'maintenanceProfile':profile},profile)
        for manifest,p in [({},profile),({'maintenanceProfile':'wrong'},profile),({'maintenanceProfile':profile},None)]:
            with self.assertRaises(AssertionError):build.require_maintenance_bundle_mode(manifest,p)

if __name__=='__main__':unittest.main()
