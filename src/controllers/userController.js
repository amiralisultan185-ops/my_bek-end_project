const userService = require('../services/userService');

async function list(req, res, next) {
  try {
    const items = await userService.getWorkloadDashboard();
    res.json({
      items,
      pagination: {
        total_returned: items.length,
        limit: items.length,
        next_cursor: null,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function listAll(req, res, next) {
  try {
    const result = await userService.listAllUsers(req.query);
    res.json({
      items: result.items.map(user => ({
        ...user,
        groups: user.group_memberships.map(item => item.group),
        group_memberships: undefined,
      })),
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const result = await userService.createUser(req.body, req.user);
    res.status(201).json(result.user);
  } catch (err) {
    next(err);
  }
}

async function createBulk(req, res, next) {
  try {
    const result = await userService.createUsers(req.body, req.user);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function deactivate(req, res, next) {
  try {
    const user = await userService.deactivateLawyer(req.params.user_id, req.user.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function makeDirector(req, res, next) {
  try {
    const user = await userService.makeDirector(req.params.user_id, req.user.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const result = await userService.resetUserPassword(req.params.user_id, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    res.json({
      id: req.user.id,
      full_name: req.user.full_name,
      role: req.user.role,
      email: req.user.email,
      phone: req.user.phone,
      is_active: req.user.is_active,
    });
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const user = await userService.updateProfile(req.user.id, req.body);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  listAll,
  create,
  createBulk,
  deactivate,
  makeDirector,
  resetPassword,
  me,
  updateMe,
};
