const config = require('../config');
const jobQueue = require('../services/jobQueue');
const emailService = require('../services/emailService');

let stopped = false;

async function processJob(job) {
  job.status = 'processing';
  job.attempts += 1;
  await jobQueue.updateEmailJob(job);

  try {
    const result = await emailService.deliverEmail(job.payload);
    job.status = 'completed';
    job.result = { messageId: result.messageId };
    job.last_error = null;
    await jobQueue.updateEmailJob(job);
  } catch (err) {
    job.last_error = err.message;
    job.status = job.attempts >= job.max_attempts ? 'failed' : 'queued';
    await jobQueue.updateEmailJob(job);

    if (job.status === 'queued') {
      await jobQueue.requeueEmailJob(job.id);
    }
  }
}

async function runEmailWorker() {
  if (!config.emailWorkerEnabled) return;
  console.log('Email worker started');

  while (!stopped) {
    const jobId = await jobQueue.popEmailJobId(5);
    if (!jobId) continue;

    const job = await jobQueue.getEmailJob(jobId);
    if (!job || job.status !== 'queued') continue;

    await processJob(job);
  }
}

function stopEmailWorker() {
  stopped = true;
}

module.exports = {
  runEmailWorker,
  stopEmailWorker,
};
