const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/jwt");
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization header is missing.",
      });
    }
    const token = authHeader.substring(7).trim();
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      ...decoded,
      _id: decoded.id,
    };
    next();
  } catch (error) {
    console.error("[AUTH] Authentication error:", error);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Authentication token has expired.",
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token.",
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: "NOT_AUTHENTICATED",
        message: "Authentication required.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "You do not have permission to perform this action.",
      });
    }
    next();
  };
};

function verifyTokenWithoutExpiry(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      ignoreExpiration: true,
    });
  } catch {
    return null;
  }
}

module.exports = {
  authenticate,
  authorize,
  verifyTokenWithoutExpiry,
};
