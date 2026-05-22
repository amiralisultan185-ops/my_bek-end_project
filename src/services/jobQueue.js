const { v4: uuidv4 } = require('uuid');
const redis = require('../utils/redis');

const QUEUE_KEY = redis.key('jobs:email:queue');
const JOB_KEY_PREFIX = 'jobs:email:job';

function jobKey(jobId) {
  return redis.key(`${JOB_KEY_PREFIX}:${jobId}`);
}

async function enqueueEmailJob(payload) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const job = {
    id,
    type: 'email',
    status: 'queued',
    attempts: 0,
    max_attempts: payload.max_attempts || 3,
    payload,
    created_at: now,
    updated_at: now,
    last_error: null,
  };

  await redis.set(jobKey(id), JSON.stringify(job));
  await redis.lpush(QUEUE_KEY, id);
  return job;
}

async function getEmailJob(jobId) {
  const raw = await redis.get(jobKey(jobId));
  return raw ? JSON.parse(raw) : null;
}

async function updateEmailJob(job) {
  job.updated_at = new Date().toISOString();
  await redis.set(jobKey(job.id), JSON.stringify(job));
  return job;
}

async function listEmailJobs({ status, limit = 25 } = {}) {
  const keys = [];
  let cursor = '0';
  do {
    const result = await redis.scan(cursor, 'MATCH', redis.key(`${JOB_KEY_PREFIX}:*`), 'COUNT', 100);
    cursor = result[0];
    keys.push(...result[1]);
  } while (cursor !== '0');

  const jobs = [];

  for (const key of keys) {
    try {
      const raw = await redis.get(key);
      if (!raw) continue;
      const job = JSON.parse(raw);
      if (!status || job.status === status) jobs.push(job);
    } catch (err) {
      console.error(`Skipping unreadable email job key ${key}:`, err.message);
    }
  }

  return jobs
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, Math.min(Number(limit) || 25, 100));
}

async function popEmailJobId(timeoutSeconds = 5) {
  const result = await redis.brpop(QUEUE_KEY, timeoutSeconds);
  return result?.[1] || null;
}

async function requeueEmailJob(jobId) {
  await redis.lpush(QUEUE_KEY, jobId);
}

module.exports = {
  enqueueEmailJob,
  getEmailJob,
  updateEmailJob,
  listEmailJobs,
  popEmailJobId,
  requeueEmailJob,
};
