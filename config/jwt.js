const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "6h";

module.exports = { JWT_SECRET, JWT_EXPIRES_IN };
