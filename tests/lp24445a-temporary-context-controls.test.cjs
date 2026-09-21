const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const app=fs.readFileSync('js/app.js','utf8');
const start=app.indexOf('function getGridlyMobileCommandCardVisibilityState(');
const source=app.slice(start,app.indexOf('\nlet gridlyAwarenessAreaImmediateSyncState',start));
function state({search=true,open=false,preview=false,watch=false,popup=false}={}){
 const h={window:{},document:{body:{classList:{contains:()=>false}},getElementById:id=>id==='gridlySearchShell'?{classList:{contains:()=>open}}:null},ensureGridlySearchState:()=>({selectedDestination:search?{title:'Crosby'}:null}),normalizeGridlySearchResult:x=>x,getSelectedDestinationLabel:()=>search?'Crosby':'',getGridlyDestinationRoutePreviewState:()=>({active:preview,status:preview?'ready':'idle'}),routeWatchActivated:watch,gridlySearchUiState:{routePreviewTransitionStarted:preview},isGridlyLeafletPopupInteractionActive:()=>popup,shouldShowGridlyMobileAwarenessPanel:()=>true,gridlyGetCurrentAwarenessContext:()=>({type:search?'SEARCH':'HOME'})};vm.createContext(h);vm.runInContext(source,h);return h.getGridlyMobileCommandCardVisibilityState();
}
test('closed Search retains awareness owner and bypasses pending-destination suppression',()=>{const s=state();assert.equal(s.visible,true);assert.equal(s.awarenessPanelMode,true);assert.equal(s.pendingDestinationConfirmation,false);assert.equal(s.owner,'awareness');});
test('open Search retains existing destination surface ownership',()=>{const s=state({open:true});assert.equal(s.awarenessPanelMode,false);assert.equal(s.pendingDestinationConfirmation,true);});
test('route preview and active Route Watch retain existing ownership',()=>{for(const options of [{preview:true},{watch:true}]){const s=state(options);assert.equal(s.temporaryAwarenessMode,false);assert.equal(s.awarenessPanelMode,false);}});
test('cleared context restores normal Home awareness owner',()=>{const s=state({search:false});assert.equal(s.visible,true);assert.equal(s.owner,'awareness');assert.equal(s.hasSelectedDestination,false);assert.equal(s.temporaryAwarenessMode,false);});
