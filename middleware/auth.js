const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : req.cookies?.session;
    if (!token) {
      return res.status(401).json({
        success: false,
        code: "AUTH_TOKEN_MISSING",
        message: "Authentication required.",
      });
    }
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          code: "TOKEN_EXPIRED",
          message: "Your session has expired. Please sign in again.",
        });
      }
      return res.status(401).json({
        success: false,
        code: "TOKEN_INVALID",
        message: "Invalid authentication token.",
      });
    }
    const userId = decoded.id || decoded._id || decoded.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: "TOKEN_INVALID",
        message: "Invalid authentication token.",
      });
    }
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(401).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "User associated with this token was not found.",
      });
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
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
    return jwt.verify(token, JWT_SECRET, {
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
