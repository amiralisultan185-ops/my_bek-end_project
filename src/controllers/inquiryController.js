const inquiryService = require('../services/inquiryService');

async function list(req, res, next) {
  try {
    const result = await inquiryService.listInquiries({
      cursor: req.query.cursor,
      limit: parseInt(req.query.limit, 10) || 20,
      status: req.query.status,
      category: req.query.category,
      q: req.query.q,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function detail(req, res, next) {
  try {
    const inquiry = await inquiryService.getInquiryDetail(req.params.inquiry_id);
    res.json(inquiry);
  } catch (err) {
    next(err);
  }
}

async function assign(req, res, next) {
  try {
    const caseRecord = await inquiryService.assignLawyer(
      req.params.inquiry_id,
      req.body.lawyer_id,
      req.user.id,
      req.body.note
    );
    res.status(201).json({
      message: 'Юрист назначен. Дело создано.',
      case_id: caseRecord.id,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  detail,
  assign,
};
