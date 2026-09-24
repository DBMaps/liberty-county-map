// Preserve observation-only timing: read the already-published grouping snapshot,
// never call a grouping/model builder inside the raw timed capture.
import fs from 'node:fs';
const grouped="groupedSnapshot:{generatedAt:gridlyAuthoritativeIncidentSnapshotState.snapshot?.generatedAt,incidents:(gridlyAuthoritativeIncidentSnapshotState.snapshot?.unifiedIncidents||[]).map(r=>({id:r.id,incidentId:r.incidentId,status:r.status,type:r.type})),active:(gridlyAuthoritativeIncidentSnapshotState.snapshot?.activeUnifiedIncidents||[]).map(r=>({id:r.id,incidentId:r.incidentId,status:r.status,type:r.type}))},";
for(const name of ['baseline-replay.mjs','pulse-statewide.mjs']){
 const path=`tools/lp24449b/${name}`;let source=fs.readFileSync(path,'utf8');
 if(source.includes('groupedSnapshot:'))continue;
 const needle=name==='baseline-replay.mjs'?'hazards:activeHazards.map':'hazards:activeHazards.map';
 if(source.split(needle).length!==2)throw Error(`Ambiguous ${name}`);
 source=source.replace(needle,grouped+needle);fs.writeFileSync(path,source);
}
