import {initialView,saveView,viewControl} from './view-preference.mjs';
import {brand, icon, badge, empty, statePanel, incidentRow, reviewItem, escape, themeControl} from './components.mjs';
import {signIn, recoveryMessage, verificationMessage} from './auth.mjs';

const app = document.querySelector('#app');
const dialog = document.querySelector('#detail');
const params = new URLSearchParams(location.search);
let fixtures = null;
let activeUnit = 'police';
let page = 'Dispatch Board';
let state = 'populated';
let filters = {search:'',severity:'',status:'',source:'',review:''};
let lastFocus;
let viewMode='board', selectedIncident=null, mapController=null, viewGeneration=0;
// Query parameters alone never unlock the preview. An explicit loopback server is required.
const loopback = ['127.0.0.1','localhost','[::1]'].includes(location.hostname);
let demoEnabled = false, operationalEnabled=false, connectLocalLogin;
if (loopback) {
  try { const result = await fetch('./__preview', {cache:'no-store'}); const mode=result.ok?(await result.json()).mode:null; demoEnabled=mode==='local-fixtures'; operationalEnabled=mode==='local-auth'; } catch {}
}
if (demoEnabled && params.get('demo') === '1') {
  fixtures = await import('./demo/fixtures.mjs');
  viewMode=initialView(params.get('view'));
  if(fixtures.memberships.includes(params.get('unit')))activeUnit=params.get('unit');
  if(['light','dark','system'].includes(params.get('theme')))window.gridlyDispatchTheme.setPreference(params.get('theme'));
  state = ['populated','empty','loading','error','denied'].includes(params.get('state')) ? params.get('state') : 'populated';
  renderShell();
} else {
  if(operationalEnabled)({connectOperationalLogin:connectLocalLogin}=await import('./local-auth-view.mjs'));
  renderLogin();
}

function renderLogin() {
  app.innerHTML = `<div class="login-layout"><section class="login-story">${brand()}<div class="story-content"><p class="eyebrow">COMMUNITY OPERATIONS, CONNECTED</p><h1>Operational awareness for the people responsible for keeping communities moving.</h1><p class="story-description">A clear view of what matters. A shared commitment to the communities you serve.</p><div class="service-list"><span>Police</span><span>Fire</span><span>EMS</span><span>Public Works</span></div></div><div class="story-footer"><span>GRIDLY DISPATCH</span><span>Clarity. Coordination. Confidence.</span></div></section><main id="main" class="login-main"><div class="login-tools">${themeControl()}</div><div class="login-form"><div class="access-icon">${icon('lock')}</div><p class="eyebrow">AUTHORIZED AGENCY ACCESS</p><h2>Welcome to Dispatch</h2><p class="muted">Sign in with your organization-managed account.</p><form id="login"><label for="email">Email</label><input id="email" type="email" autocomplete="username" placeholder="you@agency.gov" required><div class="password-label"><label for="password">Password</label><button type="button" class="text-button" id="recover">Forgot password?</button></div><input id="password" type="password" autocomplete="current-password" required><button class="button primary sign-in" type="submit">Sign In ${icon('arrow')}</button></form><p id="auth-message" class="auth-message" role="status"></p><div class="secure-note">${icon('lock')}<p>Authorized agency access only.<br><span>Access and verification are managed by your organization.</span></p></div>${demoEnabled?'<a class="demo-link" href="?demo=1">Open local visual demo <span aria-hidden="true">↗</span></a><p class="preview-caption">Synthetic records · no live operations</p>':''}</div><footer>Gridly Dispatch <span>Organization-controlled access</span></footer></main></div>`;
  if(operationalEnabled){connectLocalLogin({app,restart:renderLogin});return;}
  document.querySelector('#login').addEventListener('submit',async event=>{
    event.preventDefault();
    // Credentials are deliberately neither read, stored nor transmitted by this preview.
    const result = await signIn();
    document.querySelector('#password').value = '';
    document.querySelector('#auth-message').textContent = result.message;
  });
  document.querySelector('#recover').onclick=()=>document.querySelector('#auth-message').textContent=recoveryMessage();
  if (demoEnabled && params.get('auth')==='verification') document.querySelector('#auth-message').textContent=verificationMessage();
}

