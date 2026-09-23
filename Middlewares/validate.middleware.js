const validate = (schema) => async (req, res, next) => {
  try {
    const parsed = await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params
    });

    req.body = parsed.body || req.body;
    req.query = parsed.query || req.query;
    req.params = parsed.params || req.params;

    next();
  } catch (error) {
    if (error.name === "ZodError" || error.issues) {
      const details = (error.issues || []).map((issue) => ({
        field: issue.path.join(".").replace(/^body\.|^query\.|^params\./, ""),
        message: issue.message
      }));

      return res.status(400).json({
        error: "Validation failed",
        details
      });
    }
    next(error);
  }
};

module.exports = validate;
