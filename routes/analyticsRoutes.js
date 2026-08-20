const express = require("express");
const Url = require("../models/Url");
const RedirectEvent = require("../models/RedirectEvent");
const { authenticate } = require("../middleware/auth");
const router = express.Router();
const ActivityLog = require("../models/ActivityLog");

function buildAnalytics(events) {
  const totalClicks = events.length;
  const deviceBreakdown = events.reduce((acc, event) => {
    const device = event.device || "unknown";
    acc[device] = (acc[device] || 0) + 1;
    return acc;
  }, {});

  const geography = events.reduce((acc, event) => {
    const key = `${event.country || "unknown"}:${event.city || "unknown"}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const timeSeries = events.reduce((acc, event) => {
    const bucket = event.createdAt.toISOString().slice(0, 13);
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});
  return { totalClicks, deviceBreakdown, geography, timeSeries };
}

router.post("/domain", authenticate, async (req, res) => {
  try {
    const { domain, url } = req.body;
    if (!domain && !url) {
      return res.status(400).json({ message: "Domain or url is required." });
    }
    const domainFilter = domain?.trim().toLowerCase();
    let matchRegex = null;
    if (domainFilter) {
      matchRegex = new RegExp(
        `https?://(www\\.)?${domainFilter.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}($|/)", "i"`,
      );
    }
    const urls = await Url.find({
      ...(matchRegex ? { originalUrl: matchRegex } : {}),
      ...(url
        ? {
            originalUrl: new RegExp(
              `^ ${url.trim().replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`,
              "i",
            ),
          }
        : {}),
    });
    if (!urls.length) {
      return res.json({
        urls: [],
        analytics: {
          totalClicks: 0,
          deviceBreakdown: {},
          geography: {},
          timeSeries: {},
        },
      });
    }
    const events = await RedirectEvent.find({
      url: { $in: urls.map((item) => item._id) },
    });
    const analytics = buildAnalytics(events);
    res.json({ urls, analytics });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load domain analytics.",
      error: error.message,
    });
  }
});

router.get("/dashboard", authenticate, async (req, res) => {
  try {
    const urlFilter = req.user.role === "admin" ? {} : { owner: req.user.id };
    const urls = await Url.find(urlFilter, { _id: 1 });
    const urlIds = urls.map((item) => item._id);
    const events = await RedirectEvent.find({
      url: { $in: urlIds },
    }).sort({ createdAt: -1 });
    const analytics = buildAnalytics(events);
    const clickHistory = events.map((event) => ({
      clickedAt: event.createdAt,
      device: event.device || "unknown",
      browser: event.browser || "unknown",
      country: event.country || "unknown",
      city: event.city || "unknown",
      ip: event.ip || "unknown",
      referer: event.referer || "direct",
      success: event.success,
    }));
    res.json({ analytics, events: clickHistory });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load dashboard analytics.",
      error: error.message,
    });
  }
});

function normalizeUrl(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}
router.get("/url", authenticate, async (req, res) => {
  try {
    // console.log("RAW SEARCH:", req.query.search);
    const allUrls = await Url.find(
      {},
      {
        slug: 1,
        originalUrl: 1,
        owner: 1,
      },
    );
    // console.log("DATABASE URLS:");
    // console.log(allUrls);
    const search = req.query.search?.trim();
    if (!search) {
      return res.status(400).json({
        message: "Search value is required.",
      });
    }
    // console.log("Search parameter:", search);
    const normalizeUrl = (value = "") => {
      return value
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/$/, "");
    };
    const normalizedSearch = normalizeUrl(search);
    const urls = await Url.find();
    const url = urls.find((item) => {
      return (
        item.slug.toLowerCase() === normalizedSearch ||
        normalizeUrl(item.originalUrl) === normalizedSearch
      );
    });
    await ActivityLog.create({
      user: req.user._id,
      type: "usage",
      action: "url_analytics",
    });
    // console.log("URL Analytics activity log added:", url);
    if (!url) {
      return res.status(404).json({
        message: "URL not found.",
      });
    }
    if (req.user.role !== "admin" && url.owner.toString() !== req.user.id) {
      return res.status(403).json({
        message: "Access denied.",
      });
    }
    const events = await RedirectEvent.find({
      url: url._id,
    }).sort({ createdAt: -1 });
    const analytics = buildAnalytics(events);
    const clickHistory = events.map((event) => ({
      clickedAt: event.createdAt,
      device: event.device || "unknown",
      browser: event.browser || "unknown",
      country: event.country || "unknown",
      city: event.city || "unknown",
      ip: event.ip || "unknown",
      referer: event.referer || "direct",
    }));
    res.json({
      url,
      analytics,
      events: clickHistory,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to load URL analytics.",
      error: error.message,
    });
  }
});

module.exports = router;
