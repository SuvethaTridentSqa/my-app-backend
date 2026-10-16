const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const User = require("../models/User");
const ActivityLog = require("../models/ActivityLog");
const RefreshSession = require("../models/RefreshSession");
const { generateCaptcha, verifyCaptcha } = require("../utils/captcha");
const router = express.Router();
const {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require("../config/jwt");

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_REPLAY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const refreshCookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  path: "/api/auth",
};

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getRefreshExpiry(token) {
  const decoded = verifyRefreshToken(token);
  return new Date(decoded.exp * 1000);
}

function getTokenExpiry(token, verifyToken) {
  const decoded = verifyToken(token);
  return new Date(decoded.exp * 1000);
}

function sendAccessTokenCookie(res, token) {
  const expiresAt = getTokenExpiry(token, verifyAccessToken);
  return res.cookie("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
  });
}

function setRefreshCookie(res, token, expiresAt) {
  return res.cookie(REFRESH_COOKIE_NAME, token, {
    ...refreshCookieOptions,
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
  });
}

function clearAuthCookies(res) {
  res.clearCookie("session", {
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...refreshCookieOptions,
    secure: process.env.NODE_ENV === "production",
  });
}

function createSessionId() {
  return crypto.randomUUID();
}

async function issueTokens(user, res, sessionId = createSessionId()) {
  const claims = {
    id: user._id,
    email: user.email,
    role: user.role,
    sid: sessionId,
  };
  const accessToken = createAccessToken(claims);
  const refreshToken = createRefreshToken(claims);
  const expiresAt = getRefreshExpiry(refreshToken);

  await RefreshSession.create({
    user: user._id,
    sessionId,
    tokenHash: hashToken(refreshToken),
    status: "active",
    expiresAt,
    purgeAt: new Date(expiresAt.getTime() + REFRESH_REPLAY_RETENTION_MS),
  });
  sendAccessTokenCookie(res, accessToken);
  setRefreshCookie(res, refreshToken, expiresAt);

  return accessToken;
}

router.get("/captcha", (req, res) => {
  try {
    const captcha = generateCaptcha();
    res.status(200).json({
      success: true,
      id: captcha.id,
      expression: captcha.expression,
    });
  } catch (error) {
    console.error("Captcha generation failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to generate captcha.",
    });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required.",
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Email is already registered." });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: "user",
    });

    await ActivityLog.create({
      user: user._id,
      type: "user",
      action: "register",
      metadata: { email: user.email },
    });

    await issueTokens(user, res);
    res.status(201).json({
      success: true,
      message: "Registration successful.",
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to register user.",
      error: error.message,
    });
  }
});

