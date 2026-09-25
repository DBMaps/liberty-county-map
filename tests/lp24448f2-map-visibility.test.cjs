const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/gridly-map-visibility.js','utf8');
function setup() {
  const rect = (left,top,right,bottom) => ({left,top,right,bottom,width:right-left,height:bottom-top});
  const element = (r) => ({hidden:false,style:{setProperty(){}},setAttribute(){},getBoundingClientRect:()=>r});
  const top = element(rect(10,0,380,214)), bottom = element(rect(12,690,378,760)), rail=element(rect(342,230,380,403));
  let notice, timer, settle;
  const emitter = () => ({ events:{}, on(names,fn){for(const name of names.split(' '))(this.events[name] ||= []).push(fn);},fire(name){for(const fn of this.events[name]||[])fn();} });
  const layers=[emitter(),emitter()];
  const map=Object.assign(emitter(),{active:layers[0],hasLayer(layer){return this.active===layer;},getContainer:()=>({getBoundingClientRect:()=>rect(0,84,390,928),appendChild(n){notice=n;}}),panBy(offset){this.pans.push(offset);},pans:[]});
  const document={body:{dataset:{layoutMode:'portrait'}},createElement:()=>element(rect(8,645,334,680)),querySelectorAll(selector){return selector.includes('gridly-v2-topbar')?[top]:selector.includes('mobileDestination')?[bottom]:selector.includes('control-rail')?[rail]:selector.includes('BackgroundStatus')&&notice?[notice]:[];}};
  const global={innerWidth:390,innerHeight:844};
  const sandbox={window:global,document,getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'}),requestAnimationFrame(fn){timer=fn;return 1;},cancelAnimationFrame(){timer=null;}};
  sandbox.setTimeout = fn => { settle=fn; return 2; };
  sandbox.clearTimeout = () => { settle=null; };
  vm.runInNewContext(source,sandbox);
  const api=global.GridlyMapVisibility.install(map,layers);
  return {global,document,map,layers,api,top,bottom,rail,notice:()=>notice,flush(){const fn=timer;timer=null;fn?.();const late=settle;settle=null;late?.();},element,rect};
}
test('bounds subtract actual fixed stack, context and right controls; hidden UI does not reserve space',()=>{
  const h=setup(); assert.deepEqual(JSON.parse(JSON.stringify(h.api.bounds())),{left:8,right:334,top:222,bottom:682});
  h.rail.hidden=true;assert.equal(h.api.bounds().right,382);
  h.top.hidden=true;assert.equal(h.api.bounds().top,92);
});
test('failed base tiles announce background loss, successful tile recovery clears it, inactive errors do not leak',()=>{
  const h=setup();h.layers[1].fire('tileerror');assert.equal(h.notice().hidden,true);
  h.layers[0].fire('tileerror');assert.equal(h.notice().hidden,false);
  assert.match(h.notice().textContent,/imagery unavailable/);
  h.layers[0].fire('tileload');assert.equal(h.notice().hidden,true);
  h.layers[0].fire('loading');h.layers[0].fire('tileerror');assert.equal(h.notice().hidden,false);
  h.map.active=null;h.map.fire('baselayerchange');assert.equal(h.notice().hidden,true);
});
test('one bounded correction updates the existing popup without changing auto-pan or scheduling move loops',()=>{
  const h=setup(),position=h.rect(35,160,355,430);
  h.map.panBy=function(offset){this.pans.push(offset);position.left-=offset[0];position.right-=offset[0];position.top-=offset[1];position.bottom-=offset[1];};
  const popup={options:{autoPan:true},isOpen:()=>true,getElement:()=>h.element(position),update(){this.updated=true;}};
  h.map._popup=popup;h.map.fire('popupopen');h.flush();
  assert.equal(popup.updated,true);assert.equal(popup.options.autoPan,true);
  assert.equal(h.map.pans.length,1);assert.equal(h.map.pans[0][1],-62);
  h.map.fire('moveend');h.flush();assert.equal(h.map.pans.length,1);
});
test('closed or replaced popup cannot apply a late camera correction',()=>{
  const h=setup();h.map._popup={isOpen:()=>true};h.map.fire('resize');h.map._popup=null;h.flush();assert.equal(h.map.pans.length,0);
  h.map._popup={isOpen:()=>false};h.map.fire('resize');h.flush();assert.equal(h.map.pans.length,0);
  h.map._popup={options:{autoPan:true},isOpen:()=>true,getElement:()=>h.element(h.rect(10,230,300,430)),update(){}};
  h.map.fire('popupopen');h.map._popup=null;h.map.fire('popupclose');h.flush();assert.equal(h.map.pans.length,0);
});
test('desktop does not use portrait correction; module has no context, route or storage writer',()=>{
  const h=setup();h.document.body.dataset.layoutMode='desktop';h.map._popup={isOpen:()=>true};h.map.fire('popupopen');h.flush();assert.equal(h.map.pans.length,0);
  assert.doesNotMatch(source,/localStorage|setView|fitBounds|routeWatch|gridlyActivate|gridlySetTemporary/);
});
