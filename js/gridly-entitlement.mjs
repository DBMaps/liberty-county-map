// Foundation only: not loaded by the app until native/server authority is certified.
export const LAUNCH = Object.freeze({
  currency: 'USD', monthlyPrice: '2.99', country: 'US',
  appleProductId: 'com.gridlygo.gridly.monthly',
  googleProductId: 'gridly_monthly', googleBasePlanId: 'monthly',
  freeTier: false, trial: false, annualPlan: false, billingGrace: false, webCheckout: false
});
const STATES = new Set(['active', 'inactive', 'expired', 'canceled_pending_expiry', 'unknown']);
const ERRORS = new Set(['none', 'network_unavailable', 'store_unavailable', 'verification_unavailable', 'invalid_authority', 'platform_unavailable', 'purchase_pending', 'user_canceled']);
const FIELDS = ['platform','productId','subscriptionState','entitlementState','currentPeriodEnd','lastVerifiedAt','verificationSource','environment','restoreAvailable','errorCategory','nonce','audience','expiresAt'];
const MAX_LEASE_MS = 300_000;
const PUBLIC_SURFACES = new Set(['legal','privacy','terms','community_guidelines','support','delete_data','emergency']);
const proven = new WeakSet();
const date = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value ? Date.parse(value) : NaN;
const product = platform => platform === 'apple' ? LAUNCH.appleProductId : LAUNCH.googleProductId;
function failure(category = 'invalid_authority') {
  // Never include an exception message, receipt, token, or transport response.
  return Object.freeze({ platform:null, productId:null, environment:null, subscriptionState:'unknown', entitlementState:'unknown', currentPeriodEnd:null,
    lastVerifiedAt:null, verificationSource:'none', restoreAvailable:true,
    errorCategory:ERRORS.has(category) ? category : 'verification_unavailable' });
}
function decode(part) {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw Error('invalid_authority');
  const bytes = Uint8Array.from(atob(part.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
  return bytes;
}
// Caller supplies a pinned public CryptoKey, never a key supplied by the response.
export async function verifyAuthorityProof({proof, publicKey, nonce, platform, environment='production', now=Date.now(), crypto=globalThis.crypto}) {
  try {
    if (!['apple','google'].includes(platform) || !['production','sandbox/test'].includes(environment) ||
        !Number.isFinite(now) || typeof nonce !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(nonce) ||
        typeof proof !== 'string' || proof.length > 8192 || !publicKey ||
        publicKey.type !== 'public' || publicKey.algorithm.name !== 'ECDSA' || publicKey.algorithm.namedCurve !== 'P-256') return failure();
    const parts = proof.split('.');
    if(parts.length !== 3) return failure();
    const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    if(Object.keys(header).sort().join(',') !== 'alg,typ' || header.alg !== 'ES256' || header.typ !== 'gridly-entitlement-v1') return failure();
    if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'}, publicKey, decode(parts[2]), new TextEncoder().encode(parts[0]+'.'+parts[1]))) return failure();
    const row = JSON.parse(new TextDecoder().decode(decode(parts[1])));
    if(!row || Object.keys(row).sort().join(',') !== [...FIELDS].sort().join(',') ||
       row.platform !== platform || row.productId !== product(platform) || row.environment !== environment ||
       row.audience !== 'com.gridlygo.gridly' || row.nonce !== nonce ||
       row.verificationSource !== 'gridly_server_store_api' || row.restoreAvailable !== true ||
       !STATES.has(row.subscriptionState) || !ERRORS.has(row.errorCategory)) return failure();
    const verified = date(row.lastVerifiedAt), expiry = date(row.expiresAt), period = row.currentPeriodEnd === null ? null : date(row.currentPeriodEnd);
    if(!Number.isFinite(verified) || !Number.isFinite(expiry) || verified > now || expiry <= now ||
       expiry <= verified || expiry-verified > MAX_LEASE_MS || (period !== null && !Number.isFinite(period))) return failure();
    const enabled = ['active','canceled_pending_expiry'].includes(row.subscriptionState);
    const expected = enabled ? 'entitled' : row.subscriptionState === 'unknown' ? 'unknown' : 'not_entitled';
    if(row.entitlementState !== expected || (enabled && (period === null || period <= now || expiry > period || row.errorCategory !== 'none')) ||
       (row.subscriptionState === 'expired' && (period === null || period > now))) return failure();
    const snapshot = Object.freeze({...row});
    proven.add(snapshot);
    return snapshot;
  } catch { return failure(); }
}
export function accessDecision(snapshot, {platform, environment='production', surface='product', now=Date.now()}={}) {
  if(PUBLIC_SURFACES.has(surface)) return Object.freeze({allowed:true, reason:'public_surface'});
  if(!['apple','google'].includes(platform)) return Object.freeze({allowed:false,reason:'app_store_required'});
  if(!proven.has(snapshot) || snapshot.platform !== platform || snapshot.environment !== environment ||
     !Number.isFinite(now) || now < date(snapshot.lastVerifiedAt) || now >= date(snapshot.expiresAt)) return Object.freeze({allowed:false,reason:'verification_required'});
  if(snapshot.entitlementState === 'entitled' && now < date(snapshot.currentPeriodEnd)) return Object.freeze({allowed:true,reason:'verified_subscription'});
  return Object.freeze({allowed:false,reason:snapshot.entitlementState === 'not_entitled' ? 'subscription_required' : 'verification_required'});
}

// Ports are trusted application composition, not window globals or persisted state.
// bridge: lookupProduct, queryPurchases, purchase, restore, completeVerifiedPurchase.
// authority: reconcile({platform, environment, nonce, evidence}) -> signed proof.
export function createEntitlementSession({platform, environment='production', publicKey, bridge, authority, crypto=globalThis.crypto, now=Date.now, timeoutMs=15000}) {
  let state = failure('verification_unavailable'), generation = 0;
  const read = () => state;
  const allowed = surface => accessDecision(state,{platform,environment,surface,now:now()});
  async function bounded(work) {
    let timer;
    try { return await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),timeoutMs);})]); }
    finally { clearTimeout(timer); }
  }
  async function run(action) {
    const ticket = ++generation;
    state = failure('verification_unavailable'); // Reverify; no offline/grace unlock.
    if(!['apple','google'].includes(platform) || !bridge || !authority || !publicKey) {state=failure('platform_unavailable');return state;}
    let category = 'store_unavailable';
    try {
      const result = await bounded(async () => {
        const options = {productId:product(platform), ...(platform==='google' ? {basePlanId:LAUNCH.googleBasePlanId} : {})};
        const evidence = await bridge[action](options);
        if(action==='purchase' && evidence?.pending === true) return failure('purchase_pending');
        if(action==='purchase' && evidence?.canceled === true) return failure('user_canceled');
        category = 'verification_unavailable';
        const nonce = Array.from(crypto.getRandomValues(new Uint8Array(24)), b=>b.toString(16).padStart(2,'0')).join('');
        const proof = await authority.reconcile({platform,environment,nonce,evidence});
        const verified = await verifyAuthorityProof({proof,publicKey,nonce,platform,environment,now:now(),crypto});
        if(ticket !== generation) return failure();
        if(verified.entitlementState==='entitled') {
          // Google authority must already have durably granted then acknowledged;
          // Apple bridge finishes verified transaction, never a failed/pending one.
          category = 'store_unavailable';
          await bridge.completeVerifiedPurchase();
        }
        return verified;
      });
      if(ticket===generation) state=result;
    } catch { if(ticket===generation) { generation++; state=failure(category); } }
    return state;
  }
  return Object.freeze({read,allowed,launch:()=>run('queryPurchases'),resume:()=>run('queryPurchases'),refresh:()=>run('queryPurchases'),
    purchase:()=>run('purchase'),restore:()=>run('restore'),
    lookupProduct:async()=>{
      if(!['apple','google'].includes(platform) || !bridge) return Object.freeze({available:false,errorCategory:'platform_unavailable'});
      try {const value=await bounded(()=>bridge.lookupProduct({productId:product(platform),...(platform==='google'?{basePlanId:LAUNCH.googleBasePlanId}:{})}));
        // Return only safe store display fields; receipts/transaction data never reach UI.
        if(value?.productId!==product(platform) || typeof value.displayPrice!=='string' || !/^\$2\.99$/.test(value.displayPrice) ||
          value.currency!=='USD' || value.priceMicros!==2990000 || value.billingPeriod!=='P1M' || value.storefront!=='US' || value.hasOffer!==false ||
          (platform==='google' && value.basePlanId!==LAUNCH.googleBasePlanId)) return Object.freeze({available:false,errorCategory:'store_unavailable'});
        return Object.freeze({available:true,productId:value.productId,displayPrice:value.displayPrice});
      } catch {return Object.freeze({available:false,errorCategory:'store_unavailable'});}
    }
  });
}
