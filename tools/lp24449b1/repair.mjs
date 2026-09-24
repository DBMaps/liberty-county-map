import fs from 'node:fs';import crypto from 'node:crypto';
const file='js/app.js';let app=fs.readFileSync(file,'utf8');
const hash=crypto.createHash('sha256').update(app).digest('hex');if(hash!=='857dc05e8f12786ace4ccded59e7ed582e3438da3f76d65f2fb4d579af6ceb91')throw Error('Unexpected dirty 49B app source');
const edits=[];const change=(old,next)=>{if(app.split(old).length!==2)throw Error('Non-unique repair seam: '+old.slice(0,70));app=app.replace(old,next);edits.push({old,next});};
change('function isGridlyCachedAwarenessSummaryForCurrentArea(summary = {}) {',`function isGridlyCachedAwarenessSummaryForCurrentArea(summary = {}) {
  // Same place does not mean the same active community conditions. A provider
  // publication captured before clear must not reintroduce its former rows.
  if (summary.canonicalCommunityRevision && summary.canonicalCommunityRevision !== gridlyGetCanonicalActiveCommunityState().revision) return false;`);
change('  return {\n    selectedAwarenessArea: getGridlyAwarenessAreaDebugOption(selectedArea),\n    awarenessAreaName,',`  return {
    canonicalCommunityRevision: typeof gridlyGetCanonicalActiveCommunityState === "function" ? gridlyGetCanonicalActiveCommunityState({ selectedArea }).revision : null,
    selectedAwarenessArea: getGridlyAwarenessAreaDebugOption(selectedArea),
    awarenessAreaName,`);
change('  const proposedSummary = gridlyLastAuthoritativeCommunityAwarenessSummary || normalizedPatch.communityAwarenessSummary || publisherAuthoritativeSummary;',`  const summaryCandidates = [gridlyLastAuthoritativeCommunityAwarenessSummary, normalizedPatch.communityAwarenessSummary, publisherAuthoritativeSummary];
  const proposedSummary = summaryCandidates.find((summary) => summary && (!summary.canonicalCommunityRevision || summary.canonicalCommunityRevision === gridlyGetCanonicalActiveCommunityState().revision))
    || (normalizedPatch.communityAwarenessSummary ? buildGridlyCommunityAwarenessIntelligenceSummary() : null);`);
change('function gridlyPublishAuthoritativeCommunityAwarenessSummary(summary, publication = {}) {\n  if (!summary || typeof summary !== "object") return null;',`function gridlyPublishAuthoritativeCommunityAwarenessSummary(summary, publication = {}) {
  if (!summary || typeof summary !== "object") return null;
  if (summary.canonicalCommunityRevision && summary.canonicalCommunityRevision !== gridlyGetCanonicalActiveCommunityState().revision) {
    summary = buildGridlyCommunityAwarenessIntelligenceSummary();
  }`);
fs.writeFileSync(file,app);fs.writeFileSync('reports/lp24449b1/repair.json',JSON.stringify({file,startingSha256:hash,finalSha256:crypto.createHash('sha256').update(app).digest('hex'),edits},null,2)+'\n');
console.log(JSON.stringify({file,edits:edits.length,sha256:crypto.createHash('sha256').update(app).digest('hex')}));
