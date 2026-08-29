// Bull(MQ)-backed delayed job for the "offline >2min" edge case in §4:
// scheduled on every socket disconnect, cancelled on reconnect. jobId is
// deterministic (`${dashId}:${userId}`) so cancelling is a lookup, not a scan.
import { Queue } from 'bullmq';
import { config } from '../config.js';

const connection = { url: config.redisUrl, maxRetriesPerRequest: null };

export const disconnectQueue = new Queue('dash-disconnect-grace', { connection });

function jobId(dashId, userId) {
  return `${dashId}:${userId}`;
}

export async function scheduleOfflineJob(dashId, userId) {
  await disconnectQueue.add(
    'offline-grace-expired',
    { dashId, userId },
    { jobId: jobId(dashId, userId), delay: config.offlineGraceMs, removeOnComplete: true, removeOnFail: true }
  );
}

export async function cancelOfflineJob(dashId, userId) {
  const job = await disconnectQueue.getJob(jobId(dashId, userId));
  if (job) await job.remove();
}