function currentRecords() { return state==='populated' ? fixtures.unitRecords(activeUnit) : []; }
function activeName() { return fixtures.units.find(unit=>unit.id===activeUnit).name; }
function renderShell() {
  app.innerHTML = `<div class="shell"><aside class="sidebar">${brand()}<p class="nav-label">OPERATIONS</p><nav aria-label="Primary">${[['Dispatch Board','board'],['Reports','reports'],['Review Queue','review'],['Activity','activity'],['Organization','organization']].map(([name,symbol])=>`<button data-page="${name}" ${page===name?'aria-current="page"':''}>${icon(symbol)}${name}</button>`).join('')}</nav><div class="nav-future"><p class="nav-label">ADMINISTRATION</p><p>Members · Units · Sharing · Settings</p><small>Available after activation</small></div><div class="sidebar-bottom">${icon('lock')}<strong>Controlled access</strong><span>Publication is off</span><span>Participant onboarding blocked</span></div></aside><div class="workspace"><header class="topbar"><div class="context"><span class="org-label">${icon('organization')}City of Dayton</span><label for="active-unit">ACTING UNIT</label><select id="active-unit" aria-describedby="unit-scope">${fixtures.units.filter(unit=>fixtures.memberships.includes(unit.id)).map(unit=>`<option value="${unit.id}" ${activeUnit===unit.id?'selected':''}>${unit.name}</option>`).join('')}</select></div><div class="user-area">${themeControl()}<span class="avatar">DV</span><div><strong>Demo viewer</strong><small>Local visual session</small></div><button class="text-button" id="signout">Exit demo</button></div></header><div class="demo-banner"><strong>LOCAL VISUAL DEMO</strong><span>Synthetic records · no live operations</span><label for="preview-state">Preview state</label><select id="preview-state">${['populated','empty','loading','error','denied'].map(value=>`<option value="${value}" ${state===value?'selected':''}>${value==='denied'?'Authorization error':value[0].toUpperCase()+value.slice(1)}</option>`).join('')}</select></div><main id="main" tabindex="-1"><div class="page-heading"><div><p class="eyebrow">DAYTON / OPERATIONS</p><h1>${page}</h1><p id="unit-scope">${escape(activeName())} <span class="separator">/</span> Separate unit authorization required</p></div><div class="snapshot"><span class="status-dot"></span>Fixture snapshot<strong>Oct 6, 2026 · 08:30 CDT</strong></div></div><div id="view"></div></main><footer class="shell-footer"><span>City of Dayton · ${escape(activeName())}</span><span>Internal workspace · Publication off</span></footer></div></div>`;
  const noticeEntry=document.createElement('button');noticeEntry.className='notice-entry';noticeEntry.textContent='Draft Notice Preview';noticeEntry.onclick=async()=>{const {openNoticePreview}=await import('./notice-preview-view.mjs');openNoticePreview(activeUnit,noticeEntry);};document.querySelector('.sidebar').append(noticeEntry);
  if(page==='Dispatch Board'){
    document.querySelector('.page-heading').insertAdjacentHTML('beforeend',viewControl(viewMode));
    document.querySelector('#dispatch-view').onchange=event=>{viewMode=event.target.value;saveView(viewMode);renderView();};
  }
  document.querySelectorAll('[data-page]').forEach(button=>button.onclick=()=>{page=button.dataset.page;filters={search:'',severity:'',status:'',source:'',review:''};renderShell();document.querySelector('#main').focus();});
  document.querySelector('#active-unit').onchange=event=>{if(!fixtures.memberships.includes(event.target.value))return;activeUnit=event.target.value;filters={search:'',severity:'',status:'',source:'',review:''};renderShell();document.querySelector('#active-unit').focus();};
  document.querySelector('#preview-state').onchange=event=>{state=event.target.value;renderShell();document.querySelector('#preview-state').focus();};
  document.querySelector('#signout').onclick=()=>location.assign(location.pathname);
  renderView();
}

