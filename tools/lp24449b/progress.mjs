import fs from 'node:fs';import crypto from 'node:crypto';
const hash=crypto.createHash('sha256').update(fs.readFileSync('js/app.js')).digest('hex');
const lines=f=>fs.existsSync(f)?fs.readFileSync(f,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const homes=[...new Map([0,1].flatMap(i=>lines(`.artifacts/lp24449b/home-progress-${i}.jsonl`)).filter(r=>r.sourceHash===hash).map(r=>[`${r.county_id}|${r.place_geoid}`,r])).values()];
const search=lines('.artifacts/lp24449b/search-progress.jsonl');
const ring=[0,1].flatMap(i=>lines(`.artifacts/lp24449b/transitions-progress-${i}.jsonl`)).filter(r=>r.sourceHash===hash);
const result={updatedAt:new Date().toISOString(),sourceHash:hash,home:{target:793,completed:homes.filter(r=>!r.error).length,passed:homes.filter(r=>r.pass).length,remaining:793-homes.filter(r=>!r.error).length,failed:homes.filter(r=>!r.pass).map(r=>({county:r.county_id,place:r.place_geoid,error:r.error,checks:r.checks}))},search:{target:2058,completed:search.length,passed:search.filter(r=>r.pass).length},crossCounty:{target:254,completed:ring.length,passed:ring.filter(r=>r.pass).length},queues:[0,1].map(i=>fs.existsSync(`reports/lp24449b/queue-${i}.json`)?JSON.parse(fs.readFileSync(`reports/lp24449b/queue-${i}.json`)):{shard:i,waitingForHome:!fs.existsSync(`reports/lp24449b/home-browser-results-${i}.json`),firstQueuedSuitePendingResult:fs.existsSync(`reports/lp24449b/home-browser-results-${i}.json`)})};
fs.writeFileSync('reports/lp24449b/progress.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
