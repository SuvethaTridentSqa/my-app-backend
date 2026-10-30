function responseEnvelope(req, res, next) {
  const json = res.json.bind(res);

  res.json = (body) => {
    if (body && typeof body === "object" && !Array.isArray(body)) {
      if (body.success === false || res.statusCode >= 400) {
        const errors = Array.isArray(body.meta?.errors)
          ? body.meta.errors
          : Array.isArray(body.errors)
            ? body.errors
            : [];
        const meta = { ...(body.meta || {}), errors };
        if (body.code) {
          meta.code = body.code;
        }
        return json({
          success: false,
          message: body.message || "Request failed",
          data: null,
          meta,
        });
      }

      const {
        success,
        message,
        data,
        meta,
        pagination,
        ...payload
      } = body;
      return json({
        success: true,
        message: message || "Request completed successfully",
        data:
          success === true && Object.hasOwn(body, "data")
            ? data
            : payload,
        meta: meta ?? pagination ?? null,
      });
    }

    if (res.statusCode >= 400) {
      return json({
        success: false,
        message: "Request failed",
        data: null,
        meta: { errors: [] },
      });
    }

    return json({
      success: true,
      message: "Request completed successfully",
      data: body,
      meta: null,
    });
  };

  next();
}

module.exports = responseEnvelope;
