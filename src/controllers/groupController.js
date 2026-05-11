const groupService = require('../services/groupService');

async function list(req, res, next) {
  try {
    const items = await groupService.listGroups({ type: req.query.type });
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

async function create(req, res, next) {
  try {
    const group = await groupService.createGroup(req.body, req.user.id);
    res.status(201).json(group);
  } catch (err) {
    next(err);
  }
}

async function addMember(req, res, next) {
  try {
    const membership = await groupService.addUserToGroup(
      req.params.group_id,
      req.body.user_id,
      req.user.id
    );
    res.status(201).json(membership);
  } catch (err) {
    next(err);
  }
}

async function addCase(req, res, next) {
  try {
    const caseGroup = await groupService.addCaseToGroup(
      req.params.group_id,
      req.body.case_id,
      req.user.id
    );
    res.status(201).json(caseGroup);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  create,
  addMember,
  addCase,
};