function renderView() {
  mapController?.destroy();mapController=null;viewGeneration++;
  const view=document.querySelector('#view');
  if (['loading','error','denied'].includes(state)) {
    view.innerHTML=`<section class="panel">${statePanel(state)}</section>`;
    const retry=document.querySelector('#retry');
    if(retry)retry.onclick=()=>{if(state==='denied')location.assign(location.pathname);else{state='populated';renderShell();}};
    return;
  }
  const rows=currentRecords();
  if(page==='Dispatch Board'&&viewMode!=='board'){renderGeographic();return;}
  if(page==='Organization') {
    view.innerHTML=`<section class="panel organization-panel"><p class="eyebrow">MUNICIPAL ORGANIZATION</p><h2>City of Dayton</h2><p>Unit access is separately authorized. Membership in the city does not grant access to every department.</p><div class="unit-list">${fixtures.units.map(unit=>`<div>${icon('organization')}<strong>${unit.name}</strong><span>${unit.member?'Separate demo membership':'No demo membership · access unavailable'}</span></div>`).join('')}</div><div class="policy-note">Reviewer readiness requires a minimum of two trained reviewers per unit. Demo memberships do not establish reviewer authority.</div></section>`;return;
  }
  if(page==='Activity') {
    view.innerHTML=`<section class="panel"><div class="panel-heading"><h2>Unit activity</h2><span>Fixture timeline</span></div>${rows.length?`<div class="activity-list">${rows.flatMap(item=>item.timeline.map(([time,event])=>`<div><time>${time} CDT</time><span><strong>${escape(item.title)}</strong><small>${escape(event)}</small></span><span>${item.id}</span></div>`)).join('')}</div>`:empty('No activity yet','Updates for your authorized unit will appear here.')}</section>`;return;
  }
  if(page==='Review Queue') {
    view.innerHTML=`<section class="panel"><div class="panel-heading"><h2>Awaiting authorized review</h2><span>${rows.filter(item=>item.review==='Needs review').length} items</span></div><div class="review-full">${queue(rows)}</div><div class="policy-note">At least two trained reviewers per unit. Authors cannot self-approve. Every decision requires live authorization for the exact unit, subtype, risk and scope; stale revisions are rejected.</div></section>`;bindRecords();return;
  }
  view.innerHTML=`<section class="metrics" aria-label="Unit summary">${[['Active incidents',rows.filter(item=>item.status==='Active').length,'Current unit only'],['Needs review',rows.filter(item=>item.review==='Needs review').length,'Awaiting authorized review'],['High priority',rows.filter(item=>['High','Critical'].includes(item.severity)&&item.status!=='Resolved').length,'High or critical severity'],['Recently updated',rows.filter(item=>parseInt(item.updated)<=15).length,'Within 15 minutes of snapshot']].map(([label,value,note])=>`<div><span>${label}</span><strong>${value.toString().padStart(2,'0')}</strong><small>${note}</small></div>`).join('')}</section><div class="work-area ${page==='Reports'?'reports-only':''}"><section class="panel records-panel"><div class="panel-heading"><h2>${page==='Reports'?'All unit reports':'Incidents & reports'}</h2><span>Internal records</span></div>${filtersMarkup()}<div id="record-results" aria-live="polite"></div></section>${page==='Dispatch Board'?`<aside class="board-secondary"><section class="panel"><div class="panel-heading"><h2>Review queue</h2><span class="count">${rows.filter(item=>item.review==='Needs review').length}</span></div>${queue(rows)}<div class="queue-footer">${icon('lock')}Inspection only. Authority is checked live before any decision.</div></section><section class="panel location-context"><p class="eyebrow">LOCATION CONTEXT</p>${icon('pin')}<h3>Dayton, Texas</h3><p>Open a report to inspect its roadway and location details.</p><span>Map integration reserved</span></section></aside>`:''}</div>`;
  wireFilters();
  renderResults();bindRecords();
}
function filtersMarkup(){return `<div class="filters"><label class="search">${icon('search')}<span class="sr-only">Search reports</span><input id="search" type="search" placeholder="Search incident or location" value="${escape(filters.search)}"></label><div class="filter-selects">${filter('severity','Severity',['Critical','High','Moderate','Low'])}${filter('status','Status',['Active','Monitoring','Resolved'])}<label>Unit<select aria-label="Unit filter"><option>${activeName()}</option></select></label>${filter('source','Source',['Community report','Official source','Agency-created','Shared agency'])}${filter('review','Review',['Needs review','Reviewed'])}<button class="text-button" id="clear">Reset</button></div></div>`;}
function wireFilters(){
  document.querySelector('#search').oninput=event=>{filters.search=event.target.value;renderResults();};
  document.querySelectorAll('[data-filter]').forEach(select=>select.onchange=event=>{filters[select.dataset.filter]=event.target.value;renderResults();});
  document.querySelector('#clear').onclick=()=>{filters={search:'',severity:'',status:'',source:'',review:''};renderView();document.querySelector('#search').focus();};
}
function filter(key,label,options) {return `<label>${label}<select data-filter="${key}"><option value="">All ${label.toLowerCase()}</option>${options.map(value=>`<option ${filters[key]===value?'selected':''}>${value}</option>`).join('')}</select></label>`;}
function queue(rows) { const pending=rows.filter(item=>item.review==='Needs review');return pending.length?pending.map(reviewItem).join(''):empty('Nothing waiting for review','Items requiring your authorized review will appear here.'); }
function renderResults() {
  const rows=filteredRecords();
  if(page==='Dispatch Board'&&viewMode!=='board'){mapController?.update(rows);return;}
  const filtered=Object.values(filters).some(Boolean);
  document.querySelector('#record-results').innerHTML=rows.length?`<div class="table-wrap"><table><caption class="sr-only">Reports for ${activeName()}</caption><thead><tr><th>Incident / source</th><th>Severity</th><th>Location / owning unit</th><th>Status / review</th><th>Updated</th></tr></thead><tbody>${rows.map(incidentRow).join('')}</tbody></table></div><div class="table-footer"><span>${rows.length} reports · ${activeName()}</span><span>All times CDT</span></div>`:empty(filtered?'No matching reports':'No active incidents',filtered?'Adjust or reset your filters to see reports for this unit.':'When reports or operational incidents require attention, they’ll appear here.');
  bindRecords();
}
function bindRecords() {document.querySelectorAll('[data-record]').forEach(button=>button.onclick=()=>openDetail(button.dataset.record));}
function openDetail(id) {
  const item=currentRecords().find(record=>record.id===id);if(!item)return;
  lastFocus=document.activeElement;
  document.querySelectorAll(`[data-record="${id}"]`).forEach(button=>button.closest("tr")?.classList.add("selected"));
  dialog.innerHTML=`<div class="drawer-top"><span>REPORT DETAIL · ${item.id}</span><button id="close-detail" class="icon-button" aria-label="Close report detail">${icon('close')}</button></div><div class="drawer-body"><p class="eyebrow">SYNTHETIC RECORD / INTERNAL ONLY</p><h2 id="detail-title">${escape(item.title)}</h2><div class="detail-badges">${badge(item.severity)}${badge(item.status)}${badge(item.review)}</div><div class="detail-location">${icon('pin')}<span><strong>${escape(item.location)}</strong><small>${escape(item.unitName)} · City of Dayton</small></span></div><section><h3>Operational details</h3><p>${escape(item.description)}</p><dl><dt>Source</dt><dd>${item.source}</dd><dt>Affected area</dt><dd>${escape(item.location)}</dd><dt>Created</dt><dd>Oct 6, 2026 · ${item.created} CDT</dd><dt>Last updated</dt><dd>Oct 6, 2026 · ${item.revised} CDT</dd></dl></section><section><h3>Report timeline</h3><ol class="timeline">${item.timeline.map(([time,event])=>`<li><time>${time}</time><span>${escape(event)}</span></li>`).join('')}</ol></section><section><div class="section-heading"><h3>Review & authority</h3><span>Revision ${item.revision}</span></div><p><strong>${item.review==='Reviewed'?'Reviewed in fixture':'Awaiting authorized review'}</strong></p><p>Eligibility unverified — a local demo cannot establish reviewer authority.</p><ul class="requirements"><li>Minimum two trained reviewers per unit.</li><li>Authors cannot approve their own reports.</li><li>Authority must match subtype, risk, scope and acting unit.</li><li>Live authorization and exact revisions are required. Stale revisions are rejected.</li><li>Multiple memberships do not grant cross-unit authority.</li></ul></section><section class="publication"><h3>Publication</h3><strong>Internal · Publication off</strong><p>This record is not published. Publication and approval actions are unavailable in the visual preview.</p></section></div><div class="drawer-footer">${icon('lock')}Read-only visual inspection · No operational writes</div>`;
  document.querySelector('#close-detail').onclick=()=>dialog.close();
  dialog.showModal();document.querySelector('#close-detail').focus();
}
dialog.addEventListener('close',()=>{document.querySelectorAll('tr.selected').forEach(row=>row.classList.remove('selected'));lastFocus?.focus();});

function filteredRecords(){return currentRecords().filter(item=>(!filters.search || `${item.title} ${item.location} ${item.id}`.toLowerCase().includes(filters.search.toLowerCase())) && ['severity','status','source','review'].every(key=>!filters[key]||item[key]===filters[key]));}
async function renderGeographic(){
  const generation=viewGeneration;
  const view=document.querySelector('#view');
  view.innerHTML=`<section class="panel geo-filters">${filtersMarkup()}</section><div id="geo-host"></div>`;
  wireFilters();
  const host=document.querySelector('#geo-host');
  try{
    const {createGeographicView}=await import('./map-view.mjs');
    if(generation!==viewGeneration)return;
    mapController=createGeographicView(host,{mode:viewMode,rows:filteredRecords(),selectedId:selectedIncident,onSelect:id=>selectedIncident=id,onDetail:openDetail,unitName:activeName()});
  }catch{if(generation!==viewGeneration)return;host.innerHTML=`<section class="panel">${empty('Map unavailable','Incident records remain available in Board view.','<button class="button" id="retry-map-view">Retry map</button>')}</section>`;host.querySelector('button').onclick=renderView;}
}
