const authService = require('../services/authService');

async function register(req, res, next) {
  try {
    const user = await authService.registerDirector(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

async function registerClient(req, res, next) {
  try {
    const result = await authService.registerClient(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const user = await authService.verifyEmail(req.body);
    res.json({ message: 'Email verified', user });
  } catch (err) {
    next(err);
  }
}

async function resendEmailVerification(req, res, next) {
  try {
    const result = await authService.resendEmailVerification(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function requestPasswordReset(req, res, next) {
  try {
    const result = await authService.requestPasswordReset(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    await authService.resetPasswordWithCode(req.body);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body, req);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const result = await authService.refresh(req.body.refresh_token);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.body.refresh_token);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  registerClient,
  verifyEmail,
  resendEmailVerification,
  requestPasswordReset,
  resetPassword,
  login,
  refresh,
  logout,
};
