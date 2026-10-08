import {escape} from './components.mjs';
export function connectOperationalLogin({app,restart}){
 let generation=0,timer,visibility;
 const form=()=>app.querySelector('.login-form');
 const stop=()=>{generation++;clearInterval(timer);if(visibility)document.removeEventListener('visibilitychange',visibility)};
 async function request(route,body){try{const response=await fetch('/api/'+route,{method:body===undefined?'GET':'POST',cache:'no-store',credentials:'same-origin',headers:{'X-Gridly-Dispatch':'local-auth',...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});return await response.json()}catch{return {ok:false,message:'Local authentication service unavailable.'}}}
 function message(value){app.querySelector('#auth-message').textContent=value}
 function deny(value){stop();form().innerHTML=`<p class="eyebrow">LOCAL SYNTHETIC AUTHENTICATION</p><h2>Access unavailable</h2><p id="auth-message" role="status">${escape(value)}</p><button class="button primary" id="retry-login">Return to sign in</button>`;app.querySelector('#retry-login').onclick=()=>{stop();restart()}}
 async function logout(){stop();const result=await request('logout',{});restart();message(result.ok&&result.upstreamRevocationConfirmed?'Signed out.':'Local session ended. Upstream revocation was not confirmed.')}
 function mfa(enroll){stop();const version=generation;form().innerHTML=`<p class="eyebrow">LOCAL SYNTHETIC AUTHENTICATION</p><h2>Verify your access</h2><p>Use a six-digit code from your authenticator.</p>${enroll?'<button class="button" id="enroll">Set up local authenticator</button><p id="enrollment-secret"></p>':''}<form id="totp"><label for="code">Authenticator code</label><input id="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required><button class="button primary sign-in">Verify</button></form><p id="auth-message" role="status"></p><button class="text-button" id="logout">Sign out</button>`;
  app.querySelector('#logout').onclick=logout;
  if(enroll)app.querySelector('#enroll').onclick=async()=>{const result=await request('enroll',{});if(version!==generation)return;if(result.ok){app.querySelector('#enrollment-secret').textContent='Enter this setup key in your authenticator: '+result.secret;app.querySelector('#enroll').disabled=true}else message(result.message)};
  app.querySelector('#totp').onsubmit=async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;const code=app.querySelector('#code').value;app.querySelector('#code').value='';const result=await request('verify',{code});if(version!==generation)return;if(result.ok)authorized(result.units);else{message(result.message);button.disabled=false}};
 }
 function authorized(units,selected){stop();const version=generation;selected=units.some(u=>u.unit_id===selected)?selected:units[0].unit_id;
  form().innerHTML=`<p class="eyebrow">LOCAL SYNTHETIC AUTHENTICATION</p><h2>Authorized departments</h2><p>Current server-authorized context. Notice creation, approval and publication are disabled.</p><label for="authorized-unit">Acting department</label><select class="button" id="authorized-unit">${units.map(u=>`<option value="${u.unit_id}" ${u.unit_id===selected?'selected':''}>${escape(u.organization_display_name)} · ${escape(u.unit_display_name)}</option>`).join('')}</select><p id="auth-message" role="status">Read-only context · Synthetic test account</p><button class="button" id="logout">Sign out</button>`;
  app.querySelector('#logout').onclick=logout;
  async function revalidate(target){const result=await request('context');if(version!==generation)return;if(!result.ok){if(result.state==='refresh-required'){stop();deny('Session needs renewal. Sign in again to verify current access.')}else deny(result.message);return}if(target&&!result.units.some(u=>u.unit_id===target)){deny('Department access denied.');return}authorized(result.units,target||selected)}
  app.querySelector('#authorized-unit').onchange=event=>revalidate(event.target.value);
  timer=setInterval(()=>revalidate(),10000);
  visibility=()=>{if(!document.hidden&&version===generation)revalidate()};document.addEventListener('visibilitychange',visibility);
 }
 app.querySelector('.login-form .eyebrow').textContent='LOCAL SYNTHETIC AUTHENTICATION';
 app.querySelector('#email').placeholder='test@dispatch.invalid';
 app.querySelector('#recover').onclick=()=>message('Contact the test account owner for recovery. No recovery email has been sent.');
 app.querySelector('#login').onsubmit=async event=>{event.preventDefault();stop();const version=generation;const email=app.querySelector('#email').value.trim().toLowerCase(),password=app.querySelector('#password').value,button=event.currentTarget.querySelector('[type="submit"]');button.disabled=true;const result=await request('login',{email,password});if(version!==generation)return;app.querySelector('#password').value='';if(result.ok)mfa(result.enrollmentAvailable);else{message(result.message);button.disabled=false}};
 const initialGeneration=generation;request('context').then(result=>{if(result.ok&&initialGeneration===generation)authorized(result.units)});
}
