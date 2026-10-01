import {sandboxGoogleEdgeRuntime} from '../_shared/entitlement/sandbox-google-edge-runtime.ts';
const handler=await sandboxGoogleEdgeRuntime();
Deno.serve(handler);
