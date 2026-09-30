import {productionEdgeRuntime} from '../_shared/entitlement/edge-runtime.ts';
import {createSubscriptionOperations} from '../_shared/entitlement/operations.mjs';
const runtime=await productionEdgeRuntime();
const handler=createSubscriptionOperations({token:Deno.env.get('GRIDLY_SUBSCRIPTION_OPS_TOKEN'),
  retryGoogle:runtime.retryGoogle,store:runtime.store,environment:'production'});
Deno.serve(handler);
