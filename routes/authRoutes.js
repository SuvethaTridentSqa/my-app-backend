const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ActivityLog = require("../models/ActivityLog");
const { generateCaptcha, verifyCaptcha } = require("../utils/captcha");
const { verifyTokenWithoutExpiry } = require("../middleware/auth");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "6h";

function createSessionToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

function sendToken(res, token) {
  return res.cookie("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 1000 * 60 * 60 * 6,
  });
}

router.get("/captcha", (req, res) => {
  const captcha = generateCaptcha();
  res.json({ id: captcha.id, expression: captcha.expression });
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required." });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "Email is already registered." });
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

    const token = createSessionToken(user);
    sendToken(res, token);
    res.status(201).json({
      message: "Registration successful.",
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to register user.", error: error.message });
  }
});

router.post("/refresh", (req, res) => {
  try {
    const { verifyTokenWithoutExpiry } = require("../middleware/auth");
    const token =
      req.cookies?.session || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        code: "MISSING_AUTH",
        message: "No token provided for refresh.",
      });
    }

    const decoded = verifyTokenWithoutExpiry(token);
    if (!decoded || !decoded.id) {
      return res.status(401).json({
        code: "INVALID_AUTH",
        message: "Invalid token structure. Cannot refresh.",
      });
    }

    const freshToken = createSessionToken({
      _id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    });

    sendToken(res, freshToken);
    res.json({
      message: "Token refreshed successfully.",
      token: freshToken,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to refresh token.",
      error: error.message,
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password, captchaId, captchaAnswer } = req.body;
    if (!email || !password || !captchaId || captchaAnswer == null) {
      return res
        .status(400)
        .json({ message: "Email, password, and captcha are required." });
    }
    if (!verifyCaptcha(captchaId, captchaAnswer)) {
      return res
        .status(400)
        .json({ message: "Math captcha verification failed." });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "password name email role",
    );
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    const matched = await bcrypt.compare(password, user.password);
    if (!matched) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    user.lastLogin = new Date();
    await user.save();
    const token = createSessionToken(user);
    sendToken(res, token);
    await ActivityLog.create({
      user: user._id,
      type: "login",
      action: user.role === "admin" ? "admin_login" : "user_login",
      metadata: { origin: "user" },
    });
    res.json({
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
    res.status(500).json({ message: "Login failed.", error: error.message });
  }
});

router.post("/admin/login", async (req, res) => {
  try {
    const { email, password, captchaId, captchaAnswer } = req.body;
    if (!email || !password || !captchaId || captchaAnswer == null) {
      return res
        .status(400)
        .json({ message: "Email, password, and captcha are required." });
    }
    if (!verifyCaptcha(captchaId, captchaAnswer)) {
      return res
        .status(400)
        .json({ message: "Math captcha verification failed." });
    }
    const user = await User.findOne({
      email: email.toLowerCase(),
      role: "admin",
    }).select("password name email role");
    if (!user) {
      return res
        .status(401)
        .json({ message: "Admin credentials are invalid." });
    }
    const matched = await bcrypt.compare(password, user.password);
    if (!matched) {
      return res
        .status(401)
        .json({ message: "Admin credentials are invalid." });
    }
    user.lastLogin = new Date();
    await user.save();
    const token = createSessionToken(user);
    sendToken(res, token);
    await ActivityLog.create({
      user: user._id,
      role: "admin",
      type: "login",
      action: "admin_login",
      metadata: { origin: "admin" },
    });
    res.json({
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
    res
      .status(500)
      .json({ message: "Admin login failed.", error: error.message });
  }
});

router.post("/logout", async (req, res) => {
  try {
    await ActivityLog.create({
      user: req.user.id,
      role: req.user.role,
      type: "logout",
      action: req.user.role === "admin" ? "admin_logout" : "user_logout",
      metadata: {
        origin: req.user.role,
      },
    });
    res.clearCookie("session", {
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });
    res.json({
      message: "Logged out successfully.",
    });
  } catch (error) {
    res.status(500).json({
      message: "Logout failed.",
      error: error.message,
    });
  }
});

module.exports = router;
