const nodemailer = require('nodemailer');
const config = require('../config');
const jobQueue = require('./jobQueue');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: config.smtpUser && config.smtpPassword
        ? { user: config.smtpUser, pass: config.smtpPassword }
        : undefined,
    });
  }
  return transporter;
}

async function deliverEmail({ to, subject, text, html }) {
  if (!config.isProduction && (!config.smtpUser || !config.smtpPassword || config.smtpHost === 'smtp.example.com')) {
    console.log(`[MOCK EMAIL]\nTo: ${to}\nSubject: ${subject}\nText: ${text?.substring(0, 500)}\n`);
    return { messageId: `mock-${Date.now()}` };
  }

  return getTransporter().sendMail({
    from: config.emailFrom,
    to,
    subject,
    text,
    html,
  });
}

async function sendEmail(message) {
  if (config.emailQueueEnabled) {
    const job = await jobQueue.enqueueEmailJob({
      ...message,
      max_attempts: config.emailJobMaxAttempts,
    });
    return { queued: true, job_id: job.id };
  }

  return deliverEmail(message);
}

async function sendOTPEmail(email, code) {
  return sendEmail({
    to: email,
    subject: 'POWER LAW Digital verification code',
    text: `Your POWER LAW Digital verification code is ${code}. It expires in ${config.otpTtlMinutes} minutes.`,
    html: `<p>Your POWER LAW Digital verification code is <strong>${code}</strong>.</p><p>It expires in ${config.otpTtlMinutes} minutes.</p>`,
  });
}

async function sendUserVerificationEmail(email, code) {
  return sendEmail({
    to: email,
    subject: 'Verify your POWER LAW Digital account',
    text: `Your POWER LAW Digital account verification code is ${code}. It expires in ${config.emailVerificationTtlMinutes} minutes.`,
    html: `<p>Your POWER LAW Digital account verification code is <strong>${code}</strong>.</p><p>It expires in ${config.emailVerificationTtlMinutes} minutes.</p>`,
  });
}

async function sendPasswordResetEmail(email, code) {
  return sendEmail({
    to: email,
    subject: 'Reset your POWER LAW Digital password',
    text: `Your POWER LAW Digital password reset code is ${code}. It expires in ${config.passwordResetTtlMinutes} minutes.`,
    html: `<p>Your POWER LAW Digital password reset code is <strong>${code}</strong>.</p><p>It expires in ${config.passwordResetTtlMinutes} minutes.</p>`,
  });
}

async function sendInquiryConfirmation(email, inquiryId) {
  return sendEmail({
    to: email,
    subject: 'Your POWER LAW Digital inquiry was received',
    text: `Your inquiry ${inquiryId} was received. We will contact you within one business day.`,
  });
}

async function sendDirectorNotification(inquiry) {
  return sendEmail({
    to: 'director@example.invalid',
    subject: 'New POWER LAW Digital inquiry',
    text: `New inquiry from ${inquiry.full_name} (${inquiry.category}).`,
  });
}

async function sendAssignmentNotification(lawyerEmail, clientName) {
  return sendEmail({
    to: lawyerEmail,
    subject: 'New case assigned in POWER LAW Digital',
    text: `A new case was assigned to you for client: ${clientName}.`,
  });
}

module.exports = {
  sendEmail,
  deliverEmail,
  sendOTPEmail,
  sendUserVerificationEmail,
  sendPasswordResetEmail,
  sendInquiryConfirmation,
  sendDirectorNotification,
  sendAssignmentNotification,
};
