const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const legacySecret = process.env.JWT_SECRET;
const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || legacySecret ||
  "change_this_secret";
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET ||
  process.env.JWT_REFRESH_SECRET ||
  (legacySecret
    ? crypto
        .createHmac("sha256", legacySecret)
        .update("refresh-token-signing-key")
        .digest("hex")
    : "change_this_secret_refresh");
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_IN =
  process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";

function createAccessToken(payload) {
  return jwt.sign(
    { ...payload, tokenType: "access" },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN },
  );
}

function verifyAccessToken(token, options = {}) {
  const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET, options);
  if (decoded.tokenType && decoded.tokenType !== "access") {
    throw new jwt.JsonWebTokenError("Invalid access token type.");
  }
  return decoded;
}

function createRefreshToken(payload) {
  return jwt.sign(
    {
      ...payload,
      tokenType: "refresh",
      jti: payload.jti || crypto.randomUUID(),
    },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN },
  );
}

function verifyRefreshToken(token, options = {}) {
  const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET, options);
  if (decoded.tokenType !== "refresh") {
    throw new jwt.JsonWebTokenError("Invalid refresh token type.");
  }
  return decoded;
}

module.exports = {
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  JWT_SECRET: ACCESS_TOKEN_SECRET,
  JWT_EXPIRES_IN: ACCESS_TOKEN_EXPIRES_IN,
  createAccessToken,
  verifyAccessToken,
  createRefreshToken,
  verifyRefreshToken,
};
