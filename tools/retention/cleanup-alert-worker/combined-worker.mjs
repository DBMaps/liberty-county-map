import cleanupWorker from './worker.mjs';
import {runSubscriptionMonitor} from './subscription-monitor.mjs';
// REVIEW-ONLY future entrypoint. Current deployed cleanup Worker remains unchanged.
export default {
 fetch:cleanupWorker.fetch,
 async scheduled(controller,env){
  const [cleanup,subscription]=await Promise.allSettled([
   cleanupWorker.scheduled(controller,env),
   runSubscriptionMonitor({env})
  ]);
  // Each branch owns its separate dead-man ping. Neither masks the other.
  if(cleanup.status==='rejected'||subscription.status==='rejected')throw Error('gridly_combined_monitor_run_failed');
 }
};
