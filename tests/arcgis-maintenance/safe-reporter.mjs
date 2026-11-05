// Deliberately excludes assertion values, stacks, raw source, request data and tokens.
import { relative } from 'node:path';
export default async function* report(events) {
  for await (const event of events) {
    if (event.type === 'test:pass') yield JSON.stringify({type:event.data.skip?'skip':'pass',file:relative(process.cwd(),event.data.file || ''),name:event.data.name}) + '\n';
    if (event.type === 'test:fail') {
      const error = event.data.details?.error;
      const cause=error?.cause||error;
      const sqlstate=/^[0-9A-Z]{5}$/.test(cause?.sqlstate||'')?cause.sqlstate:null;
      const safeCodes=new Set(['OWNERSHIP_DENIED','VERSION_CONFLICT','FIXTURE_COMMIT_FAILED','FIXTURE_STORE_BUSY','FIXTURE_STATE_INVALID','FIXTURE_STORE_UNAVAILABLE','FIXTURE_DIRECTORY_REQUIRED','CONFLICTING_CURRENT_PROJECTIONS','STALE_ATTEMPT','INVALID_SCHEDULE','GOVERNED_ROUTE_REQUIRED','INVALID_STORE_SNAPSHOT']);
      const messageCode=safeCodes.has(cause?.message)?cause.message:'ASSERTION_FAILURE';
      const assertionLine=Number((cause?.stack||'').match(/(?:[A-Za-z0-9-]+)\.test\.mjs:(\d+):/)?.[1])||null;
      yield JSON.stringify({ type:'failure', file:relative(process.cwd(),event.data.file || ''), name:event.data.name,
        code:['ERR_TEST_FAILURE','ERR_ASSERTION','OFFLINE_NETWORK_BLOCKED'].includes(error?.code)?error.code:'ASSERTION_FAILURE',messageCode,assertionLine,sqlstate, environment:error?.code === 'OFFLINE_NETWORK_BLOCKED' }) + '\n';
    }
    if (event.type === 'test:summary') yield JSON.stringify({ type:'summary', file:event.data.file || null,
      counts:event.data.counts, durationMs:event.data.duration_ms }) + '\n';
  }
}
