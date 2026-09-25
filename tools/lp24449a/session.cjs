const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.geojson':'application/json','.png':'image/png','.svg':'image/svg+xml'};
module.exports=async function session(options={}){
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,options.baseline&&pathname==='/js/app.js'?'.artifacts/lp24449a/baseline-app.js':'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  async function newPage(profile=null){
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    const evidence={errors:[],warnings:[],blockedWrites:[],providerRequests:[],localRequests:[]};
    await context.routeWebSocket('**/*',socket=>socket.close());
    await context.route('**/*',async route=>{
      const req=route.request(),url=req.url();
      if(!['GET','HEAD','OPTIONS'].includes(req.method())){evidence.blockedWrites.push({method:req.method(),url});return route.abort();}
      if(options.fixtureWeather&&url.startsWith('https://api.weather.gov/')){
        const body=url.includes('/points/')?{properties:{forecast:'https://api.weather.gov/gridpoints/TEST/1,1/forecast'}}:url.includes('/forecast')?{properties:{periods:[{number:1,name:'Controlled certification period',isDaytime:true,temperature:75,temperatureUnit:'F',windSpeed:'5 mph',windDirection:'S',shortForecast:'Partly Cloudy',detailedForecast:'Controlled local certification fixture. No live weather claim.'}]}}:{type:'FeatureCollection',features:[]};
        evidence.providerRequests.push({url,method:req.method(),result:'CONTROLLED_HEALTHY_EMPTY_FIXTURE'});return route.fulfill({contentType:'application/geo+json',body:JSON.stringify(body)});
      }
      if(options.fixtureReports&&/\/rest\/v1\//.test(url)){evidence.providerRequests.push({url,method:req.method(),result:'CONTROLLED_EMPTY_REPORT_FIXTURE'});return route.fulfill({contentType:'application/json',body:'[]'});}
      if(url.startsWith(origin)){if(/Crossing-Packages|canonical-crossing|place-presentation/.test(url))evidence.localRequests.push(url.slice(origin.length));return route.continue();}
      const libs=[['leaflet@1.9.4/dist/leaflet.js','leaflet/dist/leaflet.js','text/javascript'],['leaflet@1.9.4/dist/leaflet.css','leaflet/dist/leaflet.css','text/css'],['@supabase/supabase-js@2','@supabase/supabase-js/dist/umd/supabase.js','text/javascript']];
      const lib=libs.find(([needle])=>url.includes(needle));if(lib)return route.fulfill({path:path.join(root,'node_modules',lib[1]),contentType:lib[2]});
      if(/weather\.gov|drivetexas|\/rest\/v1\//.test(url))evidence.providerRequests.push({url:url.replace(/([?&]key=)[^&]+/,'$1[REDACTED]'),method:req.method(),result:'BLOCKED_LOCAL_UNAVAILABLE_SCENARIO'});
      return route.abort();
    });
    await context.addInitScript(profile=>{
      if(profile&&!sessionStorage.getItem('lp24449a-profile-seeded')){
        localStorage.clear();
        Object.entries(profile).forEach(([key,value])=>localStorage.setItem(key,typeof value==='string'?value:JSON.stringify(value)));
        sessionStorage.setItem('lp24449a-profile-seeded','yes');
      }
      localStorage.setItem('gridlyBetaFirstRunWalkthroughCompleteV894C','yes');
      if(profile===null&&!localStorage.getItem('gridlySavedPlacesV1'))localStorage.setItem('gridlySavedPlacesV1',JSON.stringify({version:1,home:{id:'home',label:'Certification saved Home',lat:30.04725,lng:-94.88737,coordinateSource:'geocode',resolutionStatus:'success',validationStatus:'passed'},work:{id:'work',label:'Certification saved Work',lat:30.0505,lng:-94.889,coordinateSource:'geocode',resolutionStatus:'success',validationStatus:'passed'},custom:[],favorites:[]}));
    },profile);
    const page=await context.newPage();page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(60000);
    page.on('pageerror',e=>evidence.errors.push(String(e.stack)));page.on('console',m=>{if(m.type()==='warning')evidence.warnings.push(m.text());});
    await page.goto(origin,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof window.gridlySearchAddress==='function'&&typeof window.gridlyLocalTestReports==='object'&&window.gridlyCanonicalCrossingRuntime?.state?.records&&typeof gridlyGetCurrentAwarenessContext==='function',null,{timeout:60000});
    await page.evaluate(async()=>{await gridlyLoadStatewidePlacePresentation();});
    return {page,context,evidence};
  }
  return {browser,server,origin,newPage,close:async()=>{await browser.close();await new Promise(r=>server.close(r));}};
};
