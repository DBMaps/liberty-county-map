import {escape} from './components.mjs';
import {registryFromBytes} from './road-selection.mjs';
import {WEEKDAYS,scheduleSummary,workStatus} from './notice-schedule.mjs';
import {newNotice,loadWorkspace,preserveWorking,validateNotice,saveNotice,reviewChanges,overlapNotices,storageKey,effectiveRestriction} from './notice-preview.mjs';
let cachedRegistry;
async function roads(){
 if(!cachedRegistry)cachedRegistry=Promise.all([
  fetch('./demo/dayton-roads.geojson').then(r=>{if(!r.ok)throw new Error('Roads unavailable');return r.arrayBuffer();}),
  fetch('./demo/dayton-roads-provenance.json').then(r=>{if(!r.ok)throw new Error('Road provenance unavailable');return r.json();})
 ]).then(([b,p])=>registryFromBytes(b,p)).catch(e=>{cachedRegistry=null;throw e;});
 return cachedRegistry;
}
const input=(label,id,type,value,max='')=>'<label>'+label+'<input id="'+id+'" type="'+type+'" value="'+escape(value)+'" '+(max?'maxlength="'+max+'"':'')+'></label>';
const unitName=unit=>unit==='works'?'Dayton Public Works':'Dayton Police Department';
const timezoneName=zone=>({'America/Chicago':'Central Time','America/New_York':'Eastern Time','America/Denver':'Mountain Time','America/Los_Angeles':'Pacific Time','UTC':'Coordinated Universal Time'}[zone]||'Local schedule time')+' ('+zone+')';
const exceptionText=s=>Object.entries(s.exceptions).sort().map(([date,e])=>date+' · '+(e.kind==='skip'?'Skipped':e.startTime+'–'+e.endTime)).join('; ')||'None';
export async function openNoticePreview(unit,trigger){
 const dialog=document.createElement('dialog');
 dialog.className='notice-dialog';dialog.setAttribute('aria-labelledby','notice-heading');
 dialog.innerHTML='<header class="notice-top"><h2 id="notice-heading">Draft Notice Preview</h2><button class="button" data-exit>Return to Dispatch</button></header><p class="notice-message" role="status">Loading local source geometry…</p>';
 document.body.append(dialog);dialog.showModal();
 dialog.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  const focusable=[...dialog.querySelectorAll('button,input,select,textarea,a[href],summary,[tabindex]')].filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length);
  const first=focusable[0],last=focusable.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 });
 let disposed=false,picker=null,registry,w,draft,review=null,closeIntent=false,storage,mapGeneration=0,step=1;
 dialog.querySelector('[data-exit]').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{disposed=true;++mapGeneration;picker?.destroy();dialog.remove();trigger?.focus();});
 function message(text){dialog.querySelector('.notice-message').textContent=text;}
 function retain(){
  review=null;closeIntent=false;
  try{w=preserveWorking(storage,w,draft);message('Unsaved synthetic draft preserved for this tab.');}
  catch(e){message(e.message+' Unsaved edits remain here.');}
 }
 function fieldSchedule(kind){
  const v=draft[kind];
  return '<div class="notice-schedule" data-schedule="'+kind+'"><label>How often?<select id="'+kind+'-mode">'+[['once','One-time'],['weekdays','Selected weekdays'],['continuous','Continuous 24 hours']].map(([key,label])=>'<option value="'+key+'" '+(key===v.mode?'selected':'')+'>'+label+'</option>').join('')+'</select></label><div class="notice-weekdays" id="'+kind+'-weekdays" '+(v.mode!=='weekdays'?'hidden':'')+'>'+[1,2,3,4,5,6,0].map(i=>'<label><input type="checkbox" data-day="'+kind+'" value="'+i+'" '+(v.weekdays.includes(i)?'checked':'')+'>'+WEEKDAYS[i]+'</label>').join('')+'</div><div class="notice-fields" id="'+kind+'-times" '+(v.mode==='continuous'?'hidden':'')+'>'+input('Daily start time',kind+'-start','time',v.startTime)+input('Daily end time',kind+'-end','time',v.endTime)+'</div><p class="muted">Editable defaults. One-time uses the project start date. Continuous uses local midnight boundaries. Overnight custom windows are not supported.</p></div>';
 }
 function exceptionEditor(kind){
  const v=draft[kind];
  return '<fieldset><legend>'+(kind==='work'?'Crew work dates':'Traffic restriction dates')+'</legend>'+input('Date to change',kind+'-date','date',draft.project.start)+'<label>Change this date<select id="'+kind+'-exception-kind"><option value="skip">Skip / cancel date</option><option value="modify">Modify hours</option><option value="remove">Remove exception</option></select></label><div class="notice-fields">'+input('Modified start time',kind+'-modified-start','time',v.startTime)+input('Modified end time',kind+'-modified-end','time',v.endTime)+'</div><button class="button" type="button" data-exception="'+kind+'">Apply date change</button><div id="'+kind+'-exceptions">'+escape(exceptionText(v))+'</div></fieldset>';
 }
 function selection(){
  const host=dialog.querySelector('#notice-selected');if(!host)return;
  host.innerHTML=registry.selected(draft.selected).map(r=>'<li><div><strong>'+escape(r.name)+'</strong><small>'+escape(r.ref)+' · '+escape(r.osmId)+'</small></div><button class="button" type="button" data-remove="'+escape(r.id)+'">Remove<span class="sr-only"> '+escape(r.name)+'</span></button></li>').join('')||'<li>No source lines selected</li>';
  host.querySelectorAll('[data-remove]').forEach(b=>{b.disabled=draft.status==='CLOSED';b.onclick=()=>{draft.selected=draft.selected.filter(id=>id!==b.dataset.remove);selection();retain();};});
  picker?.update(draft.selected);
  dialog.querySelector('#notice-next').disabled=!draft.selected.length;
 }
 function candidates(rows,reason){
  const host=dialog.querySelector('#notice-candidates');
  host.innerHTML='<p>'+escape(reason)+' · '+rows.length+' candidates. Choose explicitly.</p>'+rows.map(r=>'<button class="notice-candidate" type="button" data-add="'+escape(r.id)+'">'+escape(r.name)+' <small>'+escape(r.ref)+' · '+escape(r.osmId)+'</small></button>').join('');
  host.querySelectorAll('[data-add]').forEach(b=>{b.disabled=draft.status==='CLOSED';b.onclick=()=>{try{if(!draft.selected.includes(b.dataset.add)){registry.selected([...draft.selected,b.dataset.add]);draft.selected.push(b.dataset.add);}selection();retain();}catch(e){message(e.message);}};});
 }
 async function mountMap(){
  const generation=++mapGeneration;picker?.destroy();picker=null;
  const host=dialog.querySelector('#notice-map');host.textContent='Loading source map…';
  try{
   const {createRoadPicker}=await import('./map-view.mjs');
   if(disposed||generation!==mapGeneration)return;host.textContent='';
   const next=await createRoadPicker(host,registry,draft.selected,rows=>candidates(rows,'Map pick'),()=>!disposed&&generation===mapGeneration);
   if(disposed||generation!==mapGeneration){next.destroy();return;}picker=next;
  }catch(e){if(disposed||generation!==mapGeneration)return;host.textContent='Map unavailable. Search and selected lines remain available.';message(e.message);}
 }
 function allowReplace(){return !w.working||JSON.stringify(w.working)===JSON.stringify(w.notices.find(n=>n.id===w.working.id))||confirm('Replace unsaved synthetic preview edits? Cancel keeps your edits. Saved revisions remain unchanged.');}
 function savedList(){
  return '<details id="notice-saved-list"><summary>Saved synthetic notices</summary><div id="notice-saved">'+(w.notices.length?w.notices.map(n=>'<button class="notice-candidate" type="button" data-open="'+escape(n.id)+'">'+escape(n.subject)+'<small>'+n.status+' · Revision '+n.revision+' · '+escape(n.id)+'</small></button>').join(''):'<p class="muted">No saved synthetic notices for this unit.</p>')+'</div></details>';
 }
 function location(){
  return '<div class="notice-location-grid"><section><label>Search road name or reference<input id="notice-search" type="search" placeholder="Main Street, US 90, FM 1960"></label><h3>Selected source lines</h3><ul id="notice-selected"></ul><div id="notice-candidates" class="notice-candidates"></div>'+savedList()+'</section><section><div id="notice-map" class="notice-map" aria-label="Source road picking map. Search results provide the equivalent keyboard path."></div><div class="notice-toolbar"><button class="button" id="notice-fit">Fit selected lines</button><button class="button" id="notice-retry">Retry map</button></div><p class="muted">Map data © OpenStreetMap contributors · ODbL 1.0 · Source snapshot May 9, 2026</p><details><summary>Dataset provenance</summary><code>'+registry.hash+'</code><p>Exact original OSM coordinates; no connectors, snapping or inferred intersections.</p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap attribution</a> · <a href="./demo/dayton-roads.geojson" download>Download ODbL source lines</a></details></section></div>';
 }
 function details(){
  const choice=draft.restrictionChoice??'custom';
  return '<div class="notice-details-grid"><section><fieldset><legend>Notice details</legend>'+input('Subject','notice-subject','text',draft.subject,160)+'<label>Description<textarea id="notice-body" maxlength="1000" rows="4">'+escape(draft.body)+'</textarea></label>'+input('Optional reference','notice-reference','text',draft.reference,240)+'</fieldset><fieldset><legend>When does this project begin and end?</legend><div class="notice-fields">'+input('Start date','project-start','date',draft.project.start)+input('End date','project-end','date',draft.project.end)+'</div>'+input('Timezone (IANA)','project-timezone','text',draft.project.timezone,80)+'<p id="notice-zone" class="muted">'+escape(timezoneName(draft.project.timezone))+'</p><p class="muted">All times use this timezone. Maximum 366 project dates; DST gaps and ambiguous times require correction.</p></fieldset><fieldset><legend>Notice validity</legend><div class="notice-fields">'+input('Notice begins','notice-effective','datetime-local',draft.effective)+input('Notice ends','notice-expiry','datetime-local',draft.expiry)+'</div><p class="muted">Must contain every work and restriction occurrence.</p></fieldset></section><section><fieldset><legend>When will crews be working?</legend>'+fieldSchedule('work')+'</fieldset><fieldset><legend>When will the roadway be affected?</legend><label>Traffic restriction schedule<select id="restriction-choice"><option value="" '+(!choice?'selected':'')+'>Choose restriction hours</option>'+[['work','Only during scheduled work hours'],['continuous','Continuously throughout the project'],['custom','Different/custom restriction hours']].map(([k,l])=>'<option value="'+k+'" '+(choice===k?'selected':'')+'>'+l+'</option>').join('')+'</select></label>'+(draft.restrictionChoice===undefined?'<p class="muted">Existing saved restriction schedule retained. Choose another option to change it.</p>':'')+'<div id="restriction-custom" '+(choice!=='custom'?'hidden':'')+'>'+fieldSchedule('restriction')+'</div><p id="restriction-help" class="muted"></p><p class="muted">Restriction hours describe scheduled effects only. The clock does not establish whether a roadway is open or closed.</p></fieldset></section></div><details id="notice-exceptions"><summary>Change or skip specific dates</summary><p>Changes are validated during review. Skips and modified hours apply to one date within the parent notice.</p><div class="notice-details-grid">'+exceptionEditor('work')+'<div><p id="restriction-exception-help" class="muted"></p><div id="restriction-exception-editor">'+exceptionEditor('restriction')+'</div></div></div></details>';
 }
 function restrictionPresentation(){
  const choice=draft.restrictionChoice??'custom';
  dialog.querySelector('#restriction-custom').hidden=choice!=='custom';
  dialog.querySelector('#restriction-help').textContent=choice==='work'?'Uses the exact crew work occurrences, including every skipped date and modified window.':choice==='continuous'?'Traffic restrictions cover all project dates, including non-work days, except explicit restriction date changes.':choice==='custom'?'Independent restriction hours and date changes.':'Choose explicitly before reviewing this notice.';
  dialog.querySelector('#restriction-exception-editor').hidden=choice==='work'||!choice;
  dialog.querySelector('#restriction-exception-help').textContent=choice==='work'?'Work date changes also apply to restrictions. Choose custom restriction hours to change restriction dates independently. Stored custom changes are retained.':!choice?'Choose a restriction schedule before changing its dates.':'Restriction date changes are independent of crew work dates.';
 }
 function reviewMarkup(){
  const previous=w.notices.find(n=>n.id===draft.id),change=reviewChanges(previous,review),overlaps=overlapNotices(review,w.notices),restriction=effectiveRestriction(review);
  const time=instant=>new Intl.DateTimeFormat('en-US',{timeZone:review.project.timezone,hour:'numeric',minute:'2-digit',month:'short',day:'numeric'}).format(new Date(instant));
  const dates=[...new Set([...review.workOccurrences,...review.restrictionOccurrences].map(o=>o.date))].sort();
  return '<section id="notice-review" class="notice-review"><p><strong>'+escape(unitName(unit))+'</strong> · '+escape(review.organization)+' · Demo unit</p><h3>'+escape(review.subject)+'</h3><p>'+escape(review.body)+'</p><p>Reference: '+escape(review.reference||'None')+'</p><h4>Selected source lines</h4><ul>'+registry.selected(review.selected).map(r=>'<li>'+escape(r.name)+' · '+escape(r.ref)+' · '+escape(r.osmId)+'</li>').join('')+'</ul><p>Project: '+escape(review.project.start)+' through '+escape(review.project.end)+'</p><p>Timezone: '+escape(timezoneName(review.project.timezone))+'</p><p>Notice begins: '+escape(review.effective)+'<br>Notice ends: '+escape(review.expiry)+'</p><p>Current crew schedule: <strong>'+workStatus(review.workOccurrences)+'</strong>. No roadway open/closed status is inferred.</p>'+[['work','Work scheduled',review.work],['restriction','Traffic restrictions scheduled',restriction]].map(([k,title,s])=>'<h4>'+title+'</h4><p>'+escape(scheduleSummary(review.project,s))+'</p><p>Date changes: '+escape(exceptionText(s))+'</p><p>Affected dates: '+escape(change[k].join(', ')||'None')+'</p><details><summary>'+review[k+'Occurrences'].length+' exact occurrences</summary><ol class="notice-occurrences">'+review[k+'Occurrences'].map(o=>'<li>'+o.date+(o.modified?' · Modified':'')+'<br><code>'+o.start+' → '+o.end+'</code></li>').join('')+'</ol></details>').join('')+'<h4>Each scheduled day</h4><ul class="notice-days">'+dates.map(date=>'<li><strong>'+date+'</strong><div>'+[['work','Work scheduled'],['restriction','Traffic restrictions scheduled']].map(([k,label])=>{const o=review[k+'Occurrences'].find(o=>o.date===date);return '<p>'+label+': '+(o?escape(time(o.start)+' – '+time(o.end))+(o.modified?' · Modified':''):'No occurrence')+'</p>';}).join('')+'</div></li>').join('')+'</ul><p class="muted">No occurrence describes only the schedule; it does not establish that a roadway is open.</p>'+(overlaps.length?'<p class="notice-warning">Overlapping synthetic notices: '+escape(overlaps.join(', '))+'. Review the overlap; records remain separate.</p>':'')+'<details><summary>Version history ('+draft.history.length+')</summary>'+draft.history.map(h=>'<p>Revision '+h.revision+' · '+escape(h.at)+' · '+escape([...h.changes.work,...h.changes.restriction].join(', '))+'</p>').join('')+'</details>'+(closeIntent?'<p class="notice-warning">Review closure of this synthetic notice. Closing creates a retained revision; it does not establish a roadway status.</p>':'')+'</section>';
 }
 function go(next){
  if(next===2&&!draft.selected.length){message('Select at least one source line.');return;}
  if(next===3){try{review=validateNotice(draft,registry);}catch(e){review=null;message(e.message);return;}}
  else {review=null;closeIntent=false;}
  step=next;render();
 }
 function commit(close){
  if(!review||close!==closeIntent||draft.status==='CLOSED')return;
  try{const result=saveNotice(storage,unit,registry,review,draft.revision,close);w=result.workspace;draft=structuredClone(result.notice);review=validateNotice(draft,registry);closeIntent=false;render();message('Synthetic notice '+(close?'closed':'saved')+' · Revision '+draft.revision+'. Publication remains off.');}
  catch(e){message(e.message+' Your unsaved edits remain in this editor.');}
 }
 function render(){
  ++mapGeneration;picker?.destroy();picker=null;
  const closed=draft.status==='CLOSED',titles=['Where is the issue?','What should people know?','Review your notice'];
  dialog.innerHTML='<header class="notice-top"><div><p class="eyebrow">LOCAL · SYNTHETIC · PREVIEW ONLY</p><h2 id="notice-heading" tabindex="-1">'+titles[step-1]+'</h2><small>'+escape(unitName(unit))+' · Revision '+draft.revision+' · '+draft.status+'</small></div><button class="button" data-exit>Return to Dispatch</button></header><ol class="notice-steps" aria-label="Notice steps">'+['Location','Details & schedule','Review'].map((s,i)=>'<li '+(step===i+1?'aria-current="step"':'')+'>'+(i+1)+'. '+s+'</li>').join('')+'</ol><div class="notice-warning"><strong>Source geometry preview — jurisdiction unverified.</strong> OSM lines are not certified operational segments. No publication, agency authority or consumer sync.</div><p class="notice-message" role="status"></p><main class="notice-step-body">'+(step===1?location():step===2?details():reviewMarkup())+'</main><footer class="notice-footer"><div class="notice-toolbar"><button class="button" id="notice-new">New synthetic draft</button><small>'+escape(draft.id)+'</small></div><div class="notice-navigation">'+(step>1?'<button class="button" id="notice-back">'+(step===3?'Back to edit':'Back to location')+'</button>':'')+(step===1?'<button class="button primary" id="notice-next">Next: details & schedule</button>':step===2?'<button class="button primary" id="notice-check">Next: review notice</button>':!closed?(closeIntent?'<button class="button" id="notice-cancel-close">Cancel closure</button><button class="button primary" id="notice-confirm-close">Close synthetic notice</button>':'<button class="button" id="notice-check-close" '+(!draft.revision?'disabled':'')+'>Review closure</button><button class="button primary" id="notice-save">Save synthetic draft</button>'):'<strong>Closed synthetic notice · inspection only</strong>')+'</div></footer>';
  dialog.querySelector('[data-exit]').onclick=()=>dialog.close();
  dialog.querySelector('#notice-new').onclick=()=>{if(!allowReplace())return;draft=newNotice(unit);review=null;closeIntent=false;step=1;retain();render();};
  dialog.querySelector('#notice-back')?.addEventListener('click',()=>go(step-1));
  if(step===1){
   dialog.querySelector('#notice-next').onclick=()=>go(2);
   dialog.querySelector('#notice-search').oninput=e=>candidates(registry.search(e.target.value),'Search results');
   dialog.querySelector('#notice-fit').onclick=()=>picker?.fit(draft.selected);
   dialog.querySelector('#notice-retry').onclick=mountMap;
   dialog.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{try{if(!allowReplace())return;w=loadWorkspace(storage,unit,registry);draft=structuredClone(w.notices.find(n=>n.id===b.dataset.open));closeIntent=false;if(draft.status==='CLOSED'){review=validateNotice(draft,registry);step=3;}render();}catch(e){message(e.message);}});
   selection();mountMap();
  }else if(step===2){
   for(const field of ['subject','body','reference','effective','expiry'])dialog.querySelector('#notice-'+field).oninput=e=>{draft[field]=e.target.value;retain();};
   for(const field of ['start','end','timezone'])dialog.querySelector('#project-'+field).oninput=e=>{draft.project[field]=e.target.value;retain();if(field==='timezone')dialog.querySelector('#notice-zone').textContent=timezoneName(draft.project.timezone);};
   dialog.querySelector('#restriction-choice').onchange=e=>{draft.restrictionChoice=e.target.value;retain();restrictionPresentation();};
   for(const kind of ['work','restriction']){
    dialog.querySelector('#'+kind+'-mode').onchange=e=>{draft[kind].mode=e.target.value;dialog.querySelector('#'+kind+'-weekdays').hidden=e.target.value!=='weekdays';dialog.querySelector('#'+kind+'-times').hidden=e.target.value==='continuous';retain();};
    for(const part of ['start','end'])dialog.querySelector('#'+kind+'-'+part).oninput=e=>{draft[kind][part+'Time']=e.target.value;retain();};
    dialog.querySelectorAll('[data-day="'+kind+'"]').forEach(e=>e.onchange=()=>{draft[kind].weekdays=[...dialog.querySelectorAll('[data-day="'+kind+'"]:checked')].map(e=>Number(e.value));retain();});
    dialog.querySelector('[data-exception="'+kind+'"]').onclick=()=>{
     const date=dialog.querySelector('#'+kind+'-date').value,action=dialog.querySelector('#'+kind+'-exception-kind').value;
     if(!date){message('Choose an occurrence date.');return;}
     if(action==='remove')delete draft[kind].exceptions[date];
     else draft[kind].exceptions[date]=action==='skip'?{kind:'skip'}:{kind:'modify',startTime:dialog.querySelector('#'+kind+'-modified-start').value,endTime:dialog.querySelector('#'+kind+'-modified-end').value};
     dialog.querySelector('#'+kind+'-exceptions').textContent=exceptionText(draft[kind]);retain();
    };
   }
   restrictionPresentation();dialog.querySelector('#notice-check').onclick=()=>go(3);
   if(closed)dialog.querySelectorAll('.notice-step-body input,.notice-step-body textarea,.notice-step-body select,.notice-step-body button').forEach(e=>e.disabled=true);
  }else{
   dialog.querySelector('#notice-save')?.addEventListener('click',()=>commit(false));
   dialog.querySelector('#notice-check-close')?.addEventListener('click',()=>{if(!draft.revision)return;try{review=validateNotice(draft,registry);closeIntent=true;render();message('Review the retained closure revision before confirming.');}catch(e){message(e.message);}});
   dialog.querySelector('#notice-cancel-close')?.addEventListener('click',()=>{closeIntent=false;render();});
   dialog.querySelector('#notice-confirm-close')?.addEventListener('click',()=>commit(true));
  }
  if(closed)message('Closed synthetic notice — retained for inspection. Create a new draft to continue.');
  dialog.querySelector('#notice-heading').focus();
 }
 try{registry=await roads();if(disposed)return;storage=sessionStorage;w=loadWorkspace(storage,unit,registry);draft=w.working||newNotice(unit);render();message(w.working?'Recovered unsaved synthetic draft for this tab.':'Select source lines to begin.');}
 catch(e){if(disposed)return;message(e.message);const reset=document.createElement('button');reset.className='button';reset.textContent='Reset this unit’s synthetic preview storage';reset.onclick=()=>{try{sessionStorage.removeItem(storageKey(unit));dialog.close();openNoticePreview(unit,trigger);}catch(error){message(error.message);}};dialog.append(reset);}
}