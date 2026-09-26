// Request contract only. Shape validation is not store verification or ownership proof.
// Native store results travel privately to a verifier; never log these bodies.
export const STORE_VERIFIERS = Object.freeze({
  apple: Object.freeze({endpoint:'/functions/v1/gridly-verify-apple-subscription', productId:'com.gridlygo.gridly.monthly',
    evidenceField:'signedTransactions', verification:'apple_signed_transaction_and_current_subscription_status', accountRequired:false,
    recovery:'storekit_current_entitlements_or_explicit_sync', launchRestorePrompt:false}),
  google: Object.freeze({endpoint:'/functions/v1/gridly-verify-google-subscription', productId:'gridly_monthly', basePlanId:'monthly',
    evidenceField:'purchaseTokens', verification:'purchases.subscriptionsv2.get', acknowledgement:'purchases.subscriptions.acknowledge',
    accountRequired:false, recovery:'billingclient_query_purchases', launchRestorePrompt:false})
});
export function storeVerificationRequest({platform,environment,nonce,evidence}) {
  const spec=Object.hasOwn(STORE_VERIFIERS,platform) ? STORE_VERIFIERS[platform] : null;
  if(!spec || !['production','sandbox/test'].includes(environment) || typeof nonce!=='string' || !/^[A-Za-z0-9_-]{32,128}$/.test(nonce) ||
     !evidence || Object.keys(evidence).length!==1 || !Object.hasOwn(evidence,spec.evidenceField)) throw Error('invalid_store_evidence');
  const entries=evidence[spec.evidenceField];
  if(!Array.isArray(entries) || entries.length>8 || new Set(entries).size!==entries.length) throw Error('invalid_store_evidence');
  for(const entry of entries) {
    if(typeof entry!=='string' || entry.length>16384 || entry.length===0 ||
       (platform==='apple' ? !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(entry) : !/^[A-Za-z0-9._~+\/-]+={0,2}$/.test(entry))) throw Error('invalid_store_evidence');
  }
  // No email, profile, Gridly account, old installation ID or report device ID.
  // Empty current store results cannot by themselves prove backend non-entitlement.
  return Object.freeze({platform,environment,nonce,productId:spec.productId,
    ...(platform==='google'?{basePlanId:spec.basePlanId}:{}),
    evidence:Object.freeze({[spec.evidenceField]:Object.freeze([...entries])})});
}
