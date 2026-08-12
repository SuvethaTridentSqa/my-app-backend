const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";

function authenticate(req, res, next) {
  const token =
    req.cookies?.session || req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res
      .status(401)
      .json({
        message:
          "Authentication token missing.So Kindly Signin Again and Try Again.",
      });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Invalid or expired authentication token." });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
