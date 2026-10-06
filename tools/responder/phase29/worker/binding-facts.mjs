// Temporary diagnostics: fixed boolean/type facts only; never serialize a binding or URI.
const type=value=>typeof value;
export function bindingFacts(env){
 const facts={bindingPresent:false,bindingType:'undefined',connectionStringPresent:false,connectionStringType:'undefined',connectionStringNonEmpty:false,hasPropertyCacheDeclarationValid:false,hasPropertyTlsDeclarationValid:false,hasPropertyUrlParseable:false,hasPropertyPostgresProtocol:false,hasPropertyUsernameDecodable:false,hasPropertyExpectedLogin:false,hasPropertyPassword:false,hasPropertySslModePresent:false,hasPropertySslModeAllowed:false};
 try{
  const b=env.DISPATCH_DELIVERY_DB;facts.bindingPresent=Boolean(b);facts.bindingType=type(b);
  facts.hasPropertyCacheDeclarationValid=env.GRIDLY_DISPATCH_DB_CACHING_DISABLED==='true';facts.hasPropertyTlsDeclarationValid=env.GRIDLY_DISPATCH_DB_TLS_REQUIRED==='true';
  if(!b)return facts;
  const value=b.connectionString;facts.connectionStringPresent=value!==undefined;facts.connectionStringType=type(value);facts.connectionStringNonEmpty=typeof value==='string'&&value.length>0;
  if(typeof value!=='string')return facts;
  let u;try{u=new URL(value)}catch{return facts}
  facts.hasPropertyUrlParseable=true;facts.hasPropertyPostgresProtocol=u.protocol==='postgres:'||u.protocol==='postgresql:';
  try{facts.hasPropertyExpectedLogin=decodeURIComponent(u.username)==='dispatch_delivery_connection';facts.hasPropertyUsernameDecodable=true}catch{}
  facts.hasPropertyPassword=Boolean(u.password);facts.hasPropertySslModePresent=u.searchParams.has('sslmode');facts.hasPropertySslModeAllowed=!facts.hasPropertySslModePresent||u.searchParams.get('sslmode')==='verify-full';
 }catch{}
 return facts;
}
