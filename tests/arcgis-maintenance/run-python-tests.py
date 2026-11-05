"""Offline, fixed-output test runner. No tracebacks, assertion values or raw logs."""
import importlib.util,json,pathlib,socket,subprocess,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2]
def denied(*args,**kwargs):raise RuntimeError('OFFLINE_NETWORK_BLOCKED')
socket.create_connection=denied
socket.socket.connect=denied
socket.socket.connect_ex=denied
original_run=subprocess.run
def offline_run(args,*rest,**kwargs):
    if not isinstance(args,list) or len(args)<2 or pathlib.Path(str(args[0])).name.lower() not in ('git','git.exe') or args[1] not in ('show','diff','rev-parse','merge-base','status'):
        return denied()
    return original_run(args,*rest,**kwargs)
subprocess.run=offline_run
suite=unittest.TestSuite()
try:
    for relative in ['tests/arcgis-maintenance/test_apple_maintenance.py','tests/apple_acceptance_build_only_test.py','tests/apple_native_parity_test.py']:
        spec=importlib.util.spec_from_file_location('offline_'+pathlib.Path(relative).stem,ROOT/relative)
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        suite.addTests(unittest.defaultTestLoader.loadTestsFromModule(module))
    result=unittest.TestResult();suite.run(result)
    print(json.dumps({'tests':result.testsRun,'passed':result.testsRun-len(result.failures)-len(result.errors)-len(result.skipped),'failures':[t.id() for t,_ in result.failures],'errors':[t.id() for t,_ in result.errors],'skipped':[t.id() for t,_ in result.skipped]}))
    sys.exit(0 if result.wasSuccessful() else 1)
except Exception:
    print('OFFLINE_PYTHON_TEST_LOADER_FAILED');sys.exit(1)
