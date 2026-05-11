const jobQueue = require('../services/jobQueue');

async function listEmailJobs(req, res, next) {
  try {
    const items = await jobQueue.listEmailJobs(req.query);
    res.json({
      items,
      pagination: {
        total_returned: items.length,
        limit: Math.min(Number(req.query.limit) || 25, 100),
        next_cursor: null,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getEmailJob(req, res, next) {
  try {
    const job = await jobQueue.getEmailJob(req.params.job_id);
    if (!job) {
      const err = new Error('Job not found');
      err.statusCode = 404;
      err.code = 'not_found';
      throw err;
    }
    res.json(job);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listEmailJobs,
  getEmailJob,
};
