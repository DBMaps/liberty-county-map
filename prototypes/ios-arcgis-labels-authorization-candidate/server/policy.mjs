export const policy=Object.freeze({purpose:'gridly-labels-lease-v1',appId:'com.gridlygo.gridly',
 attestAppId:'2XSH6R7K37.com.gridlygo.gridly',store:'sandbox',attest:'production',gatewayId:'gridly-labels-consumer-pilot-v1'});
export const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
export const digest43=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v)&&Buffer.from(v,'base64url').toString('base64url')===v;
export const live=signal=>signal?.throwIfAborted();
