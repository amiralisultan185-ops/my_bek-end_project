const inquiryService = require('../services/inquiryService');

async function submit(req, res, next) {
  try {
    const inquiry = await inquiryService.createInquiry(req.body, req);
    res.status(201).json({
      message: `Код подтверждения отправлен на ${inquiry.email}`,
      inquiry_id: inquiry.id,
    });
  } catch (err) {
    next(err);
  }
}

async function verify(req, res, next) {
  try {
    const inquiry = await inquiryService.verifyInquiryOTP(req.body.inquiry_id, req.body.code, req);
    res.json({
      message: `Ваша заявка №${inquiry.id} принята. Мы свяжемся с вами в течение 1 рабочего дня.`,
      inquiry_id: inquiry.id,
    });
  } catch (err) {
    next(err);
  }
}

async function resend(req, res, next) {
  try {
    const inquiry = await inquiryService.resendOTP(req.body.inquiry_id);
    res.json({
      message: `Новый код отправлен на ${inquiry.email}`,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  submit,
  verify,
  resend,
};
