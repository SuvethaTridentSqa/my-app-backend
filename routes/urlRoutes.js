const express = require("express");
const bcrypt = require("bcrypt");
const QRCode = require("qrcode");
const Url = require("../models/Url");
const RedirectEvent = require("../models/RedirectEvent");
const ActivityLog = require("../models/ActivityLog");
const { authenticate, authorize } = require("../middleware/auth");
const { generateSlug, isSlugValid } = require("../utils/slug");
const { getCache, setCache } = require("../utils/redisClient");

const router = express.Router();
const BASE_URL =
  process.env.BASE_URL || process.env.API_BASE_URL || "http://localhost:5000";
const RESERVED_SLUGS = ["api", "u", "auth", "admin", "health", "status"];

function validateAlias(alias) {
  if (!alias) return true;
  if (RESERVED_SLUGS.includes(alias.toLowerCase())) return false;
  return isSlugValid(alias);
}

router.get("/check-alias/:alias", async (req, res) => {
  const alias = req.params.alias?.trim().toLowerCase();
  if (!alias || !validateAlias(alias)) {
    return res.json({ available: false });
  }
  const existing = await Url.findOne({ slug: alias });
  res.json({ available: !Boolean(existing) });
});

router.post("/", authenticate, async (req, res) => {
  try {
    const { originalUrl, alias, password, expiresAt, title, description } =
      req.body;
    if (!originalUrl) {
      return res.status(400).json({ message: "Original URL is required." });
    }
    if (!validateAlias(alias)) {
      return res
        .status(400)
        .json({ message: "Custom alias is invalid or reserved." });
    }
    const slug = alias ? alias.trim().toLowerCase() : generateSlug();
    const existingSlug = await Url.findOne({ slug });
    if (existingSlug) {
      return res.status(409).json({
        message: "Alias already in use. Choose another custom alias.",
      });
    }
    const urlData = {
      owner: req.user.id,
      originalUrl: originalUrl.trim(),
      slug,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      title: title ? title.trim() : "",
      description: description ? description.trim() : "",
    };
    if (password) {
      urlData.passwordHash = await bcrypt.hash(password.toString(), 10);
    }
    const short = await Url.create(urlData);
    const existingShortUrl = `${BASE_URL.replace(/\/$/, "")}/u/${short.slug}`;
    const qrCode = await QRCode.toDataURL(existingShortUrl);
    await ActivityLog.create({
      user: req.user.id,
      type: "usage",
      action: "create_short_url",
      metadata: { slug: short.slug, originalUrl: short.originalUrl },
    });

    await setCache(
      `shorturl:${short.slug}`,
      JSON.stringify({
        id: short._id,
        originalUrl: short.originalUrl,
        slug: short.slug,
        expiresAt: short.expiresAt,
        passwordProtected: Boolean(short.passwordHash),
      }),
      300,
    );
    //here add activity log
    await ActivityLog.create({
      user: req.user.id,
      type: "usage",
      action: "url_alias",
      metadata: { slug: short.slug, originalUrl: short.originalUrl },
    });
    res.status(201).json({
      message: "Short URL created.",
      shortUrl: existingShortUrl,
      slug: short.slug,
      qrCode,
      createdAt: short.createdAt,
      expiresAt: short.expiresAt,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create short URL.", error: error.message });
  }
});

router.get("/", authenticate, async (req, res) => {
  try {
    const urls = await Url.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(urls);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to load URLs.", error: error.message });
  }
});

router.get("/:slug", authenticate, async (req, res) => {
  try {
    const url = await Url.findOne({
      slug: req.params.slug,
      owner: req.user.id,
    });
    if (!url) {
      return res.status(404).json({ message: "Short URL not found." });
    }
    res.json(url);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to fetch URL details.", error: error.message });
  }
});

router.get("/:slug/analytics", authenticate, async (req, res) => {
  try {
    // console.log("Requested slug:", req.params.slug);
    const urls = await Url.find(
      {},
      {
        slug: 1,
        originalUrl: 1,
        owner: 1,
      },
    );

    // console.log("All URLs:", urls);
    const allUrls = await Url.find(
      {},
      {
        slug: 1,
        originalUrl: 1,
      },
    );

    // console.log("Database URLs:", allUrls);

    const url = await Url.findOne({ slug: req.params.slug });
    // // console.log("Found URL:", url);
    if (!url) {
      return res.status(404).json({ message: "Short URL not found." });
    }

    if (req.user.role !== "admin" && url.owner.toString() !== req.user.id) {
      return res.status(403).json({
        message: "You do not have permission to view analytics for this URL.",
      });
    }

    const events = await RedirectEvent.find({ url: url._id }).sort({
      createdAt: -1,
    });
    const totalClicks = events.length;
    const firstClick = events[0]?.createdAt || null;
    const lastClick = events[events.length - 1]?.createdAt || null;

    const deviceBreakdown = events.reduce((acc, event) => {
      const device = event.device || "unknown";
      acc[device] = (acc[device] || 0) + 1;
      return acc;
    }, {});

    const geography = events.reduce((acc, event) => {
      const location = `${event.country || "unknown"}:${event.city || "unknown"}`;
      acc[location] = (acc[location] || 0) + 1;
      return acc;
    }, {});

    const timeSeries = events.reduce((acc, event) => {
      const bucket = event.createdAt.toISOString().slice(0, 13);
      acc[bucket] = (acc[bucket] || 0) + 1;
      return acc;
    }, {});

    const history = events.map((event) => ({
      timestamp: event.createdAt,
      ip: event.ip,
      device: event.device,
      browser: event.browser,
      country: event.country,
      city: event.city,
      referer: event.referer,
      success: event.success,
    }));

    res.json({
      slug: url.slug,
      originalUrl: url.originalUrl,
      totalClicks,
      firstClick,
      lastClick,
      deviceBreakdown,
      geography,
      timeSeries,
      history,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to load analytics.", error: error.message });
  }
});

router.get(
  "/:slug/usage",
  authenticate,
  authorize("admin"),
  async (req, res) => {
    try {
      const url = await Url.findOne({ slug: req.params.slug });
      if (!url) {
        return res.status(404).json({ message: "Short URL not found." });
      }

      const events = await RedirectEvent.find({ url: url._id }).sort({
        createdAt: -1,
      });
      res.json({ url, events });
    } catch (error) {
      res.status(500).json({
        message: "Failed to load usage history.",
        error: error.message,
      });
    }
  },
);

module.exports = router;
