// Disabled foundation: real provider/security/cache/signing composition awaits review.
import {createHandler} from '../_shared/entitlement/handler.mjs';
Deno.serve(createHandler({platform:'google'}));
