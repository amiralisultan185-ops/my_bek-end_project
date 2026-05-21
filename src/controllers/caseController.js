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

async function listTasks(req, res, next) {
  try {
    const result = await caseService.listTasks(req.params.case_id, {
      cursor: req.query.cursor,
      limit: parseInt(req.query.limit, 10) || 20,
      status: req.query.status,
    }, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function createTask(req, res, next) {
  try {
    const task = await caseService.createTask(req.params.case_id, req.body, req.user);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
}

async function updateTask(req, res, next) {
  try {
    const task = await caseService.updateTask(req.params.case_id, req.params.task_id, req.body, req.user);
    res.json(task);
  } catch (err) {
    next(err);
  }
}

async function deleteTask(req, res, next) {
  try {
    await caseService.deleteTask(req.params.case_id, req.params.task_id, req.user);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function listDocuments(req, res, next) {
  try {
    const result = await caseService.listDocuments(req.params.case_id, {
      cursor: req.query.cursor,
      limit: parseInt(req.query.limit, 10) || 20,
    }, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function createDocument(req, res, next) {
  try {
    const filename = req.headers['x-filename'];
    if (!filename || Array.isArray(filename)) {
      const err = new Error('Header X-Filename is required');
      err.statusCode = 422;
      err.code = 'validation_error';
      throw err;
    }

    const document = await caseService.createDocument(req.params.case_id, {
      filename,
      mime_type: req.headers['content-type'] || 'application/octet-stream',
      description: req.headers['x-description'] || null,
      file_buffer: req.body,
    }, req.user);
    res.status(201).json(document);
  } catch (err) {
    next(err);
  }
}

async function downloadDocument(req, res, next) {
  try {
    const { document, fileBuffer } = await caseService.getDocumentFile(
      req.params.case_id,
      req.params.document_id,
      req.user
    );
    const safeFilename = document.filename.replace(/["\r\n]/g, '');

    res.setHeader('Content-Type', document.mime_type);
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('X-Content-SHA256', document.sha256_hash || '');
    res.send(fileBuffer);
  } catch (err) {
    next(err);
  }
}

async function listNotes(req, res, next) {
  try {
    const result = await caseService.listNotes(req.params.case_id, {
      cursor: req.query.cursor,
      limit: parseInt(req.query.limit, 10) || 20,
    }, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function createNote(req, res, next) {
  try {
    const note = await caseService.createNote(req.params.case_id, req.body, req.user);
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  detail,
  updateStatus,
  reassign,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  listDocuments,
  createDocument,
  downloadDocument,
  listNotes,
  createNote,
};