router.post("/refresh", async (req, res) => {
  let storedSession;
  let token;
  try {
    token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) {
      clearAuthCookies(res);
      return res.status(401).json({
        code: "MISSING_AUTH",
        message: "No refresh token provided.",
      });
    }

    const oldTokenHash = hashToken(token);
    storedSession = await RefreshSession.findOne({ tokenHash: oldTokenHash });
    if (!storedSession) {
      clearAuthCookies(res);
      return res.status(401).json({
        code: "INVALID_AUTH",
        message: "Invalid refresh token.",
      });
    }

    if (storedSession.status !== "active") {
      if (storedSession.status === "rotated") {
        await RefreshSession.updateMany(
          { sessionId: storedSession.sessionId, status: "active" },
          { $set: { status: "revoked", revokedAt: new Date() } },
        );
      }
      clearAuthCookies(res);
      return res.status(401).json({
        code: "INVALID_AUTH",
        message: "Refresh token has already been used or revoked.",
      });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (error) {
      if (
        error.name !== "TokenExpiredError" &&
        error.name !== "JsonWebTokenError"
      ) {
        throw error;
      }
      await RefreshSession.updateOne(
        { _id: storedSession._id, status: "active" },
        { $set: { status: "revoked", revokedAt: new Date() } },
      );
      clearAuthCookies(res);
      return res.status(401).json({
        code: "INVALID_AUTH",
        message: "Refresh token is expired or invalid.",
      });
    }

    if (
      !decoded.id ||
      decoded.sid !== storedSession.sessionId ||
      String(decoded.id) !== String(storedSession.user) ||
      storedSession.expiresAt <= new Date()
    ) {
      await RefreshSession.updateOne(
        { _id: storedSession._id, status: "active" },
        { $set: { status: "revoked", revokedAt: new Date() } },
      );
      clearAuthCookies(res);
      return res.status(401).json({
        code: "INVALID_AUTH",
        message: "Refresh token is expired or invalid.",
      });
    }

    const claims = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      sid: storedSession.sessionId,
    };
    const accessToken = createAccessToken(claims);
    const refreshToken = createRefreshToken(claims);
    const newTokenHash = hashToken(refreshToken);
    const expiresAt = getRefreshExpiry(refreshToken);
    const replacement = await RefreshSession.create({
      user: storedSession.user,
      sessionId: storedSession.sessionId,
      tokenHash: newTokenHash,
      status: "active",
      expiresAt,
      purgeAt: new Date(expiresAt.getTime() + REFRESH_REPLAY_RETENTION_MS),
    });
    let rotated;
    try {
      rotated = await RefreshSession.findOneAndUpdate(
        {
          _id: storedSession._id,
          status: "active",
          expiresAt: { $gt: new Date() },
        },
        {
          $set: {
            status: "rotated",
            lastUsedAt: new Date(),
            replacedByHash: newTokenHash,
          },
        },
        { new: true },
      );
    } catch (error) {
      await RefreshSession.deleteOne({ _id: replacement._id });
      throw error;
    }

    if (!rotated) {
      await RefreshSession.deleteOne({ _id: replacement._id });
      await RefreshSession.updateMany(
        { sessionId: storedSession.sessionId, status: "active" },
        { $set: { status: "revoked", revokedAt: new Date() } },
      );
      clearAuthCookies(res);
      return res.status(401).json({
        code: "INVALID_AUTH",
        message: "Refresh token has already been used or revoked.",
      });
    }

    sendAccessTokenCookie(res, accessToken);
    setRefreshCookie(res, refreshToken, expiresAt);
    return res.json({
      success: true,
      message: "Token refreshed successfully.",
      token: accessToken,
    });
  } catch (error) {
    console.error("[AUTH] Token refresh failed:", error);
    if (token) {
      clearAuthCookies(res);
    }
    return res.status(500).json({
      message: "Failed to refresh token.",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password, captchaId, captchaAnswer } = req.body;
    if (!email || !password || !captchaId || captchaAnswer == null) {
      return res.status(400).json({
        success: false,
        message: "Email, password, and captcha are required.",
      });
    }
    if (!verifyCaptcha(captchaId, captchaAnswer)) {
      return res
        .status(400)
        .json({ success: false, message: "Math captcha verification failed." });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "password name email role",
    );
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials." });
    }
    const matched = await bcrypt.compare(password, user.password);
    if (!matched) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials." });
    }
    user.lastLogin = new Date();
    await user.save();
    const token = await issueTokens(user, res);
    await ActivityLog.create({
      user: user._id,
      type: "login",
      action: user.role === "admin" ? "admin_login" : "user_login",
      metadata: { origin: "user" },
    });
    res.json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Login failed.", error: error.message });
  }
});

router.post("/admin/login", async (req, res) => {
  try {
    const { email, password, captchaId, captchaAnswer } = req.body;
    if (!email || !password || !captchaId || captchaAnswer == null) {
      return res.status(400).json({
        success: false,
        message: "Email, password, and captcha are required.",
      });
    }
    if (!verifyCaptcha(captchaId, captchaAnswer)) {
      return res
        .status(400)
        .json({ success: false, message: "Math captcha verification failed." });
    }
    const user = await User.findOne({
      email: email.toLowerCase(),
      role: "admin",
    }).select("password name email role");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Admin credentials are invalid." });
    }
    const matched = await bcrypt.compare(password, user.password);
    if (!matched) {
      return res
        .status(401)
        .json({ success: false, message: "Admin credentials are invalid." });
    }
    user.lastLogin = new Date();
    await user.save();
    const token = await issueTokens(user, res);
    await ActivityLog.create({
      user: user._id,
      role: "admin",
      type: "login",
      action: "admin_login",
      metadata: { origin: "admin" },
    });
    res.json({
      success: true,
      message: "Admin login successful.",
      token,
      admin: {
        id: user._id,
        role: user.role,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Admin login failed.",
      error: error.message,
    });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (token) {
      const session = await RefreshSession.findOne({ tokenHash: hashToken(token) });
      if (session) {
        let role = "user";
        try {
          role = verifyRefreshToken(token, { ignoreExpiration: true }).role || role;
        } catch (error) {
          if (
            error.name !== "TokenExpiredError" &&
            error.name !== "JsonWebTokenError"
          ) {
            throw error;
          }
        }
        await RefreshSession.updateMany(
          { sessionId: session.sessionId, status: "active" },
          { $set: { status: "revoked", revokedAt: new Date() } },
        );
        await ActivityLog.create({
          user: session.user,
          role,
          type: "logout",
          action: role === "admin" ? "admin_logout" : "user_logout",
          metadata: { origin: role },
        });
      }
    }
    clearAuthCookies(res);
    return res.json({
      message: "Logged out successfully.",
    });
  } catch (error) {
    console.error("[AUTH] Logout failed:", error);
    return res.status(500).json({
      message: "Logout failed.",
    });
  }
});

module.exports = router;
