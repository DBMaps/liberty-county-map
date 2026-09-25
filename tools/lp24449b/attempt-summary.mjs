import fs from 'node:fs';
export function summarizeAttempts(directory,sourceHash){
 const files=fs.readdirSync(directory).filter(name=>/^(?:home-progress(?:-\d+)?|search-progress|pulse-statewide-progress).*\.jsonl$/.test(name));
 const rows=files.flatMap(file=>fs.readFileSync(`${directory}/${file}`,'utf8').trim().split('\n').filter(Boolean).map(line=>({...JSON.parse(line),attemptFile:file})));
 const current=rows.filter(row=>row.sourceHash===sourceHash),groups=new Map();
 for(const row of current){const suite=row.attemptFile.startsWith('home')?'Home':row.attemptFile.startsWith('search')?'Search':'Pulse';const key=`${suite}|${row.county_id}|${row.place_geoid}`;const group=groups.get(key)||{suite,county:row.county_id,place:row.place_geoid,attempts:[]};group.attempts.push({file:row.attemptFile,startedAt:row.startedAt,pass:row.pass,error:row.error,runtimeMs:row.runtimeMs});groups.set(key,group);}
 const repeated=[...groups.values()].filter(group=>group.attempts.length>1);
 return {scope:'Persisted Home, Search and statewide Pulse JSONL attempts. Exploratory provider pilots and visual suite invocations are separate logs, not membership retries.',files,recordedAttempts:rows.length,finalAppSourceAttempts:current.length,otherAppSourceAttempts:rows.length-current.length,uniqueFinalSourceCases:groups.size,retriedCases:repeated.length,extraAttempts:repeated.reduce((n,g)=>n+g.attempts.length-1,0),repeated,failedAttempts:current.filter(r=>r.pass===false).map(r=>({file:r.attemptFile,county:r.county_id,place:r.place_geoid,error:r.error,checks:r.checks})),timeoutAttempts:current.filter(r=>/timeout/i.test(r.error||'')).map(r=>({file:r.attemptFile,county:r.county_id,place:r.place_geoid,error:r.error}))};
}
