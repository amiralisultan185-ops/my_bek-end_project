const caseService = require('../services/caseService');

async function list(req, res, next) {
  try {
    const result = await caseService.listCases({
      cursor: req.query.cursor,
      limit: parseInt(req.query.limit, 10) || 20,
      status: req.query.status,
      lawyerId: req.query.lawyer_id,
    }, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function detail(req, res, next) {
  try {
    const c = await caseService.getCaseDetail(req.params.case_id, req.user);
    res.json(c);
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const c = await caseService.updateStatus(req.params.case_id, req.body.status, req.user);
    res.json(c);
  } catch (err) {
    next(err);
  }
}

async function reassign(req, res, next) {
  try {
    const c = await caseService.reassignLawyer(
      req.params.case_id,
      req.body.lawyer_id,
      req.body.reason,
      req.user.id
    );
    res.json(c);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  detail,
  updateStatus,
  reassign,
};
