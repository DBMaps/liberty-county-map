// Offline trusted-composition fixture. Never staged into a production package.
// The real UI, coordinator, provider adapters and signature verifier execute.
export function paidStartupFixtureModule() {
  return `export const productionPaidComposition = ${composition.toString()};`;
}
async function composition(capacitor) {
  const platform=capacitor.getPlatform()==='ios'?'apple':'google';
  const control=window.__paidStartupFixture={mode:'unpaid',product:'available',hold:false,...window.__paidStartupOptions,
    events:[],handlers:{},release(){this.hold=false;this.releaseWait?.();}};
  const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
  const id='com.gridlygo.gridly.monthly';
  const current=async method=>{
    control.events.push(method);
    if(control.hold)await new Promise(resolve=>{control.releaseWait=resolve;});
    if(control.mode==='unpaid')return {result:'no_evidence',errorCategory:'not_entitled'};
    if(control.mode==='store-failure')return {result:'error',errorCategory:'billing_unavailable'};
    return platform==='google'?{result:'purchased',productId:id,basePlanId:'monthly',purchaseToken:'offline-fixture-token'}
      :{result:'verified',productId:id,environment:'production',state:'active',completionHandle:'offline-handle',signedTransaction:'offline.fixture.signature'};
  };
  const plugin={
    addListener:async(name,fn)=>{control.handlers[name]=fn;return {remove:async()=>{delete control.handlers[name];}};},
    startObserving:async()=>{control.events.push('observe');},stopObserving:async()=>{},
    getProducts:async()=>{control.events.push('products');return control.product==='available'
      ?{result:'available',productId:id,basePlanId:'monthly',displayName:'Gridly Monthly',displayPrice:'$2.99',currency:'USD',billingPeriod:'P1M',storefront:'US',hasOffer:false}
      :{result:'error',errorCategory:'product_unavailable'};},
    queryCurrentPurchases:()=>current('query'),getCurrentEntitlement:()=>current('current'),
    refreshEntitlement:()=>current('refresh'),restorePurchases:()=>current('restore'),
    purchase:async()=>{control.events.push('purchase');return {result:'error',errorCategory:'product_unavailable',responseCode:4};},
    finishTransaction:async()=>{control.events.push('finish');return {finished:true};}
  };
  const base64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const authority={reconcile:async request=>{
    control.events.push('authority');
    if(control.mode==='verification-failure')throw Error('offline verification unavailable');
    if(control.mode==='invalid-proof')return 'invalid.fixture.proof';
    const now=Date.now(),expired=control.mode==='expired';
    const row={platform,productId:id,subscriptionState:expired?'expired':'active',entitlementState:expired?'not_entitled':'entitled',
      currentPeriodEnd:new Date(now+(expired?-1000:86400000)).toISOString(),lastVerifiedAt:new Date(now).toISOString(),
      verificationSource:'gridly_server_store_api',environment:'production',restoreAvailable:true,errorCategory:'none',
      nonce:request.nonce,audience:'com.gridlygo.gridly',expiresAt:new Date(now+300000).toISOString()};
    const encode=value=>base64(new TextEncoder().encode(JSON.stringify(value)));
    const payload=encode({alg:'ES256',typ:'gridly-entitlement-v1'})+'.'+encode(row);
    return payload+'.'+base64(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,new TextEncoder().encode(payload))));
  }};
  return {capacitor,plugin,authority,publicKey:keys.publicKey};
}
