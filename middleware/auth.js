const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : req.cookies?.session;
    if (!token) {
      return res.status(401).json({
        message: "Authentication token missing.",
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(
      decoded.id || decoded._id || decoded.userId,
    ).select("-password");

    if (!user) {
      return res.status(401).json({
        message: "User not found or token invalid.",
      });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error("[AUTH] Authentication failed:", error);

    return res.status(401).json({
      message:
        "Invalid or corrupted authentication token. Please sign in again.",
    });
  }
};

function verifyTokenWithoutExpiry(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      ignoreExpiration: true,
    });

    return decoded;
  } catch (error) {
    return null;
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Insufficient permissions.",
      });
    }

    return next();
  };
}

module.exports = {
  authenticate,
  authorize,
  verifyTokenWithoutExpiry,
};
