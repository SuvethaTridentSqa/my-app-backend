const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { JWT_SECRET } = require("../config/jwt");
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    // console.log(
    //   "[AUTH] Authorization header:",
    //   authHeader ? "present" : "missing",
    // );
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header is missing.",
      });
    }
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format.",
      });
    }
    const token = authHeader.substring(7).trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing.",
      });
    }
    if (!process.env.JWT_SECRET) {
      // console.error("[AUTH] JWT_SECRET is not configured.");
      return res.status(500).json({
        success: false,
        message: "Server authentication configuration error.",
      });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // console.log("[AUTH] JWT verified:", {
    //   id: decoded.id,
    //   email: decoded.email,
    //   role: decoded.role,
    // });
    req.user = decoded;
    next();
  } catch (error) {
    // console.error("[AUTH] JWT verification failed:", error.name, error.message);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Authentication token has expired.",
      });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }
    return res.status(401).json({
      success: false,
      message: "Authentication failed.",
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
