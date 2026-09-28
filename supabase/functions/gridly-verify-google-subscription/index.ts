import {productionEdgeRuntime} from '../_shared/entitlement/edge-runtime.ts';
const runtime=await productionEdgeRuntime();
Deno.serve(runtime.google);
