function validate(schema) {
  return async (req, res, next) => {
    try {
      const data = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      req.body = data.body || req.body;
      req.query = data.query || req.query;
      req.params = data.params || req.params;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = validate;
